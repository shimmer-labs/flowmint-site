-- ============================================================
-- Migration 004: GHL Connections
-- Stores per-location GHL OAuth tokens for the integration.
-- One row per (FlowMint user, GHL sub-account). A user can connect
-- multiple sub-accounts, hence the composite uniqueness.
-- ============================================================

-- 1. Create ghl_connections table
CREATE TABLE IF NOT EXISTS ghl_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,           -- GHL sub-account ID (e.g. oYIrCtw0dzwNOMiinMX8)
  company_id TEXT,                     -- GHL agency ID (when present)
  user_type TEXT,                      -- 'Company' or 'Location' (GHL's userType)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,     -- absolute expiry; refresh wrapper compares to NOW()
  scopes TEXT NOT NULL,                -- space-separated scope string as returned by GHL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. One active connection per (user, location). Upsert on reconnect.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ghl_connections_user_location
  ON ghl_connections (user_id, location_id);

CREATE INDEX IF NOT EXISTS idx_ghl_connections_user_id
  ON ghl_connections (user_id);

-- 3. Auto-update timestamps (reuses the same trigger function as the other tables)
DROP TRIGGER IF EXISTS set_ghl_connections_updated_at ON ghl_connections;
CREATE TRIGGER set_ghl_connections_updated_at
  BEFORE UPDATE ON ghl_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Row Level Security
ALTER TABLE ghl_connections ENABLE ROW LEVEL SECURITY;

-- Users can read their own connections (e.g. settings page lists connected locations).
CREATE POLICY "Users can view own ghl connections"
  ON ghl_connections FOR SELECT USING (auth.uid() = user_id);

-- Users can disconnect (delete) their own.
CREATE POLICY "Users can delete own ghl connections"
  ON ghl_connections FOR DELETE USING (auth.uid() = user_id);

-- Service role does all token writes (insert on callback, update on refresh).
-- Tokens are never written from a user-context client; the OAuth callback runs server-side
-- with the service-role key. Matches the pattern used for purchases.
CREATE POLICY "Service role full access to ghl_connections"
  ON ghl_connections FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- DONE!
--
-- New table: ghl_connections
-- One row per (FlowMint user, GHL location). Tokens stored without
-- column-level encryption (deferred to WALK; see plan.md).
-- ============================================================
