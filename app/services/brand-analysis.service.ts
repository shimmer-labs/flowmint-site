/**
 * Brand Analysis Service
 * Adapted from ottomate - now uses scraped data instead of Shopify API
 */

import { callClaude } from "./claude-api.service";
import { ScrapedData } from "./scraper.service";
import { recommendFlows, FlowDefinition } from "../utils/flow-mappings";

export interface BrandAnalysisResult {
  brandVoice: {
    tone: string;
    style: string;
    personality: string[];
    keyPhrases: string[];
  };
  brandColors: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  targetAudience: string;
  valueProposition: string;
  businessModel: string;
  productCategories: string[];
  recommendedFlows: FlowDefinition[];
  sourcesAnalyzed: {
    productsCount: number;
    blogsCount: number;
    hasAboutPage: boolean;
  };
  images: {
    logo?: string;
    hero?: string;
    products: string[];
    lifestyle: string[];
  };
}

/**
 * Analyze brand from scraped website data
 */
export async function analyzeBrand(scrapedData: ScrapedData): Promise<BrandAnalysisResult> {
  console.log(`🧠 Analyzing brand for ${scrapedData.url}`);

  // Build comprehensive brand analysis prompt
  const prompt = buildBrandAnalysisPrompt(scrapedData);

  // Call Claude for brand analysis
  const analysisText = await callClaude(prompt, {
    maxTokens: 3000,
    temperature: 0.7,
    systemPrompt: "You are an expert brand analyst specializing in brand voice, visual identity, and customer positioning. Analyze websites and extract brand characteristics accurately.",
  });

  // Parse Claude's response (expecting JSON)
  const analysis = parseAnalysisResponse(analysisText);

  // Recommend flows based on business model
  const recommendedFlows = recommendFlows(analysis.businessModel);

  return {
    ...analysis,
    recommendedFlows: recommendedFlows.slice(0, 3), // Top 3 recommendations
    sourcesAnalyzed: {
      productsCount: scrapedData.products.length,
      blogsCount: scrapedData.blogPosts.length,
      hasAboutPage: !!scrapedData.aboutContent,
    },
    images: {
      logo: scrapedData.logo,
      hero: scrapedData.images.hero,
      products: scrapedData.images.products,
      lifestyle: scrapedData.images.lifestyle,
    },
  };
}

/**
 * Build brand analysis prompt from scraped data
 */
function buildBrandAnalysisPrompt(data: ScrapedData): string {
  let prompt = `Analyze this brand based on their website content and provide a comprehensive brand analysis.

**Website:** ${data.url}
**Site Name:** ${data.siteName}
**Tagline:** ${data.tagline}
**Description:** ${data.description}
`;

  // Add products/services
  if (data.products.length > 0) {
    prompt += `\n**Products/Services (${data.products.length}):**\n`;
    prompt += data.products.map((p, i) =>
      `${i + 1}. ${p.title}${p.description ? ` - ${p.description.substring(0, 200)}` : ''}${p.price ? ` ($${p.price})` : ''}`
    ).join('\n');
  }

  // Add pricing tiers (for SaaS)
  if (data.pricingTiers && data.pricingTiers.length > 0) {
    prompt += `\n\n**Pricing Tiers (${data.pricingTiers.length}):**\n`;
    prompt += data.pricingTiers.map((tier, i) => {
      let tierText = `${i + 1}. ${tier.name}`;
      if (tier.price) tierText += ` - ${tier.price}`;
      if (tier.features.length > 0) {
        tierText += `\n   Features: ${tier.features.slice(0, 3).join(', ')}`;
      }
      return tierText;
    }).join('\n');
  }

  // Add services (for agencies)
  if (data.servicesOffered && data.servicesOffered.length > 0) {
    prompt += `\n\n**Services Offered:**\n${data.servicesOffered.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }

  // Add blog content
  if (data.blogPosts.length > 0) {
    prompt += `\n\n**Blog/Content (${data.blogPosts.length} posts):**\n`;
    prompt += data.blogPosts.map((b, i) =>
      `${i + 1}. "${b.title}"${b.content ? `\n   ${b.content.substring(0, 300)}...` : ''}`
    ).join('\n\n');
  }

  // Add about content
  if (data.aboutContent) {
    prompt += `\n\n**About/Mission:**\n${data.aboutContent}`;
  }

  prompt += `\n\n---

Provide a JSON response with the following structure (ONLY JSON, no other text):

{
  "brandVoice": {
    "tone": "professional/casual/friendly/authoritative/etc",
    "style": "concise/conversational/storytelling/technical/etc",
    "personality": ["trait1", "trait2", "trait3"],
    "keyPhrases": ["phrase1", "phrase2", "phrase3"]
  },
  "brandColors": {
    "primary": "${data.primaryColor || '#0066FF'}",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE"
  },
  "targetAudience": "Describe the target customer persona",
  "valueProposition": "What unique value does this brand offer?",
  "businessModel": "e-commerce/saas/agency/service-business/content/etc (be specific based on what you see - e.g., 'b2b-saas', 'e-commerce-apparel', 'marketing-agency', 'consulting', etc)",
  "productCategories": ["category1", "category2", "category3"]
}`;

  return prompt;
}

/**
 * Parse Claude's JSON response
 */
function parseAnalysisResponse(text: string): Omit<BrandAnalysisResult, 'recommendedFlows' | 'sourcesAnalyzed'> {
  try {
    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.brandVoice || !parsed.brandColors || !parsed.targetAudience) {
      throw new Error("Invalid analysis response - missing required fields");
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    console.error("Raw response:", text);

    // Return fallback analysis
    return {
      brandVoice: {
        tone: "professional",
        style: "clear",
        personality: ["approachable", "reliable"],
        keyPhrases: [],
      },
      brandColors: {
        primary: "#0066FF",
        secondary: "#0A1E3D",
      },
      targetAudience: "General consumers",
      valueProposition: "Quality products and services",
      businessModel: "unknown",
      productCategories: [],
      images: {
        logo: undefined,
        hero: undefined,
        products: [],
        lifestyle: [],
      },
    };
  }
}
