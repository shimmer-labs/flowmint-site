/**
 * Email Generator Service
 * Generates individual emails for flows using Claude AI
 * Ported from ottomate with lifecycle marketing prompts
 */

import { callClaude } from "./claude-api.service";
import { FlowDefinition } from "../utils/flow-mappings";
import { BrandAnalysisResult } from "./brand-analysis.service";
import { getSyntaxInstructions } from "../utils/platform-syntax";

export interface GeneratedEmail {
  subject: string;
  preheader: string;
  body: string;
  platform: string;
  format: "html" | "plain";
}

export interface EmailGenerationContext {
  flow: FlowDefinition;
  emailNumber: number; // 1, 2, or 3 (which email in the sequence)
  brandAnalysis: BrandAnalysisResult;
  platform: string;
  format: "html" | "plain";
}

/**
 * Generate a single email using Claude
 */
export async function generateEmail(context: EmailGenerationContext): Promise<GeneratedEmail> {
  console.log(`🤖 Generating ${context.flow.name} email #${context.emailNumber} for ${context.platform}`);

  const prompt = buildEmailPrompt(context);

  const emailContent = await callClaude(prompt, {
    maxTokens: 2000,
    temperature: 0.8,
    systemPrompt: "You are an expert lifecycle marketing email copywriter. Write compelling, conversion-focused emails that match the brand's voice and drive results.",
  });

  return parseEmailResponse(emailContent, context.platform, context.format);
}

/**
 * Build comprehensive email generation prompt
 */
function buildEmailPrompt(context: EmailGenerationContext): string {
  const { flow, emailNumber, brandAnalysis, platform, format } = context;

  const platformSyntax = getSyntaxInstructions(platform);
  const flowGuidance = getFlowSpecificGuidance(flow.id, emailNumber, flow.emailCount);
  const hasImages = !!brandAnalysis.images;
  const formatInstructions = format === "html" ? getHTMLInstructions(hasImages, brandAnalysis.brandColors.primary) : getPlainTextInstructions();

  return `You are writing email #${emailNumber} of ${flow.emailCount} for a "${flow.name}" email sequence.

**Brand Context:**
- Brand: ${brandAnalysis.sourcesAnalyzed.hasAboutPage ? brandAnalysis.valueProposition : ""}
- Voice Tone: ${brandAnalysis.brandVoice.tone}
- Style: ${brandAnalysis.brandVoice.style}
- Personality: ${brandAnalysis.brandVoice.personality.join(", ")}
- Target Audience: ${brandAnalysis.targetAudience}
- Business Model: ${brandAnalysis.businessModel}
- Brand Colors: Primary ${brandAnalysis.brandColors.primary}, Secondary ${brandAnalysis.brandColors.secondary}
${brandAnalysis.brandVoice.keyPhrases.length > 0 ? `- Key Phrases: ${brandAnalysis.brandVoice.keyPhrases.join(", ")}` : ""}

**DESIGN GUIDANCE:**
- Do NOT include small logos at the top of the email (they look unprofessional when tiny)
- Instead, use the brand name in text or focus on a strong headline
- If using hero images, make them prominent and full-width (visually impactful)
- Keep the design clean, modern, and focused on the message + CTA

**Product Categories:**
${brandAnalysis.productCategories.join(", ")}
${buildImagesSection(brandAnalysis, format)}

${platformSyntax}

${flowGuidance}

${formatInstructions}

CRITICAL REQUIREMENTS:
- Match the brand voice (${brandAnalysis.brandVoice.tone}, ${brandAnalysis.brandVoice.style})
- Use EXACT platform syntax from above for personalization variables
- ${format === "html" ? "Output complete HTML with inline CSS (no markdown code blocks)" : "Output clean plain text"}
- Include unsubscribe link in footer using platform syntax
- Make it conversion-focused and action-oriented
- Use proper conditional logic for personalization
- Subject + preheader should work together (not redundant)

**CRITICAL: PERSONALIZATION SYNTAX**
DO NOT HTML-escape the personalization syntax. Output the curly braces and percent signs RAW in your HTML:
✅ CORRECT: {% if person.first_name %}{{ person.first_name }}{% endif %}
❌ WRONG: &#123;% if person.first_name %&#125;&#123;&#123; person.first_name &#125;&#125;&#123;% endif %&#125;

The template syntax MUST be raw so email platforms can process it.

Generate the email now:`;
}

/**
 * Build images section (safely handles missing images)
 */
function buildImagesSection(brandAnalysis: BrandAnalysisResult, format: "html" | "plain"): string {
  if (!brandAnalysis.images) {
    return "";
  }

  const images = brandAnalysis.images;
  const lines: string[] = ["\n**Available Images (use these in HTML emails):**"];

  if (images.logo) {
    lines.push(`- Logo: ${images.logo}`);
  }
  if (images.hero) {
    lines.push(`- Hero Image: ${images.hero}`);
  }
  if (images.products && images.products.length > 0) {
    lines.push("- Product Images:");
    images.products.forEach((img, i) => {
      lines.push(`  ${i + 1}. ${img}`);
    });
  }
  if (images.lifestyle && images.lifestyle.length > 0) {
    lines.push("- Lifestyle Images:");
    images.lifestyle.forEach((img, i) => {
      lines.push(`  ${i + 1}. ${img}`);
    });
  }

  if (format === "html") {
    lines.push("\nIMPORTANT: Use these real image URLs in your HTML email. Include at least 1-2 images for visual appeal.");
  }

  return lines.join("\n");
}

/**
 * Flow-specific guidance based on email number
 */
function getFlowSpecificGuidance(flowId: string, emailNumber: number, totalEmails: number): string {
  const flowGuidance: Record<string, Record<number, string>> = {
    welcome: {
      1: "**Purpose:** Warm welcome, introduce brand story, set expectations. Include first-purchase incentive (10-15% off). Friendly, excited tone. CTA: Shop Now / Get Started.",
      2: "**Purpose:** Sent 2-3 days after signup. Highlight bestsellers or key features. Social proof (testimonials, reviews). CTA: Browse Collection / Explore Features.",
      3: "**Purpose:** Sent 5-7 days after signup. Show brand values, behind-the-scenes, or customer stories. Final nudge with expiring discount. CTA: Complete Your Order.",
    },
    "cart-abandonment": {
      1: "**Purpose:** Send within 1 hour of abandonment. Friendly reminder, show cart contents. Address common objections (shipping, returns). CTA: Complete Your Purchase.",
      2: "**Purpose:** Send 24 hours later. Gentle urgency, sweetener (free shipping or 10% off). Include customer reviews. CTA: Get [Product] Now.",
      3: "**Purpose:** Send 48-72 hours later. Final reminder, stronger incentive (15% off). Scarcity/urgency (limited stock, expiring offer). CTA: Claim Your Discount.",
    },
    "browse-abandonment": {
      1: "**Purpose:** Sent 24 hours after browsing. 'We noticed you were looking at...' Show viewed products. CTA: Continue Shopping.",
      2: "**Purpose:** Sent 3 days later. Recommend similar products, bestsellers in that category. Social proof. CTA: Discover More.",
      3: "**Purpose:** Sent 1 week later. Offer incentive (10% off), show new arrivals in viewed category. CTA: Shop the Collection.",
    },
    "post-purchase": {
      1: "**Purpose:** Order confirmation tone. Thank you, what to expect next, tracking info. CTA: Track Your Order.",
      2: "**Purpose:** Sent when delivered. 'It's arrived!' Care instructions, setup tips. Ask for review. CTA: Leave a Review.",
      3: "**Purpose:** 2 weeks later. How's it going? Usage tips, complementary products. Loyalty program info. CTA: Shop Accessories.",
    },
    "win-back": {
      1: "**Purpose:** We miss you! Show what's new since they left. Personal tone. Mild incentive (10% off). CTA: Come Back.",
      2: "**Purpose:** Sent 1 week later. Show bestsellers, new products, customer favorites. Stronger offer (15% off). CTA: Rediscover Us.",
      3: "**Purpose:** Final attempt. 'Last chance to save.' Strong incentive (20% off or free gift). Urgency (expiring offer). CTA: Claim Your Offer.",
    },
    "about-to-lapse": {
      1: "**Purpose:** Gentle nudge. 'It's been a while...' Show new products, what they've missed. Soft offer. CTA: See What's New.",
      2: "**Purpose:** Stronger urgency. 'Don't let your points expire' or 'Special comeback offer.' 15-20% off. CTA: Shop Now.",
      3: "**Purpose:** Last chance. Strong incentive, scarcity. 'We don't want to say goodbye.' CTA: Reactivate Your Account.",
    },
    "replenishment": {
      1: "**Purpose:** 'Time to restock?' Based on typical repurchase cycle. Show last purchased product. Easy reorder. CTA: Order Again.",
      2: "**Purpose:** 1 week later. 'Running low?' Mild urgency. Show product benefits reminder. Small incentive. CTA: Reorder Now.",
      3: "**Purpose:** Final reminder. 'Don't run out!' Stronger offer (subscribe & save). CTA: Set Up Auto-Delivery.",
    },
    "subscription-winback": {
      1: "**Purpose:** 'We noticed you canceled.' Address common pain points. What's improved. Come-back offer. CTA: Restart Your Subscription.",
      2: "**Purpose:** Show what they're missing. Customer success stories. Better offer (first month free). CTA: Give Us Another Try.",
      3: "**Purpose:** Final attempt. Strong incentive (2 months for price of 1). Scarcity. CTA: Reactivate Now.",
    },
    "vip": {
      1: "**Purpose:** 'You're VIP!' Exclusive early access to sale/new products. Make them feel special. CTA: Shop VIP Access.",
      2: "**Purpose:** VIP perks reminder. Exclusive content, behind-the-scenes. Special gift or bonus. CTA: Claim Your Gift.",
      3: "**Purpose:** VIP community invitation. Refer friends, join private group. Loyalty program benefits. CTA: Invite Friends.",
    },
    "birthday": {
      1: "**Purpose:** Happy birthday! Personal, warm tone. Birthday gift (discount or free item). Time-limited. CTA: Claim Your Gift.",
      2: "**Purpose:** Mid-month reminder (if unclaimed). 'Don't forget your birthday gift!' Urgency. CTA: Use Your Gift.",
      3: "**Purpose:** (Optional) 'Last day!' if still unclaimed. Final urgency. CTA: Redeem Before Midnight.",
    },
    "referral": {
      1: "**Purpose:** 'Give $20, Get $20' (or similar). Explain referral program. Easy sharing. CTA: Invite Your Friends.",
      2: "**Purpose:** Reminder. 'Your friends are missing out!' Show program benefits. CTA: Share Your Link.",
      3: "**Purpose:** Success story. 'Sarah referred 5 friends!' Social proof. Incentive boost. CTA: Start Referring.",
    },
    "product-education": {
      1: "**Purpose:** 'Get the most out of [product].' Setup guide, quick start. Video or images. CTA: Watch Tutorial.",
      2: "**Purpose:** Advanced tips, hidden features, pro tricks. Empowerment. CTA: Try This Feature.",
      3: "**Purpose:** Community resources, FAQ, customer success stories. Support info. CTA: Join Community.",
    },
    "cross-sell": {
      1: "**Purpose:** 'Complete your collection.' Based on past purchase, show complementary products. Soft recommendation. CTA: Shop Accessories.",
      2: "**Purpose:** 'Customers also bought...' Social proof-driven. Bundle offer. CTA: Add to Cart.",
      3: "**Purpose:** Limited-time bundle discount. Urgency. 'Save 20% when you buy together.' CTA: Get the Bundle.",
    },
    "seasonal": {
      1: "**Purpose:** Announce seasonal sale/collection. Build excitement. Early access feel. CTA: Shop the Collection.",
      2: "**Purpose:** Highlight bestsellers from seasonal line. Social proof, scarcity. CTA: Shop Before It's Gone.",
      3: "**Purpose:** Final days. Strong urgency. 'Last chance for summer styles!' CTA: Shop Final Hours.",
    },
    "feedback-request": {
      1: "**Purpose:** 'How are we doing?' Post-purchase feedback request. Simple, quick survey. Incentive (entry to win gift card). CTA: Take 2-Min Survey.",
      2: "**Purpose:** 'Tell us more.' For negative feedback, offer to make it right. For positive, ask for review. CTA: Share Your Review.",
      3: "**Purpose:** 'Thanks for your feedback!' Close the loop. Show how feedback led to improvements. CTA: See What Changed.",
    },
    "new-product-announcement": {
      1: "**Purpose:** 'Just launched!' Create excitement, show new product. Waitlist or pre-order. CTA: Be the First.",
      2: "**Purpose:** 'Now available!' Product is live. Detailed features, benefits. Launch discount. CTA: Shop Now.",
      3: "**Purpose:** Social proof. 'Customers love it!' Reviews, testimonials. Last chance for launch pricing. CTA: Get Yours.",
    },
    "sale-announcement": {
      1: "**Purpose:** 'Sale starts now!' Announce sale, show scope (40% off, sitewide, etc.). Urgency. CTA: Start Shopping.",
      2: "**Purpose:** Highlight bestsellers on sale. 'Don't miss these deals.' Urgency reminder. CTA: Shop Top Deals.",
      3: "**Purpose:** 'Final hours!' Strong urgency. FOMO. Low stock indicators. CTA: Shop Before It Ends.",
    },
    "back-in-stock": {
      1: "**Purpose:** 'It's back!' For waitlist subscribers. Show the product they wanted. Limited quantity warning. CTA: Get It Now.",
      2: "**Purpose:** Reminder (24-48 hours later if not purchased). 'Still available, but not for long.' CTA: Secure Yours.",
      3: "**Purpose:** (Optional) Related products if out of stock again. 'You might also love...' CTA: Shop Similar.",
    },
  };

  const guidance = flowGuidance[flowId]?.[emailNumber];

  if (guidance) {
    return `**Email #${emailNumber} of ${totalEmails} - ${flowId.toUpperCase()} FLOW:**
${guidance}`;
  }

  // Fallback for flows without specific guidance
  return `**Email #${emailNumber} of ${totalEmails}:**
Create a compelling email that moves the customer toward the desired action. Use storytelling, social proof, and urgency where appropriate.`;
}

/**
 * HTML format instructions (matching Ottomate's detailed approach)
 */
function getHTMLInstructions(hasImages: boolean = true, brandColor: string = "#0066FF"): string {
  return `**FORMAT: HTML Email**

CRITICAL: Output raw HTML only - do NOT wrap in markdown code blocks (no \`\`\`html). Start directly with <!DOCTYPE html>.

1. Create COMPLETE HTML with inline CSS
2. Single-column layout, mobile-responsive (max-width: 600px)
3. Use brand colors in design (primary: ${brandColor})
4. Include personalization variables using platform syntax (shown above)
5. Include CTA button with brand primary color
6. Structure:
   - Subject line (separate line starting with "SUBJECT:")
   - Preheader text (separate line starting with "PREHEADER:")
   - Complete HTML email body starting with <!DOCTYPE html>
   - Footer with company info AND unsubscribe link
7. Use table-based layout for email client compatibility
8. Inline CSS for all styling

${hasImages ? `**IMAGES:** Use the real image URLs provided above:
- Hero images should be prominent and full-width within the email container (max-width: 100%)
- Product images can be smaller but still visually impactful (at least 200-300px wide)
- Include 1-2 high-quality images to enhance visual appeal
- Always include alt text for accessibility` : ""}

**CRITICAL STYLING RULES:**
- Use table-based layouts (not divs) for maximum email client compatibility
- ALL styles must be inline (no external CSS)
- Images: Use descriptive alt text, ensure they're responsive
- Font stack: Arial, Helvetica, sans-serif (universally supported)
- Test rendering: Your HTML should work in Gmail, Outlook, Apple Mail

REQUIRED:
- Footer MUST include unsubscribe link using platform syntax (shown above)
- Use personalization variables in natural places (greetings, CTAs)
- Keep HTML structure clean and semantic`;
}

/**
 * Plain text format instructions (matching Ottomate's approach)
 */
function getPlainTextInstructions(): string {
  return `**FORMAT: Plain Text Email**

1. Clean, readable text format
2. Use line breaks and spacing for structure
3. Include personalization using platform syntax
4. Structure:
   - Subject line (separate line starting with "SUBJECT:")
   - Preheader text (separate line starting with "PREHEADER:")
   - Body copy with clear CTAs
   - Footer with company info AND unsubscribe link
5. Use ASCII characters for simple visual elements (---, ***, etc.)
6. Keep it concise and scannable

Example structure:
SUBJECT: Your compelling subject line
PREHEADER: Preview text that complements the subject

Hi there,

We're excited to have you here!

Check out our latest collection and find something you'll love.

[Shop Now] → https://example.com

---
Company Name
Unsubscribe link here

REQUIRED: Footer MUST include unsubscribe link using platform syntax.`;
}

/**
 * Extract subject line from generated email
 */
function extractSubjectLine(emailContent: string): string {
  const match = emailContent.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : "Your Email Subject";
}

/**
 * Extract preheader text from generated email
 */
function extractPreheader(emailContent: string): string {
  const match = emailContent.match(/PREHEADER:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : "";
}

/**
 * Clean email content (remove SUBJECT/PREHEADER lines)
 */
function cleanEmailContent(emailContent: string): string {
  return emailContent
    .replace(/SUBJECT:\s*.+?\n/i, "")
    .replace(/PREHEADER:\s*.+?\n/i, "")
    .trim();
}

/**
 * Parse Claude's email response (using extraction instead of JSON)
 */
function parseEmailResponse(text: string, platform: string, format: "html" | "plain"): GeneratedEmail {
  try {
    // Extract subject, preheader, and clean body content
    const subject = extractSubjectLine(text);
    const preheader = extractPreheader(text);
    const body = cleanEmailContent(text);

    // Validate we got content
    if (!body || body.length < 50) {
      throw new Error("Email body is too short or missing");
    }

    return {
      subject,
      preheader,
      body,
      platform,
      format,
    };
  } catch (error) {
    console.error("Failed to parse Claude email response:", error);
    console.error("Raw response:", text);

    // Return fallback email
    return {
      subject: "Welcome!",
      preheader: "We're glad you're here",
      body: format === "html"
        ? `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h2>Welcome!</h2>
  <p>Thanks for joining us! We're excited to have you.</p>
</body>
</html>`
        : "Thanks for joining us! We're excited to have you.",
      platform,
      format,
    };
  }
}
