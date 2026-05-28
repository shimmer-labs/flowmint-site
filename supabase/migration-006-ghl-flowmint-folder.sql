-- ============================================================
-- Migration 006: cache the FlowMint folder ID per connected GHL location.
--
-- On first push to a location, the push handler creates a "FlowMint" folder
-- in that GHL sub-account and persists its ID here so subsequent pushes drop
-- templates into the same folder. Keeps Reed's clients' email-template list
-- tidy instead of cluttering the root.
--
-- Nullable column; null means "no folder cached yet, create one on next push."
-- ============================================================

ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS flowmint_folder_id TEXT;

-- ============================================================
-- DONE!
-- ============================================================
