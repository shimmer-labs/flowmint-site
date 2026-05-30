"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { analytics } from "@/app/lib/analytics";
import { isBetaOpenAccessClient } from "@/app/lib/beta-client";
import AnalyzingCard from "@/app/components/AnalyzingCard";

export default function Home() {
  const beta = isBetaOpenAccessClient();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const handlePurchase = (purchaseType: string) => {
    const prices: Record<string, number> = { single_flow: 29, full_campaign: 79, unlimited: 149 }
    analytics.beginCheckout(purchaseType, prices[purchaseType] || 0)

    if (purchaseType === 'single_flow' || purchaseType === 'full_campaign') {
      // These need an analysis first — scroll to URL input
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => document.querySelector("input")?.focus(), 500);
      return;
    }

    // Unlimited — direct to checkout
    if (user) {
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseType }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.url) window.location.href = data.url
          else alert(data.error || 'Failed to start checkout')
        })
        .catch(() => alert('Something went wrong. Please try again.'))
    } else {
      router.push(`/signup?redirectTo=/api/checkout-redirect?purchaseType=${purchaseType}`)
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let validatedUrl = url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        validatedUrl = "https://" + url;
      }

      new URL(validatedUrl);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validatedUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await response.json();

      sessionStorage.setItem(
        `analysis-${data.analysisId}`,
        JSON.stringify(data)
      );

      analytics.generateAnalysis(validatedUrl)

      router.push(`/results?id=${data.analysisId}`);
    } catch (err: any) {
      if (err.message.includes("Invalid URL")) {
        setError("Please enter a valid URL (e.g., https://example.com)");
      } else {
        setError(err.message || "Failed to analyze website");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <AnalyzingCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-mint-700">FlowMint</div>
          <nav className="hidden md:flex gap-6 items-center">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Dashboard
                </Link>
                <Link href="/templates" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Templates
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Settings
                </Link>
              </>
            ) : (
              <>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
                  How It Works
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Pricing
                </a>
                <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">
                  FAQ
                </a>
                <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-mint-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-mint-700 transition-colors text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-6 py-4 flex flex-col gap-3">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/templates" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Templates
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Settings
                </Link>
              </>
            ) : (
              <>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  How It Works
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Pricing
                </a>
                <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  FAQ
                </a>
                <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-mint-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-mint-700 transition-colors text-sm text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="py-24 bg-gradient-to-b from-mint-50 to-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block bg-mint-100 text-mint-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            Email marketing for local service businesses
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Turn your website into emails that bring customers back
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Drop in your website and FlowMint writes a full set of customer
            emails in minutes that sound like you, not a robot. Ready to send
            from GoHighLevel or wherever you email from.
          </p>

          {/* URL Input */}
          <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="yourwebsite.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="flex-1 border border-gray-300 rounded-lg px-6 py-4 text-lg focus:outline-none focus:border-mint-600 focus:ring-4 focus:ring-mint-100 transition-all duration-200 disabled:bg-gray-100"
                required
              />
              <button
                type="submit"
                disabled={loading || !url}
                className="bg-mint-600 hover:bg-mint-700 disabled:bg-gray-300 text-white font-medium py-4 px-8 rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Scan my website
              </button>
            </div>
            {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
          </form>

          {/* Trust Signals */}
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-mint-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>See it in 30 seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-mint-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>No signup to try it</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-mint-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Free to start</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                num: "1",
                title: "Drop in your website",
                desc: "Paste your link. We read your whole website to learn your business and how you talk.",
                time: "30 seconds",
              },
              {
                num: "2",
                title: "We write your emails",
                desc: "You get a full set of customer emails that sound like you, not a robot.",
                time: "About a minute",
              },
              {
                num: "3",
                title: "Send them out",
                desc: "Push them into GoHighLevel (or wherever you email from) and start bringing customers back.",
                time: "Minutes",
              },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-16 h-16 bg-mint-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-mint-700">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-600 mb-2">{step.desc}</p>
                <span className="text-sm text-mint-600 font-medium">
                  {step.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-6">Trusted by growing brands</p>
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div>
              <div className="text-3xl font-bold text-gray-900">18+</div>
              <div className="text-sm text-gray-500 mt-1">Email campaigns</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">5</div>
              <div className="text-sm text-gray-500 mt-1">Platforms</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">30s</div>
              <div className="text-sm text-gray-500 mt-1">Brand analysis</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simple Pricing. Pay When You&apos;re Ready.
          </h2>
          <p className="text-center text-gray-600 mb-8 text-lg">
            {beta
              ? "We're in beta, so everything's free while we test. Here's where pricing's headed."
              : "Scan and write for free. Pay only when you're ready to send."}
          </p>
          <div className="bg-mint-50 border border-mint-200 rounded-lg px-6 py-3 text-center mb-12 max-w-xl mx-auto">
            <p className="text-sm text-mint-800">
              <span className="font-semibold">{beta ? "Free during beta:" : "Always free:"}</span> Scan your website + write + preview every email. No signup needed.
            </p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className={`grid md:grid-cols-3 gap-6 ${beta ? "opacity-40 pointer-events-none select-none" : ""}`}>
            {/* Single Flow */}
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Single Flow</h3>
              <div className="text-3xl font-bold mb-1">
                $29
              </div>
              <div className="text-sm text-gray-500 mb-5">one-time per flow</div>
              <ul className="space-y-2.5 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  <span>Export 1 flow for 1 brand<br /><span className="text-xs text-gray-400">e.g. Welcome Series or Cart Abandonment</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  Push to all platforms
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  AI Template Editing
                </li>
              </ul>
              <button
                onClick={() => handlePurchase('single_flow')}
                className="w-full py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Get Started Free &rarr;
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">Scan your website first, then buy</p>
            </div>

            {/* Full Campaign */}
            <div className="border-2 border-mint-500 rounded-xl p-6 relative shadow-lg">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mint-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </span>
              <h3 className="text-lg font-semibold mb-2">Full Campaign</h3>
              <div className="text-3xl font-bold mb-1">
                $79
              </div>
              <div className="text-sm text-gray-500 mb-5">one-time per brand</div>
              <ul className="space-y-2.5 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  <span>Export ALL 18+ flows for 1 brand<br /><span className="text-xs text-gray-400">Welcome, Cart Abandonment, Post-Purchase &amp; more</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  Push to all platforms
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  AI Template Editing
                </li>
              </ul>
              <button
                onClick={() => handlePurchase('full_campaign')}
                className="w-full py-2.5 bg-mint-600 text-white rounded-lg font-medium hover:bg-mint-700 transition-colors text-sm"
              >
                Get Started Free &rarr;
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">Scan your website first, then buy</p>
            </div>

            {/* Unlimited */}
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Unlimited</h3>
              <div className="text-3xl font-bold mb-1">
                $149
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </div>
              <div className="text-sm text-gray-500 mb-5">subscription</div>
              <ul className="space-y-2.5 mb-6 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  Unlimited brands &amp; exports
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  Campaign Calendar
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-mint-500 mt-0.5">&#10003;</span>
                  Priority support
                </li>
              </ul>
              <button
                onClick={() => handlePurchase('unlimited')}
                className="w-full py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Subscribe for $149/mo
              </button>
            </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            {beta
              ? "Pricing is paused during the beta. We'll give you plenty of warning before anything turns paid."
              : "Single Flow and Full Campaign are one-time purchases locked to one brand analysis. Unlimited is a monthly subscription."}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">FAQ</h2>
          <div className="space-y-4">
            {[
              {
                q: "Do I need a Shopify store?",
                a: "No! FlowMint works with any website: Shopify, WooCommerce, Squarespace, custom sites, even a brick-and-mortar shop with a web presence.",
              },
              {
                q: "How much does it cost?",
                a: beta
                  ? "Right now FlowMint is free while we're in beta. Scan, write, edit, and send as much as you like. We'll give you plenty of warning before any pricing kicks in."
                  : "Scan any website for free and preview every email. When you're ready to send, buy a Single Flow ($29) for one campaign or a Full Campaign ($79) for all of them. Each one is locked to a single website.",
              },
              {
                q: "What if I have multiple brands?",
                a: "Each brand analysis is a separate purchase. Or subscribe to Unlimited ($149/mo) for unlimited brands and exports.",
              },
              {
                q: "Will the emails actually sound like my brand?",
                a: "Yes. FlowMint reads your website, blog posts, and service pages to learn your voice. Most folks say the first draft is 80-90% ready to use.",
              },
              {
                q: "What email platforms are supported?",
                a: "Klaviyo, Mailchimp, ActiveCampaign, GetResponse, Customer.io, OmniSend, and Shopify Email. You can also export as ZIP for any other platform.",
              },
              {
                q: "How is this different from ChatGPT?",
                a: "ChatGPT makes you write the prompts and doesn't know your brand. FlowMint reads your website, learns your voice, and writes ready-to-send emails with the right merge fields built in.",
              },
            ].map((faq) => (
              <details
                key={faq.q}
                className="bg-white rounded-lg border border-gray-200"
              >
                <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-mint-700 transition-colors">
                  {faq.q}
                </summary>
                <div className="px-6 pb-4 text-gray-600">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gray-900 text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6">
            Ready to launch your email marketing?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Enter your URL above and write your first campaign in under 5
            minutes.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => document.querySelector("input")?.focus(), 500);
            }}
            className="bg-mint-500 hover:bg-mint-600 text-white font-medium py-4 px-8 rounded-lg text-lg transition-colors"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-600">
            &copy; {new Date().getFullYear()} FlowMint. Built by{" "}
            <a
              href="https://shimmerlabs.co"
              className="text-mint-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Shimmer Labs
            </a>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-gray-900">
              Privacy
            </a>
            <a href="/terms" className="hover:text-gray-900">
              Terms
            </a>
            <a href="/support" className="hover:text-gray-900">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
