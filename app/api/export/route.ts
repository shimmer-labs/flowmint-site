/**
 * API Route: Export Templates as ZIP
 * Builds a ZIP file from user's generated templates
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { canExportFlow, isPaidPlan } from "@/app/lib/plan-gating";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get plan
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan || "free";
    if (!isPaidPlan(plan)) {
      return NextResponse.json({ error: "Upgrade to export templates" }, { status: 403 });
    }

    const body = await request.json();
    const { flowIds } = body;

    if (!flowIds?.length) {
      return NextResponse.json({ error: "No flow IDs provided" }, { status: 400 });
    }

    // Fetch templates
    const { data: templates, error } = await admin
      .from("email_templates")
      .select("*")
      .eq("user_id", user.id)
      .in("flow_id", flowIds)
      .order("flow_name")
      .order("email_number");

    if (error || !templates?.length) {
      return NextResponse.json({ error: "No templates found" }, { status: 404 });
    }

    // Filter by plan access
    const accessible = templates.filter((t: any) => canExportFlow(plan, t.flow_id));

    if (accessible.length === 0) {
      return NextResponse.json({ error: "No accessible templates for your plan" }, { status: 403 });
    }

    // Build ZIP
    const zip = new JSZip();
    const root = zip.folder("FlowMint-Templates")!;

    // Group by flow
    const flowMap = new Map<string, any[]>();
    for (const t of accessible) {
      if (!flowMap.has(t.flow_id)) flowMap.set(t.flow_id, []);
      flowMap.get(t.flow_id)!.push(t);
    }

    for (const [flowId, flowTemplates] of flowMap) {
      const flowFolder = root.folder(flowId)!;

      for (const t of flowTemplates) {
        const safeName = t.subject
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .replace(/\s+/g, "-")
          .toLowerCase()
          .slice(0, 50);

        const ext = t.format === "html" ? "html" : "txt";
        const filename = `email-${t.email_number}-${safeName}.${ext}`;

        const content = t.format === "html"
          ? `<!-- Subject: ${t.subject} -->\n<!-- Preheader: ${t.preheader} -->\n${t.body}`
          : `Subject: ${t.subject}\nPreheader: ${t.preheader}\n\n${t.body}`;

        flowFolder.file(filename, content);
      }
    }

    // Add metadata
    const metadata = {
      exportedAt: new Date().toISOString(),
      platform: accessible[0]?.platform || "unknown",
      flows: Array.from(flowMap.entries()).map(([id, templates]) => ({
        flowId: id,
        flowName: templates[0]?.flow_name,
        emailCount: templates.length,
      })),
      totalTemplates: accessible.length,
    };
    root.file("metadata.json", JSON.stringify(metadata, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "blob" });

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="flowmint-templates.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    );
  }
}
