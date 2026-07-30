-- Migration 004: Create resources table
--
-- Each row represents one resource type at one hospital.
-- UNIQUE (hospital_id, resource_type) enforces one row per type per hospital —
-- updates are UPDATEs, never additional INSERTs for the same type.
--
-- staleness_threshold_minutes is per-row, not global, so different resource
-- types (e.g. ICU bed vs. blood unit) can have different freshness windows.
-- A resource past its threshold is treated as unavailable regardless of
-- quantity_available — enforced in the FastAPI /match query (FR-2 step 2).

CREATE TABLE IF NOT EXISTS resources (
    id                          SERIAL PRIMARY KEY,
    hospital_id                 INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    resource_type               resource_type_enum NOT NULL,
    quantity_available          INTEGER NOT NULL DEFAULT 0,
    last_updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    staleness_threshold_minutes INTEGER NOT NULL DEFAULT 30,
    UNIQUE (hospital_id, resource_type)
);

-- Composite index supports the availability subquery in /match:
--   WHERE resource_type = ANY(:requested_types) AND quantity_available > 0
CREATE INDEX IF NOT EXISTS idx_resources_type_qty ON resources(resource_type, quantity_available);
