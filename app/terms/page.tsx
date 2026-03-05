import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - FlowMint",
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 5, 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Acceptance of Terms</h2>
          <p>By using FlowMint (&ldquo;the Service&rdquo;), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Service Description</h2>
          <p>FlowMint is an AI-powered email marketing tool that analyzes websites and generates personalized email campaigns. The Service includes brand analysis, email template generation, and export/integration features.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Accounts</h2>
          <p>You are responsible for maintaining the security of your account credentials. You must provide accurate information when creating an account.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Purchases & Refunds</h2>
          <p>FlowMint offers one-time purchases. All purchases are final. If you experience technical issues that prevent you from using a purchased feature, contact us within 14 days for a resolution or refund.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Service to generate spam or misleading emails</li>
            <li>Submit URLs of websites you do not own or have authorization to analyze</li>
            <li>Attempt to reverse-engineer or abuse the AI generation system</li>
            <li>Resell generated content as a competing service</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Generated Content</h2>
          <p>You own the email templates generated for your brand. FlowMint retains no ownership of generated content. However, generated content is created by AI and should be reviewed before sending to customers.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Limitation of Liability</h2>
          <p>FlowMint is provided &ldquo;as is&rdquo; without warranties. We are not liable for any damages arising from the use of generated email content, including but not limited to email deliverability issues, CAN-SPAM violations, or lost revenue.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Contact</h2>
          <p>For questions about these terms, contact:<br />
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
