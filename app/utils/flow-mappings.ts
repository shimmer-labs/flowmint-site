/**
 * Flow Mappings
 * Single source of truth for flow IDs, names, and metadata
 * Ported directly from ottomate - works the same for any brand
 */

export interface FlowDefinition {
  id: string;
  name: string;
  emailCount: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  description: string;
  requiresEcommerce?: boolean;
  requiresSubscriptions?: boolean;
}

export const FLOW_DEFINITIONS: Record<string, FlowDefinition> = {
  welcome: {
    id: "welcome",
    name: "Welcome Series",
    emailCount: 3,
    priority: "Critical",
    description: "Welcome new subscribers and drive first action"
  },
  "cart-abandonment": {
    id: "cart-abandonment",
    name: "Cart Abandonment",
    emailCount: 3,
    priority: "High",
    description: "Recover abandoned carts automatically",
    requiresEcommerce: true
  },
  "checkout-abandonment": {
    id: "checkout-abandonment",
    name: "Checkout Abandonment",
    emailCount: 3,
    priority: "High",
    description: "Recover checkout abandons with urgency",
    requiresEcommerce: true
  },
  "back-in-stock": {
    id: "back-in-stock",
    name: "Back in Stock",
    emailCount: 1,
    priority: "High",
    description: "Notify customers when items return",
    requiresEcommerce: true
  },
  "about-to-lapse": {
    id: "about-to-lapse",
    name: "Win-Back Campaign",
    emailCount: 3,
    priority: "High",
    description: "Re-engage inactive customers"
  },
  "cross-sell": {
    id: "cross-sell",
    name: "Cross-Sell Campaign",
    emailCount: 2,
    priority: "Medium",
    description: "Recommend complementary products or services",
    requiresEcommerce: true
  },
  "post-purchase-onboarding": {
    id: "post-purchase-onboarding",
    name: "Post-Purchase Onboarding",
    emailCount: 3,
    priority: "High",
    description: "Help customers get the most from their purchase",
    requiresEcommerce: true
  },
  "review-request": {
    id: "review-request",
    name: "Review Request",
    emailCount: 2,
    priority: "High",
    description: "Collect reviews to build social proof"
  },
  "feedback-survey": {
    id: "feedback-survey",
    name: "Feedback Survey",
    emailCount: 1,
    priority: "Medium",
    description: "Gather customer feedback"
  }
} as const;

/**
 * Get flow ID from name (case-insensitive)
 */
export function getFlowIdFromName(name: string): string | null {
  const entries = Object.entries(FLOW_DEFINITIONS);
  const match = entries.find(([_, def]) =>
    def.name.toLowerCase() === name.toLowerCase()
  );
  return match ? match[0] : null;
}

/**
 * Get flow definition by ID
 */
export function getFlowDefinition(id: string) {
  return FLOW_DEFINITIONS[id as keyof typeof FLOW_DEFINITIONS];
}

/**
 * Get all flow definitions
 */
export function getAllFlows(): FlowDefinition[] {
  return Object.values(FLOW_DEFINITIONS);
}

/**
 * Recommend flows based on business model
 */
export function recommendFlows(businessModel: string): FlowDefinition[] {
  const allFlows = getAllFlows();

  // E-commerce gets all flows
  if (businessModel.toLowerCase().includes('ecommerce') ||
      businessModel.toLowerCase().includes('e-commerce') ||
      businessModel.toLowerCase().includes('store')) {
    return allFlows;
  }

  // SaaS/Service businesses - exclude product-specific flows
  return allFlows.filter(flow => !flow.requiresEcommerce);
}
