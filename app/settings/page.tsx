import { ensureAuthenticated } from "@/app/lib/auth/protected";
import { createClient } from "@/app/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const user = await ensureAuthenticated();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, purchased_at")
    .eq("id", user.id)
    .single();

  // Fetch user settings if they exist
  const { data: settings } = await supabase
    .from("user_settings")
    .select("platform, api_key")
    .eq("user_id", user.id)
    .single();

  return (
    <SettingsClient
      user={{ email: user.email!, name: user.user_metadata?.full_name }}
      plan={profile?.plan || "free"}
      currentPlatform={settings?.platform || ""}
      hasApiKey={!!settings?.api_key}
    />
  );
}
