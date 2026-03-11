/**
 * Client-side plan gating helpers (synchronous)
 * Operate on pre-fetched purchase arrays passed from server components.
 */

import type { Purchase } from "./stripe";

/**
 * Can user export a specific flow for a specific analysis?
 */
export function canExportFlowClient(
  purchases: Purchase[],
  isUnlimited: boolean,
  analysisId: string,
  flowId: string
): boolean {
  if (isUnlimited) return true;

  return purchases.some(
    (p) =>
      p.status === "active" &&
      p.analysis_id === analysisId &&
      (p.purchase_type === "full_campaign" ||
        (p.purchase_type === "single_flow" && p.flow_id === flowId))
  );
}

/**
 * Can user export all flows for a specific analysis?
 */
export function canExportAllClient(
  purchases: Purchase[],
  isUnlimited: boolean,
  analysisId: string
): boolean {
  if (isUnlimited) return true;

  return purchases.some(
    (p) =>
      p.status === "active" &&
      p.analysis_id === analysisId &&
      p.purchase_type === "full_campaign"
  );
}

/**
 * Does user have any active purchase at all?
 */
export function hasAnyPurchaseClient(
  purchases: Purchase[],
  isUnlimited: boolean
): boolean {
  if (isUnlimited) return true;
  return purchases.some((p) => p.status === "active");
}

/**
 * Get purchased flow IDs for a specific analysis
 */
export function getPurchasedFlowIds(
  purchases: Purchase[],
  analysisId: string
): string[] {
  return purchases
    .filter(
      (p) =>
        p.status === "active" &&
        p.analysis_id === analysisId &&
        p.purchase_type === "single_flow" &&
        p.flow_id
    )
    .map((p) => p.flow_id!);
}

/**
 * Does user have full campaign access for this analysis?
 */
export function hasFullCampaignClient(
  purchases: Purchase[],
  isUnlimited: boolean,
  analysisId: string
): boolean {
  if (isUnlimited) return true;
  return purchases.some(
    (p) =>
      p.status === "active" &&
      p.analysis_id === analysisId &&
      p.purchase_type === "full_campaign"
  );
}

/**
 * Get display label for user's billing status
 */
export function getPlanLabel(
  isUnlimited: boolean,
  purchaseCount: number
): string {
  if (isUnlimited) return "Unlimited";
  if (purchaseCount > 0) return "Paid";
  return "Free";
}
