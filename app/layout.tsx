import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/contexts/AuthContext";

export const metadata: Metadata = {
  title: "FlowMint - AI Email Campaigns in Minutes",
  description:
    "FlowMint analyzes your brand and generates personalized email marketing campaigns in minutes. Works with any website. Push to Klaviyo, Mailchimp, ActiveCampaign, and more.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FlowMint - AI Email Campaigns in Minutes",
    description:
      "Generate personalized email flows for your brand in minutes, not hours.",
    url: "https://flowmint.me",
    siteName: "FlowMint",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
