-- =============================================================================
-- Crisis Care — Migration 001: Initial V1 schema
--
-- Codifies the tables that already exist from the seed/import scripts.
-- Every statement is idempotent (IF NOT EXISTS / DO NOTHING) so this is
-- safe to apply against both a blank database and a pre-seeded one.
--
-- Columns verified against live DB introspection (2026-09-19).
--
-- Spatial rule (AGENTS.md): ALL spatial columns are geography(Point, 4326).
-- ST_DWithin / ST_Distance operate in **metres**, never degrees.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Enum: resource types (18 values, mirrors models.py VALID_RESOURCE_TYPES)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'resource_type_enum'
  ) THEN
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
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table: hospitals
-- Live columns: id, name, geom, address, phone, created_at
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hospitals (
  id         SERIAL PRIMARY KEY,
  name       CHARACTER VARYING NOT NULL,
  geom       GEOGRAPHY(POINT, 4326) NOT NULL,
  address    CHARACTER VARYING,
  phone      CHARACTER VARYING,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hospitals_geom_idx
  ON hospitals USING GIST (geom);

-- ---------------------------------------------------------------------------
-- Table: resources
-- Live columns: id, hospital_id, resource_type, quantity_available,
--               last_updated_at, staleness_threshold_minutes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS resources (
  id                          SERIAL PRIMARY KEY,
  hospital_id                 INTEGER NOT NULL
                                REFERENCES hospitals (id) ON DELETE CASCADE,
  resource_type               resource_type_enum NOT NULL,
  quantity_available          INTEGER NOT NULL DEFAULT 0
                                CHECK (quantity_available >= 0),
  last_updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  staleness_threshold_minutes INTEGER NOT NULL DEFAULT 30
                                CHECK (staleness_threshold_minutes > 0),

  UNIQUE (hospital_id, resource_type)
);

CREATE INDEX IF NOT EXISTS resources_hospital_id_idx
  ON resources (hospital_id);

-- ---------------------------------------------------------------------------
-- Table: admin_users
-- Live columns: id, hospital_id, username, hashed_password, created_at
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER NOT NULL
                    REFERENCES hospitals (id) ON DELETE CASCADE,
  username        CHARACTER VARYING NOT NULL UNIQUE,
  hashed_password CHARACTER VARYING NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: query_log  (FR-5 — one row per /match call, including zero-match)
-- Live columns: id, patient_location, requested_resources,
--               matched_hospital_id, baseline_hospital_id,
--               search_radius_used_km, db_query_time_ms, mapbox_time_ms,
--               response_time_ms, timestamp
-- Note: the created-at column is named "timestamp" in the live DB.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS query_log (
  id                    BIGSERIAL PRIMARY KEY,
  patient_location      GEOGRAPHY(POINT, 4326) NOT NULL,
  requested_resources   resource_type_enum[]   NOT NULL,
  matched_hospital_id   INTEGER REFERENCES hospitals (id) ON DELETE SET NULL,
  baseline_hospital_id  INTEGER REFERENCES hospitals (id) ON DELETE SET NULL,
  search_radius_used_km NUMERIC,
  db_query_time_ms      INTEGER NOT NULL DEFAULT 0,
  mapbox_time_ms        INTEGER NOT NULL DEFAULT 0,
  response_time_ms      INTEGER NOT NULL DEFAULT 0,
  "timestamp"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS query_log_timestamp_idx
  ON query_log ("timestamp" DESC);
