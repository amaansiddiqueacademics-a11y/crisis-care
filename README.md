# Crisis Care

Resource-aware emergency hospital routing system — single-city pilot and academic feasibility study instrument.

> Full product spec: [`docs/PRD.md`](docs/PRD.md)

---

## Repository Structure

```
crisis-care/
├── docs/                        # Product requirements, architecture notes
│   └── PRD.md                   # Full spec — read before every task
│
├── frontend/
│   ├── patient-app/             # React PWA — anonymous patient-facing UI
│   └── admin-dashboard/         # React app — authenticated hospital admin UI
│
├── backend/
│   └── gateway/                 # Node/Express — admin auth, inventory CRUD, SSE
│
├── services/
│   └── routing/                 # Python/FastAPI — /match endpoint, spatial queries
│
├── db/
│   ├── migrations/              # SQL migration files (PostGIS schema)
│   └── seed/                    # Seed SQL for dev/demo data
│
├── scripts/
│   ├── data-import/             # Import real hospital data (OSM / Google Places)
│   ├── synthetic-data/          # Generate synthetic hospitals + inventory at scale
│   └── evaluation/              # Evaluation harness scripts (Section 12 of PRD)
│
├── infra/                       # Cloud infra config (AWS ECS, RDS, etc.)
│
├── docker-compose.yml           # Local dev: PostgreSQL + PostGIS
├── AGENTS.md                    # Agent instructions — architecture rules + tech stack
└── .gitignore
```

---

## Architecture Overview

Two backend services share one PostgreSQL+PostGIS database. **They must stay separate — never merge them.**

| Service | Path | Responsibility |
|---|---|---|
| Express gateway | `backend/gateway` | Admin JWT auth, inventory CRUD, SSE broadcast |
| FastAPI routing | `services/routing` | Patient `/match`, spatial queries, Mapbox ETA, query logging |

Patient-facing endpoints are **unauthenticated by design**. Admin endpoints always require a valid JWT.

---

## Local Development

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres + PostGIS)
- Node.js ≥ 18
- Python ≥ 3.11

### 1. Start the database

```bash
docker-compose up -d
```

Postgres 16 + PostGIS 3.4 will be available on `localhost:5433`.  
Database: `crisis_care` · User: `crisis_user` · Password: `crisis_password`

> **Note:** The Docker container maps to host port **5433** (not 5432) to avoid
> conflict with any native PostgreSQL installation on the host. All `DATABASE_URL`
> values in `.env.example` files use `:5433` accordingly.

Verify PostGIS is available:
```bash
docker exec -it crisis-care-db psql -U crisis_user -d crisis_care -c "SELECT PostGIS_Version();"
```

### 2. Express gateway (`backend/gateway`)

```bash
cd backend/gateway
cp .env.example .env        # fill in JWT_SECRET and MAPBOX_API_KEY
npm install
npm run dev
```

Runs on `http://localhost:4000` by default.

### 3. FastAPI routing service (`services/routing`)

```bash
cd services/routing
cp .env.example .env        # fill in DATABASE_URL, MAPBOX_API_KEY
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs on `http://localhost:8000` by default.  
Interactive docs: `http://localhost:8000/docs`

### 4. Frontend apps

**Patient app:**
```bash
cd frontend/patient-app
npm install
npm run dev
```

**Admin dashboard:**
```bash
cd frontend/admin-dashboard
npm install
npm run dev
```

---

## Environment Variables

Copy `.env.example` → `.env` in each service directory and fill in real values:

| File | Variables |
|---|---|
| `backend/gateway/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `MAPBOX_API_KEY`, `PORT` |
| `services/routing/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `MAPBOX_API_KEY`, `PORT` |

Real `.env` files are gitignored and must never be committed.

---

## Build Phases (from PRD §13)

| Phase | Status | Deliverable |
|---|---|---|
| **1** | ⬜ Next | Schema + PostGIS setup, synthetic data generator, hospital data import |
| **2** | ⬜ | FastAPI `/match` endpoint, radius expansion, Mapbox ETA, query logging |
| **3** | ⬜ | Express gateway: JWT auth, inventory CRUD, SSE broadcast |
| **4** | ⬜ | Frontend: patient PWA + admin dashboard |
| **5** | ⬜ | AWS deployment (RDS, ECS Fargate ×2, S3+CloudFront) |
| **6** | ⬜ | Evaluation harness (baseline comparison, k6/Locust, scale benchmark) |
| **7** | ⬜ | Run evaluations A–D, export `query_log` for analysis |
