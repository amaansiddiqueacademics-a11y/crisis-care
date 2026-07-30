# Crisis Care — Product Requirements Document

**Scope:** Single-city pilot · doubles as the instrument for an academic feasibility + outcome-impact study
**Status:** Draft — target city and cloud account details still open (see Section 15)

> **Using this in Antigravity:** Sections 7 (Data Model) and 9 (API Specification) are written to be handed over close to verbatim — they remove most of the schema/contract ambiguity up front. Section 13 (Build Phases) is ordered so each row can be given to the Agent Manager as its own planning task, in sequence.

---

## 1. Overview

Crisis Care is a resource-aware emergency routing system. Instead of sending a patient to the nearest hospital by distance alone, it matches them to the nearest hospital that actually has the specific resource(s) they need available *right now* — an ICU bed, a blood type, a ventilator, a specialist, specific equipment — then re-ranks candidates by live-traffic ETA rather than straight-line distance.

Two surfaces share one backend:
- **Patient app** (anonymous, mobile-first PWA): auto-detects location, lets the user select needed resources, returns the fastest reachable hospital that has everything they need.
- **Hospital admin dashboard**: authenticated, one account per hospital, lets staff keep live inventory counts current.

This product doubles as a research instrument for a single-city academic study. Every query it serves needs to also produce data usable for the evaluation in Section 12 — that requirement shapes several decisions below, so treat the logging/instrumentation items as functional requirements, not optional telemetry.

## 2. Problem Statement

Naive "nearest hospital" routing — what maps apps do today — has no concept of whether that hospital can actually treat the patient's emergency. A patient routed to the closest ER that's out of the blood type they need, has no open ICU bed, or has no ventilator loses time re-routing, in exactly the scenario where time matters most. The core bet: filtering on real-time resource availability *before* optimizing for ETA produces measurably better outcomes than distance-only routing, and this is achievable within emergency-usable latency (target: under 2–3 seconds end to end).

## 3. Goals & Non-Goals

**Goals**
- Ship a working patient-matching flow and admin inventory dashboard for a single-city pilot.
- Show resource-aware routing beats naive distance routing on a defined metric (Section 12.A).
- Show the architecture holds up at scale and under concurrent load, using synthetic data where real data doesn't exist yet (Section 12.B–D).
- Produce a structured dataset (`query_log`) usable directly in the study's results section, generated as a byproduct of normal use rather than a separate step.

**Non-Goals (v1)**
- No real clinical outcome validation — outcomes are simulated/estimated, never claimed as clinically proven.
- No multi-city or national rollout — single city only.
- No hospital-identity-level admin verification (document upload, manual vetting) — accounts are provisioned directly, not via self-service signup. This is a Future Work item, not something to build now.
- No native mobile app — PWA only.

## 4. Users & Personas

| Persona | Context | Needs |
|---|---|---|
| **Patient** | Anonymous, likely on a phone, in or near a medical emergency (possibly acting for someone else) | Fastest possible path to a hospital that can actually treat them; zero login friction |
| **Hospital admin** | Hospital staff, one login per hospital | Fast, low-friction way to update what's available right now |
| **Researcher (you)** | Not a live user of the app | `query_log` populated with enough structure to compute Section 12's metrics without bolting on instrumentation later |

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React.js + Tailwind CSS | Mobile-first, fast to build |
| Maps | react-map-gl (Mapbox) | Renders Mapbox data directly |
| Geolocation | HTML5 Geolocation API | Auto-detects patient start point |
| Backend gateway | Node.js + Express.js | Auth + inventory management |
| Auth | JWT + bcrypt | Stateless, simple, sufficient for hospital admin accounts |
| Real-time push | Server-Sent Events (SSE) | One-directional live updates without WebSocket overhead |
| Routing microservice | Python + FastAPI | Native async for concurrent spatial queries |
| Database | PostgreSQL + PostGIS | `ST_DWithin`/KNN + iterative radius search |
| Routing/traffic | Mapbox Directions API | Live-traffic ETA, generous free tier |

## 6. System Architecture

Two backend services share one database, split by responsibility. **Keep this split — don't merge them:**

- **Express gateway** owns admin auth, inventory reads/writes, and the SSE broadcast. Nothing patient-facing goes through it.
- **FastAPI service** owns the patient match endpoint: spatial query, radius expansion, Mapbox ETA re-ranking, query logging. Nothing admin-facing goes through it.

```
┌────────────────────┐                       ┌─────────────────────────┐
│  React Patient PWA   │──── HTTPS/JSON ────▶│  FastAPI (routing svc)    │
└────────────────────┘                       └────────────┬────────────┘
                                                           │
                     ┌──────────────────────────────────────┼──────────────────────┐
                     ▼                                      ▼                      ▼
          ┌───────────────────────┐             ┌────────────────────────┐   writes query_log
          │ PostgreSQL + PostGIS     │             │ Mapbox Directions API    │
          │ (GiST spatial index)     │             │ + live traffic             │
          └───────────┬─────────────┘             └────────────────────────┘
                     ▲
                     │ reads/writes inventory
          ┌───────────┴─────────────┐             ┌─────────────────────────┐
          │ Express gateway (Node)    │◀── JWT ───│ React Admin Dashboard     │
          │ auth · inventory · SSE     │── SSE ───▶│ (subscribes to stream)     │
          └────────────────────────┘             └─────────────────────────┘
```

**Cloud (AWS):**
- RDS PostgreSQL + PostGIS, GiST index on `geom`
- ECS Fargate: one service per backend (Express gateway, FastAPI routing service)
- S3 + CloudFront: React static builds (patient PWA + admin dashboard)
- ElastiCache: only add if load testing (Section 12.C) shows it's needed — don't add it speculatively

## 7. Data Model

Use `geography(Point, 4326)`, not `geometry` — the one schema detail worth getting right up front. `ST_DWithin`/`ST_Distance` on a `geography` column take/return **meters** directly; the same calls on a `geometry` column with SRID 4326 silently operate in **degrees**, which would make every radius number in FR-2 wrong without ever throwing an error.

One deliberate deviation from the original research plan: that version put `admin_user_id` on `hospitals` *and* `hospital_id` on `admin_users` — a circular FK that forces an awkward two-step insert (can't create either row first without the other already existing). Dropped `hospitals.admin_user_id` below; look up a hospital's admin via `admin_users.hospital_id` instead. Flagging this since it's a deliberate change, not an oversight — it's also the more standard direction if a hospital ever needs more than one admin account later.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE hospitals (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    geom        GEOGRAPHY(POINT, 4326) NOT NULL,
    address     VARCHAR(500),
    phone       VARCHAR(20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hospitals_geom ON hospitals USING GIST (geom);

CREATE TYPE resource_type_enum AS ENUM (
    'icu_bed',
    'blood_a_pos', 'blood_a_neg', 'blood_b_pos', 'blood_b_neg',
    'blood_o_pos', 'blood_o_neg', 'blood_ab_pos', 'blood_ab_neg',
    'oxygen_cylinder', 'ventilator',
    'specialist_trauma_surgeon', 'specialist_cardiologist',
    'specialist_neurologist', 'specialist_pediatric_er',
    'equipment_dialysis', 'equipment_mri_trauma_ready', 'equipment_ct_scanner'
);
-- Extensible later via ALTER TYPE resource_type_enum ADD VALUE 'x' — no data migration needed.

CREATE TABLE resources (
    id                          SERIAL PRIMARY KEY,
    hospital_id                 INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    resource_type               resource_type_enum NOT NULL,
    quantity_available          INTEGER NOT NULL DEFAULT 0,
    last_updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    staleness_threshold_minutes INTEGER NOT NULL DEFAULT 30,
    UNIQUE (hospital_id, resource_type)
);
CREATE INDEX idx_resources_type_qty ON resources(resource_type, quantity_available);

CREATE TABLE admin_users (
    id              SERIAL PRIMARY KEY,
    hospital_id     INTEGER NOT NULL REFERENCES hospitals(id),
    username        VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This table IS the evaluation dataset — every column maps to a Section 12 metric. Don't trim it.
CREATE TABLE query_log (
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
CREATE INDEX idx_query_log_timestamp ON query_log("timestamp");
```

## 8. Functional Requirements

**FR-1 — Patient App**
- On load, request geolocation (HTML5 Geolocation API); handle denial with a manual address/pin-drop fallback.
- Multi-select over the `resource_type` enum, grouped for usability (beds, blood, equipment, specialists) — don't render 18 flat checkboxes.
- Submit → call `POST /match` (Section 9) → render the matched hospital, live ETA, and turn-by-turn route on `react-map-gl`.
- No login, ever, on this surface.

**FR-2 — Matching & Routing Engine (FastAPI)**
Request flow for `POST /match`:
1. Run the spatial + inventory query at `radius_km = 10`.
2. **AND logic**: a hospital only qualifies if it has *every* requested resource type, each with `quantity_available > 0` **and** `last_updated_at` within its own `staleness_threshold_minutes`. A resource past its staleness threshold is treated as unavailable regardless of its stored count.
3. Zero qualifying hospitals → retry at `25km`, then `50km`, then city-wide (drop the distance filter). Stop at the first radius that returns at least one match.
4. Take the top 3 candidates by straight-line distance, send each to the Mapbox Directions API for a live-traffic ETA.
5. Return the candidate with the lowest *real* ETA, not the lowest distance — these can differ, that's the point of this step.
6. Write one row to `query_log`, including a `baseline_hospital_id` computed in the same request via a plain nearest-distance query with no resource filter. This makes every production query double as an evaluation data point for Section 12.A, with no separate baseline pass needed later.

Reference query for steps 1–3 (illustrative, adapt as needed):
```sql
SELECT h.id, h.name, h.address, h.phone,
       ST_Distance(h.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS distance_m
FROM hospitals h
WHERE ST_DWithin(h.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius_m)
  AND h.id IN (
    SELECT hospital_id FROM resources
    WHERE resource_type = ANY(:requested_types)
      AND quantity_available > 0
      AND last_updated_at > now() - (staleness_threshold_minutes || ' minutes')::interval
    GROUP BY hospital_id
    HAVING COUNT(DISTINCT resource_type) = :num_requested_types
  )
ORDER BY distance_m ASC
LIMIT 3;
```

**FR-3 — Hospital Admin Dashboard**
- Login (JWT, one account per hospital, bcrypt-hashed passwords).
- Grid view of that hospital's `resources` rows, editable quantity per row.
- Every save updates `quantity_available`, bumps `last_updated_at` to `now()`, and pushes the change over SSE.
- Subscribes to `/stream/hospital/:id` on load, so a second open tab/device reflects changes without a manual refresh.

**FR-4 — Real-Time Inventory Sync**
- Postgres is the source of truth — a patient query always reads current data directly; SSE is for dashboard UX, not for correctness of matching.
- `/stream/hospital/:id` (Express) pushes an event on every inventory write for that hospital.
- Staleness enforcement (FR-2, step 2) is what actually prevents routing someone to a stale "available" bed — SSE alone can't guarantee that, since a dashboard tab could be closed.

**FR-5 — Query Logging & Evaluation Instrumentation**
- Every `/match` call writes to `query_log`, regardless of outcome — including zero-match cases (`matched_hospital_id = NULL`, baseline still computed).
- Instrument and store per-stage timing (`db_query_time_ms`, `mapbox_time_ms`, `response_time_ms`) on every call. This is Section 12.D's entire data source — don't plan to add it retroactively.

**FR-6 — Security & Access Control**
- JWT auth on every Express admin route; no auth on the FastAPI `/match` route by design (anonymous patient access).
- IP-based rate limiting on `/match` to deter scraping/abuse of an unauthenticated endpoint.
- bcrypt for password hashing; parameterized queries everywhere — no string-built SQL, given `resource_type = ANY(:requested_types)` takes user input directly.
- HTTPS everywhere (terminate at ALB/CloudFront in the AWS deployment).

## 9. API Specification

**FastAPI routing service** (patient-facing, unauthenticated)

`POST /match`
```json
// Request
{ "lat": 40.7128, "lng": -74.0060, "resource_types": ["icu_bed", "blood_o_neg"] }

// Response
{
  "hospital": { "id": 14, "name": "...", "address": "...", "phone": "..." },
  "eta_seconds": 312,
  "distance_km": 4.1,
  "route_geometry": "<Mapbox route geometry>",
  "search_radius_used_km": 10,
  "query_log_id": 88213
}
```

`GET /resource-types` → the enum list, for the frontend's multi-select.

**Express gateway** (admin-facing, JWT-protected except login)

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/admin/auth/login` | `{ username, password }` → `{ token, hospital_id }` |
| GET | `/admin/inventory` | Returns the logged-in hospital's `resources` rows |
| PUT | `/admin/inventory/:resourceId` | `{ quantity_available }` → updates row + `last_updated_at`, triggers SSE push |
| GET | `/stream/hospital/:hospitalId` | SSE stream of inventory change events |

## 10. Non-Functional Requirements

| Requirement | Target | Maps to |
|---|---|---|
| End-to-end query latency | < 2–3s, p95 | H4 |
| Spatial query latency at scale | Sub-second at 1K / 10K / 100K synthetic hospital rows, measured with vs. without the GiST index | H2 |
| Concurrent load | Sustain realistic concurrent emergency-query volume without error-rate degradation (k6/Locust) | H3 |
| Availability during load test window | Measure and report uptime %, don't just assert it | H3 |

## 11. Data Seeding & Test Data

- **Real dataset**: ~20–50 hospitals for the pilot city, sourced from OSM or Google Places (name, address, geocoded lat/lng). Blocked on target city — see Section 15.
- **Synthetic inventory generator**: plausible random `quantity_available` + `last_updated_at` per resource type, for demoing and for the accuracy evaluation (12.A).
- **Synthetic scale datasets**: generated hospital rows at 1K / 10K / 100K scale, geographically distributed, for the performance benchmark (12.B) — these don't need real addresses, just valid geometry.

## 12. Evaluation Methodology (build deliverables, not just metrics)

| # | Tests | Needs to be built |
|---|---|---|
| **A. Routing accuracy vs. baseline** | Resource-aware routing beats naive nearest-hospital routing | Script running 500–1000 randomized simulated patient queries against the live `/match` endpoint; compute % of `baseline_hospital_id` results that would've failed the resource requirement, and mean ETA delta vs. `matched_hospital_id` |
| **B. Spatial query performance at scale** | GiST index + PostGIS hold up as hospital count scales | Benchmark harness against the 1K/10K/100K synthetic datasets; capture p50/p95/p99, once with the GiST index and once without, to make the index's payoff explicit |
| **C. Architecture feasibility under load** | Backend holds up under concurrent emergency queries | k6 or Locust script simulating concurrent `/match` calls; capture sustained req/sec, error rate, uptime |
| **D. End-to-end latency** | Real usability, not just component-level speed | Already instrumented via FR-5 — this is just the analysis pass over `query_log`'s timing columns |

## 13. Build Phases

| Phase | Deliverable |
|---|---|
| 1 | Schema + PostGIS setup, synthetic inventory generator, real hospital dataset import |
| 2 | FastAPI: `/match` endpoint, radius-expansion logic, Mapbox integration, query logging |
| 3 | Express gateway: JWT auth, inventory CRUD, SSE broadcast |
| 4 | Frontend: patient PWA, then admin dashboard |
| 5 | AWS deployment (RDS, ECS Fargate ×2, S3+CloudFront) |
| 6 | Evaluation harness: baseline-comparison script, k6/Locust load scripts, scale benchmark script |
| 7 | Run evaluations A–D, export `query_log` for analysis |

## 14. Known Limitations

Carry these into the study's discussion section rather than engineering around them:
- Simulated inventory doesn't capture the real-world friction of hospitals actually keeping data current — in a real deployment, stale data is the bigger risk, not the routing logic.
- Single-city scope — don't generalize results beyond it without saying so.
- No real emergency validation is possible or ethical; the outcome-impact claim (H1) is necessarily simulated, not clinically proven.
- Admin account model is intentionally simplified (one JWT login per hospital, no identity verification) — real deployment would need hospital-identity-level verification. Worth one line in Future Work, not worth building now.

## 15. Open Assumptions — Confirm Before Build

- **Target city** not yet specified — needed before Section 11's real-dataset step can start.
- Assuming admin accounts are provisioned directly (seed script or manual insert), not via self-service signup — matches the simplified admin model in Section 14.
- Assuming you'll supply your own Mapbox API key and AWS credentials as environment variables/secrets, not something to be generated.
- Assuming a local/dev-first build (Phases 1–4) before cloud deployment (Phase 5), not a simultaneous build.
