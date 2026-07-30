-- Migration 003: Create hospitals table
--
-- IMPORTANT: geom is GEOGRAPHY(POINT, 4326), NOT geometry.
-- ST_DWithin / ST_Distance on a geography column operate in METERS.
-- The same functions on geometry(4326) silently operate in DEGREES,
-- which would make every radius check in FR-2 wrong without an error.
--
-- Deliberately omits admin_user_id (see PRD.md Section 7 rationale):
-- hospital → admin lookup is done via admin_users.hospital_id only.

CREATE TABLE IF NOT EXISTS hospitals (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    geom        GEOGRAPHY(POINT, 4326) NOT NULL,
    address     VARCHAR(500),
    phone       VARCHAR(20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GiST index required for ST_DWithin / KNN spatial queries (FR-2).
-- Without this index every radius search is a full table scan —
-- the PRD Section 12.B benchmark explicitly measures its payoff.
CREATE INDEX IF NOT EXISTS idx_hospitals_geom ON hospitals USING GIST (geom);
