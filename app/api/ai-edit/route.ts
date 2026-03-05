/**
 * API Route: AI Template Edit
 * Uses Claude to make surgical edits to email templates
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { canAIEdit } from "@/app/lib/plan-gating";
import { callClaude } from "@/app/services/claude-api.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    if (!canAIEdit(profile?.plan || "free")) {
      return NextResponse.json(
        { error: "AI editing requires Complete or Premium plan" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { templateId, editPrompt } = body;

    if (!templateId || !editPrompt) {
      return NextResponse.json(
        { error: "Missing templateId or editPrompt" },
        { status: 400 }
      );
    }

    // Fetch template
    const { data: template, error: fetchError } = await admin
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Fetch brand analysis for context (optional)
    let brandContext = "";
    if (template.analysis_id) {
      const { data: analysis } = await admin
        .from("brand_analyses")
        .select("analysis")
        .eq("id", template.analysis_id)
        .single();

      if (analysis?.analysis) {
        const a = analysis.analysis;
        brandContext = `
Brand Context:
- Voice: ${a.brandVoice?.tone}, ${a.brandVoice?.style}
- Colors: ${a.brandColors?.primary}, ${a.brandColors?.secondary}
- Business: ${a.businessModel}
`;
      }
    }

    // Call Claude for surgical edit
    const prompt = `You are editing an existing email template. Make ONLY the change described below. Do NOT rewrite, improve, or modify any other part of the email.

EDIT INSTRUCTION: ${editPrompt}

${brandContext}

CURRENT EMAIL:
Subject: ${template.subject}
Preheader: ${template.preheader}
Body:
${template.body}

Respond with ONLY valid JSON (no markdown code blocks):
{
  "subject": "the subject line (changed ONLY if the edit requires it, otherwise keep identical)",
  "preheader": "the preheader (changed ONLY if the edit requires it, otherwise keep identical)",
  "body": "the full email body with the requested change applied"
}

CRITICAL: Make the MINIMUM change needed. If the edit says "make the CTA more urgent", only change the CTA text. Don't touch anything else.`;

    const response = await callClaude(prompt, {
      maxTokens: 3000,
      temperature: 0,
      systemPrompt: "You are a precise email editor. You make surgical, targeted changes to email templates. Output only valid JSON.",
    });

    // Parse response
    let edited;
    try {
      // Strip markdown code blocks if present
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      edited = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI edit response:", response);
      return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 500 });
    }

    if (!edited.subject || !edited.body) {
      return NextResponse.json({ error: "AI returned incomplete response" }, { status: 500 });
    }

    // Update template in Supabase
    const { error: updateError } = await admin
      .from("email_templates")
      .update({
        subject: edited.subject,
        preheader: edited.preheader || template.preheader,
        body: edited.body,
      })
      .eq("id", templateId);

    if (updateError) {
      console.error("Failed to update template:", updateError);
      return NextResponse.json({ error: "Failed to save edit" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        subject: edited.subject,
        preheader: edited.preheader || template.preheader,
        body: edited.body,
      },
    });
  } catch (error: any) {
    console.error("AI edit error:", error);
    return NextResponse.json(
      { error: error.message || "AI edit failed" },
      { status: 500 }
    );
  }
}
