"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { analytics } from "@/app/lib/analytics";

interface FlowRecommendation {
  id: string;
  name: string;
  emailCount: number;
  priority: string;
  description: string;
}

interface BrandAnalysis {
  brandVoice: {
    tone: string;
    style: string;
    personality: string[];
    keyPhrases: string[];
  };
  brandColors: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  targetAudience: string;
  valueProposition: string;
  businessModel: string;
  productCategories: string[];
  recommendedFlows: FlowRecommendation[];
  sourcesAnalyzed: {
    productsCount: number;
    blogsCount: number;
    hasAboutPage: boolean;
  };
}

interface GeneratedEmail {
  subject: string;
  preheader: string;
  body: string;
  platform: string;
  format: "html" | "plain";
}

const PLATFORMS = [
  { id: "klaviyo", name: "Klaviyo" },
  { id: "mailchimp", name: "Mailchimp" },
  { id: "customerio", name: "Customer.io" },
  { id: "activecampaign", name: "ActiveCampaign" },
  { id: "omnisend", name: "Omnisend" },
];

function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const analysisId = searchParams.get("id");

  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Platform & format selection
  const [selectedPlatform, setSelectedPlatform] = useState("klaviyo");
  const [selectedFormat, setSelectedFormat] = useState<"html" | "plain">("html");

  // Flow selection for batch generation
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());

  // Single email preview
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Batch generation
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, currentFlow: "" });
  const [batchComplete, setBatchComplete] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!analysisId) {
      setError("No analysis ID provided");
      setLoading(false);
      return;
    }

    const cachedData = sessionStorage.getItem(`analysis-${analysisId}`);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      setAnalysis(parsed.analysis);
      setSiteName(parsed.scrapedData?.siteName || "Your Brand");
      // Pre-select all recommended flows
      const flowIds = new Set<string>(parsed.analysis.recommendedFlows.map((f: FlowRecommendation) => f.id));
      setSelectedFlows(flowIds);
      setLoading(false);
      analytics.viewResults(analysisId!, parsed.analysis.businessModel);
    } else {
      setError("Analysis not found. Please try again.");
      setLoading(false);
    }
  }, [analysisId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toggleFlow = (flowId: string) => {
    setSelectedFlows((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  };

  const handlePreviewEmail = (flow: FlowRecommendation) => {
    setSelectedFlow(flow);
    setShowEmailModal(true);
    setGenerating(false);
    setGeneratedEmail(null);
  };

  const handleStartPreview = async () => {
    if (!selectedFlow) return;
    setGenerating(true);

    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: selectedFlow,
          emailNumber: 1,
          brandAnalysis: analysis,
          platform: selectedPlatform,
          format: selectedFormat,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate email");
      const data = await response.json();
      setGeneratedEmail(data.email);
    } catch (err) {
      console.error("Email generation error:", err);
      alert("Failed to generate email. Please try again.");
      setShowEmailModal(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyEmail = () => {
    if (!generatedEmail) return;
    const emailText = `Subject: ${generatedEmail.subject}\n\nPreheader: ${generatedEmail.preheader}\n\n${generatedEmail.body}`;
    navigator.clipboard.writeText(emailText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const closeModal = () => {
    setShowEmailModal(false);
    setSelectedFlow(null);
    setGeneratedEmail(null);
    setGenerating(false);
    setCopySuccess(false);
  };

  const handleGenerateAll = async () => {
    if (selectedFlows.size === 0) return;
    setBatchGenerating(true);
    setBatchComplete(false);
    selectedFlows.forEach((flowId) => analytics.generateFlow(flowId));

    try {
      // Check if user is logged in (we need userId for storage)
      const res = await fetch("/api/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowIds: Array.from(selectedFlows),
          brandAnalysis: analysis,
          platform: selectedPlatform,
          format: selectedFormat,
          analysisId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        // If user not authenticated, we still generate but won't save
        if (res.status === 401) {
          throw new Error("Please sign in to generate and save your flows.");
        }
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setBatchJobId(data.jobId);
      setBatchProgress({ completed: 0, total: data.totalEmails, currentFlow: "" });

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/generation-status?jobId=${data.jobId}`);
          const status = await statusRes.json();

          setBatchProgress({
            completed: status.completedEmails,
            total: status.totalEmails,
            currentFlow: status.currentFlow || "",
          });

          if (status.status === "completed" || status.status === "partial") {
            if (pollRef.current) clearInterval(pollRef.current);
            setBatchComplete(true);
            setBatchGenerating(false);
          }
        } catch {
          // Polling error, continue
        }
      }, 2000);
    } catch (err: any) {
      setBatchGenerating(false);
      alert(err.message || "Failed to start generation. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-mint-600 text-white px-6 py-3 rounded-lg hover:bg-mint-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalSelectedEmails = analysis.recommendedFlows
    .filter((f) => selectedFlows.has(f.id))
    .reduce((sum, f) => sum + f.emailCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm">
                  Dashboard
                </Link>
                <Link href="/templates" className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm">
                  Templates
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm">
                Log in
              </Link>
            )}
            <button
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
            >
              Analyze Another Site
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Success Banner */}
        <div className="bg-gradient-to-r from-mint-50 to-green-50 border border-mint-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <svg className="w-8 h-8 text-mint-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Analysis Complete for {siteName}!
              </h2>
              <p className="text-gray-700">
                We&apos;ve analyzed your brand and generated personalized flow recommendations based on your business model: <strong>{analysis.businessModel}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Data Sources */}
        {analysis.sourcesAnalyzed && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <span className="text-sm font-medium text-gray-700">Data Sources Analyzed:</span>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-mint-50 rounded-full">
                  <span className="text-mint-600">&#10003;</span>
                  {analysis.sourcesAnalyzed.productsCount} products
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 rounded-full">
                  <span className="text-purple-600">&#10003;</span>
                  {analysis.sourcesAnalyzed.blogsCount} blog posts
                </span>
                {analysis.sourcesAnalyzed.hasAboutPage && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
                    <span className="text-blue-600">&#10003;</span>
                    About page
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Platform & Format Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Email Platform</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      selectedPlatform === platform.id
                        ? "bg-mint-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {platform.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Format</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFormat("html")}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    selectedFormat === "html"
                      ? "bg-mint-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  HTML
                </button>
                <button
                  onClick={() => setSelectedFormat("plain")}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    selectedFormat === "plain"
                      ? "bg-mint-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Plain Text
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Flows */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">Recommended Email Flows</h2>
              <p className="text-gray-600">Select flows to generate, then hit the button below</p>
            </div>
            {selectedFlows.size > 0 && !batchGenerating && !batchComplete && (
              <span className="text-sm text-gray-500">
                {selectedFlows.size} flow{selectedFlows.size !== 1 ? "s" : ""} selected ({totalSelectedEmails} emails)
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {analysis.recommendedFlows.map((flow, index) => {
              const isSelected = selectedFlows.has(flow.id);
              return (
                <div
                  key={flow.id}
                  className={`bg-white rounded-xl p-6 shadow-sm transition-all duration-200 border-2 cursor-pointer ${
                    isSelected
                      ? "border-mint-500 ring-4 ring-mint-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => !batchGenerating && toggleFlow(flow.id)}
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-mint-600 text-white">
                            &#9733; TOP PICK
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          flow.priority === "Critical" ? "bg-red-100 text-red-700" :
                          flow.priority === "High" ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {flow.priority}
                        </span>
                      </div>
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected ? "bg-mint-600 border-mint-600" : "border-gray-300"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{flow.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{flow.emailCount} emails</span>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">{flow.description}</p>
                  <button
                    className="text-sm text-mint-600 hover:text-mint-700 font-medium"
                    onClick={(e) => { e.stopPropagation(); handlePreviewEmail(flow); }}
                  >
                    Preview email &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate All Button / Progress / Complete */}
        {!batchComplete && !batchGenerating && (
          <div className="bg-gradient-to-br from-mint-600 to-mint-800 rounded-2xl p-8 text-center text-white shadow-xl mb-12">
            <h2 className="text-3xl font-bold mb-3">Generate All Selected Flows</h2>
            <p className="text-lg mb-6 opacity-90">
              {selectedFlows.size > 0
                ? `${selectedFlows.size} flow${selectedFlows.size !== 1 ? "s" : ""}, ${totalSelectedEmails} emails for ${PLATFORMS.find((p) => p.id === selectedPlatform)?.name}`
                : "Select flows above to get started"
              }
            </p>
            {user ? (
              <button
                onClick={handleGenerateAll}
                disabled={selectedFlows.size === 0}
                className="bg-white text-mint-700 font-bold py-4 px-12 rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                Generate {totalSelectedEmails} Emails
              </button>
            ) : (
              <Link
                href={`/signup?redirectTo=${encodeURIComponent(`/results?id=${analysisId}`)}`}
                className="inline-block bg-white text-mint-700 font-bold py-4 px-12 rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl text-lg"
              >
                Create Free Account & Generate
              </Link>
            )}
            {!user && (
              <p className="text-sm mt-4 opacity-75">
                Free account required to save your templates — takes 10 seconds
              </p>
            )}
          </div>
        )}

        {batchGenerating && (
          <div className="bg-white rounded-2xl border-2 border-mint-500 p-12 text-center shadow-lg mb-12">
            <div className="inline-block w-16 h-16 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Generating Your Email Flows</h2>
            <div className="max-w-md mx-auto">
              <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-mint-600 transition-all duration-500 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                >
                  {batchProgress.completed}/{batchProgress.total}
                </div>
              </div>
              {batchProgress.currentFlow && (
                <p className="text-gray-600">Currently generating: <strong>{batchProgress.currentFlow}</strong></p>
              )}
              <p className="text-sm text-gray-500 mt-2">This takes about 15-30 seconds per email</p>
            </div>
          </div>
        )}

        {batchComplete && (
          <div className="bg-gradient-to-r from-mint-50 to-green-50 border-2 border-mint-300 rounded-2xl p-12 text-center mb-12">
            <svg className="w-16 h-16 text-mint-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">All done!</h2>
            <p className="text-lg text-gray-600 mb-6">
              {batchProgress.completed} emails generated across {selectedFlows.size} flows.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/templates"
                className="bg-mint-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-mint-700 transition-colors shadow-lg text-lg"
              >
                View Your Templates
              </a>
            </div>
            {/* Purchase CTAs */}
            <div className="mt-8 pt-6 border-t border-mint-200">
              <p className="text-sm text-gray-600 mb-4">Ready to export? Choose a plan:</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    analytics.beginCheckout('single_flow', 29);
                    if (!user) { router.push('/signup'); return; }
                    fetch('/api/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ purchaseType: 'single_flow', analysisId, flowId: Array.from(selectedFlows)[0] }),
                    }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
                  }}
                  className="bg-white text-gray-700 font-semibold py-3 px-6 rounded-lg border-2 border-gray-200 hover:border-mint-300 transition-colors"
                >
                  Single Flow — $29
                </button>
                <button
                  onClick={() => {
                    analytics.beginCheckout('full_campaign', 79);
                    if (!user) { router.push('/signup'); return; }
                    fetch('/api/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ purchaseType: 'full_campaign', analysisId }),
                    }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
                  }}
                  className="bg-mint-700 text-white font-semibold py-3 px-6 rounded-lg hover:bg-mint-800 transition-colors"
                >
                  All Flows — $79 (Best Value)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Brand Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Business Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Business Model</div>
                <div className="text-base font-medium text-gray-900">{analysis.businessModel}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Target Audience</div>
                <div className="text-base text-gray-900">{analysis.targetAudience}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Value Proposition</div>
                <div className="text-base text-gray-900">{analysis.valueProposition}</div>
              </div>
              {analysis.productCategories?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Product Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.productCategories.map((cat, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-sm bg-gray-100 text-gray-700 capitalize">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Brand Voice & Tone</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Tone</div>
                  <div className="text-base font-medium text-gray-900 capitalize">{analysis.brandVoice.tone}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Style</div>
                  <div className="text-base font-medium text-gray-900 capitalize">{analysis.brandVoice.style}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Personality Traits</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.brandVoice.personality.map((trait, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md text-sm bg-mint-50 text-mint-700 capitalize font-medium">{trait}</span>
                  ))}
                </div>
              </div>
              {analysis.brandVoice.keyPhrases?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Key Phrases</div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.brandVoice.keyPhrases.slice(0, 3).map((phrase, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-sm bg-purple-50 text-purple-700">&ldquo;{phrase}&rdquo;</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Brand Colors */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-12">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Brand Colors</h3>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="w-full h-32 rounded-lg border-2 border-gray-200 shadow-inner mb-2" style={{ backgroundColor: analysis.brandColors.primary }}></div>
              <div className="text-sm text-gray-600">Primary</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{analysis.brandColors.primary}</div>
            </div>
            <div className="flex-1">
              <div className="w-full h-32 rounded-lg border-2 border-gray-200 shadow-inner mb-2" style={{ backgroundColor: analysis.brandColors.secondary }}></div>
              <div className="text-sm text-gray-600">Secondary</div>
              <div className="text-sm font-mono font-semibold text-gray-900">{analysis.brandColors.secondary}</div>
            </div>
            {analysis.brandColors.accent && (
              <div className="flex-1">
                <div className="w-full h-32 rounded-lg border-2 border-gray-200 shadow-inner mb-2" style={{ backgroundColor: analysis.brandColors.accent }}></div>
                <div className="text-sm text-gray-600">Accent</div>
                <div className="text-sm font-mono font-semibold text-gray-900">{analysis.brandColors.accent}</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-600">
            &copy; {new Date().getFullYear()} FlowMint. Built by{" "}
            <a href="https://shimmerlabs.co" className="text-mint-600 hover:underline" target="_blank" rel="noopener noreferrer">Shimmer Labs</a>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-gray-900">Privacy</a>
            <a href="/terms" className="hover:text-gray-900">Terms</a>
            <a href="/support" className="hover:text-gray-900">Support</a>
          </div>
        </div>
      </footer>

      {/* Email Preview Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedFlow?.name}</h3>
                <p className="text-sm text-gray-600 mt-1">Email #1 preview (of {selectedFlow?.emailCount})</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-8 py-6">
              {!generating && !generatedEmail && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Preview the first email in this flow</p>
                  <button
                    onClick={handleStartPreview}
                    className="bg-mint-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-mint-700 transition-colors"
                  >
                    Generate Preview
                  </button>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium text-gray-900 mb-2">Generating preview...</p>
                  <p className="text-sm text-gray-600">10-20 seconds</p>
                </div>
              )}

              {generatedEmail && !generating && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Subject Line</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <p className="font-medium text-gray-900">{generatedEmail.subject}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Preheader Text</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <p className="text-gray-700">{generatedEmail.preheader}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Email Body</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
                      {generatedEmail.format === "html" ? (
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: generatedEmail.body }} />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900">{generatedEmail.body}</pre>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyEmail}
                    className="w-full bg-mint-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-mint-700 transition-all flex items-center justify-center gap-2"
                  >
                    {copySuccess ? <><span>&#10003;</span> Copied!</> : "Copy to Clipboard"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-mint-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading results...</p>
          </div>
        </div>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}
