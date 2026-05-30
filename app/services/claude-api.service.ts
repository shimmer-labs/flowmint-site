/**
 * Claude API Service
 *
 * Thin wrapper around the official @anthropic-ai/sdk client. Exposes a single
 * `callClaude` function that keeps the same shape the rest of the app already
 * uses (string prompt + string-or-array systemPrompt + simple options).
 *
 * Model: Sonnet 4.6 with `thinking: {type: "disabled"}` + `effort: "low"`.
 * Effort defaults to "high" on 4.6 — setting it low explicitly maintains
 * latency parity with Sonnet 4 (which had no effort param).
 *
 * Caching: callers can pass `systemPrompt` as an array of TextBlockParam to
 * place a `cache_control` marker on the stable prefix. See
 * email-generator.service.ts for the pattern.
 *
 * The wrapper logs token usage including cache_read / cache_creation tokens so
 * we can verify caching is actually working in production logs.
 */

import Anthropic from "@anthropic-ai/sdk";

/** Model used for all generation calls. Exported so callers can persist it as
 *  a perf-metric (email_templates.model) without re-hardcoding the string. */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

/** Timeout for AI generation calls (90 seconds — Sonnet 4.6 under load) */
const AI_TIMEOUT_MS = 90_000;

/**
 * Lazily-constructed singleton client. We construct on first use so missing
 * ANTHROPIC_API_KEY at import time doesn't crash the whole route module.
 */
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not found in environment variables");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * System prompt input: either a plain string (legacy callers, no caching) or
 * an array of TextBlockParam (lets callers attach `cache_control` to specific
 * blocks for prefix caching).
 */
export type SystemPromptInput =
  | string
  | Array<Anthropic.TextBlockParam>;

/**
 * Normalized token usage for one Claude call. Field names match the perf-metric
 * columns added in migration-007 so callers can spread these straight into a
 * DB insert. The SDK's verbose names (cache_read_input_tokens etc.) are mapped
 * here once so the rest of the app speaks one vocabulary.
 */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
}

/** Result of a callClaude call: the generated text plus token usage. */
export interface ClaudeResult {
  text: string;
  usage: ClaudeUsage;
}

/**
 * Call Claude with a single user-turn prompt.
 *
 * Returns the response text plus token usage. Throws on failure (with retry
 * handled by the caller, e.g. email-generator.service.ts).
 */
export async function callClaude(
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: SystemPromptInput;
  } = {}
): Promise<ClaudeResult> {
  const {
    maxTokens = 2000,
    temperature = 1.0,
    systemPrompt,
  } = options;

  const client = getClient();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature,
        // Email gen doesn't need extended reasoning. Disable explicitly to keep
        // latency tight (Sonnet 4.6's default effort is "high" — set low).
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        ...(systemPrompt !== undefined ? { system: systemPrompt } : {}),
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    // Narrow the discriminated union — we only ever ask for text output here.
    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error(
        `Claude API returned no text block (first block type: ${firstBlock?.type ?? "none"})`
      );
    }

    // Log usage with cache info so we can verify prompt caching is hitting.
    // cache_creation_input_tokens > 0 on first call after deploy/restart.
    // cache_read_input_tokens > 0 on subsequent calls if the prefix matches.
    const u = response.usage;
    const cacheNote =
      u.cache_read_input_tokens || u.cache_creation_input_tokens
        ? ` cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0}`
        : "";
    console.log(
      `✅ Claude: ${u.input_tokens}in/${u.output_tokens}out${cacheNote}`
    );

    return {
      text: firstBlock.text,
      usage: {
        input_tokens: u.input_tokens ?? 0,
        output_tokens: u.output_tokens ?? 0,
        cache_read_tokens: u.cache_read_input_tokens ?? 0,
        cache_create_tokens: u.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Typed errors from the SDK — surface useful info without leaking internals.
    if (error instanceof Anthropic.APIError) {
      console.error(`❌ Claude API error (${error.status}):`, error.message);
      // Preserve original error semantics for upstream retry logic.
      throw new Error(
        `Claude API error (${error.status}): ${error.message}`
      );
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Claude API timeout after ${AI_TIMEOUT_MS / 1000}s`);
    }

    console.error("❌ Claude API call failed:", error);
    throw error;
  }
}
