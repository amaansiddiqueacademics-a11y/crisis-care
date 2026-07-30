-- Migration 002: Create resource_type_enum
-- 18 values exactly as specified in PRD.md Section 7.
-- Extensible later via: ALTER TYPE resource_type_enum ADD VALUE 'x'
-- No data migration needed when adding new values.
-- Wrapped in DO block because CREATE TYPE has no IF NOT EXISTS until PG14+.

DO $$ BEGIN
    CREATE TYPE resource_type_enum AS ENUM (
        'icu_bed',
        'blood_a_pos',
        'blood_a_neg',
        'blood_b_pos',
        'blood_b_neg',
        'blood_o_pos',
        'blood_o_neg',
        'blood_ab_pos',
        'blood_ab_neg',
        'oxygen_cylinder',
        'ventilator',
        'specialist_trauma_surgeon',
        'specialist_cardiologist',
        'specialist_neurologist',
        'specialist_pediatric_er',
        'equipment_dialysis',
        'equipment_mri_trauma_ready',
        'equipment_ct_scanner'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'resource_type_enum already exists, skipping';
END $$;
