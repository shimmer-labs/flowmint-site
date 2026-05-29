-- migration-008: track GHL template pushes for dedup + sync status
--
-- Before this, push-to-platform tried to write pushed_to_platform/pushed_at to
-- email_templates but those columns didn't exist (silent failures), and nothing
-- stored the created GHL template id — so re-pushing a flow created duplicate
-- templates in the FlowMint folder. These columns enable: (1) skip re-creating an
-- email already pushed to the same location, (2) show "Synced to GHL" status.

alter table public.email_templates
  add column if not exists pushed_to_platform text,
  add column if not exists pushed_at timestamptz,
  add column if not exists pushed_location_id text,
  add column if not exists ghl_template_id text;
