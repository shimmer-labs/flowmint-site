/**
 * API Route: Push to Platform
 * Pushes email templates to the user's email marketing platform
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { canPush } from "@/app/lib/plan-gating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PushResult {
  templateId: string;
  success: boolean;
  platformTemplateId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check plan
    const { data: profile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (!canPush(profile?.plan || "free")) {
      return NextResponse.json({ error: "Upgrade to push templates" }, { status: 403 });
    }

    const body = await request.json();
    const { templateIds, platform, apiKey } = body;

    if (!templateIds?.length || !platform || !apiKey) {
      return NextResponse.json(
        { error: "Missing templateIds, platform, or apiKey" },
        { status: 400 }
      );
    }

    // Fetch templates
    const { data: templates, error } = await admin
      .from("email_templates")
      .select("*")
      .eq("user_id", user.id)
      .in("id", templateIds);

    if (error || !templates?.length) {
      return NextResponse.json({ error: "No templates found" }, { status: 404 });
    }

    // Push each template
    const results: PushResult[] = [];

    for (const template of templates) {
      try {
        const platformId = await pushTemplate(platform, apiKey, template);
        results.push({
          templateId: template.id,
          success: true,
          platformTemplateId: platformId,
        });

        // Track push in DB
        await admin
          .from("email_templates")
          .update({ pushed_to_platform: platform, pushed_at: new Date().toISOString() })
          .eq("id", template.id);
      } catch (err: any) {
        results.push({
          templateId: template.id,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      total: templates.length,
      pushed: successCount,
      failed: templates.length - successCount,
      results,
    });
  } catch (error: any) {
    console.error("Push error:", error);
    return NextResponse.json(
      { error: error.message || "Push failed" },
      { status: 500 }
    );
  }
}

async function pushTemplate(platform: string, apiKey: string, template: any): Promise<string> {
  switch (platform) {
    case "klaviyo":
      return pushToKlaviyo(apiKey, template);
    case "mailchimp":
      return pushToMailchimp(apiKey, template);
    case "activecampaign":
      return pushToActiveCampaign(apiKey, template);
    case "customerio":
      return pushToCustomerIO(apiKey, template);
    case "omnisend":
      return pushToOmnisend(apiKey, template);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function pushToKlaviyo(apiKey: string, template: any): Promise<string> {
  const res = await fetch("https://a.klaviyo.com/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: "2024-10-15",
    },
    body: JSON.stringify({
      data: {
        type: "template",
        attributes: {
          name: `${template.flow_name} - Email ${template.email_number}: ${template.subject}`,
          html: template.body,
        },
      },
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.detail || `Klaviyo API error (${res.status})`);
  }

  const data = await res.json();
  return data.data?.id || "";
}

async function pushToMailchimp(apiKey: string, template: any): Promise<string> {
  // Mailchimp API key format: key-dc (e.g., abc123-us14)
  const dc = apiKey.split("-").pop() || "us1";

  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: `${template.flow_name} - Email ${template.email_number}`,
      html: template.body,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `Mailchimp API error (${res.status})`);
  }

  const data = await res.json();
  return String(data.id || "");
}

async function pushToActiveCampaign(apiKey: string, template: any): Promise<string> {
  // AC API key doesn't encode the URL, user provides it in settings
  // For now, we'll extract the base URL from a header or require it
  // ActiveCampaign URL format: https://yourname.api-us1.com
  throw new Error("ActiveCampaign push coming soon — use ZIP export for now");
}

async function pushToCustomerIO(apiKey: string, template: any): Promise<string> {
  throw new Error("Customer.io push coming soon — use ZIP export for now");
}

async function pushToOmnisend(apiKey: string, template: any): Promise<string> {
  throw new Error("Omnisend push coming soon — use ZIP export for now");
}
