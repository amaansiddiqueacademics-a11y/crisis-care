-- Migration 006: Create query_log table
--
-- THIS TABLE IS THE EVALUATION DATASET — every column maps directly to a
-- PRD Section 12 metric. Do not remove or rename columns.
--
-- patient_location: GEOGRAPHY(POINT,4326) — stores the exact patient coords
--   submitted to /match. Used to compute per-query distance deltas in 12.A.
--
-- requested_resources: array of resource_type_enum — what the patient asked for.
--
-- matched_hospital_id: the hospital /match returned. NULL on zero-match cases
--   (matched_hospital_id = NULL is a valid, required row — see FR-5).
--
-- baseline_hospital_id: nearest hospital by straight-line distance, no resource
--   filter. Computed in the same /match request via a separate DB query so every
--   production call auto-generates an evaluation data point (PRD 12.A).
--
-- search_radius_used_km: which radius tier (10 / 25 / 50 / NULL for city-wide)
--   produced the first match. Tracks how often the system had to expand.
--
-- db_query_time_ms / mapbox_time_ms / response_time_ms: per-stage latency.
--   These columns ARE Section 12.D's entire data source — do not add retroactively.

CREATE TABLE IF NOT EXISTS query_log (
    id                    BIGSERIAL PRIMARY KEY,
    patient_location      GEOGRAPHY(POINT, 4326) NOT NULL,
    requested_resources   resource_type_enum[] NOT NULL,
    matched_hospital_id   INTEGER REFERENCES hospitals(id),
    baseline_hospital_id  INTEGER REFERENCES hospitals(id),
    search_radius_used_km NUMERIC(6,2),
    db_query_time_ms      INTEGER,
    mapbox_time_ms        INTEGER,
    response_time_ms      INTEGER,
    "timestamp"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index supports time-range queries when exporting the evaluation dataset.
CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log("timestamp");
