-- ============================================================
-- Migration 007: per-call performance + token metrics.
--
-- Captures generation latency and Claude token usage so the eval workstream
-- (scripts/perf-summary.ts) can track gen_ms medians/p95, cache hit rate, and
-- token spend by model + prompt_version over time. These feed the "ship GHL on
-- a fast generation step" goal in references/flowmintv2ghl/plan.md.
--
-- Every column is nullable: existing rows (and any future row written before
-- the app change deploys) are not blocked. Token columns hold Claude usage as
-- reported by the SDK; *_ms columns are wall-clock milliseconds.
-- ============================================================

-- Per-analysis metrics (scrape + analyze stages of /api/analyze).
ALTER TABLE brand_analyses
  ADD COLUMN IF NOT EXISTS scrape_ms                    INTEGER,
  ADD COLUMN IF NOT EXISTS analyze_ms                   INTEGER,
  ADD COLUMN IF NOT EXISTS analyze_input_tokens         INTEGER,
  ADD COLUMN IF NOT EXISTS analyze_output_tokens        INTEGER,
  ADD COLUMN IF NOT EXISTS analyze_cache_read_tokens    INTEGER,
  ADD COLUMN IF NOT EXISTS analyze_cache_create_tokens  INTEGER;

-- Per-email metrics (one row per generated email in email_templates).
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS gen_ms              INTEGER,
  ADD COLUMN IF NOT EXISTS input_tokens        INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens       INTEGER,
  ADD COLUMN IF NOT EXISTS cache_read_tokens   INTEGER,
  ADD COLUMN IF NOT EXISTS cache_create_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS model               TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version      TEXT;

-- ============================================================
-- DONE!
-- ============================================================
