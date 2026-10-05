-- =============================================================================
-- Crisis Care — Migration 006: PRD v5 resource types + 17 triage categories
--
-- Adds 6 new resource_type_enum values:
--   antivenom, labor_delivery_bed, pediatric_icu_bed,
--   specialist_orthopedic_surgeon, specialist_obstetrician,
--   specialist_pediatrician
--
-- Expands triage_category enum from 4 → 17 categories per PRD v5 Section 3.
--
-- After running this migration, re-run the inventory seeder to populate
-- resource rows for the new types across all hospitals.
--
-- Idempotent: uses IF NOT EXISTS checks via pg_enum lookups.
-- =============================================================================

BEGIN;

-- ===========================================================================
-- 1. Add new resource_type_enum values
-- ===========================================================================
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in Postgres < 12.
-- For Postgres 12+ (which PostGIS 3.x requires), ADD VALUE IF NOT EXISTS
-- is safe inside a transaction block.
-- ===========================================================================

ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'antivenom';
ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'labor_delivery_bed';
ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'pediatric_icu_bed';
ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'specialist_orthopedic_surgeon';
ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'specialist_obstetrician';
ALTER TYPE resource_type_enum ADD VALUE IF NOT EXISTS 'specialist_pediatrician';

-- ===========================================================================
-- 2. Expand triage_category enum: 4 → 17 categories (PRD v5 §3)
-- ===========================================================================
--
-- Original 4: high_velocity_polytrauma, acute_coronary_syndrome_stemi,
--             acute_ischemic_stroke, severe_respiratory_distress
--
-- New 13 added below:
-- ===========================================================================

ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'breathing_choking';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'severe_bleeding_trauma';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'unconscious_fainted';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'suspected_stroke_fast';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'seizure_epileptic';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'severe_burns_fire';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'fall_spinal_trauma';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'fracture_crush_injury';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'poison_toxic_ingestion';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'snakebite_animal_attack';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'pregnancy_labor_emergency';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'pediatric_infant_distress';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'severe_allergic_reaction';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'electric_shock_electrocution';
ALTER TYPE triage_category ADD VALUE IF NOT EXISTS 'other_acute_emergency';

COMMIT;
