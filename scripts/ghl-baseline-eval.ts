/**
 * Baseline eval for FlowMint generation speed and quality.
 * Slice 3 of the GHL plan (references/flowmintv2ghl/plan.md).
 *
 * What it does, for each input URL:
 *   1. Scrape the site (timed).
 *   2. Run brand analysis (timed).
 *   3. Generate every email in one flow (default: welcome, 3 emails) (timed per email).
 *   4. Spot-check quality on each generated email.
 *
 * Output:
 *   - Human-readable summary to stderr (so it shows up in the terminal).
 *   - Full per-URL JSON to stdout (so it pipes cleanly into a file).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/ghl-baseline-eval.ts <urls-file> [--flow=welcome] [--platform=klaviyo] [--format=html]
 *
 * URLs file: one URL per line. Lines starting with # are comments.
 *
 * Calls services directly (bypassing /api/* routes) so we measure raw generation
 * time without HTTP/Next overhead. If we want end-to-end-via-API numbers later,
 * add a second script that hits localhost:3000.
 */

import { readFileSync } from "node:fs";
import { scrapeWebsite } from "../app/services/scraper.service";
import { analyzeBrand } from "../app/services/brand-analysis.service";
import { generateEmail } from "../app/services/email-generator.service";
import { getFlowDefinition } from "../app/utils/flow-mappings";

interface EmailQuality {
  emailNumber: number;
  subjectPresent: boolean;
  preheaderPresent: boolean;
  bodyLengthChars: number;
  emDashCount: number;
  personalizationPresent: boolean;
  failed: boolean;
  error?: string;
}

interface EmailTiming {
  emailNumber: number;
  generateMs: number;
}

interface UrlResult {
  url: string;
  ok: boolean;
  error?: string;
  classification?: {
    businessModel: string;
    voiceTone: string;
    voiceStyle: string;
    productCategories: string[];
    targetAudience: string;
  };
  timing?: {
    scrapeMs: number;
    analyzeMs: number;
    emails: EmailTiming[];
    totalMs: number;
  };
  quality?: EmailQuality[];
}

function parseArgs(argv: string[]): {
  urlsFile: string;
  flowId: string;
  platform: string;
  format: "html" | "plain";
} {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v ?? "true";
    } else {
      positional.push(a);
    }
  }
  if (!positional[0]) {
    console.error(
      "usage: npx tsx --env-file=.env.local scripts/ghl-baseline-eval.ts <urls-file> [--flow=welcome] [--platform=klaviyo] [--format=html]"
    );
    process.exit(1);
  }
  const format = (flags.format ?? "html") as "html" | "plain";
  if (format !== "html" && format !== "plain") {
    console.error(`invalid --format=${format}; use html or plain`);
    process.exit(1);
  }
  return {
    urlsFile: positional[0],
    flowId: flags.flow ?? "welcome",
    platform: flags.platform ?? "klaviyo",
    format,
  };
}

function readUrls(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function platformFirstNameMarker(platform: string): RegExp {
  // Loose check: does the body contain anything that looks like the platform's first-name syntax?
  // We are not enforcing fallback presence here, just "did the generator personalize at all."
  switch (platform) {
    case "klaviyo":
      return /person\.first_name/i;
    case "mailchimp":
      return /\*\|FNAME\|\*/i;
    case "customerio":
      return /customer\.first_name/i;
    case "activecampaign":
      return /%FIRSTNAME%/i;
    case "omnisend":
      return /contact\.firstName/i;
    case "ghl":
      return /contact\.first_name/i;
    default:
      return /first[_-]?name/i;
  }
}

function qualityCheck(
  email: {
    emailNumber: number;
    subject: string;
    preheader: string;
    body: string;
    failed?: boolean;
    error?: string;
  },
  platform: string
): EmailQuality {
  // Em-dashes: count actual char + HTML entity. Brand voice = 0.
  const emDashCount =
    (email.body.match(/—/g)?.length ?? 0) +
    (email.body.match(/&mdash;/gi)?.length ?? 0) +
    (email.subject.match(/—/g)?.length ?? 0) +
    (email.preheader.match(/—/g)?.length ?? 0);

  return {
    emailNumber: email.emailNumber,
    subjectPresent: email.subject.trim().length > 0 && email.subject !== "Welcome!",
    preheaderPresent: email.preheader.trim().length > 0,
    bodyLengthChars: email.body.length,
    emDashCount,
    personalizationPresent: platformFirstNameMarker(platform).test(email.body),
    failed: !!email.failed,
    error: email.error,
  };
}

async function evalOne(
  url: string,
  flowId: string,
  platform: string,
  format: "html" | "plain"
): Promise<UrlResult> {
  const result: UrlResult = { url, ok: false };
  const flow = getFlowDefinition(flowId);
  if (!flow) {
    result.error = `Unknown flow id: ${flowId}`;
    return result;
  }

  const t0 = Date.now();
  let scraped;
  try {
    scraped = await scrapeWebsite(url);
  } catch (err: any) {
    result.error = `scrape failed: ${err?.message ?? err}`;
    return result;
  }
  const tScrape = Date.now();

  let analysis;
  try {
    // analyzeBrand now returns { analysis, usage }; this eval only needs analysis.
    ({ analysis } = await analyzeBrand(scraped));
  } catch (err: any) {
    result.error = `analyze failed: ${err?.message ?? err}`;
    return result;
  }
  const tAnalyze = Date.now();

  const emailTimings: EmailTiming[] = [];
  const qualities: EmailQuality[] = [];
  for (let n = 1; n <= flow.emailCount; n++) {
    const t = Date.now();
    const email = await generateEmail({
      flow,
      emailNumber: n,
      brandAnalysis: analysis,
      platform,
      format,
    });
    const generateMs = Date.now() - t;
    emailTimings.push({ emailNumber: n, generateMs });
    qualities.push(
      qualityCheck(
        {
          emailNumber: n,
          subject: email.subject,
          preheader: email.preheader,
          body: email.body,
          failed: email.failed,
          error: email.error,
        },
        platform
      )
    );
  }
  const tEnd = Date.now();

  result.ok = true;
  result.classification = {
    businessModel: analysis.businessModel,
    voiceTone: analysis.brandVoice.tone,
    voiceStyle: analysis.brandVoice.style,
    productCategories: analysis.productCategories,
    targetAudience: analysis.targetAudience,
  };
  result.timing = {
    scrapeMs: tScrape - t0,
    analyzeMs: tAnalyze - tScrape,
    emails: emailTimings,
    totalMs: tEnd - t0,
  };
  result.quality = qualities;
  return result;
}

function summarize(results: UrlResult[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(72));
  lines.push("BASELINE EVAL SUMMARY");
  lines.push("=".repeat(72));

  for (const r of results) {
    lines.push("");
    lines.push(`URL: ${r.url}`);
    if (!r.ok) {
      lines.push(`  ❌ ${r.error}`);
      continue;
    }
    const t = r.timing!;
    const c = r.classification!;
    const q = r.quality!;
    lines.push(
      `  classified as: ${c.businessModel} (tone=${c.voiceTone}, style=${c.voiceStyle})`
    );
    lines.push(
      `  product categories: ${c.productCategories.join(", ") || "(none)"}`
    );
    lines.push(`  target audience: ${c.targetAudience}`);
    lines.push(
      `  timing: scrape=${t.scrapeMs}ms analyze=${t.analyzeMs}ms total=${t.totalMs}ms`
    );
    lines.push(
      `  per-email gen: ${t.emails
        .map((e) => `#${e.emailNumber}=${e.generateMs}ms`)
        .join(" ")}`
    );
    for (const e of q) {
      const flags: string[] = [];
      if (e.failed) flags.push("❌FAILED");
      if (!e.subjectPresent) flags.push("⚠no-subject");
      if (!e.preheaderPresent) flags.push("⚠no-preheader");
      if (e.bodyLengthChars < 200) flags.push(`⚠body=${e.bodyLengthChars}ch`);
      if (e.emDashCount > 0) flags.push(`❌em-dash×${e.emDashCount}`);
      if (!e.personalizationPresent) flags.push("⚠no-personalization");
      lines.push(
        `  email #${e.emailNumber}: ${flags.length ? flags.join(" ") : "✅ ok"}`
      );
    }
  }

  // Aggregates over successful runs only
  const ok = results.filter((r) => r.ok);
  if (ok.length > 0) {
    const totalTimes = ok.map((r) => r.timing!.totalMs).sort((a, b) => a - b);
    const median = totalTimes[Math.floor(totalTimes.length / 2)];
    const allEmailTimes = ok.flatMap((r) =>
      r.timing!.emails.map((e) => e.generateMs)
    );
    allEmailTimes.sort((a, b) => a - b);
    const emailMedian = allEmailTimes[Math.floor(allEmailTimes.length / 2)];
    const emailP95 = allEmailTimes[Math.floor(allEmailTimes.length * 0.95)];

    const emDashUrls = ok.filter((r) =>
      r.quality!.some((q) => q.emDashCount > 0)
    ).length;

    lines.push("");
    lines.push("-".repeat(72));
    lines.push(`URLs processed: ${ok.length}/${results.length}`);
    lines.push(
      `End-to-end median: ${median}ms (scrape + analyze + ${
        ok[0].timing!.emails.length
      } emails)`
    );
    lines.push(
      `Per-email generation: median ${emailMedian}ms, p95 ${emailP95}ms`
    );
    lines.push(`URLs with em-dashes in output: ${emDashUrls}/${ok.length}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const { urlsFile, flowId, platform, format } = parseArgs(process.argv);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY not set. Run with: npx tsx --env-file=.env.local scripts/ghl-baseline-eval.ts ..."
    );
    process.exit(1);
  }
  const urls = readUrls(urlsFile);
  if (urls.length === 0) {
    console.error(`No URLs in ${urlsFile}`);
    process.exit(1);
  }
  console.error(
    `Evaluating ${urls.length} URL(s) on flow=${flowId} platform=${platform} format=${format}\n`
  );

  const results: UrlResult[] = [];
  for (const url of urls) {
    console.error(`→ ${url}`);
    const r = await evalOne(url, flowId, platform, format);
    if (r.ok) {
      console.error(
        `  ✓ ${r.timing!.totalMs}ms (${r.classification!.businessModel})`
      );
    } else {
      console.error(`  ✗ ${r.error}`);
    }
    results.push(r);
  }

  console.error(summarize(results));
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((err) => {
  console.error("eval crashed:", err);
  process.exit(1);
});
