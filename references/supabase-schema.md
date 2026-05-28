# Supabase schema snapshot — flowmint-site

Source of truth for the live `public` schema as of the export date. Re-export with the queries below after every migration. Format is "what I can grep without leaving the editor," not executable DDL.

**Exported:** 2026-05-28
**Project:** flowmint-site (Supabase)

To re-export: run the four queries from `references/flowmintv2ghl/plan.md` Prereq 2 in the Supabase SQL editor; paste each block's CSV under the matching section below.

---

## 1. Columns

```
table_name,column_name,data_type,is_nullable,column_default

brand_analyses
  id                    uuid                          NOT NULL  gen_random_uuid()
  url                   text                          NOT NULL
  user_id               uuid                          NULL
  analysis              jsonb                         NULL
  scraped_content       jsonb                         NULL
  product_data          jsonb                         NULL
  brand_colors          jsonb                         NULL
  brand_voice           jsonb                         NULL
  business_model        text                          NULL
  recommended_flows     jsonb                         NULL
  last_refreshed        timestamptz                   NULL      now()
  refresh_count         integer                       NULL      1
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()

email_templates
  id                    uuid                          NOT NULL  gen_random_uuid()
  url                   text                          NULL
  user_id               uuid                          NULL
  job_id                uuid                          NULL
  flow_id               text                          NOT NULL
  flow_name             text                          NOT NULL
  email_number          integer                       NOT NULL
  subject               text                          NOT NULL
  preheader             text                          NULL
  content               text                          NOT NULL
  format                text                          NOT NULL  'plain'
  platform              text                          NULL      'Klaviyo'
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()
  body                  text                          NULL
  analysis_id           uuid                          NULL

generation_jobs
  id                    uuid                          NOT NULL  gen_random_uuid()
  url                   text                          NULL
  user_id               uuid                          NULL
  status                text                          NOT NULL  'pending'
  current_flow          text                          NULL      0
  total_flows           integer                       NOT NULL  0
  completed_emails      integer                       NULL      0
  total_emails          integer                       NOT NULL  0
  selected_flows        jsonb                         NULL
  results               jsonb                         NULL
  errors                jsonb                         NULL
  format                text                          NULL      'plain'
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()
  completed_at          timestamptz                   NULL
  flow_id               text                          NULL
  flow_name             text                          NULL
  platform              text                          NULL      'klaviyo'
  analysis_id           uuid                          NULL
  current_flow_index    integer                       NULL      0

profiles
  id                    uuid                          NOT NULL  (auth.users.id)
  email                 text                          NOT NULL
  full_name             text                          NULL
  plan                  text                          NOT NULL  'free'
  purchased_at          timestamptz                   NULL
  stripe_session_id     text                          NULL
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()
  unlimited_expires_at  timestamptz                   NULL
  stripe_customer_id    text                          NULL
  legacy_plan           text                          NULL

purchases
  id                    uuid                          NOT NULL  gen_random_uuid()
  user_id               uuid                          NOT NULL
  stripe_session_id     text                          NULL
  stripe_subscription_id text                         NULL
  purchase_type         purchase_type (enum)          NOT NULL
  analysis_id           uuid                          NULL
  flow_id               text                          NULL
  status                text                          NOT NULL  'active'
  exported_at           timestamptz                   NULL
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()

websites
  id                    uuid                          NOT NULL  gen_random_uuid()
  url                   text                          NOT NULL
  site_name             text                          NULL
  tagline               text                          NULL
  description           text                          NULL
  primary_color         text                          NULL
  logo                  text                          NULL
  scraped_data          jsonb                         NULL
  last_scraped_at       timestamptz                   NULL      now()
  created_at            timestamptz                   NULL      now()
  updated_at            timestamptz                   NULL      now()
```

## 2. Indexes

```
brand_analyses     pkey on (id), unique on (url), idx on url, idx on user_id
email_templates    pkey on (id), idx on job_id, idx on url, idx on flow_id, idx on user_id
generation_jobs    pkey on (id), idx on user_id, idx on url
profiles           pkey on (id), idx on email, idx on plan
purchases          pkey on (id), idx on user_id, idx on analysis_id, idx on status
                   UNIQUE idx_purchases_full_campaign on (user_id, analysis_id) WHERE purchase_type='full_campaign' AND status='active'
                   UNIQUE idx_purchases_single_flow on (user_id, analysis_id, flow_id) WHERE purchase_type='single_flow' AND status='active'
websites           pkey on (id), unique on (url), idx on url
```

## 3. RLS policies

```
brand_analyses
  SELECT  "Anonymous can view unowned analyses"   user_id IS NULL
  SELECT  "Users can view own analyses"           auth.uid() = user_id
  INSERT  "Users can create analyses"             true
  UPDATE  "Users can update own analyses"         auth.uid() = user_id
  ALL     "Service role full access"              auth.role() = 'service_role'

email_templates
  SELECT  "Users can view own templates"          auth.uid() = user_id OR user_id IS NULL
  INSERT  "Users can create templates"            true
  ALL     "Service role full access"              auth.role() = 'service_role'

generation_jobs
  SELECT  "Users can view own jobs"               auth.uid() = user_id OR user_id IS NULL
  INSERT  "Users can create jobs"                 true
  UPDATE  "Users can update own jobs"             auth.uid() = user_id OR user_id IS NULL
  ALL     "Service role full access"              auth.role() = 'service_role'

profiles
  SELECT  "Users can view own profile"            auth.uid() = id
  UPDATE  "Users can update own profile"          auth.uid() = id
  ALL     "Service role full access"              auth.role() = 'service_role'

purchases
  SELECT  "Users can view own purchases"          auth.uid() = user_id
  ALL     "Service role full access"              auth.role() = 'service_role'

websites
  SELECT  "Anyone can view websites"              true
  ALL     "Service role full access"              auth.role() = 'service_role'
```

## 4. Foreign keys

```
email_templates.job_id        → generation_jobs.id
purchases.analysis_id         → brand_analyses.id
```

---

## Notes for the GHL build

- New `ghl_connections` table will not collide with any name above. Safe to add.
- Pattern for RLS on the new table: match the `profiles` / `purchases` style — `SELECT` and `UPDATE` gated by `auth.uid() = user_id`, plus `ALL` for service role. Insert via service role only (the OAuth callback runs server-side with service-role key).
- Existing convention: `created_at` / `updated_at` are `timestamptz` with `now()` default. Match.
- Existing convention: primary keys are `uuid` with `gen_random_uuid()`. Match.
- The `analysis_id` foreign key on `purchases` points at `brand_analyses.id` (not `analyses` — the table is `brand_analyses`). The flowmint-site root CLAUDE.md says "analyses" — that's shorthand; the real name is `brand_analyses`. Worth noting if we ever read that table from new code.

## Re-export procedure

Run all four queries in the Supabase SQL editor, paste results into the corresponding sections above (replacing the existing content), bump the "Exported:" date, commit. Do this after every migration.
