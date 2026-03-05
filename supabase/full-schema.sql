-- ============================================================
-- FlowMint — Full Database Schema
-- Run this in Supabase SQL Editor after creating a new project
-- ============================================================

-- ============================================================
-- PART 1: Base Tables (from Flow Studio)
-- ============================================================

-- Website scraping cache
CREATE TABLE IF NOT EXISTS websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  site_name TEXT,
  tagline TEXT,
  description TEXT,
  primary_color TEXT,
  logo TEXT,
  scraped_data JSONB,
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand analysis cache
CREATE TABLE IF NOT EXISTS brand_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  analysis JSONB,
  scraped_content JSONB,
  product_data JSONB,
  brand_colors JSONB,
  brand_voice JSONB,
  business_model TEXT,
  recommended_flows JSONB,
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  refresh_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email generation jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_flow INTEGER DEFAULT 0,
  total_flows INTEGER NOT NULL DEFAULT 0,
  completed_emails INTEGER DEFAULT 0,
  total_emails INTEGER NOT NULL DEFAULT 0,
  selected_flows JSONB,
  results JSONB,
  errors JSONB,
  format TEXT DEFAULT 'plain',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id UUID REFERENCES generation_jobs(id),
  flow_id TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  email_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'plain',
  platform TEXT DEFAULT 'Klaviyo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PART 2: FlowMint-specific Tables
-- ============================================================

-- User profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  purchased_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PART 3: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_websites_url ON websites(url);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_url ON brand_analyses(url);
CREATE INDEX IF NOT EXISTS idx_brand_analyses_user_id ON brand_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_url ON generation_jobs(url);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_url ON email_templates(url);
CREATE INDEX IF NOT EXISTS idx_email_templates_job_id ON email_templates(job_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_flow_id ON email_templates(flow_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- ============================================================
-- PART 4: Triggers
-- ============================================================

-- Auto-create profile when user signs up
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
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

DROP TRIGGER IF EXISTS set_websites_updated_at ON websites;
CREATE TRIGGER set_websites_updated_at
  BEFORE UPDATE ON websites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- PART 5: Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access to profiles"
  ON profiles FOR ALL USING (auth.role() = 'service_role');

-- Brand analyses: users see their own + anonymous can create/view unowned
CREATE POLICY "Users can view own analyses"
  ON brand_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create analyses"
  ON brand_analyses FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own analyses"
  ON brand_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anonymous can view unowned analyses"
  ON brand_analyses FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Service role full access to brand_analyses"
  ON brand_analyses FOR ALL USING (auth.role() = 'service_role');

-- Generation jobs
CREATE POLICY "Users can view own jobs"
  ON generation_jobs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create jobs"
  ON generation_jobs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own jobs"
  ON generation_jobs FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service role full access to generation_jobs"
  ON generation_jobs FOR ALL USING (auth.role() = 'service_role');

-- Email templates
CREATE POLICY "Users can view own templates"
  ON email_templates FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create templates"
  ON email_templates FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service role full access to email_templates"
  ON email_templates FOR ALL USING (auth.role() = 'service_role');

-- Websites: public read, service role write
CREATE POLICY "Anyone can view websites"
  ON websites FOR SELECT USING (true);
CREATE POLICY "Service role full access to websites"
  ON websites FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- DONE!
--
-- Tables: profiles, brand_analyses, generation_jobs,
--         email_templates, websites
--
-- Auth: Auto-creates profile on signup
-- RLS: Enabled with user-scoped policies
--
-- Next steps:
-- 1. Enable Email auth in Supabase Dashboard > Auth > Providers
-- 2. Copy project URL + anon key + service role key to .env.local
-- 3. Set up Stripe webhook pointing to /api/webhooks/stripe
-- ============================================================
