import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - FlowMint",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</a>
            <a href="/support" className="text-gray-600 hover:text-gray-900 transition-colors">Support</a>
            <a href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</a>
            <a href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Support</h1>
        <p className="text-lg text-gray-600 mb-12">Need help? We&apos;re here for you.</p>

        <div className="space-y-8">
          {/* Contact */}
          <div className="bg-mint-50 border border-mint-200 rounded-xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 mb-4">For any questions, issues, or feature requests:</p>
            <a
              href="mailto:logan@shimmerlabs.co"
              className="inline-flex items-center gap-2 bg-mint-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-mint-700 transition-colors"
            >
              Email Us: logan@shimmerlabs.co
            </a>
            <p className="text-sm text-gray-500 mt-4">We typically respond within 24 hours on business days.</p>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: "My analysis is taking too long",
                  a: "Analysis typically takes 10-30 seconds depending on the website size. If it takes longer than 60 seconds, try refreshing and submitting again. Some websites with heavy JavaScript may take longer to scrape.",
                },
                {
                  q: "The generated emails don't match my brand",
                  a: "Make sure your website has enough content for the AI to analyze — product descriptions, blog posts, and an about page help a lot. You can also use the AI Edit feature to refine any template.",
                },
                {
                  q: "How do I export my templates?",
                  a: "After generating your flows, you can copy individual emails or download all templates as a ZIP file. Paid plans also support direct push to Klaviyo, Mailchimp, and other platforms.",
                },
                {
                  q: "Can I get a refund?",
                  a: "All purchases are one-time and final. If you experience technical issues that prevent you from using a feature you paid for, contact us within 14 days and we'll work with you to resolve it.",
                },
                {
                  q: "Do you store my website data?",
                  a: "We cache your brand analysis to speed up future requests. You can request deletion of your data at any time by emailing us.",
                },
              ].map((faq) => (
                <details key={faq.q} className="bg-gray-50 rounded-lg border border-gray-200">
                  <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-mint-700 transition-colors">
                    {faq.q}
                  </summary>
                  <div className="px-6 pb-4 text-gray-600">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-12 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-600">
          &copy; {new Date().getFullYear()} FlowMint. Built by{" "}
          <a href="https://shimmerlabs.co" className="text-mint-600 hover:underline" target="_blank" rel="noopener noreferrer">Shimmer Labs</a>
        </div>
      </footer>
    </div>
  );
}
