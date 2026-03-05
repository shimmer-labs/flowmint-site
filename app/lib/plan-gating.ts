/**
 * Plan Gating Utility
 * Determines what features/flows a user can access based on their plan
 */

import { PLANS, type PlanId } from "./stripe";

export function isPaidPlan(plan: string): boolean {
  return plan === "essentials" || plan === "complete" || plan === "premium";
}

export function canExport(plan: string): boolean {
  return isPaidPlan(plan);
}

export function canPush(plan: string): boolean {
  return isPaidPlan(plan);
}

export function canExportFlow(plan: string, flowId: string): boolean {
  if (!isPaidPlan(plan)) return false;

  const planDef = PLANS[plan as PlanId];
  if (!planDef) return false;

  // Complete and Premium can export all flows
  if (planDef.allowedFlows === null) return true;

  // Essentials can only export specific flows
  return (planDef.allowedFlows as readonly string[]).includes(flowId);
}

export function canAIEdit(plan: string): boolean {
  return plan === "complete" || plan === "premium";
}

export function canAccessCampaignCalendar(plan: string): boolean {
  return plan === "premium";
}

export function getAllowedFlows(plan: string): readonly string[] | null {
  if (!isPaidPlan(plan)) return [];

  const planDef = PLANS[plan as PlanId];
  if (!planDef) return [];

  return planDef.allowedFlows;
}

export function getPlanLabel(plan: string): string {
  switch (plan) {
    case "essentials": return "Essentials";
    case "complete": return "Complete";
    case "premium": return "Premium";
    default: return "Free";
  }
}
