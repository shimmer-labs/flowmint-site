/**
 * API Route: Push to Platform
 * Pushes email templates to the user's email marketing platform (purchase-gated)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getUserPurchases, hasUnlimitedAccess, hasAnyPurchase } from "@/app/lib/plan-gating";
import { canExportFlowClient } from "@/app/lib/plan-gating-client";
import { ghlFetch } from "@/app/lib/ghl/client";

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

    const body = await request.json();
    const { templateIds, platform, apiKey, analysisId, ghlLocationId } = body;

    if (!templateIds?.length || !platform) {
      return NextResponse.json(
        { error: "Missing templateIds or platform" },
        { status: 400 }
      );
    }

    // GHL uses a stored PIT/OAuth connection, not a request-body apiKey.
    // Every other platform still needs an apiKey from the request.
    if (platform !== "ghl" && !apiKey) {
      return NextResponse.json(
        { error: "Missing apiKey" },
        { status: 400 }
      );
    }
    if (platform === "ghl" && !ghlLocationId) {
      return NextResponse.json(
        { error: "Missing ghlLocationId (pick a connected GHL location)" },
        { status: 400 }
      );
    }

    // Fetch purchases once
    const [purchases, isUnlimited] = await Promise.all([
      getUserPurchases(user.id),
      hasUnlimitedAccess(user.id),
    ]);

    // If no analysisId, check for any purchase (legacy templates)
    if (!analysisId) {
      const hasAccess = await hasAnyPurchase(user.id);
      if (!hasAccess) {
        return NextResponse.json({ error: "Purchase required to push templates" }, { status: 403 });
      }
    }

    const admin = createAdminClient();

    // Fetch templates
    const { data: templates, error } = await admin
      .from("email_templates")
      .select("*")
      .eq("user_id", user.id)
      .in("id", templateIds);

    if (error || !templates?.length) {
      return NextResponse.json({ error: "No templates found" }, { status: 404 });
    }

    // Filter by purchase access
    const accessible = analysisId
      ? templates.filter((t: any) =>
          canExportFlowClient(purchases, isUnlimited, analysisId, t.flow_id)
        )
      : templates;

    if (accessible.length === 0) {
      return NextResponse.json({ error: "No accessible templates for your purchases" }, { status: 403 });
    }

    // Push each template
    const results: PushResult[] = [];

    for (const template of accessible) {
      try {
        const platformId =
          platform === "ghl"
            ? await pushToGHL(user.id, ghlLocationId, template)
            : await pushTemplate(platform, apiKey, template);
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
      total: accessible.length,
      pushed: successCount,
      failed: accessible.length - successCount,
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
  throw new Error("ActiveCampaign push coming soon — use ZIP export for now");
}

async function pushToCustomerIO(apiKey: string, template: any): Promise<string> {
  throw new Error("Customer.io push coming soon — use ZIP export for now");
}

async function pushToOmnisend(apiKey: string, template: any): Promise<string> {
  throw new Error("Omnisend push coming soon — use ZIP export for now");
}

/**
 * Lazily ensure a "FlowMint" folder exists in the user's GHL location and
 * return its ID. Caches the ID on the ghl_connections row so we only call
 * GHL's create-folder endpoint once per location.
 *
 * GHL has no public list-folders endpoint, so this can't dedupe against a
 * folder the user (or a previous probe) made manually. If the cached ID is
 * stale (folder deleted from GHL UI), the push will fail; the user removes
 * the cached ID by reconnecting the location in Settings.
 */
async function ensureFlowMintFolder(
  userId: string,
  locationId: string
): Promise<string> {
  const admin = createAdminClient();
  const { data: conn, error: loadErr } = await admin
    .from("ghl_connections")
    .select("id, flowmint_folder_id")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (loadErr) throw new Error(`load connection failed: ${loadErr.message}`);
  if (!conn) throw new Error(`no connection for location ${locationId}`);
  if (conn.flowmint_folder_id) return conn.flowmint_folder_id;

  // No cached folder ID; create one and persist.
  const createUrl = `https://services.leadconnectorhq.com/emails/public/v2/locations/${locationId}/templates/folders`;
  const createRes = await ghlFetch(userId, locationId, createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Version: "2023-02-21" },
    body: JSON.stringify({ name: "FlowMint" }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new Error(
      `GHL create-folder failed (${createRes.status}): ${text.slice(0, 200)}`
    );
  }

  const folder = await createRes.json().catch(() => ({}));
  if (!folder.id) {
    throw new Error("GHL create-folder response missing id field");
  }

  await admin
    .from("ghl_connections")
    .update({ flowmint_folder_id: folder.id })
    .eq("id", conn.id);

  return folder.id;
}

/**
 * Push one template to GHL as a public V2 email template, into the location's
 * FlowMint folder (created lazily on first push).
 *
 * Endpoint and shape from GHL's live docs (verified 2026-05-28):
 *   POST https://services.leadconnectorhq.com/emails/public/v2/locations/{locationId}/templates
 *   Headers: Version: 2023-02-21
 *   Body: { name, editorType: "html", editorContent, subjectLine, previewText, parentFolderId }
 *   Response: { id, name, editorType, subjectLine, previewText, previewUrl, ... }
 *
 * Verified that previewUrl returns the exact HTML we sent (including merge
 * fields with fallbacks), so this endpoint actually accepts raw HTML.
 *
 * NOTE: there is also a `POST /emails/builder` endpoint that returns 201 but
 * silently drops the payload and creates a starter template. Do not use it.
 *
 * Returns the GHL template ID so the caller can surface it.
 */
async function pushToGHL(
  userId: string,
  locationId: string,
  template: any
): Promise<string> {
  const parentFolderId = await ensureFlowMintFolder(userId, locationId);
  const name = `${template.flow_name} - Email ${template.email_number}: ${template.subject}`;
  const url = `https://services.leadconnectorhq.com/emails/public/v2/locations/${locationId}/templates`;
  const res = await ghlFetch(userId, locationId, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // This endpoint requires the newer Version header, not the default.
      Version: "2023-02-21",
    },
    body: JSON.stringify({
      name,
      editorType: "html",
      editorContent: template.body,
      subjectLine: template.subject || "",
      previewText: template.preheader || "",
      parentFolderId,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error(
        "GHL rejected the token. Rotate or re-connect this GHL location in Settings."
      );
    }
    if (res.status === 403) {
      throw new Error(
        "GHL token missing emails/builder.write scope. Edit the integration in GHL and re-add scopes."
      );
    }
    throw new Error(`GHL push failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => ({}));
  return data.id || "";
}
