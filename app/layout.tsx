import type { Metadata } from "next";
import Script from "next/script";
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
    images: [
      {
        url: "https://flowmint.me/og-image.png",
        width: 1200,
        height: 630,
        alt: "FlowMint - AI Email Campaigns in Minutes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowMint - AI Email Campaigns in Minutes",
    description:
      "Generate personalized email flows for your brand in minutes, not hours.",
    images: ["https://flowmint.me/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "FlowMint",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "AI email marketing tool that analyzes your brand and generates personalized email campaigns in minutes. Works with any website. Push to Klaviyo, Mailchimp, ActiveCampaign, and more.",
              "url": "https://flowmint.me",
              "offers": [
                { "@type": "Offer", "name": "Single Flow", "price": "29", "priceCurrency": "USD" },
                { "@type": "Offer", "name": "Full Campaign", "price": "79", "priceCurrency": "USD" },
                { "@type": "Offer", "name": "Unlimited", "price": "149", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" } }
              ],
              "creator": {
                "@type": "Organization",
                "name": "Shimmer Labs",
                "url": "https://shimmerlabs.co"
              },
              "featureList": [
                "AI brand analysis from any URL",
                "18+ email flow types",
                "Multi-platform export (Klaviyo, Mailchimp, ActiveCampaign, GetResponse, Customer.io, OmniSend, Shopify Email)",
                "AI template editing",
                "One-click platform push"
              ]
            }),
          }}
        />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-25H25RV136"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-25H25RV136');
          `}
        </Script>
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
