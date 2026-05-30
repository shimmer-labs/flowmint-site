# Supabase schema snapshot — flowmint-site

Source of truth for the live `public` schema as of the export date. Re-export with the queries below after every migration. Format is "what I can grep without leaving the editor," not executable DDL.

**Exported:** 2026-05-30 (full re-export via the Supabase MCP — read-only access can read `information_schema` / `pg_catalog` directly, so no manual SQL-editor paste is needed). Reflects migration-007 (perf metrics) and migration-008 (push tracking), plus the `ghl_connections` table.
**Project:** flowmint-site (Supabase, project ref `fcibehadmkbasqnwhenr`)

To re-export: have any session with the read-only Supabase MCP run the four queries in the "Re-export procedure" section and rewrite the sections below. No restart or SQL-editor round-trip required.

---

## 1. Columns

```
table_name,column_name,data_type,is_nullable,column_default

brand_analyses
  id                           uuid          NOT NULL  gen_random_uuid()
  url                          text          NOT NULL
  user_id                      uuid          NULL
  analysis                     jsonb         NULL
  scraped_content              jsonb         NULL
  product_data                 jsonb         NULL
  brand_colors                 jsonb         NULL
  brand_voice                  jsonb         NULL
  business_model               text          NULL
  recommended_flows            jsonb         NULL
  last_refreshed               timestamptz   NULL      now()
  refresh_count                integer       NULL      1
  created_at                   timestamptz   NULL      now()
  updated_at                   timestamptz   NULL      now()
  scrape_ms                    integer       NULL              -- migration-007
  analyze_ms                   integer       NULL              -- migration-007
  analyze_input_tokens         integer       NULL              -- migration-007
  analyze_output_tokens        integer       NULL              -- migration-007
  analyze_cache_read_tokens    integer       NULL              -- migration-007
  analyze_cache_create_tokens  integer       NULL              -- migration-007

email_templates
  id                    uuid          NOT NULL  gen_random_uuid()
  url                   text          NULL
  user_id               uuid          NULL
  job_id                uuid          NULL
  flow_id               text          NOT NULL
  flow_name             text          NOT NULL
  email_number          integer       NOT NULL
  subject               text          NOT NULL
  preheader             text          NULL
  content               text          NOT NULL
  format                text          NOT NULL  'plain'
  platform              text          NULL      'Klaviyo'
  created_at            timestamptz   NULL      now()
  updated_at            timestamptz   NULL      now()
  body                  text          NULL
  analysis_id           uuid          NULL
  gen_ms                integer       NULL              -- migration-007
  input_tokens          integer       NULL              -- migration-007
  output_tokens         integer       NULL              -- migration-007
  cache_read_tokens     integer       NULL              -- migration-007
  cache_create_tokens   integer       NULL              -- migration-007
  model                 text          NULL              -- migration-007
  prompt_version        text          NULL              -- migration-007
  pushed_to_platform    text          NULL              -- migration-008
  pushed_at             timestamptz   NULL              -- migration-008
  pushed_location_id    text          NULL              -- migration-008
  ghl_template_id       text          NULL              -- migration-008

generation_jobs
  id                    uuid          NOT NULL  gen_random_uuid()
  url                   text          NULL
  user_id               uuid          NULL
  status                text          NOT NULL  'pending'
  current_flow          text          NULL      '0'
  total_flows           integer       NOT NULL  0
  completed_emails      integer       NULL      0
  total_emails          integer       NOT NULL  0
  selected_flows        jsonb         NULL
  results               jsonb         NULL
  errors                jsonb         NULL
  format                text          NULL      'plain'
  created_at            timestamptz   NULL      now()
  updated_at            timestamptz   NULL      now()
  completed_at          timestamptz   NULL
  flow_id               text          NULL
  flow_name             text          NULL
  platform              text          NULL      'klaviyo'
  analysis_id           uuid          NULL
  current_flow_index    integer       NULL      0

ghl_connections                                          -- migration-004 (+ PIT/folder follow-ups)
  id                    uuid          NOT NULL  gen_random_uuid()
  user_id               uuid          NOT NULL
  location_id           text          NOT NULL
  company_id            text          NULL
  user_type             text          NULL
  access_token          text          NOT NULL          -- PIT token or OAuth access token
  refresh_token         text          NULL              -- null for PIT connections
  expires_at            timestamptz   NULL              -- null for PIT connections
  scopes                text          NOT NULL
  created_at            timestamptz   NULL      now()
  updated_at            timestamptz   NULL      now()
  auth_type             text          NOT NULL  'oauth'  -- CHECK auth_type IN ('oauth','pit')
  location_label        text          NULL              -- human label (resolved GHL business name)
  flowmint_folder_id    text          NULL              -- cached GHL template-folder id (lazy create)

profiles
  id                    uuid          NOT NULL  (= auth.users.id)
  email                 text          NOT NULL
  full_name             text          NULL
  plan                  text          NOT NULL  'free'
  purchased_at          timestamptz   NULL
  stripe_session_id     text          NULL
  created_at            timestamptz   NULL      now()
  updated_at            timestamptz   NULL      now()
  unlimited_expires_at  timestamptz   NULL
  stripe_customer_id    text          NULL
  legacy_plan           text          NULL

purchases
  id                     uuid          NOT NULL  gen_random_uuid()
  user_id                uuid          NOT NULL
  stripe_session_id      text          NULL
  stripe_subscription_id text          NULL
  purchase_type          purchase_type NOT NULL          -- enum: single_flow | full_campaign | unlimited
  analysis_id            uuid          NULL
  flow_id                text          NULL
  status                 text          NOT NULL  'active'
  exported_at            timestamptz   NULL
  created_at             timestamptz   NULL      now()
  updated_at             timestamptz   NULL      now()

websites
  id                    uuid          NOT NULL  gen_random_uuid()
  url                   text          NOT NULL
  site_name             text          NULL
  tagline               text          NULL
  description           text          NULL
  primary_color         text          NULL
  logo                  text          NULL
  scraped_data          jsonb         NULL
  last_scraped_at       timestamptz   NULL      now()
  created_at            timestamptz   NULL      now()
  updated_at            timestamptz   NULL      now()
```

## 2. Indexes

```
brand_analyses     pkey (id), unique brand_analyses_url_key (url), idx_brand_analyses_url (url), idx_brand_analyses_user_id (user_id)
email_templates    pkey (id), idx_email_templates_flow_id (flow_id), idx_email_templates_job_id (job_id), idx_email_templates_url (url), idx_email_templates_user_id (user_id)
generation_jobs    pkey (id), idx_generation_jobs_url (url), idx_generation_jobs_user_id (user_id)
ghl_connections    pkey (id), idx_ghl_connections_user_id (user_id), UNIQUE idx_ghl_connections_user_location (user_id, location_id)
profiles           pkey (id), idx_profiles_email (email), idx_profiles_plan (plan)
purchases          pkey (id), idx_purchases_user_id (user_id), idx_purchases_analysis_id (analysis_id), idx_purchases_status (status)
                   UNIQUE idx_purchases_full_campaign (user_id, analysis_id) WHERE purchase_type='full_campaign' AND status='active'
                   UNIQUE idx_purchases_single_flow (user_id, analysis_id, flow_id) WHERE purchase_type='single_flow' AND status='active'
websites           pkey (id), unique websites_url_key (url), idx_websites_url (url)
```

## 3. RLS policies

```
brand_analyses
  SELECT  "Anonymous can view unowned analyses"        user_id IS NULL
  SELECT  "Users can view own analyses"                auth.uid() = user_id
  INSERT  "Users can create analyses"                  (no qual)
  UPDATE  "Users can update own analyses"              auth.uid() = user_id
  ALL     "Service role full access to brand_analyses" auth.role() = 'service_role'

email_templates
  SELECT  "Users can view own templates"                 auth.uid() = user_id OR user_id IS NULL
  INSERT  "Users can create templates"                   (no qual)
  ALL     "Service role full access to email_templates"  auth.role() = 'service_role'

generation_jobs
  SELECT  "Users can view own jobs"                      auth.uid() = user_id OR user_id IS NULL
  INSERT  "Users can create jobs"                        (no qual)
  UPDATE  "Users can update own jobs"                    auth.uid() = user_id OR user_id IS NULL
  ALL     "Service role full access to generation_jobs"  auth.role() = 'service_role'

ghl_connections
  SELECT  "Users can view own ghl connections"           auth.uid() = user_id
  DELETE  "Users can delete own ghl connections"         auth.uid() = user_id
  ALL     "Service role full access to ghl_connections"  auth.role() = 'service_role'
  (no user INSERT/UPDATE policy — connections are written by the service role server-side)

profiles
  SELECT  "Users can view own profile"            auth.uid() = id
  UPDATE  "Users can update own profile"          auth.uid() = id
  ALL     "Service role full access to profiles"  auth.role() = 'service_role'

purchases
  SELECT  "Users can view own purchases"           auth.uid() = user_id
  ALL     "Service role full access to purchases"  auth.role() = 'service_role'

websites
  SELECT  "Anyone can view websites"              true
  ALL     "Service role full access to websites"  auth.role() = 'service_role'
```

## 4. Foreign keys

```
brand_analyses.user_id        → auth.users.id
email_templates.job_id        → generation_jobs.id
email_templates.user_id       → auth.users.id
generation_jobs.user_id       → auth.users.id
ghl_connections.user_id       → auth.users.id
profiles.id                   → auth.users.id
purchases.user_id             → auth.users.id
purchases.analysis_id         → brand_analyses.id
```

(Sourced from the catalog via the MCP `list_tables` FK constraints; the `information_schema` FK join returns empty here because of the cross-schema `auth.users` references.)

---

## Notes for the GHL build

- `ghl_connections` is live (migration-004 + PIT/folder follow-ups). RLS matches the intended pattern: users `SELECT`/`DELETE` their own rows; all writes go through the service role (the connect route and OAuth callback run server-side). Unique on `(user_id, location_id)`.
- Existing convention: `created_at` / `updated_at` are `timestamptz` with `now()` default. Match.
- Existing convention: primary keys are `uuid` with `gen_random_uuid()`. Match.
- The `analysis_id` foreign key on `purchases` points at `brand_analyses.id` (not `analyses` — the table is `brand_analyses`). The flowmint-site root CLAUDE.md says "analyses" — that's shorthand; the real name is `brand_analyses`.
- Push tracking (migration-008) lives on `email_templates`: `ghl_template_id` + `pushed_location_id` drive re-push dedup; `pushed_at` / `pushed_to_platform` drive the "Synced to GHL" UI.

## Re-export procedure

The read-only Supabase MCP can refresh this file directly — no SQL-editor round-trip. Run these and rewrite the sections above (then bump the "Exported:" date and commit):

```sql
-- 1. Columns
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2. Indexes
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- 3. RLS policies
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- 4. Foreign keys (use list_tables FK constraints instead — the info_schema
--    join below returns empty for cross-schema auth.users refs):
--    list_tables({schemas:["public"], verbose:true}) → foreign_key_constraints
```

Do this after every migration.
