import { ensureAuthenticated } from "@/app/lib/auth/protected";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getUserPurchases, hasUnlimitedAccess } from "@/app/lib/plan-gating";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const user = await ensureAuthenticated();
  const supabase = await createClient();

  // Fetch purchases + unlimited status
  const [purchases, isUnlimited] = await Promise.all([
    getUserPurchases(user.id),
    hasUnlimitedAccess(user.id),
  ]);

  // Fetch profile for stripe_customer_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, unlimited_expires_at")
    .eq("id", user.id)
    .single();

  // Fetch user settings if they exist
  const { data: settings } = await supabase
    .from("user_settings")
    .select("platform, api_key")
    .eq("user_id", user.id)
    .single();

  // Fetch GHL connections (via admin client so we get a clean read regardless of RLS quirks)
  const admin = createAdminClient();
  const { data: ghlConnections } = await admin
    .from("ghl_connections")
    .select("id, location_id, location_label, auth_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <SettingsClient
      user={{ email: user.email!, name: user.user_metadata?.full_name }}
      purchases={purchases}
      isUnlimited={isUnlimited}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      unlimitedExpiresAt={profile?.unlimited_expires_at || null}
      currentPlatform={settings?.platform || ""}
      hasApiKey={!!settings?.api_key}
      initialGhlConnections={ghlConnections || []}
    />
  );
}
