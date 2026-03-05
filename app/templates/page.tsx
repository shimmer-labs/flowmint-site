import { ensureAuthenticated } from "@/app/lib/auth/protected";
import { createClient } from "@/app/lib/supabase/server";
import TemplatesClient from "./TemplatesClient";

export default async function TemplatesPage() {
  const user = await ensureAuthenticated();
  const supabase = await createClient();

  // Fetch user's templates
  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("flow_name", { ascending: true })
    .order("email_number", { ascending: true });

  // Fetch user plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, purchased_at")
    .eq("id", user.id)
    .single();

  return (
    <TemplatesClient
      user={{ email: user.email!, name: user.user_metadata?.full_name }}
      templates={templates || []}
      plan={profile?.plan || "free"}
    />
  );
}
