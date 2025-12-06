---
layout: '../layouts/LegalLayout.astro'
title: 'Privacy Policy'
lastUpdated: 'October 21, 2025'
---

## Introduction

This Privacy Policy describes how Shimmer Labs LLC, operating as FlowMint ("we," "us," or "our") collects, uses, and protects your information when you use our Shopify application (the "App"). We are committed to protecting your privacy and complying with all applicable data protection laws, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).

By installing and using the App, you agree to the collection and use of information in accordance with this policy.

## Contact Information

**App Provider:** Shimmer Labs LLC (operating as FlowMint)
**Contact Email:** logan@shimmerlabs.co
**Website:** https://flowmint.me

For privacy-related questions or to exercise your data rights, please contact us at logan@shimmerlabs.co.

## Information We Collect

### 1. Shop-Level Data

When you install the App, we automatically collect the following information from your Shopify store:

- **Store Information:** Shop domain, store name, primary contact email
- **Product Data:** Product names, descriptions, images, pricing, and inventory information
- **Content Data:** Blog posts, articles, and other published content on your store
- **Theme Data:** Brand colors and fonts from your active Shopify theme
- **Session Data:** OAuth session tokens for authentication

### 2. User-Provided Data

You may provide the following information when configuring the App:

- **Email Platform API Keys:** API keys for third-party email platforms (Klaviyo, OmniSend, ActiveCampaign, GetResponse, Customer.io, Shopify Email)
- **Email Platform Account Information:** Account URLs or identifiers for certain platforms
- **App Settings:** Your selected email platform, preferred business model, and other configuration preferences

### 3. Generated Data

The App generates and stores the following data:

- **Brand Analysis Results:** AI-generated analysis of your brand voice, tone, target audience, and visual identity
- **Email Templates:** AI-generated email marketing templates based on your store data
- **Generation History:** Records of template generation jobs, including status and timestamps

### 4. Data We DO NOT Collect

**Important:** We do **not** collect, store, or process any of the following:

- Individual customer personal information (names, addresses, phone numbers)
- Customer email addresses
- Order details or transaction history
- Payment information or financial data
- Customer behavior or analytics data

We only collect and process **shop-level data** necessary for AI email template generation. We do not have access to your end customers' personal information.

## How We Use Your Information

We use the collected information solely to provide and improve the App's functionality:

### 1. AI Email Generation
- Analyze your store's brand voice, products, and content
- Generate personalized email marketing templates
- Recommend email flows based on your business model

### 2. Platform Integration
- Push generated email templates to your selected email platform
- Authenticate with third-party email platforms using your provided API keys

### 3. Service Improvement
- Cache brand analysis results to improve performance and reduce redundant AI processing
- Track generation job status to provide real-time updates
- Identify and fix technical issues

### 4. Legal Compliance
- Comply with Shopify App Store policies
- Respond to GDPR data requests
- Maintain audit logs for security purposes

## Data Storage and Security

### 1. Where Your Data is Stored

All data is stored on secure servers hosted on Fly.io infrastructure located in the United States. We use SQLite databases with automatic backups via Litestream.

### 2. Security Measures

We implement industry-standard security practices to protect your data:

- **API Key Encryption:** All email platform API keys are encrypted at rest using AES-256-GCM authenticated encryption
- **OAuth Authentication:** Secure OAuth 2.0 flow for Shopify authentication
- **HTTPS/TLS:** All data transmission is encrypted using TLS 1.2 or higher
- **Access Controls:** Limited access to production data, restricted to authorized personnel only
- **Regular Backups:** Automated daily backups with point-in-time recovery

### 3. Data Retention

- **Brand Analysis:** Cached until you request a refresh or uninstall the App
- **Email Templates:** Stored indefinitely while the App is installed, accessible via the App interface
- **Session Data:** Stored for the duration of your active session
- **Generated Jobs:** Retained for 90 days, then automatically archived

## Data Sharing and Third-Party Services

### 1. Third-Party Services We Use

We share limited data with the following third-party services to provide App functionality:

#### Anthropic (Claude AI)
- **Data Shared:** Store name, product information, blog content, brand colors (anonymized)
- **Purpose:** Generate AI-powered email templates
- **Data Retention:** Anthropic does not retain data submitted via API (per their API Data Usage Policy)
- **Privacy Policy:** https://www.anthropic.com/privacy

#### Email Platforms (Klaviyo, OmniSend, etc.)
- **Data Shared:** Generated email templates only (when you explicitly push templates)
- **Purpose:** Create email templates in your connected platform
- **Control:** You explicitly initiate all data transfers by clicking "Push to [Platform]"

#### Shopify
- **Data Shared:** App usage metadata, installation status
- **Purpose:** OAuth authentication, app billing, compliance
- **Privacy Policy:** https://www.shopify.com/legal/privacy

### 2. Data We DO NOT Share

We do **not** sell, rent, or share your data with:
- Advertisers or marketing companies
- Data brokers
- Any third parties for their own marketing purposes

## Your Data Rights (GDPR Compliance)

Under GDPR and other data protection laws, you have the following rights:

### 1. Right to Access
Request a copy of all personal data we hold about your store. Email logan@shimmerlabs.co to request your data.

### 2. Right to Deletion (Right to be Forgotten)
Request deletion of all your data. This happens automatically when you uninstall the App, or you can request manual deletion by emailing logan@shimmerlabs.co.

### 3. Right to Rectification
Request correction of inaccurate data. You can update most data directly in the App settings or request changes via email.

### 4. Right to Data Portability
Request your data in a machine-readable format (JSON). Email logan@shimmerlabs.co to request data export.

### 5. Right to Restriction
Request that we limit processing of your data. Email logan@shimmerlabs.co with your specific request.

### 6. Right to Object
Object to our processing of your data. You can uninstall the App at any time to cease all data processing.

## GDPR Webhooks and Data Deletion

We comply with Shopify's mandatory GDPR webhooks:

### 1. Customer Data Request (customers/data_request)
When triggered, we provide all shop-level data we have stored within 48 hours.

### 2. Customer Redact (customers/redact)
This is a **no-op** for our App because we do not store individual customer data. Only shop-level data is processed.

### 3. Shop Redact (shop/redact)
When triggered (after you uninstall the App), we **permanently delete** all your data within 48 hours, including:
- Brand analysis results
- Generated email templates
- Generation job history
- App settings (including encrypted API keys)
- OAuth session data

**This deletion is irreversible.** If you reinstall the App, you will start fresh with no historical data.

## Cookies and Tracking

The App does **not** use cookies or tracking technologies on your storefront. All data processing occurs server-side within the Shopify Admin embedded app interface.

## Children's Privacy

The App is not directed at individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected data from a child, please contact us immediately.

## International Data Transfers

Your data may be transferred to and processed in the United States, where our servers are located. By using the App, you consent to the transfer of your data to the United States.

If you are located in the European Economic Area (EEA), we rely on Shopify's Standard Contractual Clauses (SCCs) for lawful data transfers.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of significant changes by:
- Updating the "Last Updated" date at the top of this policy
- Sending an in-app notification or email (for material changes)

Your continued use of the App after changes are posted constitutes acceptance of the updated policy.

## Compliance with Laws

We comply with:
- **GDPR** (General Data Protection Regulation) - EU data protection law
- **CCPA** (California Consumer Privacy Act) - California privacy law
- **Shopify App Store Policies** - Shopify's data protection requirements
- **SOC 2** - Industry-standard security and privacy controls (via our hosting provider, Fly.io)

## Data Breach Notification

In the unlikely event of a data breach that affects your information, we will:
1. Notify you via email within 72 hours of discovering the breach
2. Describe the nature of the breach and data affected
3. Outline steps we're taking to mitigate harm
4. Provide recommendations for protective actions you can take

## Your Consent

By installing and using the App, you consent to:
- Collection and processing of shop-level data as described in this policy
- Transfer of data to third-party services (Anthropic, email platforms) as needed for App functionality
- Storage of your data in the United States

You can withdraw consent at any time by uninstalling the App.

## Questions or Concerns?

If you have questions about this Privacy Policy or our data practices, please contact us:

**Email:** logan@shimmerlabs.co
**Response Time:** We aim to respond to all privacy inquiries within 72 hours

For data access requests, deletion requests, or other GDPR-related inquiries, please include "GDPR Request" in your email subject line.

---

**FlowMint by Shimmer Labs LLC**
Privacy Policy - Version 1.0
