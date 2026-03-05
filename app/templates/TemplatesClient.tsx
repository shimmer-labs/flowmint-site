"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { canExportFlow, canAIEdit, isPaidPlan, getPlanLabel } from "@/app/lib/plan-gating";

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
  created_at: string;
}

interface Props {
  user: { email: string; name?: string };
  templates: EmailTemplate[];
  plan: string;
}

interface FlowGroup {
  flowId: string;
  flowName: string;
  platform: string;
  templates: EmailTemplate[];
}

export default function TemplatesClient({ user, templates, plan }: Props) {
  const router = useRouter();
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

  // Group templates by flow
  const flowGroups: FlowGroup[] = [];
  const flowMap = new Map<string, FlowGroup>();

  for (const t of templates) {
    const key = `${t.flow_id}-${t.platform}`;
    if (!flowMap.has(key)) {
      flowMap.set(key, {
        flowId: t.flow_id,
        flowName: t.flow_name,
        platform: t.platform,
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

  const handleCopy = (template: EmailTemplate) => {
    if (!canExportFlow(plan, template.flow_id)) return;
    const text = `Subject: ${template.subject}\nPreheader: ${template.preheader}\n\n${template.body}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(template.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleDownloadHTML = (template: EmailTemplate) => {
    if (!canExportFlow(plan, template.flow_id)) return;
    const blob = new Blob([template.body], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.flow_id}-email-${template.email_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFlow = async (flowId: string) => {
    if (!canExportFlow(plan, flowId)) return;
    setExportingFlow(flowId);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowIds: [flowId] }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowmint-${flowId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export. Please try again.");
    } finally {
      setExportingFlow(null);
    }
  };

  const handleExportAll = async () => {
    if (!isPaidPlan(plan)) return;
    setExportingAll(true);
    try {
      const flowIds = flowGroups.map((g) => g.flowId);
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowIds }),
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
      // Refresh page to show updated template
      setEditingTemplate(null);
      setEditPrompt("");
      router.refresh();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const planBadge = getPlanLabel(plan);
  const paid = isPaidPlan(plan);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex items-center gap-6">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/templates" className="text-sm text-mint-600 font-medium">Templates</a>
            <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</a>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              paid ? "bg-mint-100 text-mint-700" : "bg-gray-100 text-gray-600"
            }`}>
              {planBadge}
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
          {paid && flowGroups.length > 0 && (
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
            const canExport = canExportFlow(plan, group.flowId);
            const isExpanded = expandedFlow === group.flowId;
            const isLocked = !canExport && paid; // Essentials user, locked flow

            return (
              <div
                key={`${group.flowId}-${group.platform}`}
                className={`bg-white rounded-xl border ${isLocked ? "border-gray-200 opacity-75" : "border-gray-200"} overflow-hidden`}
              >
                {/* Flow header */}
                <button
                  onClick={() => setExpandedFlow(isExpanded ? null : group.flowId)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 text-left">{group.flowName}</h3>
                      <p className="text-sm text-gray-500">
                        {group.templates.length} email{group.templates.length !== 1 ? "s" : ""} &middot; {group.platform}
                      </p>
                    </div>
                    {isLocked && (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700">
                        Upgrade to export
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {canExport && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleExportFlow(group.flowId); }}
                        className="text-sm text-mint-600 hover:text-mint-700 font-medium cursor-pointer"
                      >
                        {exportingFlow === group.flowId ? "Exporting..." : "Download ZIP"}
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
                                {canAIEdit(plan) && (
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
                            {!canExport && !paid && (
                              <a
                                href="/#pricing"
                                className="text-xs font-medium px-3 py-1.5 rounded-md bg-mint-100 text-mint-700 hover:bg-mint-200 transition-colors"
                              >
                                Upgrade to export
                              </a>
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
        {!paid && flowGroups.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-mint-50 to-green-50 border-2 border-mint-200 rounded-xl p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Upgrade to unlock exports</h3>
            <p className="text-gray-600 mb-4">
              Your templates are generated and ready. Purchase a plan to download, copy, and push to your email platform.
            </p>
            <a href="/#pricing" className="inline-block bg-mint-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-mint-700 transition-colors">
              View Pricing
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
