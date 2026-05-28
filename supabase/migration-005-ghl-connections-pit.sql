-- ============================================================
-- Migration 005: ghl_connections supports PITs (Private Integration Tokens)
--
-- PIT rows have no refresh_token and no real expiry. Add an auth_type
-- discriminator and make refresh_token / expires_at nullable so both
-- OAuth and PIT rows live in the same table.
--
-- CRAWL phase uses PIT only; the OAuth code is on-shelf until RUN.
-- See references/flowmintv2ghl/plan.md.
-- ============================================================

-- 1. Add auth_type ('oauth' or 'pit'). Defaults to 'oauth' so the existing
--    column definition stays self-documenting; PIT rows must set 'pit'.
ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'oauth';

ALTER TABLE ghl_connections
  ADD CONSTRAINT ghl_connections_auth_type_check
  CHECK (auth_type IN ('oauth', 'pit'));

-- 2. PIT rows have no refresh_token and no fixed expiry. Relax NOT NULL.
ALTER TABLE ghl_connections
  ALTER COLUMN refresh_token DROP NOT NULL;

ALTER TABLE ghl_connections
  ALTER COLUMN expires_at DROP NOT NULL;

-- 3. Add an optional human label so the user can tell connected locations apart
--    in the settings UI ("Shimmer Labs" vs "Reed's Client Co").
ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS location_label TEXT;

-- ============================================================
-- DONE!
--
-- ghl_connections shape now supports both OAuth and PIT rows.
-- PIT rows: auth_type='pit', refresh_token=NULL, expires_at=NULL, location_label='...'
-- OAuth rows (when re-enabled at RUN): auth_type='oauth', tokens populated, expires_at set.
-- ============================================================
