"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { isPaidPlan, getPlanLabel } from "@/app/lib/plan-gating";

const PLATFORMS = [
  { id: "klaviyo", name: "Klaviyo", keyLabel: "API Key" },
  { id: "mailchimp", name: "Mailchimp", keyLabel: "API Key (key-dc format)" },
  { id: "activecampaign", name: "ActiveCampaign", keyLabel: "API Key" },
  { id: "customerio", name: "Customer.io", keyLabel: "API Key" },
  { id: "omnisend", name: "Omnisend", keyLabel: "API Key" },
];

interface Props {
  user: { email: string; name?: string };
  plan: string;
  currentPlatform: string;
  hasApiKey: boolean;
}

export default function SettingsClient({ user, plan, currentPlatform, hasApiKey }: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [platform, setPlatform] = useState(currentPlatform);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  const paid = isPaidPlan(plan);

  const handleSave = async () => {
    if (!platform) {
      setError("Please select a platform");
      return;
    }
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          apiKey: apiKey || undefined, // Don't send empty string
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaveSuccess(true);
      setApiKey(""); // Clear for security
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex items-center gap-6">
            <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/templates" className="text-sm text-gray-600 hover:text-gray-900">Templates</a>
            <a href="/settings" className="text-sm text-mint-600 font-medium">Settings</a>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              paid ? "bg-mint-100 text-mint-700" : "bg-gray-100 text-gray-600"
            }`}>
              {getPlanLabel(plan)}
            </span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600 mb-8">Configure your email platform for template push.</p>

        {/* Plan info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Your Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                paid ? "bg-mint-100 text-mint-700" : "bg-gray-100 text-gray-600"
              }`}>
                {getPlanLabel(plan)}
              </span>
            </div>
            {!paid && (
              <a href="/#pricing" className="text-sm font-medium text-mint-600 hover:text-mint-700">
                Upgrade
              </a>
            )}
          </div>
        </div>

        {/* Platform settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Email Platform</h2>

          {!paid && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                Platform push requires a paid plan. You can still configure your platform now.
              </p>
            </div>
          )}

          {/* Platform selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    platform === p.id
                      ? "bg-mint-600 text-white ring-2 ring-mint-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          {platform && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {PLATFORMS.find((p) => p.id === platform)?.keyLabel || "API Key"}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? "••••••••••••••••" : "Enter your API key"}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-300 focus:border-mint-500"
              />
              {hasApiKey && !apiKey && (
                <p className="text-xs text-gray-500 mt-1">API key is saved. Enter a new one to update.</p>
              )}
            </div>
          )}

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {saveSuccess && <p className="text-green-600 text-sm mb-4">Settings saved.</p>}

          <button
            onClick={handleSave}
            disabled={saving || !platform}
            className="w-full bg-mint-600 text-white font-medium py-3 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </main>
    </div>
  );
}
