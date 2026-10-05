# 🚨 Crisis Care v2.0

> **Resource-Aware Emergency Hospital Routing System**  
> An academic feasibility study & working full-stack prototype for intelligent ambulance-to-hospital allocation in Indian cities.

---

## 📌 What Is This?

Crisis Care is a smart emergency response platform that solves a critical real-world problem:

> **When an ambulance is rushing a critical patient, which hospital should it go to?**

Instead of defaulting to the *nearest* hospital (which might have zero ICU beds or no trauma surgeon), Crisis Care uses a **resource-aware routing algorithm** that finds the *optimal* hospital based on:

- Live ICU/bed/specialist availability
- Drive-time (using Poisson-modelled traffic variance)
- Geospatial proximity (PostGIS spatial queries)
- Triage-specific resource requirements (17 emergency categories)

This is an **academic project** (college research paper), but it's built as a *real*, working full-stack system — not a mockup.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│         React + Vite + TailwindCSS + Leaflet                 │
│   (Citizen | Ambulance | Hospital | Admin portals)           │
└─────────────────────────────┬────────────────────────────────┘
                              │ HTTP / SSE
        ┌─────────────────────▼────────────────────┐
        │         Node.js / Express Gateway         │
        │   Auth (JWT) · SSE · Reservations · CRUD  │
        └────────────┬─────────────────────┬────────┘
                     │ HTTP                │ SQL (pg)
        ┌────────────▼──────┐   ┌──────────▼──────────────┐
        │  FastAPI Routing  │   │  PostgreSQL + PostGIS     │
        │  Service (Python) │   │  (Hospitals, Resources,   │
        │  /match · /route  │   │   Reservations, Audit)    │
        └───────────────────┘   └──────────────────────────┘
```

The system is split into **three independent services**:

| Service | Tech | Port | Responsibility |
|---|---|---|---|
| **Gateway** | Node.js / Express | `3001` | Auth, SSE, Reservations, Hospital CRUD |
| **Routing Service** | FastAPI (Python) | `8000` | Spatial queries, routing algorithm, triage matching |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | `5433` | All persistent data + geospatial indexing |

---

## 🧠 The Routing Algorithm

This is the core research contribution. When an attendant submits a clinical assessment, the routing service:

1. **Spatial filter** — Uses `ST_DWithin` to find hospitals within 8 km of the incident location
2. **Triage filter** — Removes hospitals missing the required resources for the patient's condition (e.g., ventilator, neurologist, antivenom)
3. **Cost score** — Calculates a weighted score for every candidate:
   ```
   Cost = (Drive_Time × 0.7) + (Capacity_Penalty × 0.3)
   ```
4. **ETA modelling** — Applies a **Poisson distribution** to simulate time-of-day traffic variance on drive times
5. **Escalation** — If no hospital accepts within the tier-1 radius, automatically expands to a wider search radius (tier-2 escalation)

The system compares this against a **naive "closest hospital" baseline** to measure real improvement in Time-to-Definitive-Care (TDC).

---

## 👥 Actor Portals (4 Dashboards)

| Portal | Who Uses It | Key Actions |
|---|---|---|
| 🧑 **Citizen** | Public | SOS trigger, triage category selection, live ambulance tracking |
| 🚑 **Ambulance / Attendant** | Paramedic | Clinical assessment entry, auto-routed hospital recommendation |
| 🏥 **Hospital** | ER staff | Real-time SSE proposals, Accept / Reject with reason |
| 🔐 **Admin** | System admin | Hospital & resource management, audit log, live stats |

---

## 🔥 Features Built So Far

### ✅ Backend — Node.js Gateway
- JWT-based authentication (roles: `citizen`, `attendant`, `hospital`, `admin`)
- Server-Sent Events (SSE) for real-time hospital notifications
- Full reservation lifecycle (propose → accept/reject → escalate)
- Inventory management API
- Simulation worker with **Poisson-driven** inventory fluctuation (simulates real-world resource churn)
- Dispatch + incident creation endpoints

### ✅ Routing Service — FastAPI (Python)
- `POST /route-incident` — main routing endpoint (spatial + triage + cost ranking)
- `POST /match` — general resource matching
- `GET /resource-types` — enum list of all resource types
- `GET /hospitals/summary` — live hospital status for the dashboard map
- `GET /health` — liveness probe with DB connectivity check
- Query logging for all routing decisions (evaluation harness support)

### ✅ Database — PostgreSQL + PostGIS
- 6 migration files tracking full schema evolution
- Hospital dataset: ~60–80 real hospitals across **Mumbai, Pune, Nandurbar, Gadchiroli**
- 17 triage categories with resource requirement mappings
- 3 new resource types added in v5: **Antivenom**, **Labor/Delivery Ward Bed**, **Pediatric ICU Bed**
- Audit log table for all critical system events
- Reservations table with full lifecycle state machine

### ✅ Frontend — React + Vite
- Dark glassmorphism UI (inspired by premium Apple-style design)
- 4 actor portals: Citizen, Ambulance, Hospital, Admin
- **Live interactive map** (Leaflet + OpenStreetMap) with real-time hospital markers
- Animated metric counters, hover-lift cards, live SSE connection status indicators
- Landing page with real stats pulled from the evaluation harness

### ✅ Scripts & Dev Tools
- `npm run migrate` — apply all DB migrations in order
- `npm run import:hospitals` — seed real hospital data
- `npm run seed:inventory` — generate synthetic resource inventory
- `npm run seed:scale` — generate scale test dataset
- `npm run test:smoke` — end-to-end smoke test
- Full SSE dispatch test, reservation lifecycle test, simulation test

---

## 🛠️ Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool / dev server |
| TailwindCSS | 3.4 | Styling |
| Leaflet / react-leaflet | 1.9 / 5.0 | Interactive map |
| lucide-react | latest | Icons |

### Backend Gateway
| Package | Version | Purpose |
|---|---|---|
| Express | 5 | HTTP server |
| pg | 8 | PostgreSQL client |
| jsonwebtoken | 9 | JWT auth |
| bcrypt | 6 | Password hashing |
| cors | 2.8 | CORS middleware |
| dotenv | 17 | Environment config |

### Routing Service (Python)
| Package | Version | Purpose |
|---|---|---|
| FastAPI | ≥0.115 | API framework |
| uvicorn | ≥0.30 | ASGI server |
| asyncpg | ≥0.29 | Async PostgreSQL driver |
| httpx | ≥0.27 | HTTP client (ORS/Mapbox calls) |
| pydantic | ≥2.0 | Data validation |
| python-dotenv | ≥1.0 | Environment config |

### Infrastructure
| Tool | Purpose |
|---|---|
| PostgreSQL 16 + PostGIS 3.4 | Geospatial database |
| Docker + Docker Compose | Database container |
| ORS (OpenRouteService) | Drive-time calculation |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- Docker Desktop (for the database)

### 1. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL + PostGIS on port `5433`.

### 2. Run Database Migrations

```bash
npm run migrate
```

### 3. Seed Hospital Data

```bash
npm run import:hospitals
npm run seed:inventory
```

### 4. Start the Backend Gateway

```bash
cd backend/gateway
cp .env.example .env   # fill in your secrets
npm install
npm run dev
```

Gateway runs on **http://localhost:3001**

### 5. Start the Routing Service

```bash
cd services/routing
cp .env.example .env   # fill in your secrets
python -m venv venv
venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Routing service runs on **http://localhost:8000**  
API docs available at **http://localhost:8000/docs**

### 6. Start the Frontend

```bash
cd frontend/frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 📁 Project Structure

```
crisis-care/
├── backend/
│   └── gateway/              # Node.js/Express API gateway
│       ├── routes/
│       │   ├── auth.js       # Login/register endpoints
│       │   ├── dispatch.js   # Incident & dispatch logic
│       │   ├── reservations.js  # Reservation lifecycle
│       │   ├── inventory.js  # Resource inventory CRUD
│       │   └── stream.js     # SSE event streaming
│       ├── handshake.js      # Hospital handshake logic
│       ├── simulation-worker.js  # Poisson inventory simulation
│       └── sse.js            # SSE connection manager
├── services/
│   └── routing/              # FastAPI Python routing service
│       ├── main.py           # App entry point
│       ├── triage.py         # 17 triage category mappings
│       ├── models.py         # Pydantic data models
│       ├── ors.py            # OpenRouteService integration
│       ├── mapbox.py         # Mapbox integration
│       ├── database.py       # asyncpg pool management
│       └── routers/          # API route handlers
├── frontend/
│   └── frontend/             # React + Vite app
│       └── src/
│           ├── components/
│           │   ├── admin/    # Admin portal
│           │   ├── ambulance/ # Attendant portal
│           │   ├── client/   # Citizen portal
│           │   ├── hospital/ # Hospital portal
│           │   ├── dashboard/ # Main dashboard
│           │   └── common/   # Shared components
│           └── services/     # API service layer
├── db/
│   └── migrations/           # SQL migration files (001–006)
├── scripts/                  # Dev, seed, test, evaluation scripts
├── docker-compose.yml        # PostgreSQL + PostGIS container
├── design.md                 # UI/UX design reference
└── Crisis Care v2.0 — PRD v5.md  # Full product requirements
```

---

## 🔌 Key API Endpoints

### Gateway (Node.js — port 3001)
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate and get JWT |
| `POST` | `/dispatch/incident` | Create a new emergency incident |
| `GET` | `/stream/events` | SSE stream for real-time events |
| `POST` | `/reservations` | Propose hospital reservation |
| `PUT` | `/reservations/:id/accept` | Hospital accepts reservation |
| `PUT` | `/reservations/:id/reject` | Hospital rejects (triggers re-route) |
| `GET` | `/inventory` | Get resource inventory |

### Routing Service (FastAPI — port 8000)
| Method | Path | Description |
|---|---|---|
| `POST` | `/route-incident` | Run full routing algorithm |
| `POST` | `/match` | Match resources to triage type |
| `GET` | `/resource-types` | List all resource types |
| `GET` | `/hospitals/summary` | Live hospital status for map |
| `GET` | `/health` | Service liveness check |
| `GET` | `/docs` | Interactive API documentation |

---

## 📊 17 Triage Categories

The system maps every emergency type to specific required hospital resources:

| Emergency | Required Resources |
|---|---|
| Traffic & Road Accident | ICU bed, ventilator, trauma surgeon, Blood O-, CT scanner |
| Cardiac Arrest | Cardiologist, cardiac ICU, oxygen |
| Severe Bleeding & Trauma | Blood O-, trauma surgeon, ICU bed |
| Suspected Stroke (FAST) | CT scanner, neurologist, ICU bed |
| Seizure / Epileptic Fit | Neurologist, ICU bed |
| Severe Burns | ICU bed, IV fluids, trauma surgeon |
| Snakebite / Animal Attack | **Antivenom**, ICU bed |
| Pregnancy / Labor Emergency | **Labor/delivery ward bed**, obstetrician |
| Pediatric / Infant Distress | **Pediatric ICU bed**, pediatrician |
| + 8 more categories | (see PRD for full table) |

---

## 🔬 Research Context

This project is built as an **academic feasibility study**. The research question:

> Does resource-aware routing (triage-filtered, cost-optimized) reduce Time-to-Definitive-Care compared to naive nearest-hospital routing?

The system includes an **evaluation harness** (`scripts/evaluation/`) that:
- Runs both routing strategies on the same incident dataset
- Measures TDC difference, secondary-transfer rate, and p95 latency
- Stores results in a `stats` table
- Exposes results via `/stats/summary` on the landing page (real numbers, not hardcoded)

**Important scope note:** Ambulance-to-scene assignment uses a *simple availability rule* (next available attendant from a seeded pool of 3–5). This is **not** a research contribution — the system's contribution is the *scene-to-hospital* allocation decision.

---

## 🗺️ Roadmap (What's Left)

- [ ] Wire all frontend screens to live backend endpoints (remove all mock data)
- [ ] Fix hospital selection screen to show engine's auto-recommendation (not manual pick)
- [ ] Complete audit log display in Admin portal
- [ ] Finish evaluation harness + `/stats/summary` endpoint
- [ ] Add attendant pool + simple dispatch assignment endpoint
- [ ] Full end-to-end SSE loop verification with new frontend
- [ ] Motion/polish pass (scroll-reveal, animated counters, sticky nav)
- [ ] Update research paper with 17 categories, citizen flow, real evaluation numbers

---

## 📄 License

ISC — Academic project. Not intended for production medical use.

---

> Built by **Amaan Siddique** as part of an academic research project on emergency medical system optimization.
