# Crisis Care — Agent Instructions
Full spec: docs/PRD.md. Read it before every task in this repo.

## Architecture — do not deviate
- Two independent backend services, never merged:
  - backend/gateway (Node/Express): admin auth, inventory CRUD, SSE broadcast only.
  - services/routing (Python/FastAPI): patient /match endpoint, spatial queries, Mapbox integration, query logging only.
- Both read/write the same PostgreSQL+PostGIS database (see db/migrations).

## Non-negotiable technical rules
- All spatial columns are geography(Point, 4326), never geometry — ST_DWithin/ST_Distance must operate in meters, not degrees.
- Every /match call writes to query_log, including zero-match cases, with baseline_hospital_id computed via plain nearest-distance (no resource filter) in the same request.
- A resource past its staleness_threshold_minutes is unavailable regardless of quantity_available.
- A hospital only qualifies if it has ALL requested resource types (AND logic, never OR).
- Patient-facing endpoints are unauthenticated by design; admin endpoints always require a valid JWT.

## Tech stack
Frontend: React + Tailwind + react-map-gl. Gateway: Node/Express + JWT + bcrypt + SSE. Routing service: Python/FastAPI. DB: PostgreSQL + PostGIS. External: Mapbox Directions API.
