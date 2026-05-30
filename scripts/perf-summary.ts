/**
 * Generation performance summary.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/perf-summary.ts [days]
 *
 * Reads the perf-metric columns added in migration-007 (gen_ms, token counts,
 * model, prompt_version on email_templates; scrape/analyze metrics on
 * brand_analyses) and prints, over the last N days (default 7):
 *   - per-flow rolling median + p95 gen_ms, cache hit rate, token totals
 *   - overall email-gen median + p95 + cache hit rate
 *   - token totals grouped by model + prompt_version
 *   - a short brand-analysis (scrape/analyze) latency line
 *
 * This is the eval-workstream readout for "is generation staying fast?" — run
 * it after any prompt/model change and compare against the COORDINATION.md log.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing env vars. Run with: npx tsx --env-file=.env.local scripts/perf-summary.ts [days]"
  );
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const DAYS = Number(process.argv[2]) || 7;
const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

/** Median of a numeric array (returns 0 for empty). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Nearest-rank percentile (p in 0..100). */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1];
}

/** Cache hit rate = cached input / total prompt tokens, as a 0..1 fraction. */
function cacheHitRate(read: number, create: number, input: number): number {
  const total = read + create + input;
  return total === 0 ? 0 : read / total;
}

function ms(n: number): string {
  return `${(n / 1000).toFixed(1)}s`;
}

interface EmailRow {
  flow_id: string;
  flow_name: string | null;
  gen_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_create_tokens: number | null;
  model: string | null;
  prompt_version: string | null;
}

interface AnalysisRow {
  scrape_ms: number | null;
  analyze_ms: number | null;
  analyze_input_tokens: number | null;
  analyze_output_tokens: number | null;
  analyze_cache_read_tokens: number | null;
  analyze_cache_create_tokens: number | null;
}

async function main() {
  console.log(`\n📊 FlowMint generation perf — last ${DAYS} day(s) (since ${since})\n`);

  // ---- Email generation (email_templates) ----
  const { data: emails, error: emailErr } = await admin
    .from("email_templates")
    .select(
      "flow_id, flow_name, gen_ms, input_tokens, output_tokens, cache_read_tokens, cache_create_tokens, model, prompt_version"
    )
    .gte("created_at", since)
    .not("gen_ms", "is", null);

  if (emailErr) {
    console.error(`email_templates query failed: ${emailErr.message}`);
    process.exit(1);
  }

  const rows = (emails ?? []) as EmailRow[];

  if (rows.length === 0) {
    console.log("No email-generation metrics in the window yet.\n");
  } else {
    // Per-flow breakdown
    const byFlow = new Map<string, EmailRow[]>();
    for (const r of rows) {
      const arr = byFlow.get(r.flow_id) ?? [];
      arr.push(r);
      byFlow.set(r.flow_id, arr);
    }

    console.log("Per-flow gen_ms (median / p95), cache hit, tokens:");
    console.log(
      "  flow".padEnd(34) +
        "n".padStart(5) +
        "median".padStart(10) +
        "p95".padStart(9) +
        "cache".padStart(8) +
        "in".padStart(10) +
        "out".padStart(10)
    );
    const flowIds = [...byFlow.keys()].sort();
    for (const flowId of flowIds) {
      const fr = byFlow.get(flowId)!;
      const gens = fr.map((r) => r.gen_ms ?? 0);
      const read = sum(fr, "cache_read_tokens");
      const create = sum(fr, "cache_create_tokens");
      const input = sum(fr, "input_tokens");
      const out = sum(fr, "output_tokens");
      console.log(
        `  ${flowId}`.padEnd(34) +
          String(fr.length).padStart(5) +
          ms(median(gens)).padStart(10) +
          ms(percentile(gens, 95)).padStart(9) +
          `${(cacheHitRate(read, create, input) * 100).toFixed(0)}%`.padStart(8) +
          String(input + read + create).padStart(10) +
          String(out).padStart(10)
      );
    }

    // Overall
    const allGens = rows.map((r) => r.gen_ms ?? 0);
    const allRead = sum(rows, "cache_read_tokens");
    const allCreate = sum(rows, "cache_create_tokens");
    const allInput = sum(rows, "input_tokens");
    console.log(
      `\nOverall (${rows.length} emails): median ${ms(median(allGens))}, p95 ${ms(
        percentile(allGens, 95)
      )}, cache hit ${(cacheHitRate(allRead, allCreate, allInput) * 100).toFixed(0)}%`
    );

    // Token totals by model + prompt_version
    console.log("\nToken totals by model + prompt_version:");
    const byVersion = new Map<string, EmailRow[]>();
    for (const r of rows) {
      const k = `${r.model ?? "?"}  ${r.prompt_version ?? "?"}`;
      const arr = byVersion.get(k) ?? [];
      arr.push(r);
      byVersion.set(k, arr);
    }
    for (const [k, vr] of byVersion) {
      const input = sum(vr, "input_tokens");
      const read = sum(vr, "cache_read_tokens");
      const create = sum(vr, "cache_create_tokens");
      const out = sum(vr, "output_tokens");
      console.log(
        `  ${k}  →  n=${vr.length}, in=${input + read + create} (cached_read=${read}, cache_write=${create}, uncached=${input}), out=${out}`
      );
    }
  }

  // ---- Brand analysis (brand_analyses) ----
  const { data: analyses, error: analysisErr } = await admin
    .from("brand_analyses")
    .select(
      "scrape_ms, analyze_ms, analyze_input_tokens, analyze_output_tokens, analyze_cache_read_tokens, analyze_cache_create_tokens"
    )
    .gte("created_at", since)
    .not("analyze_ms", "is", null);

  if (analysisErr) {
    console.error(`\nbrand_analyses query failed: ${analysisErr.message}`);
  } else {
    const ar = (analyses ?? []) as AnalysisRow[];
    if (ar.length === 0) {
      console.log("\nNo brand-analysis metrics in the window yet.");
    } else {
      const scrapes = ar.map((r) => r.scrape_ms ?? 0);
      const analyzes = ar.map((r) => r.analyze_ms ?? 0);
      console.log(
        `\nBrand analysis (${ar.length} runs): scrape median ${ms(
          median(scrapes)
        )} / p95 ${ms(percentile(scrapes, 95))}, analyze median ${ms(
          median(analyzes)
        )} / p95 ${ms(percentile(analyzes, 95))}`
      );
    }
  }

  console.log("");
}

/** Sum a numeric column across rows, treating null as 0. */
function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((acc, r) => acc + ((r[key] as unknown as number) ?? 0), 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
