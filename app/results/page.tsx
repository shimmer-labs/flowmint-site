"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
  const analysisId = searchParams.get("id");

  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Email generation states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecommendation | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("klaviyo");
  const [selectedFormat, setSelectedFormat] = useState<"html" | "plain">("html");
  const [generating, setGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

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
      setLoading(false);
    } else {
      setError("Analysis not found. Please try again.");
      setLoading(false);
    }
  }, [analysisId]);

  const handleOpenModal = (flow: FlowRecommendation) => {
    setSelectedFlow(flow);
    setShowEmailModal(true);
    setGenerating(false);
    setGeneratedEmail(null);
    setSelectedPlatform("klaviyo");
    setSelectedFormat("html");
  };

  const handleStartGeneration = async () => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <button
            onClick={() => router.push("/")}
            className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            &larr; Analyze Another Site
          </button>
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

        {/* Recommended Flows */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Recommended Email Flows</h2>
          <p className="text-lg text-gray-600 mb-6">Top flows recommended for your business</p>

          <div className="grid md:grid-cols-3 gap-6">
            {analysis.recommendedFlows.map((flow, index) => (
              <div
                key={flow.id}
                className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 border-2 ${
                  index === 0
                    ? "border-mint-500 ring-4 ring-mint-50"
                    : "border-gray-200 hover:border-mint-400"
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
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
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{flow.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{flow.emailCount} emails</span>
                  </div>
                </div>
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">{flow.description}</p>
                <button
                  className={`w-full font-medium py-3 px-4 rounded-lg transition-all duration-200 ${
                    index === 0
                      ? "bg-mint-600 text-white hover:bg-mint-700 shadow-sm hover:shadow-md"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                  onClick={() => handleOpenModal(flow)}
                >
                  Generate Email {index === 0 ? " \u2192" : ""}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Business Overview */}
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

          {/* Brand Voice */}
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

        {/* CTA */}
        <div className="bg-gradient-to-br from-mint-600 to-mint-800 rounded-2xl p-12 text-center text-white shadow-xl">
          <h2 className="text-4xl font-bold mb-4">Want all your email flows?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Upgrade to export complete flows with platform-ready templates. One-time purchase, no monthly fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/#pricing" className="bg-white text-mint-700 font-semibold py-4 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              View Pricing
            </a>
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

      {/* Email Generation Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedFlow?.name}</h3>
                <p className="text-sm text-gray-600 mt-1">Email #1 of {selectedFlow?.emailCount}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-8 py-6">
              {/* Platform + Format Selection */}
              {!generating && !generatedEmail && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Select Your Email Platform</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {PLATFORMS.map((platform) => (
                        <button
                          key={platform.id}
                          onClick={() => setSelectedPlatform(platform.id)}
                          className={`px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                            selectedPlatform === platform.id
                              ? "bg-mint-600 text-white ring-2 ring-mint-300"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {platform.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Email Format</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedFormat("html")}
                        className={`px-6 py-4 rounded-lg font-medium transition-all duration-200 text-left ${
                          selectedFormat === "html"
                            ? "bg-mint-600 text-white ring-2 ring-mint-300"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <div className="font-semibold">HTML</div>
                        <div className="text-xs mt-1 opacity-90">Rich formatting with links and styles</div>
                      </button>
                      <button
                        onClick={() => setSelectedFormat("plain")}
                        className={`px-6 py-4 rounded-lg font-medium transition-all duration-200 text-left ${
                          selectedFormat === "plain"
                            ? "bg-mint-600 text-white ring-2 ring-mint-300"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <div className="font-semibold">Plain Text</div>
                        <div className="text-xs mt-1 opacity-90">Simple text, higher deliverability</div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleStartGeneration}
                      className="w-full bg-mint-600 text-white font-semibold py-4 px-6 rounded-lg hover:bg-mint-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      Generate Email &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Generating State */}
              {generating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium text-gray-900 mb-2">Generating your email...</p>
                  <p className="text-sm text-gray-600">This usually takes 10-20 seconds</p>
                </div>
              )}

              {/* Generated Email */}
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
                    className="w-full bg-mint-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-mint-700 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {copySuccess ? (
                      <><span>&#10003;</span> Copied!</>
                    ) : (
                      "Copy to Clipboard"
                    )}
                  </button>

                  {/* Upgrade CTA */}
                  <div className="bg-gradient-to-r from-mint-50 to-green-50 border-2 border-mint-200 rounded-xl p-6 mt-6">
                    <h4 className="font-bold text-gray-900 mb-2">Want all {selectedFlow?.emailCount} emails in this flow?</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Upgrade to Complete ($99 one-time) to generate all flows and export directly to {PLATFORMS.find(p => p.id === selectedPlatform)?.name || selectedPlatform}.
                    </p>
                    <a href="/#pricing" className="block w-full bg-mint-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-mint-700 transition-colors shadow-sm text-center">
                      View Pricing &rarr;
                    </a>
                  </div>
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
