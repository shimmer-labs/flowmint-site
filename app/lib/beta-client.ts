/**
 * Client-side beta flag.
 *
 * Mirrors the server-side isBetaOpenAccess() in plan-gating.ts, but readable
 * from "use client" components. NEXT_PUBLIC_ vars are inlined at build time, so
 * this works in the browser. Set NEXT_PUBLIC_BETA_OPEN_ACCESS=true to turn beta
 * on everywhere (the server helper honors the same var).
 *
 * Beta mode = no paywalls/pricing in-app; friction only at the CRM push step.
 * Tear this out when real pricing switches on post-beta.
 */
export function isBetaOpenAccessClient(): boolean {
  return process.env.NEXT_PUBLIC_BETA_OPEN_ACCESS === "true";
}
