import { ensureAuthenticated } from "@/app/lib/auth/protected";
import { createClient } from "@/app/lib/supabase/server";
import { getUserPurchases, hasUnlimitedAccess } from "@/app/lib/plan-gating";
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

  // Fetch purchases + unlimited status
  const [purchases, isUnlimited] = await Promise.all([
    getUserPurchases(user.id),
    hasUnlimitedAccess(user.id),
  ]);

  return (
    <TemplatesClient
      user={{ email: user.email!, name: user.user_metadata?.full_name }}
      templates={templates || []}
      purchases={purchases}
      isUnlimited={isUnlimited}
    />
  );
}
