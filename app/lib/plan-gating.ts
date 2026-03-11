/**
 * Plan Gating Utility — v2 (Credit-Based)
 * All functions are async and query the purchases table.
 * For client-side (sync) checks, use plan-gating-client.ts
 */

import { createAdminClient } from "./supabase/admin";
import type { Purchase } from "./stripe";

/**
 * Check if user has an active unlimited subscription
 */
export async function hasUnlimitedAccess(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, unlimited_expires_at")
    .eq("id", userId)
    .single();

  if (!profile) return false;
  if (profile.plan !== "unlimited") return false;
  if (!profile.unlimited_expires_at) return false;

  return new Date(profile.unlimited_expires_at) > new Date();
}

/**
 * Check if user can export a specific flow for a specific analysis
 */
export async function canExportFlow(
  userId: string,
  analysisId: string,
  flowId: string
): Promise<boolean> {
  if (await hasUnlimitedAccess(userId)) return true;

  const admin = createAdminClient();

  // Check for full_campaign purchase for this analysis
  const { data: fullCampaign } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .eq("purchase_type", "full_campaign")
    .eq("status", "active")
    .limit(1)
    .single();

  if (fullCampaign) return true;

  // Check for single_flow purchase for this analysis+flow
  const { data: singleFlow } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .eq("flow_id", flowId)
    .eq("purchase_type", "single_flow")
    .eq("status", "active")
    .limit(1)
    .single();

  return !!singleFlow;
}

/**
 * Check if user can export all flows for a specific analysis
 */
export async function canExportAll(
  userId: string,
  analysisId: string
): Promise<boolean> {
  if (await hasUnlimitedAccess(userId)) return true;

  const admin = createAdminClient();
  const { data: fullCampaign } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .eq("purchase_type", "full_campaign")
    .eq("status", "active")
    .limit(1)
    .single();

  return !!fullCampaign;
}

/**
 * Check if user can use AI editing (any active purchase or unlimited)
 */
export async function canAIEdit(userId: string): Promise<boolean> {
  if (await hasUnlimitedAccess(userId)) return true;

  const admin = createAdminClient();
  const { data: anyPurchase } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  return !!anyPurchase;
}

/**
 * Get all active purchases for a user
 */
export async function getUserPurchases(userId: string): Promise<Purchase[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("purchases")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (data || []) as Purchase[];
}

/**
 * Get purchases for a specific analysis
 */
export async function getAnalysisPurchaseStatus(
  userId: string,
  analysisId: string
): Promise<{ hasFullCampaign: boolean; purchasedFlowIds: string[] }> {
  const admin = createAdminClient();
  const { data: purchases } = await admin
    .from("purchases")
    .select("purchase_type, flow_id")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .eq("status", "active");

  const hasFullCampaign = (purchases || []).some(
    (p: any) => p.purchase_type === "full_campaign"
  );
  const purchasedFlowIds = (purchases || [])
    .filter((p: any) => p.purchase_type === "single_flow" && p.flow_id)
    .map((p: any) => p.flow_id as string);

  return { hasFullCampaign, purchasedFlowIds };
}

/**
 * Check if user has any purchase at all (for legacy template access)
 */
export async function hasAnyPurchase(userId: string): Promise<boolean> {
  if (await hasUnlimitedAccess(userId)) return true;

  const admin = createAdminClient();
  const { data } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  return !!data;
}

/**
 * Get plan label for display
 */
export function getPlanLabel(
  isUnlimited: boolean,
  purchaseCount: number
): string {
  if (isUnlimited) return "Unlimited";
  if (purchaseCount > 0) return "Paid";
  return "Free";
}
