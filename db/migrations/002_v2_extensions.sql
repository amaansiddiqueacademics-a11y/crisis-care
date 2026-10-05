-- =============================================================================
-- Crisis Care — Migration 002: V2 schema extensions
-- PRD v4 §§4, 6, 9 — Scene-to-Hospital Decision Support & Allocation Engine
--
-- What this migration adds:
--   1. Enum types:  volatility_group, reservation_status, triage_category,
--                  incident_status
--   2. hospitals   — ADD COLUMN tier  (1 = Urban hub, 2 = District, 3 = Rural)
--   3. resources   — ADD COLUMN volatility_group
--   4. incidents   — NEW TABLE (per-incident tracking for evaluation harness)
--   5. reservations — NEW TABLE (soft-reservation, no physical decrement)
--   6. query_log   — ADD COLUMN incident_id, triage_category, routing_mode,
--                    secondary_transfer_flag (evaluation columns)
--   7. VIEW: resource_effective_availability
--                    effective_available = quantity_available
--                                       − SUM(active non-expired reservations)
--   8. Indexes for the hot paths in match.py and reservation lookups
--
-- CRITICAL (AGENTS.md + PRD §9):
--   quantity_available is NEVER decremented on reservation creation.
--   It is only decremented when a hospital sends an explicit ACK (confirmed).
--   Effective availability is always computed at query time via the view.
--
-- Spatial rule (AGENTS.md): all spatial columns are geography(Point, 4326).
--   ST_DWithin / ST_Distance operate in metres, not degrees.
-- =============================================================================

BEGIN;

-- ===========================================================================
-- 1. New enum types
-- ===========================================================================

-- Volatility group per PRD §5 (drives Poisson λ in simulation worker §12)
DO $$ BEGIN
  CREATE TYPE volatility_group AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reservation lifecycle per PRD §9
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pending',    -- route_proposed sent; awaiting hospital ACK (90-s window)
    'confirmed',  -- hospital ACK'd; quantity_available decremented
    'released',   -- hospital rejected OR 90-s timeout; no quantity change needed
    'expired'     -- 15-min lease elapsed with no ACK; treated as released at read time
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triage categories per PRD §6 (deterministic rule table — no fuzzy matching)
DO $$ BEGIN
  CREATE TYPE triage_category AS ENUM (
    'high_velocity_polytrauma',        -- GCS ≤ 8, hemorrhagic shock
    'acute_coronary_syndrome_stemi',   -- Clinical STEMI presentation
    'acute_ischemic_stroke',           -- Within 4.5-h thrombolysis window
    'severe_respiratory_distress'      -- SpO2 drop / respiratory failure
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Incident lifecycle
DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM (
    'pending',             -- received, not yet routed
    'routing',             -- routing engine running; reservation pending ACK
    'routed',              -- hospital confirmed; patient en route
    'secondary_transfer',  -- Tier B escalation triggered (§8); flagged for evaluation
    'completed',           -- patient received definitive care
    'cancelled'            -- incident cancelled before routing completed
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================================================
-- 2. hospitals — ADD tier
-- ===========================================================================
--
-- Tier semantics per PRD §4:
--   1 = Urban hub      (Mumbai, Pune) — high density, high Poisson λ
--   2 = District       — mid-size district hospitals
--   3 = Rural          — sparse (Nandurbar, Gadchiroli) — low λ
--
-- Note: lat/lng are NOT stored as separate columns — they are always derived
-- from geom via ST_Y(geom::geometry) / ST_X(geom::geometry). This preserves
-- the AGENTS.md invariant (single spatial source of truth).
-- ---------------------------------------------------------------------------

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS tier SMALLINT NOT NULL DEFAULT 1
    CHECK (tier BETWEEN 1 AND 3);

COMMENT ON COLUMN hospitals.tier IS
  'Hospital tier per PRD §4: 1=Urban hub, 2=District, 3=Rural. '
  'Controls Poisson λ in simulation worker (§12) and QueueDelay weight (§7).';

CREATE INDEX IF NOT EXISTS hospitals_tier_idx ON hospitals (tier);

-- ===========================================================================
-- 3. resources — ADD volatility_group
-- ===========================================================================
--
-- Volatility group per PRD §5:
--   high   — blood types, oxygen cylinders  (frequent Poisson fluctuation)
--   medium — ICU beds, ventilators           (moderate fluctuation)
--   low    — specialists, heavy equipment    (rarely changes intra-day)
-- ---------------------------------------------------------------------------

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS volatility_group volatility_group NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN resources.volatility_group IS
  'Resource volatility per PRD §5. Determines Poisson λ tier in the '
  'simulation worker tick (§12). Matched with hospital.tier at simulation time.';

-- Partial index: filter on (hospital_id, resource_type, volatility_group)
-- for simulation worker updates that target a specific group per tick.
CREATE INDEX IF NOT EXISTS resources_volatility_group_idx
  ON resources (volatility_group);

-- ===========================================================================
-- 4. incidents — NEW TABLE
-- ===========================================================================
--
-- One row per emergency incident.  Created when a triage request arrives.
-- Used by:
--   - Routing engine: picks triage_category → required resources (§6)
--   - Reservation system: incident_id FK on reservations (§9)
--   - Evaluation harness: tdc_seconds, secondary_transfer_flag (§15)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS incidents (
  id                      BIGSERIAL PRIMARY KEY,

  -- Triage classification (deterministic rule table, PRD §6)
  triage_category         triage_category NOT NULL,

  -- Patient scene coordinates — stored as separate floats for the API
  -- response AND as a geography column for spatial queries.
  scene_lat               DOUBLE PRECISION NOT NULL CHECK (scene_lat  BETWEEN -90  AND  90),
  scene_lng               DOUBLE PRECISION NOT NULL CHECK (scene_lng  BETWEEN -180 AND 180),
  scene_location          GEOGRAPHY(POINT, 4326) NOT NULL,  -- indexed for spatial queries

  -- Lifecycle
  status                  incident_status NOT NULL DEFAULT 'pending',

  -- Evaluation columns (PRD §15)
  secondary_transfer_flag BOOLEAN NOT NULL DEFAULT FALSE,
  -- Tier B escalation: patient routed to stabilization-only facility.
  -- Logged as an event; no second dispatch simulated (§8).

  routed_hospital_id      INTEGER REFERENCES hospitals (id) ON DELETE SET NULL,
  -- NULL until a hospital confirms (status = 'routed')

  tdc_seconds             INTEGER,
  -- Time-to-Definitive-Care in seconds; computed when status → 'completed'.
  -- NULL until resolved.

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at             TIMESTAMPTZ  -- set when status → completed/cancelled
);

COMMENT ON TABLE incidents IS
  'One row per emergency incident. Drives triage→routing→reservation→handshake '
  'lifecycle per PRD §§6–10. Used by evaluation harness (§15) for TDC and '
  'secondary-transfer-rate metrics.';

CREATE INDEX IF NOT EXISTS incidents_status_idx
  ON incidents (status)
  WHERE status NOT IN ('completed', 'cancelled');  -- partial: only open incidents

CREATE INDEX IF NOT EXISTS incidents_created_at_idx
  ON incidents (created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_scene_location_idx
  ON incidents USING GIST (scene_location);

-- ===========================================================================
-- 5. reservations — NEW TABLE
-- ===========================================================================
--
-- Soft-reservation model per PRD §9:
--   • Creating a reservation NEVER touches resources.quantity_available.
--   • Effective available = quantity_available − SUM(active non-expired reservations).
--   • Only on hospital ACK (confirmed) is quantity_available decremented once.
--   • On reject / 90-s timeout → status = 'released'; nothing to undo.
--   • On lease expiry without ACK → treated as 'expired' at next read time.
--     No background sweep is needed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reservations (
  id            BIGSERIAL PRIMARY KEY,

  incident_id   BIGINT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  hospital_id   INTEGER NOT NULL REFERENCES hospitals (id) ON DELETE CASCADE,
  resource_type resource_type_enum NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),

  status        reservation_status NOT NULL DEFAULT 'pending',

  reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lease expires 15 minutes after creation per PRD §9.
  -- No background sweep: expiry is evaluated at query time (expires_at <= now()).
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '15 minutes'
);

COMMENT ON TABLE reservations IS
  'Soft reservations per PRD §9. quantity_available is never decremented here — '
  'only on confirmed ACK. Effective availability computed via resource_effective_availability view.';

-- Hot-path index: used by the availability subquery in match.py on every /match call.
-- Covers the WHERE clause:  status IN (pending, confirmed) AND expires_at > now()
CREATE INDEX IF NOT EXISTS reservations_availability_idx
  ON reservations (hospital_id, resource_type, status, expires_at)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS reservations_incident_id_idx
  ON reservations (incident_id);

-- ===========================================================================
-- 6. query_log — ADD evaluation / incident linkage columns
-- ===========================================================================
--
-- Existing perf columns (db_query_time_ms, mapbox_time_ms, etc.) are kept.
-- New columns link the log row to an incident and capture V2 routing metadata.
-- ---------------------------------------------------------------------------

ALTER TABLE query_log
  ADD COLUMN IF NOT EXISTS incident_id
      BIGINT REFERENCES incidents (id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS triage_category
      triage_category,           -- NULL for V1-style calls without a triage category

  ADD COLUMN IF NOT EXISTS routing_mode
      TEXT DEFAULT 'resource_aware'
        CHECK (routing_mode IN ('resource_aware', 'naive_nearest')),
  -- 'naive_nearest' used by evaluation harness baseline runs (§15)

  ADD COLUMN IF NOT EXISTS secondary_transfer_flag
      BOOLEAN NOT NULL DEFAULT FALSE;

-- Rename mapbox_time_ms → routing_api_time_ms to reflect ORS/OSRM swap (PRD §11).
-- Idempotent: silently ignores if already renamed or column doesn't exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'query_log'
      AND column_name  = 'mapbox_time_ms'
  ) THEN
    ALTER TABLE query_log RENAME COLUMN mapbox_time_ms TO routing_api_time_ms;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS query_log_incident_id_idx
  ON query_log (incident_id)
  WHERE incident_id IS NOT NULL;

-- ===========================================================================
-- 7. VIEW: resource_effective_availability
-- ===========================================================================
--
-- The canonical way to read availability in V2. Always use this view
-- (or the equivalent inline subquery from match.py) — never read
-- resources.quantity_available directly for routing decisions.
--
-- effective_available = quantity_available − reserved_quantity
--   reserved_quantity = SUM(quantity) WHERE status IN ('pending','confirmed')
--                                           AND expires_at > now()
--
-- Staleness is NOT applied here (kept separate so the view is composable).
-- The routing query in match.py applies the staleness filter on top.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW resource_effective_availability AS
SELECT
  r.id                          AS resource_id,
  r.hospital_id,
  r.resource_type,
  r.volatility_group,
  r.quantity_available,
  r.last_updated_at,
  r.staleness_threshold_minutes,
  COALESCE(rsv.reserved_qty, 0) AS reserved_quantity,
  -- Clamp at 0: can't go negative even if reservations exceed stock
  GREATEST(
    0,
    r.quantity_available - COALESCE(rsv.reserved_qty, 0)
  )                             AS effective_available
FROM resources r
LEFT JOIN (
  SELECT
    hospital_id,
    resource_type,
    SUM(quantity) AS reserved_qty
  FROM reservations
  WHERE status IN ('pending', 'confirmed')
    AND expires_at > now()        -- expired leases count as 0
  GROUP BY hospital_id, resource_type
) rsv
  ON rsv.hospital_id   = r.hospital_id
 AND rsv.resource_type = r.resource_type;

COMMENT ON VIEW resource_effective_availability IS
  'Canonical V2 availability view per PRD §9. '
  'effective_available = quantity_available − SUM(active non-expired reservations). '
  'Always use this (or the equivalent inline subquery) for routing decisions. '
  'Never read resources.quantity_available directly.';

COMMIT;
