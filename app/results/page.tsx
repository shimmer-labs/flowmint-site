"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { analytics } from "@/app/lib/analytics";
import { isBetaOpenAccessClient } from "@/app/lib/beta-client";

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
  images?: {
    logo?: string;
    hero?: string;
    products?: string[];
    lifestyle?: string[];
  };
}

interface GeneratedEmail {
  subject: string;
  preheader: string;
  body: string;
  platform: string;
  format: "html" | "plain";
}

// GHL is the default — generated merge fields must match the platform the user
// pushes to, and there's no syntax-conversion layer (see app/utils/platform-syntax.ts).
const PLATFORMS = [
  { id: "ghl", name: "GoHighLevel" },
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
  const beta = isBetaOpenAccessClient();

  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Platform & format selection — default to GHL (locked decision).
  const [selectedPlatform, setSelectedPlatform] = useState("ghl");
  const [selectedFormat, setSelectedFormat] = useState<"html" | "plain">("html");

  // The flow currently in focus: its first email is the instant "wow" sample,
  // and "Generate the rest of this flow" generates the remainder of THIS flow.
  const [activeFlow, setActiveFlow] = useState<FlowRecommendation | null>(null);

  // Single-email "wow" sample (not saved to DB — pure preview via /api/generate-email).
  const [sampleEmail, setSampleEmail] = useState<GeneratedEmail | null>(null);
  const [sampleGenerating, setSampleGenerating] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleNonce, setSampleNonce] = useState(0); // bump to force a re-roll
  const [copySuccess, setCopySuccess] = useState(false);
  const sampleReqId = useRef(0);

  // Batch generation of the rest of the active flow.
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, currentFlow: "" });
  const [batchComplete, setBatchComplete] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
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
      // Auto-pick the top recommended flow as the default sample. No selection
      // required to see the wow.
      setActiveFlow(parsed.analysis.recommendedFlows?.[0] ?? null);
      setLoading(false);
      analytics.viewResults(analysisId!, parsed.analysis.businessModel);
    } else {
      setError("Analysis not found. Please try again.");
      setLoading(false);
    }
  }, [analysisId]);

  // Generate the sample email whenever the focused flow, platform, or format
  // changes (or the user hits Regenerate). A request-id guard prevents a stale
  // response from overwriting a newer one.
  useEffect(() => {
    if (!analysis || !activeFlow) return;
    const reqId = ++sampleReqId.current;
    setSampleGenerating(true);
    setSampleError(null);
    setSampleEmail(null);

    (async () => {
      try {
        const res = await fetch("/api/generate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flow: activeFlow,
            emailNumber: 1,
            brandAnalysis: analysis,
            platform: selectedPlatform,
            format: selectedFormat,
          }),
        });
        if (!res.ok) throw new Error("Failed to generate email");
        const data = await res.json();
        if (reqId === sampleReqId.current) setSampleEmail(data.email);
      } catch (err) {
        console.error("Sample email error:", err);
        if (reqId === sampleReqId.current) setSampleError("Couldn't write the sample email. Hit Regenerate to try again.");
      } finally {
        if (reqId === sampleReqId.current) setSampleGenerating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlow, selectedPlatform, selectedFormat, sampleNonce]);

  // If the analysis was run logged-out and the user has since signed in, claim
  // the orphaned (user_id IS NULL) row so it's tied to their account and shows
  // up on their dashboard. Idempotent server-side.
  useEffect(() => {
    if (!user || !analysisId) return;
    fetch("/api/claim-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId }),
    }).catch(() => {});
  }, [user, analysisId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCopyEmail = () => {
    if (!sampleEmail) return;
    const emailText = `Subject: ${sampleEmail.subject}\n\nPreheader: ${sampleEmail.preheader}\n\n${sampleEmail.body}`;
    navigator.clipboard.writeText(emailText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Generate the remaining emails of the active flow (the committed next step).
  const handleGenerateRest = async () => {
    if (!activeFlow) return;
    setBatchGenerating(true);
    setBatchComplete(false);
    setBatchError(null);
    analytics.generateFlow(activeFlow.id);

    try {
      const res = await fetch("/api/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowIds: [activeFlow.id],
          brandAnalysis: analysis,
          platform: selectedPlatform,
          format: selectedFormat,
          analysisId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) throw new Error("Please sign in to generate and save your flow.");
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setBatchProgress({ completed: 0, total: data.totalEmails, currentFlow: "" });

      const pollStartTime = Date.now();
      const POLL_TIMEOUT_MS = 5 * 60 * 1000;
      let consecutiveErrors = 0;

      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartTime > POLL_TIMEOUT_MS) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatchGenerating(false);
          setBatchError("Generation timed out after 5 minutes. Some emails may still be processing — check your Templates page.");
          return;
        }

        try {
          const statusRes = await fetch(`/api/generation-status?jobId=${data.jobId}`);
          const status = await statusRes.json();
          consecutiveErrors = 0;

          setBatchProgress({
            completed: status.completedEmails,
            total: status.totalEmails,
            currentFlow: status.currentFlow || "",
          });

          if (status.status === "completed" || status.status === "partial") {
            if (pollRef.current) clearInterval(pollRef.current);
            setBatchComplete(true);
            setBatchGenerating(false);
            if (status.status === "partial" && status.errors?.length > 0) {
              setBatchError(`${status.errors.length} email(s) failed to generate. The rest are ready.`);
            }
          } else if (status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setBatchGenerating(false);
            setBatchError(status.errors?.[0] || "Generation failed unexpectedly.");
          }
        } catch {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBatchGenerating(false);
            setBatchError("Lost connection to the server. Check your Templates page — some emails may have been saved.");
          }
        }
      }, 2000);
    } catch (err: any) {
      setBatchGenerating(false);
      setBatchError(err.message || "Failed to start generation. Please try again.");
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

  const images = analysis.images;
  const hasImages = !!(images?.logo || images?.hero);
  const otherFlows = analysis.recommendedFlows.filter((f) => f.id !== activeFlow?.id);
  const restCount = activeFlow ? Math.max(activeFlow.emailCount - 1, 0) : 0;

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
        {/* ============ BRAND CARD (the deliverable — lead with it) ============ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-8">
          <div className="flex items-start gap-4 mb-6">
            {images?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images.logo} alt={`${siteName} logo`} className="w-14 h-14 rounded-lg object-contain border border-gray-200 bg-white flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-mint-100 text-mint-700 font-bold text-xl flex items-center justify-center flex-shrink-0">
                {siteName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-mint-700 bg-mint-50 px-2.5 py-0.5 rounded-full mb-1.5">
                <span>&#10003;</span> We read your brand
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{siteName}</h1>
              <p className="text-gray-600 mt-1">{analysis.valueProposition}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Voice */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Brand voice</div>
              <p className="text-sm text-gray-900 mb-3">
                <span className="capitalize font-medium">{analysis.brandVoice.tone}</span>
                {analysis.brandVoice.style ? <>, <span className="capitalize">{analysis.brandVoice.style}</span></> : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.brandVoice.personality.slice(0, 5).map((trait, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-mint-50 text-mint-700 capitalize font-medium">{trait}</span>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Brand colors</div>
              <div className="flex gap-3">
                {([
                  ["Primary", analysis.brandColors.primary],
                  ["Secondary", analysis.brandColors.secondary],
                  ...(analysis.brandColors.accent ? [["Accent", analysis.brandColors.accent] as [string, string]] : []),
                ] as [string, string][]).map(([label, hex]) => (
                  <div key={label} className="text-center">
                    <div className="w-12 h-12 rounded-lg border border-gray-200 shadow-inner mb-1" style={{ backgroundColor: hex }}></div>
                    <div className="text-[10px] text-gray-500">{label}</div>
                    <div className="text-[10px] font-mono text-gray-700">{hex}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Images we grabbed */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Images from your site</div>
              {hasImages ? (
                <>
                  <div className="flex gap-3">
                    {images?.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images.logo} alt="logo" className="h-12 rounded border border-gray-200 object-contain bg-white" />
                    )}
                    {images?.hero && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images.hero} alt="hero" className="h-12 rounded border border-gray-200 object-cover" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">We&apos;ll use these in your emails.</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No brand images detected — emails will be text-led.</p>
              )}
            </div>
          </div>

          {/* Quiet "what we read" line — never lead with a zero, only show >0 counts */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>Business model: <span className="text-gray-600 font-medium">{analysis.businessModel}</span></span>
            {analysis.sourcesAnalyzed?.productsCount > 0 && <span>Read {analysis.sourcesAnalyzed.productsCount} products</span>}
            {analysis.sourcesAnalyzed?.blogsCount > 0 && <span>Read {analysis.sourcesAnalyzed.blogsCount} blog posts</span>}
            {analysis.sourcesAnalyzed?.hasAboutPage && <span>Read your About page</span>}
          </div>
        </div>

        {/* ============ THE WOW: one email, instantly ============ */}
        {!batchGenerating && !batchComplete && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your first email{activeFlow ? `: ${activeFlow.name}` : ""}</h2>
                <p className="text-gray-600 text-sm">Generated from your brand, ready for {PLATFORMS.find((p) => p.id === selectedPlatform)?.name}.</p>
              </div>
              {/* Compact platform / format controls */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800"
                  aria-label="Email platform"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.id === "ghl" ? `${p.name} (recommended)` : p.name}</option>
                  ))}
                </select>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as "html" | "plain")}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800"
                  aria-label="Format"
                >
                  <option value="html">HTML</option>
                  <option value="plain">Plain text</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-mint-300 shadow-sm overflow-hidden">
              {sampleGenerating ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium text-gray-900">Writing your first email…</p>
                  <p className="text-sm text-gray-500 mt-1">About 10 seconds</p>
                </div>
              ) : sampleError ? (
                <div className="text-center py-12 px-6">
                  <p className="text-gray-700 mb-4">{sampleError}</p>
                  <button onClick={() => setSampleNonce((n) => n + 1)} className="bg-mint-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-mint-700 transition-colors">
                    Regenerate
                  </button>
                </div>
              ) : sampleEmail ? (
                <div>
                  <div className="px-6 py-4 border-b border-gray-100 space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">Subject</span>
                      <p className="font-semibold text-gray-900">{sampleEmail.subject}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">Preheader</span>
                      <p className="text-sm text-gray-600">{sampleEmail.preheader}</p>
                    </div>
                  </div>
                  <div className="px-6 py-5 max-h-[28rem] overflow-y-auto bg-gray-50">
                    {sampleEmail.format === "html" ? (
                      <div className="prose prose-sm max-w-none bg-white rounded-lg p-5 border border-gray-100" dangerouslySetInnerHTML={{ __html: sampleEmail.body }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900">{sampleEmail.body}</pre>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3">
                    <button onClick={handleCopyEmail} className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                      {copySuccess ? <><span>&#10003;</span> Copied!</> : "Copy"}
                    </button>
                    <button onClick={() => setSampleNonce((n) => n + 1)} className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Up next: the rest of this flow as a dimmed roadmap */}
            {restCount > 0 && (
              <div className="mt-5">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Up next in this flow</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: restCount }).map((_, i) => (
                    <div key={i} className="bg-white border border-dashed border-gray-300 rounded-xl p-4 opacity-60">
                      <div className="text-sm font-semibold text-gray-700">Email {i + 2}</div>
                      <div className="text-xs text-gray-400">Generates when you continue</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <div className="mt-6 bg-gradient-to-br from-mint-600 to-mint-800 rounded-2xl p-8 text-center text-white shadow-xl">
              <h3 className="text-2xl font-bold mb-2">Love it? Generate the rest of this flow</h3>
              <p className="opacity-90 mb-5">
                {restCount > 0
                  ? `${restCount} more email${restCount !== 1 ? "s" : ""} in ${activeFlow?.name}`
                  : `${activeFlow?.name} is a single-email flow`}
              </p>
              {user ? (
                <button
                  onClick={handleGenerateRest}
                  disabled={!activeFlow}
                  className="bg-white text-mint-700 font-bold py-4 px-12 rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  Generate the rest of this flow &rarr;
                </button>
              ) : (
                <>
                  <Link
                    href={`/signup?redirectTo=${encodeURIComponent(`/results?id=${analysisId}`)}`}
                    className="inline-block bg-white text-mint-700 font-bold py-4 px-12 rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl text-lg"
                  >
                    Create free account &amp; continue &rarr;
                  </Link>
                  <p className="text-sm mt-4 opacity-75">Free account to save your flow — takes 10 seconds</p>
                </>
              )}
            </div>

            {/* Secondary: pivot to a different flow */}
            {otherFlows.length > 0 && (
              <div className="mt-8">
                <div className="text-sm font-semibold text-gray-700 mb-3">Or start with a different flow</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {otherFlows.map((flow) => (
                    <button
                      key={flow.id}
                      onClick={() => setActiveFlow(flow)}
                      className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-mint-400 hover:ring-2 hover:ring-mint-50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{flow.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          flow.priority === "Critical" ? "bg-red-100 text-red-700" :
                          flow.priority === "High" ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{flow.priority}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{flow.description}</p>
                      <span className="text-xs text-mint-600 font-medium mt-2 inline-block">Generate this flow instead &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ Generating the rest ============ */}
        {batchGenerating && (
          <div className="bg-white rounded-2xl border-2 border-mint-500 p-12 text-center shadow-lg mb-12">
            <div className="inline-block w-16 h-16 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Writing the rest of {activeFlow?.name}</h2>
            <div className="max-w-md mx-auto">
              <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-mint-600 transition-all duration-500 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                >
                  {batchProgress.completed}/{batchProgress.total}
                </div>
              </div>
              {/* Only show the live flow name once it's a real value (never "0"). */}
              {batchProgress.currentFlow && batchProgress.currentFlow !== "0" && (
                <p className="text-gray-600">Writing: <strong>{batchProgress.currentFlow}</strong></p>
              )}
              <button
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setBatchGenerating(false);
                  setBatchError("Generation cancelled. Some emails may have been saved — check your Templates page.");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 mt-4 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {batchError && !batchGenerating && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center mb-12">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 font-medium mb-3">{batchError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setBatchError(null); handleGenerateRest(); }}
                className="bg-mint-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-mint-700 transition-colors"
              >
                Try Again
              </button>
              <a href="/templates" className="bg-white text-gray-700 font-medium py-2 px-6 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                Check Templates
              </a>
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
              {batchProgress.completed} email{batchProgress.completed !== 1 ? "s" : ""} ready in {activeFlow?.name}.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/templates" className="bg-mint-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-mint-700 transition-colors shadow-lg text-lg">
                View &amp; push your templates &rarr;
              </a>
            </div>
            {beta ? (
              <p className="text-sm text-gray-500 mt-6">You&apos;re in the beta — generating, editing, and pushing are all unlocked.</p>
            ) : (
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
                        body: JSON.stringify({ purchaseType: 'single_flow', analysisId, flowId: activeFlow?.id }),
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
            )}
          </div>
        )}
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
