-- =============================================================================
-- Crisis Care — Migration 005: Add hospital metadata columns
--
-- Adds the columns present in crisis_care_hospitals.json that had no column
-- in the existing schema. All columns are nullable (no NOT NULL) so the
-- migration is safe to apply to any existing hospital rows.
-- =============================================================================

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS seed_key        CHARACTER VARYING UNIQUE,
  ADD COLUMN IF NOT EXISTS city            CHARACTER VARYING,
  ADD COLUMN IF NOT EXISTS cluster         CHARACTER VARYING,
  ADD COLUMN IF NOT EXISTS region_type     CHARACTER VARYING,
  ADD COLUMN IF NOT EXISTS google_place_id CHARACTER VARYING;

COMMENT ON COLUMN hospitals.seed_key IS
  'Stable machine-readable identifier (e.g. kem_mumbai). Used as admin username '
  'and for reproducible re-seeding. Unique across hospitals.';

COMMENT ON COLUMN hospitals.city IS
  'City name (Mumbai, Pune, Nandurbar, Gadchiroli, etc.)';

COMMENT ON COLUMN hospitals.cluster IS
  'Routing cluster grouping.';

COMMENT ON COLUMN hospitals.region_type IS
  'Spatial density classification: urban_dense | urban_mid | rural_sparse.';

COMMENT ON COLUMN hospitals.google_place_id IS
  'Google Places place_id used to verify real-world location during curation.';
