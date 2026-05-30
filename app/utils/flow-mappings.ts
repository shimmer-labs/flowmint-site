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
  },

  // --- Service-business flows (local service / contractor / appointment-based) ---
  "post-job-followup": {
    id: "post-job-followup",
    name: "Post-Job Follow-Up",
    emailCount: 3,
    priority: "High",
    description: "Thank customers after the job, confirm they're happy, and earn the review"
  },
  "seasonal-maintenance": {
    id: "seasonal-maintenance",
    name: "Seasonal Maintenance Reminder",
    emailCount: 2,
    priority: "High",
    description: "Bring past customers back for seasonal tune-ups and service"
  },
  "estimate-followup": {
    id: "estimate-followup",
    name: "Estimate Follow-Up",
    emailCount: 3,
    priority: "High",
    description: "Win back leads who got a quote but haven't booked yet"
  },
  referral: {
    id: "referral",
    name: "Referral Request",
    emailCount: 2,
    priority: "Medium",
    description: "Turn happy customers into word-of-mouth referrals"
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
 * Is this business model a local-service / contractor / appointment-based business
 * (vs e-commerce)? The beta cohort is overwhelmingly the former (HVAC, roofing,
 * fencing, photography), and their playbook is different from a store's.
 */
export function isServiceBusiness(businessModel: string): boolean {
  const m = (businessModel || "").toLowerCase();
  const ecom = m.includes("ecommerce") || m.includes("e-commerce") || m.includes("store") || m.includes("retail") || m.includes("shop");
  return !ecom;
}

// Ordered playbooks (strongest first). The first 3 become the headline
// recommendations (brand-analysis slices the top 3); the rest are the
// "full playbook" shown greyed on the results page.
const SERVICE_PLAYBOOK = [
  "welcome",
  "post-job-followup",
  "review-request",
  "seasonal-maintenance",
  "about-to-lapse",
  "estimate-followup",
  "referral",
  "feedback-survey",
];

const ECOM_PLAYBOOK = [
  "welcome",
  "cart-abandonment",
  "checkout-abandonment",
  "post-purchase-onboarding",
  "back-in-stock",
  "cross-sell",
  "about-to-lapse",
  "review-request",
  "feedback-survey",
];

/**
 * Ordered list of flow IDs that a business of this type should run
 * (recommended-first). Drives both the headline recommendations and the
 * greyed "full playbook" on the results page.
 */
export function playbookFor(businessModel: string): string[] {
  return isServiceBusiness(businessModel) ? SERVICE_PLAYBOOK : ECOM_PLAYBOOK;
}

/**
 * Recommend flows based on business model (full ordered playbook for the type).
 */
export function recommendFlows(businessModel: string): FlowDefinition[] {
  return playbookFor(businessModel)
    .map((id) => FLOW_DEFINITIONS[id])
    .filter(Boolean);
}
