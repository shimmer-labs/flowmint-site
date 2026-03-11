-- ============================================================
-- Migration 003: Credit-Based Billing
-- Adds purchases table, unlimited_expires_at to profiles,
-- and migrates existing paid users to full_campaign records.
-- ============================================================

-- 1. Create purchase_type enum
CREATE TYPE purchase_type AS ENUM ('single_flow', 'full_campaign', 'unlimited');

-- 2. Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  purchase_type purchase_type NOT NULL,
  analysis_id UUID REFERENCES brand_analyses(id) ON DELETE SET NULL,
  flow_id TEXT,              -- only for single_flow purchases
  status TEXT NOT NULL DEFAULT 'active',  -- active, cancelled, refunded
  exported_at TIMESTAMPTZ,   -- tracks when user first exported
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Unique constraints to prevent duplicate purchases
-- One single_flow per user+analysis+flow
CREATE UNIQUE INDEX idx_purchases_single_flow
  ON purchases (user_id, analysis_id, flow_id)
  WHERE purchase_type = 'single_flow' AND status = 'active';

-- One full_campaign per user+analysis
CREATE UNIQUE INDEX idx_purchases_full_campaign
  ON purchases (user_id, analysis_id)
  WHERE purchase_type = 'full_campaign' AND status = 'active';

-- General indexes
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_analysis_id ON purchases(analysis_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- 4. Add unlimited_expires_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 5. Auto-update timestamps trigger for purchases
DROP TRIGGER IF EXISTS set_purchases_updated_at ON purchases;
CREATE TRIGGER set_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Row Level Security for purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to purchases"
  ON purchases FOR ALL USING (auth.role() = 'service_role');

-- 7. Migrate existing paid users to full_campaign purchase records
-- This gives legacy essentials/complete/premium users a full_campaign
-- credit for each of their existing analyses
INSERT INTO purchases (user_id, purchase_type, analysis_id, status, created_at)
SELECT
  p.id AS user_id,
  'full_campaign'::purchase_type AS purchase_type,
  ba.id AS analysis_id,
  'active' AS status,
  COALESCE(p.purchased_at, NOW()) AS created_at
FROM profiles p
JOIN brand_analyses ba ON ba.user_id = p.id
WHERE p.plan IN ('essentials', 'complete', 'premium')
ON CONFLICT DO NOTHING;

-- 8. Reset migrated profiles to 'free' (purchases table is now the source of truth)
-- Keep the old plan value in a new column for reference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS legacy_plan TEXT;

UPDATE profiles
SET legacy_plan = plan, plan = 'free'
WHERE plan IN ('essentials', 'complete', 'premium');

-- ============================================================
-- DONE!
--
-- New table: purchases (tracks single_flow, full_campaign, unlimited)
-- Updated: profiles (added unlimited_expires_at, stripe_customer_id, legacy_plan)
-- Migrated: existing paid users get full_campaign records
-- ============================================================
