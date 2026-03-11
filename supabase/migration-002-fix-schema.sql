-- ============================================================
-- FlowMint — Migration 002: Align schema with API routes
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. generation_jobs — add missing columns
-- ============================================================

-- flow_id: text identifier for the flow (or "all" for batch)
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS flow_id TEXT;

-- flow_name: human-readable flow name
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS flow_name TEXT;

-- platform: email platform (klaviyo, mailchimp, etc.)
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'klaviyo';

-- format: email format (html, plain)
-- Already exists in schema but just in case
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'html';

-- analysis_id: reference to brand analysis
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS analysis_id UUID;

-- current_flow_index: which flow number we're on (1-based)
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS current_flow_index INTEGER DEFAULT 0;

-- Fix: current_flow should be TEXT (flow name), not INTEGER
-- The original schema has it as INTEGER but API sends flow name string
ALTER TABLE generation_jobs ALTER COLUMN current_flow TYPE TEXT USING current_flow::TEXT;

-- Make url nullable (batch generation doesn't always pass url)
ALTER TABLE generation_jobs ALTER COLUMN url DROP NOT NULL;

-- ============================================================
-- 2. email_templates — add missing columns + fix column name
-- ============================================================

-- body: the API uses "body" but schema has "content"
-- Add body column, keep content for backward compat
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body TEXT;

-- analysis_id: reference to brand analysis
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS analysis_id UUID;

-- Make url nullable (generated templates may not have url)
ALTER TABLE email_templates ALTER COLUMN url DROP NOT NULL;

-- ============================================================
-- DONE!
--
-- Changes:
--   generation_jobs: added flow_id, flow_name, platform,
--     analysis_id, current_flow_index; changed current_flow
--     to TEXT; made url nullable
--   email_templates: added body, analysis_id; made url nullable
-- ============================================================
