import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - FlowMint",
};

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 5, 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Information We Collect</h2>
          <p>When you use FlowMint, we collect:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Website URLs</strong> you submit for analysis</li>
            <li><strong>Account information</strong> (email, name) when you create an account</li>
            <li><strong>Payment information</strong> processed securely through Stripe</li>
            <li><strong>Usage data</strong> such as which flows you generate and export</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Analyze your website and generate personalized email campaigns</li>
            <li>Process your purchases and provide customer support</li>
            <li>Improve our AI models and service quality</li>
            <li>Send you important service updates (no marketing spam)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Data We Scrape</h2>
          <p>When you submit a URL, we scrape publicly available information from that website including product listings, blog posts, about pages, and brand elements. We do not access any private or password-protected content.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Anthropic (Claude AI)</strong> - For brand analysis and email generation</li>
            <li><strong>Supabase</strong> - For data storage and authentication</li>
            <li><strong>Stripe</strong> - For payment processing</li>
            <li><strong>Vercel</strong> - For hosting</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Data Retention</h2>
          <p>We retain your brand analysis data and generated templates for as long as your account is active. You can request deletion of your data at any time by contacting us.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Security</h2>
          <p>We use industry-standard security measures including encrypted data storage (AES-256-GCM for sensitive data) and secure HTTPS connections.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:logan@shimmerlabs.co" className="text-mint-600 hover:underline">logan@shimmerlabs.co</a> for any privacy-related requests.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Contact</h2>
          <p>For privacy questions, contact:<br />
          Shimmer Labs<br />
          <a href="mailto:logan@shimmerlabs.co" className="text-mint-600 hover:underline">logan@shimmerlabs.co</a></p>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-600">
          &copy; {new Date().getFullYear()} FlowMint. Built by{" "}
          <a href="https://shimmerlabs.co" className="text-mint-600 hover:underline" target="_blank" rel="noopener noreferrer">Shimmer Labs</a>
        </div>
      </footer>
    </div>
  );
}
