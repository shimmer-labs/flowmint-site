/**
 * API Route: Generate Email
 * Generates a single email for a specific flow using Claude AI
 */

import { NextRequest, NextResponse } from "next/server";
import { generateEmail } from "@/app/services/email-generator.service";
import { BrandAnalysisResult } from "@/app/services/brand-analysis.service";
import { FlowDefinition } from "@/app/utils/flow-mappings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flow, emailNumber = 1, brandAnalysis, platform = "klaviyo", format = "html" } = body;

    // Validate inputs
    if (!flow || !brandAnalysis) {
      return NextResponse.json(
        { error: "Missing required fields: flow, brandAnalysis" },
        { status: 400 }
      );
    }

    if (emailNumber < 1 || emailNumber > flow.emailCount) {
      return NextResponse.json(
        { error: `Invalid emailNumber. Must be between 1 and ${flow.emailCount}` },
        { status: 400 }
      );
    }

    // Generate email
    const generatedEmail = await generateEmail({
      flow: flow as FlowDefinition,
      emailNumber,
      brandAnalysis: brandAnalysis as BrandAnalysisResult,
      platform,
      format,
    });

    return NextResponse.json({
      success: true,
      email: generatedEmail,
    });
  } catch (error: any) {
    console.error("Email generation error:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to generate email",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
