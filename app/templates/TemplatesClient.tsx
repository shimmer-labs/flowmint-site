"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  canExportFlowClient,
  canExportAllClient,
  hasAnyPurchaseClient,
  hasFullCampaignClient,
  getPlanLabel,
} from "@/app/lib/plan-gating-client";
import type { Purchase } from "@/app/lib/stripe";
import { analytics } from "@/app/lib/analytics";

interface EmailTemplate {
  id: string;
  flow_id: string;
  flow_name: string;
  email_number: number;
  subject: string;
  preheader: string;
  body: string;
  platform: string;
  format: string;
  analysis_id: string | null;
  created_at: string;
}

interface Props {
  user: { email: string; name?: string };
  templates: EmailTemplate[];
  purchases: Purchase[];
  isUnlimited: boolean;
}

interface FlowGroup {
  flowId: string;
  flowName: string;
  platform: string;
  analysisId: string | null;
  templates: EmailTemplate[];
}

export default function TemplatesClient({ user, templates, purchases, isUnlimited }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useAuth();
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [exportingFlow, setExportingFlow] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  // AI Edit state
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Purchase modal state
  const [purchaseModal, setPurchaseModal] = useState<{
    flowId: string;
    flowName: string;
    analysisId: string;
    emailCount: number;
  } | null>(null);
  const [purchaseChoice, setPurchaseChoice] = useState<"single_flow" | "full_campaign">("full_campaign");
  const [purchasing, setPurchasing] = useState(false);

  // Purchase success toast
  const [showPurchaseToast, setShowPurchaseToast] = useState(false);

  useEffect(() => {
    analytics.viewTemplates(templates.length, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const purchased = searchParams.get("purchased");
    if (purchased) {
      setShowPurchaseToast(true);
      // Clean URL
      window.history.replaceState({}, "", "/templates");
      setTimeout(() => setShowPurchaseToast(false), 5000);
    }
  }, [searchParams]);

  const hasPaid = hasAnyPurchaseClient(purchases, isUnlimited);
  const planLabel = getPlanLabel(isUnlimited, purchases.length);

  // Group templates by analysis_id + flow_id
  const flowGroups: FlowGroup[] = [];
  const flowMap = new Map<string, FlowGroup>();

  for (const t of templates) {
    const key = `${t.analysis_id || "legacy"}-${t.flow_id}-${t.platform}`;
    if (!flowMap.has(key)) {
      flowMap.set(key, {
        flowId: t.flow_id,
        flowName: t.flow_name,
        platform: t.platform,
        analysisId: t.analysis_id,
        templates: [],
      });
    }
    flowMap.get(key)!.templates.push(t);
  }

  flowMap.forEach((group) => {
    group.templates.sort((a, b) => a.email_number - b.email_number);
    flowGroups.push(group);
  });

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const canExportThisFlow = (group: FlowGroup) => {
    if (!group.analysisId) return hasPaid; // Legacy templates
    return canExportFlowClient(purchases, isUnlimited, group.analysisId, group.flowId);
  };

  const handleCopy = (template: EmailTemplate) => {
    const text = `Subject: ${template.subject}\nPreheader: ${template.preheader}\n\n${template.body}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(template.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleDownloadHTML = (template: EmailTemplate) => {
    const blob = new Blob([template.body], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.flow_id}-email-${template.email_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFlow = async (group: FlowGroup) => {
    analytics.exportContent('zip_single_flow');
    setExportingFlow(group.flowId);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowIds: [group.flowId],
          analysisId: group.analysisId,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowmint-${group.flowId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export. Please try again.");
    } finally {
      setExportingFlow(null);
    }
  };

  const handleExportAll = async () => {
    analytics.exportContent('zip_all_flows');
    setExportingAll(true);
    try {
      const flowIds = flowGroups.filter((g) => canExportThisFlow(g)).map((g) => g.flowId);
      const analysisId = flowGroups[0]?.analysisId;
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowIds, analysisId }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flowmint-templates.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export. Please try again.");
    } finally {
      setExportingAll(false);
    }
  };

  const handleAIEdit = async (templateId: string) => {
    if (!editPrompt.trim()) return;
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, editPrompt: editPrompt.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI edit failed");
      }
      setEditingTemplate(null);
      setEditPrompt("");
      router.refresh();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!purchaseModal) return;
    analytics.beginCheckout(purchaseChoice, purchaseChoice === 'single_flow' ? 29 : 79);
    setPurchasing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: purchaseChoice,
          analysisId: purchaseModal.analysisId,
          flowId: purchaseChoice === "single_flow" ? purchaseModal.flowId : undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const openPurchaseModal = (group: FlowGroup) => {
    if (!group.analysisId) return;
    setPurchaseModal({
      flowId: group.flowId,
      flowName: group.flowName,
      analysisId: group.analysisId,
      emailCount: group.templates.length,
    });
    setPurchaseChoice("full_campaign");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Purchase success toast */}
      {showPurchaseToast && (
        <div className="fixed top-4 right-4 z-[100] bg-mint-600 text-white px-6 py-3 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2">
          Purchase complete! Your templates are ready to export.
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex items-center gap-6">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/templates" className="text-sm text-mint-600 font-medium">Templates</a>
            <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</a>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              hasPaid ? "bg-mint-100 text-mint-700" : "bg-gray-100 text-gray-600"
            }`}>
              {planLabel}
            </span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Templates</h1>
            <p className="text-gray-600 mt-1">
              {templates.length} template{templates.length !== 1 ? "s" : ""} across {flowGroups.length} flow{flowGroups.length !== 1 ? "s" : ""}
            </p>
          </div>
          {flowGroups.some((g) => canExportThisFlow(g)) && flowGroups.length > 0 && (
            <button
              onClick={handleExportAll}
              disabled={exportingAll}
              className="bg-mint-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50"
            >
              {exportingAll ? "Exporting..." : "Download All as ZIP"}
            </button>
          )}
        </div>

        {/* Empty state */}
        {flowGroups.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-6">
              Analyze a website and generate your email flows to see them here.
            </p>
            <a href="/dashboard" className="inline-block bg-mint-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-mint-700 transition-colors">
              Go to Dashboard
            </a>
          </div>
        )}

        {/* Flow groups */}
        <div className="space-y-6">
          {flowGroups.map((group) => {
            const canExport = canExportThisFlow(group);
            const isExpanded = expandedFlow === `${group.analysisId}-${group.flowId}`;
            const groupKey = `${group.analysisId}-${group.flowId}-${group.platform}`;

            return (
              <div
                key={groupKey}
                className={`bg-white rounded-xl border border-gray-200 overflow-hidden`}
              >
                {/* Flow header */}
                <button
                  onClick={() => setExpandedFlow(isExpanded ? null : `${group.analysisId}-${group.flowId}`)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 text-left">{group.flowName}</h3>
                      <p className="text-sm text-gray-500">
                        {group.templates.length} email{group.templates.length !== 1 ? "s" : ""} &middot; {group.platform}
                      </p>
                    </div>
                    {canExport && (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-mint-100 text-mint-700">
                        Purchased
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {canExport ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleExportFlow(group); }}
                        className="text-sm text-mint-600 hover:text-mint-700 font-medium cursor-pointer"
                      >
                        {exportingFlow === group.flowId ? "Exporting..." : "Download ZIP"}
                      </span>
                    ) : (
                      <span
                        onClick={(e) => { e.stopPropagation(); openPurchaseModal(group); }}
                        className="text-sm text-mint-600 hover:text-mint-700 font-medium cursor-pointer"
                      >
                        Buy to export
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded templates */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {group.templates.map((template) => {
                      const isTemplateExpanded = expandedTemplate === template.id;
                      const showAIEdit = editingTemplate === template.id;

                      return (
                        <div key={template.id} className="border-b border-gray-50 last:border-0">
                          {/* Template row */}
                          <div className="px-6 py-4 flex items-center justify-between">
                            <button
                              onClick={() => setExpandedTemplate(isTemplateExpanded ? null : template.id)}
                              className="flex-1 text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-400 w-6">#{template.email_number}</span>
                                <div>
                                  <div className="font-medium text-gray-900">{template.subject}</div>
                                  <div className="text-sm text-gray-500">{template.preheader}</div>
                                </div>
                              </div>
                            </button>
                            {canExport && (
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => handleCopy(template)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                  {copySuccess === template.id ? "Copied!" : "Copy"}
                                </button>
                                <button
                                  onClick={() => handleDownloadHTML(template)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                  Download
                                </button>
                                {hasAnyPurchaseClient(purchases, isUnlimited) && (
                                  <button
                                    onClick={() => {
                                      setEditingTemplate(showAIEdit ? null : template.id);
                                      setEditPrompt("");
                                      setEditError("");
                                    }}
                                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                  >
                                    AI Edit
                                  </button>
                                )}
                              </div>
                            )}
                            {!canExport && (
                              <button
                                onClick={() => openPurchaseModal(group)}
                                className="text-xs font-medium px-3 py-1.5 rounded-md bg-mint-100 text-mint-700 hover:bg-mint-200 transition-colors ml-4"
                              >
                                Buy to export
                              </button>
                            )}
                          </div>

                          {/* AI Edit inline */}
                          {showAIEdit && (
                            <div className="px-6 pb-4">
                              <div className="bg-purple-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-purple-900 mb-2">
                                  What would you like to change?
                                </label>
                                <textarea
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder='e.g., "Make the CTA more urgent" or "Shorten this email by 50%"'
                                  className="w-full border border-purple-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                                  rows={2}
                                />
                                {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleAIEdit(template.id)}
                                    disabled={editLoading || !editPrompt.trim()}
                                    className="text-xs font-medium px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                  >
                                    {editLoading ? "Editing..." : "Apply Edit"}
                                  </button>
                                  <button
                                    onClick={() => { setEditingTemplate(null); setEditPrompt(""); setEditError(""); }}
                                    className="text-xs font-medium px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expanded email body */}
                          {isTemplateExpanded && (
                            <div className="px-6 pb-4">
                              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
                                {template.format === "html" ? (
                                  <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: template.body }}
                                  />
                                ) : (
                                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900">
                                    {template.body}
                                  </pre>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upgrade CTA for free users */}
        {!hasPaid && flowGroups.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-mint-50 to-green-50 border-2 border-mint-200 rounded-xl p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Your templates are ready to export</h3>
            <p className="text-gray-600 mb-4">
              Purchase access to download, copy, and push templates to your email platform.
            </p>
            <a href="/#pricing" className="inline-block bg-mint-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-mint-700 transition-colors">
              View Pricing
            </a>
          </div>
        )}
      </main>

      {/* Inline Purchase Modal */}
      {purchaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Export Your {purchaseModal.flowName}</h3>
              <button
                onClick={() => setPurchaseModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              {purchaseModal.emailCount} email{purchaseModal.emailCount !== 1 ? "s" : ""} ready for export
            </p>

            {/* Purchase options */}
            <div className="space-y-3 mb-6">
              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  purchaseChoice === "single_flow"
                    ? "border-mint-500 bg-mint-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setPurchaseChoice("single_flow")}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  purchaseChoice === "single_flow" ? "border-mint-600" : "border-gray-300"
                }`}>
                  {purchaseChoice === "single_flow" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-mint-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">This flow only</div>
                  <div className="text-sm text-gray-500">{purchaseModal.flowName}</div>
                </div>
                <div className="font-bold text-gray-900">$29</div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  purchaseChoice === "full_campaign"
                    ? "border-mint-500 bg-mint-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setPurchaseChoice("full_campaign")}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  purchaseChoice === "full_campaign" ? "border-mint-600" : "border-gray-300"
                }`}>
                  {purchaseChoice === "full_campaign" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-mint-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    All flows for this brand
                    <span className="ml-2 text-xs font-bold text-mint-600 bg-mint-100 px-2 py-0.5 rounded-full">BEST VALUE</span>
                  </div>
                  <div className="text-sm text-gray-500">Every flow in this analysis</div>
                </div>
                <div className="font-bold text-gray-900">$79</div>
              </label>
            </div>

            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full bg-mint-600 text-white font-bold py-3 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50"
            >
              {purchasing ? "Redirecting to checkout..." : `Buy & Export Now — $${purchaseChoice === "single_flow" ? "29" : "79"}`}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              One-time payment. No subscription.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
