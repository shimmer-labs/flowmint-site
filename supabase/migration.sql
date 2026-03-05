-- ============================================================
-- FlowMint Web App — Supabase Migration
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/havqvlypkajzgrrwsaeg/sql)
-- ============================================================

-- 1. Create profiles table (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'essentials', 'complete', 'premium'
  purchased_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- 2. Add user_id to brand_analyses (nullable for backward compat with Flow Studio data)
-- ============================================================
ALTER TABLE brand_analyses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brand_analyses_user_id ON brand_analyses(user_id);

-- 3. Add user_id to generation_jobs
-- ============================================================
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);

-- 4. Add user_id to email_templates
-- ============================================================
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);

-- 5. Auto-create profile on signup (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable Row Level Security
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies — profiles
-- ============================================================
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do everything (for webhooks/admin)
CREATE POLICY "Service role full access to profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- 8. RLS Policies — brand_analyses
-- ============================================================
-- Users can view their own analyses
CREATE POLICY "Users can view own analyses"
  ON brand_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can create analyses"
  ON brand_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own analyses
CREATE POLICY "Users can update own analyses"
  ON brand_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- Anonymous users can insert analyses (for free tier, no login required)
CREATE POLICY "Anonymous can create analyses"
  ON brand_analyses FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Anonymous can read analyses with no user_id (legacy/unowned)
CREATE POLICY "Anonymous can view unowned analyses"
  ON brand_analyses FOR SELECT
  USING (user_id IS NULL);

-- Service role full access
CREATE POLICY "Service role full access to brand_analyses"
  ON brand_analyses FOR ALL
  USING (auth.role() = 'service_role');

-- 9. RLS Policies — generation_jobs
-- ============================================================
CREATE POLICY "Users can view own jobs"
  ON generation_jobs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create jobs"
  ON generation_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own jobs"
  ON generation_jobs FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role full access to generation_jobs"
  ON generation_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- 10. RLS Policies — email_templates
-- ============================================================
CREATE POLICY "Users can view own templates"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create templates"
  ON email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role full access to email_templates"
  ON email_templates FOR ALL
  USING (auth.role() = 'service_role');

-- 11. Updated_at trigger (auto-update timestamp)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_brand_analyses_updated_at ON brand_analyses;
CREATE TRIGGER set_brand_analyses_updated_at
  BEFORE UPDATE ON brand_analyses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- DONE! Tables created:
--   - profiles (new) — user accounts + purchase tracking
--   - brand_analyses — added user_id column
--   - generation_jobs — added user_id column
--   - email_templates — added user_id column
--
-- Auth trigger:
--   - Auto-creates profile row when user signs up
--
-- RLS enabled on all tables with user-scoped policies
-- ============================================================
