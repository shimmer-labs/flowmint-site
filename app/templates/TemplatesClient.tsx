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
  pushed_at?: string | null;
  pushed_to_platform?: string | null;
  pushed_location_id?: string | null;
  ghl_template_id?: string | null;
}

interface GhlConnection {
  id: string;
  location_id: string;
  location_label: string | null;
}

interface Props {
  user: { email: string; name?: string };
  templates: EmailTemplate[];
  purchases: Purchase[];
  isUnlimited: boolean;
  ghlConnections: GhlConnection[];
  betaOpenAccess: boolean;
}

interface FlowGroup {
  flowId: string;
  flowName: string;
  platform: string;
  analysisId: string | null;
  templates: EmailTemplate[];
}

export default function TemplatesClient({ user, templates, purchases, isUnlimited, ghlConnections, betaOpenAccess }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useAuth();
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

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

  // Push-to-GHL state
  const [ghlPushModal, setGhlPushModal] = useState<{
    flowId: string;
    flowName: string;
    analysisId: string | null;
    templateIds: string[];
  } | null>(null);
  const [ghlPushLocationId, setGhlPushLocationId] = useState<string>(
    ghlConnections[0]?.location_id ?? ""
  );
  const [ghlPushing, setGhlPushing] = useState(false);
  const [ghlPushError, setGhlPushError] = useState("");
  const [ghlPushResult, setGhlPushResult] = useState<{
    flowName: string;
    pushed: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // Connected locations live in state so a just-in-time connect shows up
  // immediately without a page refresh.
  const [connections, setConnections] = useState<GhlConnection[]>(ghlConnections);

  // Just-in-time "Connect to GoHighLevel" state (inside the push modal).
  const [showConnect, setShowConnect] = useState(false);
  const [connectInput, setConnectInput] = useState("");
  const [connectToken, setConnectToken] = useState("");
  const [connectStatus, setConnectStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [connectError, setConnectError] = useState("");
  const [connectedName, setConnectedName] = useState("");

  async function handleConnectGhl() {
    const token = connectToken.trim().replace(/^Bearer\s+/i, "");
    const input = connectInput.trim();
    if (!input || !token) return;
    setConnectStatus("testing");
    setConnectError("");
    try {
      const res = await fetch("/api/settings/ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationInput: input, pitToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't connect to GoHighLevel");
      const conn = data.connection;
      const newConn: GhlConnection = {
        id: conn.id,
        location_id: conn.location_id,
        location_label: conn.location_label,
      };
      setConnections((prev) => [newConn, ...prev.filter((c) => c.location_id !== conn.location_id)]);
      setGhlPushLocationId(conn.location_id);
      setConnectedName(data.locationName || conn.location_label || conn.location_id);
      setConnectStatus("connected");
      setConnectToken("");
      setConnectInput("");
    } catch (err: any) {
      setConnectStatus("failed");
      setConnectError(err.message || "Couldn't connect to GoHighLevel");
    }
  }

  async function handlePushToGhl() {
    if (!ghlPushModal || !ghlPushLocationId) return;
    setGhlPushError("");
    setGhlPushing(true);
    try {
      const res = await fetch("/api/push-to-platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "ghl",
          ghlLocationId: ghlPushLocationId,
          templateIds: ghlPushModal.templateIds,
          analysisId: ghlPushModal.analysisId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Push failed");
      }
      setGhlPushResult({
        flowName: ghlPushModal.flowName,
        pushed: data.pushed ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
      });
      setGhlPushModal(null);
      // Re-fetch so the "Synced" badges reflect the push.
      router.refresh();
      setTimeout(() => setGhlPushResult(null), 8000);
    } catch (err: any) {
      setGhlPushError(err.message || "Push failed");
    } finally {
      setGhlPushing(false);
    }
  }

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
    if (!group.analysisId) {
      alert("These templates need to be regenerated to enable purchasing. Please analyze your brand again and regenerate the flows.");
      return;
    }
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
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-y-3">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/templates" className="text-sm text-mint-600 font-medium">Templates</a>
            <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</a>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              betaOpenAccess ? "bg-amber-100 text-amber-700" : hasPaid ? "bg-mint-100 text-mint-700" : "bg-gray-100 text-gray-600"
            }`}>
              {betaOpenAccess ? "Beta" : planLabel}
            </span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Beta-grace banner */}
        {betaOpenAccess && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
            <div className="text-amber-700 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold text-amber-900">Beta access: push and export are free during testing.</div>
              <div className="text-amber-800 mt-1">We&apos;re still figuring out pricing. Push as much as you want for now. We&apos;ll give you a heads up before any of this turns paid.</div>
            </div>
          </div>
        )}

        {/* GHL not connected banner */}
        {flowGroups.length > 0 && connections.length === 0 && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
            <div className="text-blue-700 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold text-blue-900">No GHL location connected yet.</div>
              <div className="text-blue-800 mt-1">
                <a href="/settings" className="font-medium underline">Add one in Settings</a> and you&apos;ll be able to push templates straight into your GHL email-builder list.
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Templates</h1>
            <p className="text-gray-600 mt-1">
              {templates.length} template{templates.length !== 1 ? "s" : ""} across {flowGroups.length} flow{flowGroups.length !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-gray-400 mt-1">Tap a flow to expand, then any email to preview the full message or AI-edit it.</p>
          </div>
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
            const allSynced = group.templates.every((t) => !!t.pushed_at);
            const someSynced = group.templates.some((t) => !!t.pushed_at);

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
                        {group.templates.length} email{group.templates.length !== 1 ? "s" : ""} &middot; {group.platform === "ghl" ? "GoHighLevel" : group.platform}
                      </p>
                    </div>
                    {canExport && !betaOpenAccess && (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-mint-100 text-mint-700">
                        Purchased
                      </span>
                    )}
                    {allSynced ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Synced to GHL
                      </span>
                    ) : someSynced ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700">
                        Partially synced
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {canExport ? (
                      <>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setGhlPushError("");
                            setShowConnect(connections.length === 0);
                            setConnectStatus("idle");
                            setGhlPushModal({
                              flowId: group.flowId,
                              flowName: group.flowName,
                              analysisId: group.analysisId,
                              templateIds: group.templates.map((t) => t.id),
                            });
                          }}
                          className="inline-flex items-center gap-1.5 text-sm text-mint-600 hover:text-mint-700 font-medium cursor-pointer"
                        >
                          {connections.length > 0 ? "Push to" : "Connect"}
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-ghl-50 text-ghl-700 ring-1 ring-ghl-200">
                            GHL
                          </span>
                          {connections.length > 0 ? null : "to push"}
                        </span>
                      </>
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
                                  <div className="font-medium text-gray-900 flex items-center gap-2">
                                    {template.subject}
                                    {template.pushed_at && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> synced
                                      </span>
                                    )}
                                  </div>
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
          <div className="mt-8 bg-gradient-to-r from-mint-50 to-green-50 border-2 border-mint-200 rounded-xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Your templates are ready to export</h3>
            <p className="text-gray-600 mb-6 text-center">
              Purchase access to download, copy, and push templates to your email platform.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-gray-900">$29</div>
                <div className="text-sm text-gray-500 mb-2">Single Flow</div>
                <div className="text-xs text-gray-400">Export 1 flow for this brand</div>
              </div>
              <div className="bg-white rounded-lg p-4 border-2 border-mint-400 text-center relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-mint-600 bg-mint-100 px-2 py-0.5 rounded-full">BEST VALUE</span>
                <div className="text-2xl font-bold text-gray-900">$79</div>
                <div className="text-sm text-gray-500 mb-2">Full Campaign</div>
                <div className="text-xs text-gray-400">All flows for this brand</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-gray-900">$149<span className="text-sm font-normal">/mo</span></div>
                <div className="text-sm text-gray-500 mb-2">Unlimited</div>
                <div className="text-xs text-gray-400">Unlimited brands & exports</div>
              </div>
            </div>
            <div className="text-center mt-4">
              <p className="text-xs text-gray-500">Click "Buy to export" on any flow above, or <a href="/#pricing" className="text-mint-600 hover:text-mint-700 font-medium">view full pricing details</a></p>
            </div>
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

      {/* Push / Connect to GoHighLevel Modal */}
      {ghlPushModal && (() => {
        const inConnectMode = showConnect || connections.length === 0;
        const closeModal = () => { setGhlPushModal(null); setShowConnect(false); setConnectStatus("idle"); setConnectError(""); };
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900">{inConnectMode ? "Connect to" : "Push to"}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-ghl-50 text-ghl-700 ring-1 ring-ghl-200">
                  GoHighLevel
                </span>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inConnectMode ? (
              /* ---- Just-in-time connect: token + location → live test ---- */
              <div>
                {connectStatus === "connected" ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
                    <div className="flex items-center gap-2 text-green-800 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Connected to {connectedName}
                    </div>
                    <p className="text-sm text-green-700 mt-1">Your token works. You can push your emails now.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Paste a GoHighLevel <strong>Private Integration Token</strong> and your sub-account. We&apos;ll test it against GHL before saving.
                    </p>
                    <details className="mb-4 text-sm">
                      <summary className="cursor-pointer text-mint-700 font-medium">Where do I get a token?</summary>
                      <ol className="list-decimal list-inside text-gray-600 mt-2 space-y-1">
                        <li>In GHL: <strong>Settings → Private Integrations</strong> (enable it in Labs first if you don&apos;t see it).</li>
                        <li>Create an integration called <strong>FlowMint</strong>.</li>
                        <li>Check the scopes <strong>View Locations</strong> and <strong>Edit / Write Emails</strong>.</li>
                        <li>Copy the token &mdash; GHL only shows it once &mdash; and paste it below.</li>
                      </ol>
                    </details>

                    <label className="block text-sm font-medium text-gray-700 mb-1">Your GHL sub-account (URL or location ID)</label>
                    <input
                      value={connectInput}
                      onChange={(e) => setConnectInput(e.target.value)}
                      placeholder="https://app.gohighlevel.com/location/abc123/… or abc123"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-mint-300"
                    />

                    <label className="block text-sm font-medium text-gray-700 mb-1">Private Integration Token</label>
                    <input
                      type="password"
                      value={connectToken}
                      onChange={(e) => setConnectToken(e.target.value.trim())}
                      placeholder="pit-…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-mint-300"
                    />

                    {connectStatus === "failed" && connectError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{connectError}</div>
                    )}

                    <button
                      onClick={handleConnectGhl}
                      disabled={connectStatus === "testing" || !connectInput.trim() || !connectToken.trim()}
                      className="w-full bg-mint-600 text-white font-medium py-3 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50"
                    >
                      {connectStatus === "testing" ? "Testing connection…" : "Test & connect"}
                    </button>
                  </>
                )}

                {connections.length > 0 && (
                  <button
                    onClick={() => setShowConnect(false)}
                    className="w-full mt-3 text-sm font-medium text-mint-600 hover:text-mint-700"
                  >
                    {connectStatus === "connected" ? "Continue to push →" : "Use an existing connection"}
                  </button>
                )}
              </div>
            ) : (
              /* ---- Push to a connected location ---- */
              <>
                <p className="text-sm text-gray-600 mb-5">
                  Push <strong>{ghlPushModal.templateIds.length}</strong> email{ghlPushModal.templateIds.length !== 1 ? "s" : ""} from <strong>{ghlPushModal.flowName}</strong> into a connected GHL location. You&apos;ll wire them into a workflow inside GHL after.
                </p>

                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target location</label>
                  <select
                    value={ghlPushLocationId}
                    onChange={(e) => setGhlPushLocationId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-500"
                  >
                    {connections.map((c) => (
                      <option key={c.id} value={c.location_id}>
                        {c.location_label || c.location_id}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => { setShowConnect(true); setConnectStatus("idle"); setConnectError(""); }}
                  className="text-sm text-mint-600 hover:text-mint-700 font-medium mb-5"
                >
                  + Connect another location
                </button>

                {ghlPushError && <p className="text-red-600 text-sm mb-4">{ghlPushError}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={handlePushToGhl}
                    disabled={ghlPushing || !ghlPushLocationId}
                    className="flex-1 bg-mint-600 text-white font-medium py-3 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50"
                  >
                    {ghlPushing ? "Pushing..." : "Push to GHL"}
                  </button>
                  <button onClick={closeModal} className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
                    Cancel
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Templates land in your GHL email-templates list. You wire them into a workflow manually inside GHL.
                </p>
              </>
            )}
          </div>
        </div>
        );
      })()}

      {/* GHL push success toast */}
      {ghlPushResult && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-mint-200 shadow-lg rounded-xl p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-mint-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-mint-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">
                Pushed {ghlPushResult.pushed} new
                {ghlPushResult.skipped > 0 ? `, ${ghlPushResult.skipped} already synced` : ""}
                {ghlPushResult.failed > 0 ? `, ${ghlPushResult.failed} failed` : ""}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {ghlPushResult.skipped > 0
                  ? `No duplicates created — already-synced emails were skipped. `
                  : ""}
                {ghlPushResult.flowName} lives in your GHL email templates list. Next: wire them into a workflow inside GHL.
              </div>
            </div>
            <button
              onClick={() => setGhlPushResult(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
