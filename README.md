# 🚨 Crisis Care — Real-Time Healthcare Routing System

> **A resource-aware emergency dispatch and hospital coordination prototype**  
> Designed to coordinate citizens, ambulance attendants, hospital emergency departments, and system administrators during time-critical medical emergencies.

Crisis Care coordinates citizen SOS requests, ambulance dispatch, paramedic triage, hospital acceptance, and resource-aware destination selection. Its routing engine is designed to choose a hospital based on the patient’s assessed needs and available resources—not distance alone. This is an academic prototype; it is not a certified emergency dispatch or clinical decision-support service.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Portals and Features](#-portals-and-features)
3. [Technology Stack](#-technology-stack)
4. [Demo Credentials](#-demo-login-credentials)
5. [Prerequisites](#-prerequisites)
6. [Run the Project Locally](#-run-the-project-locally)
7. [Project Structure](#-project-structure)
8. [Key Workflows](#-key-workflows)
9. [Demo Data and State Reset](#-demo-data-and-state-reset)
10. [Available Scripts](#-available-scripts)
11. [Reliability and Verification Checklist](#-reliability-and-verification-checklist)
12. [Disclaimer](#-disclaimer)

---

## 📌 Project Overview

During a medical emergency, sending a patient to the closest hospital may not be the best option if that facility lacks an ICU bed, a required specialist, oxygen, or another resource needed for the patient's condition.

Crisis Care is designed to coordinate four operational roles through a shared workflow:

- **Citizens** submit emergency requests and track dispatch progress.
- **Ambulance attendants** assess the patient, review hospital recommendations, and select a destination.
- **Hospital emergency staff** review incoming requests and accept or decline transfers based on current capacity.
- **Administrators** monitor system activity, hospital resources, and audit events.

The main objective is to support resource-aware hospital routing and reduce avoidable delays in reaching appropriate care.

### Core routing considerations

The routing service considers or is designed to consider:

- Emergency/triage category and required hospital capabilities
- Geographic proximity and estimated drive time
- Available beds, equipment, blood units, oxygen, and specialists
- Hospital acceptance or rejection
- Re-routing when a facility cannot accept a case

The system is an academic feasibility prototype. Any performance figures shown in the interface must be clearly identified as measured evaluation results or illustrative demo values; they must not be presented as verified real-world outcomes unless supported by an evaluation.

---

## 🏗️ Portals and Features

Crisis Care includes a Command Center and four role-specific portals, connected through the emergency incident and hospital reservation workflow.

### 1. Command Center Dashboard

- **Live resource monitor:** city-wide view of ICU beds, ventilators, oxygen cylinders, and specialist availability across 22+ major Mumbai hospitals. Availability depends on the configured dataset and backend state.
- **Live ambulance map:** Leaflet map showing ambulance locations and status, color-coded as Available, Responding, or Returning.
- **Dispatch analytics:** emergency-volume and transit-time visualizations where data is available.
- **Real-time audit logs:** updates to hospital resources and other critical actions.
- **CSV exports:** export supported ambulance-fleet data and historical audit records.
- **Theme switcher:** Emergency Red & Black and Deep Teal themes.

> Dashboard metrics should distinguish live backend data, simulated inventory, and evaluation results.

### 2. Citizen / Client Portal

- **One-click SOS:** submit an emergency request and capture the citizen’s GPS coordinates when location permission is granted.
- **Ambulance assignment:** dispatch logic assigns an available ambulance from the configured fleet pool and returns the paramedic’s name, callsign, and Badge ID when those fields are available.
- **Live incident lifecycle:** display dispatch status and ambulance ETA, then update the hospital destination and hospital ETA as the reservation workflow progresses.
- **Hospital decision updates:** show acceptance or rejection and the resulting destination change.
- **Fallback behavior:** if dispatch or routing requests fail or time out, the UI may currently fall back to demo data; this is a known reliability issue to resolve, not a successful live dispatch.

The interface should communicate clearly when location permission is unavailable or a value is only simulated.

### 3. Ambulance Attendant Portal

- **Badge ID authentication:** paramedics sign in with their crew Badge ID (for example, `PARA-101`, depending on seeded accounts) and password.
- **In-field triage:** complete an interactive assessment checklist for signs such as severe bleeding, cardiac arrest, and stroke, along with other supported clinical observations.
- **Constraint-based smart routing:** submit the assessment to the routing backend, which filters out hospitals lacking the resources required for the case and ranks eligible options.
- **Route visualization:** view the proposed destination and route on an interactive Leaflet map.
- **Transfer proposal:** send incident and triage details to the selected hospital ER.
- **Re-routing:** if a hospital declines, the system attempts to select the next eligible hospital while keeping the incident active.

Clinical fields are for demonstration and academic evaluation only; the application does not replace professional medical assessment.

### 4. Hospital Emergency Department Portal

- **Facility-specific access:** hospital staff view requests for their own facility.
- **Live proposals:** receive incoming transfer proposals through Server-Sent Events (SSE), when the stream connection is healthy.
- **Accept or decline:** accept a request or decline it with a reason. A rejection triggers a new routing attempt.
- **Resource reservation:** on acceptance, the backend reserves required resources so they cannot be double-booked by concurrent requests.
- **Inventory management:** update available beds, equipment, oxygen, blood units, and supported specialist availability.
- **Status propagation:** send the hospital decision back to the ambulance and citizen workflows.

A hospital's actions must be scoped to that facility. A decline from one hospital must not cancel the incident or modify another hospital's decision.

### 5. Admin Operations Portal

- **Administrator authentication:** access the administrative dashboard.
- **Global resource oversight:** monitor resource availability across configured hospitals.
- **Live ambulance fleet:** inspect ambulance positions and statuses on the Leaflet map.
- **Real-time audit ledger:** review resource changes with facility, timestamp, action, and quantity delta where recorded.
- **CSV exports:** download supported fleet snapshots and audit history.
- **Session management:** support administrator login and logout.

Audit records should only be described as immutable or cryptographically protected if the implementation actually enforces those properties. A client-side demo log is not a tamper-proof audit system.

---

## 🔑 Demo Login Credentials

The following are the demo credentials specified for the prototype. Fast-login buttons may be available on the corresponding login screens.

| Portal | Demo user / ID | Password | Login shortcut |
|---|---|---|---|
| Hospital — Apex Central | `er.chief@apex.care` | `hospital123` | Apex Central |
| Hospital — LifeLine Specialty | `er.chief@lifeline.care` | `hospital123` | LifeLine Specialty |
| Ambulance / Attendant | `PARA-409` | `paramedic123` | Pre-filled credentials |
| Admin Operations | `adm_shivam_027` | `admin123` | Log In as Super Admin |

**Demo-mode warning:** These credentials are for local demonstration only. Do not use them in a deployed or production system. If the current login implementation accepts any password of four or more characters, that is a demo shortcut—not secure authentication. Confirm the actual behavior in the running application.

The citizen portal should provide an SOS/request flow; a citizen login is not listed in the demo credentials above.

---

## 🛠️ Technology Stack

The platform uses the following frontend and backend technologies. Check the checked-out repository and configuration files for exact installed versions and enabled integrations.

| Technology | Purpose |
|---|---|
| React | Build reusable portal and dashboard interfaces |
| Vite | Local development server and production build |
| Tailwind CSS | Utility-based styling and theme implementation |
| Leaflet | Interactive maps, hospital markers, and route visualization |
| Lucide React | Interface icons |
| Browser Storage Events | Synchronize demo state across open tabs when using browser storage |
| Node.js and npm | JavaScript runtime and package management |

### Backend and infrastructure

If the project is connected to the resource-aware routing architecture, the intended services can be separated as follows:

| Service | Technology | Responsibility |
|---|---|---|
| API gateway | Node.js / Express | Authentication, incidents, dispatch, reservations, inventory, and real-time SSE events |
| Routing service | Python / FastAPI | Triage/resource matching, spatial filtering, and hospital ranking |
| Database | PostgreSQL + PostGIS | Persistent incidents, hospitals, inventory, reservations, audit records, and spatial indexes |
| Drive-time provider | OpenRouteService (ORS) | Road-network route and driving ETA estimates |
| Local infrastructure | Docker Compose | Run the database and supporting services consistently |

The backend is responsible for authoritative state. The gateway delivers hospital proposals through SSE, while the FastAPI routing service selects candidates based on triage requirements, resources, and travel time. Database transactions and row-level locking (including `SELECT ... FOR UPDATE`) are intended to prevent concurrent reservations from consuming the same last available resource. Confirm the active environment and integration configuration before treating any external service or live-data feed as available.

---

## ⚙️ Prerequisites

Before running the **frontend prototype**, install:

1. **Node.js:** version 18 or higher.
2. **npm:** version 9 or higher, included with Node.js.
3. **A modern browser:** Chrome, Edge, Firefox, or Brave.

Check your installation:

```bash
node -v
npm -v
```

If you are using the separate backend architecture, you may also need Python 3.11+, Docker Desktop, and credentials for any external routing service. Those are not required merely to launch the frontend.

---

## 🚀 Run the Project Locally

### 1. Open the project directory

In PowerShell or the VS Code terminal, change to the directory containing `package.json`.

For example:

```powershell
cd "C:\path\to\Crisis Care"
```

If the project is already open in VS Code, use its integrated terminal and verify the directory:

```powershell
dir
```

You should see `package.json` in the current directory before installing dependencies.

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Start the Vite development server

```bash
npm run dev
```

Vite will print the local URL in the terminal. Open the URL shown there; for the configuration described for this prototype, it is expected to be:

```text
http://localhost:3000
```

If Vite reports a different port, use the URL it actually prints. A port may change when the configured port is already occupied.

### 4. Build the frontend for production

```bash
npm run build
```

The generated static assets are normally written to `dist/`.

### 5. Preview the production build

```bash
npm run preview
```

Use the URL printed by Vite to open the preview.

### Optional: Start the separate backend architecture

Only follow these steps if the repository contains the corresponding backend folders, scripts, environment templates, and Docker Compose configuration. The commands below reflect the planned service layout and may need adjustment to match the checked-out branch.

**Database:**

```bash
docker compose up -d
```

**Gateway:**

```bash
cd backend/gateway
```

Create a local `.env` from `.env.example`, fill in the required configuration, install dependencies, and run the scripts defined in that directory's `package.json`.

**Routing service:**

```bash
cd services/routing
```

Create and activate a Python virtual environment, install the service's `requirements.txt`, configure its environment variables, and start the FastAPI application using the command documented by that service.

Do not commit `.env` files, API keys, database passwords, or production credentials.

---

## 📁 Project Structure

The frontend structure below describes the expected portal organization. File names may differ slightly in the current working tree.

```text
Crisis Care/
├── public/
│   └── images/                       # Public visual assets
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminPortal.jsx       # Admin login, overview, and audit UI
│   │   ├── ambulance/
│   │   │   ├── AmbulancePortal.jsx   # Attendant assessment and routing UI
│   │   │   └── VitalSignInput.jsx    # Clinical observation inputs
│   │   ├── client/
│   │   │   ├── ClientPortal.jsx      # Citizen SOS and incident tracker
│   │   │   └── EmergencyReportModal.jsx
│   │   ├── common/
│   │   │   ├── Header.jsx            # Navigation and theme controls
│   │   │   ├── LeafletMapView.jsx    # Interactive map
│   │   │   ├── NotificationToast.jsx # Status and dispatch notifications
│   │   │   └── OfflineBanner.jsx     # Connectivity indicator
│   │   ├── dashboard/
│   │   │   └── MainDashboard.jsx     # Command Center dashboard
│   │   └── hospital/
│   │       └── HospitalPortal.jsx    # Hospital requests and inventory UI
│   ├── context/
│   │   └── CrisisCareContext.jsx     # Shared frontend state
│   ├── data/
│   │   └── mockData.js               # Demo hospitals, incidents, and resources
│   ├── App.jsx                       # Root application
│   ├── index.css                     # Global styles and themes
│   └── main.jsx                      # React entry point
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

If the backend architecture is present, it may also include:

```text
backend/
└── gateway/                           # Node.js / Express API
services/
└── routing/                           # FastAPI routing service
db/
└── migrations/                        # Database schema migrations
scripts/                               # Seed, smoke-test, and evaluation tools
docker-compose.yml                     # Local database infrastructure
```

Treat the actual repository and `package.json` scripts as authoritative if they differ from these illustrative structures.

---

## 🔄 Key Workflows

### 1. Citizen SOS and ambulance dispatch

1. The citizen submits an SOS request and grants location permission where possible.
2. The dispatch workflow selects an available ambulance from the configured pool.
3. The citizen view displays the assigned paramedic identity and badge/callsign fields returned by the backend.
4. The incident remains active while the attendant performs triage and the system finds an appropriate hospital.
5. The UI should display real backend status and ETA data, and explicitly indicate failures rather than silently treating demo fallback data as a successful dispatch.

### 2. Hospital proposal, resource reservation, and rejection

1. The attendant submits the incident and triage assessment to the routing service.
2. The routing engine filters hospitals that lack the resources required for the emergency and ranks eligible facilities.
3. The gateway sends a proposal to the selected hospital; hospital staff receive it through SSE when connected.
4. If the hospital accepts, the backend reserves the required resources within a database transaction.
5. Row-level locking (for example, `SELECT ... FOR UPDATE`) protects inventory updates from concurrent booking races.
6. If the hospital declines, the reservation is rejected with a reason and the routing workflow attempts the next eligible option.
7. The citizen and ambulance interfaces receive updated destination and ETA information when the backend publishes the change.

SSE and routing calls can fail or time out. These failure states should be visible and recoverable; they must not silently be represented as confirmed dispatches.


### 3. Resource-aware hospital selection

The intended routing workflow is:

1. Find hospitals within a configured geographic search radius.
2. Filter candidates according to the emergency category and required resources.
3. Rank eligible candidates using estimated drive time and a resource/capacity penalty.
4. Send a proposal to a suitable hospital.
5. Expand the search or recommend another facility if no suitable hospital accepts.

The routing service uses OpenRouteService for road-network drive-time estimates when configured. Its resource constraints, scoring weights, search-radius escalation, and fallback rules should match the deployed configuration. The backend also includes a background simulator that can consume and release inventory to create changing demo conditions; simulated changes must be labelled as simulated.

### 4. Inventory and audit history

Hospital staff update their facility's available resources. The system should record supported changes with the facility, actor, timestamp, resource, and quantity delta. The Admin portal should provide a consolidated view of these events.

For a mock-data implementation, the records are demo state. Production-grade audit integrity requires server-side authorization, durable storage, and tamper-resistance controls.

---

## 🔁 Demo Data and State Reset

- **Page refresh:** The expected demo behavior is to reset active incidents, login sessions, and hospital decisions if the current implementation is configured to initialize a clean session on refresh.
- **Reset Mock Data:** If available, use the dashboard's reset control to restore sample hospital capacity, oxygen, and blood inventory values.
- **Multiple tabs:** Browser storage events may synchronize supported state changes between tabs; behavior depends on the state-management implementation.
- **No backend configured:** Data shown in a frontend-only demo may be sample data and should not be treated as live hospital availability.

The backend database is intended to preserve authoritative resource, reservation, and audit state. The background simulator may change inventory during a demo. If a citizen dispatch request times out and the UI falls back to demo data, treat this as a known bug: inspect the request timeout, backend response handling, and fallback logic, and do not show mock assignment/ETA details as if they were live.

---

## 📜 Available Scripts

Run scripts from the directory containing the relevant `package.json`.

| Command | Purpose |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build production frontend assets |
| `npm run preview` | Preview the production build |

If the repository includes a backend, its `package.json`, Python service configuration, and root scripts may provide additional commands for database migrations, hospital imports, inventory seeding, smoke tests, and evaluation. Confirm the exact names with `npm run` and the scripts defined in the repository.

---

## 🧪 Testing and Evaluation Goals

The project should be evaluated against the core research question:

> Does resource-aware hospital routing improve the time to definitive care compared with selecting the nearest hospital alone?

A meaningful evaluation can compare both approaches using the same incident scenarios and report metrics such as:

- Time to Definitive Care (TDC)
- Estimated drive time
- Rate of hospital rejection or secondary transfer
- Routing-service latency, including p95 latency
- Outcomes by emergency/triage category

Report sample or simulated results as such. Do not present illustrative dashboard values as validated clinical outcomes.

---

## 🚧 Reliability and Verification Checklist

The following checks are especially important for the described current feature set:

- [ ] Reproduce and fix the citizen dispatch timeout that can cause fallback to demo data when the hospital has not accepted quickly enough.
- [ ] Keep dispatch status, hospital acceptance status, and reservation status as separate lifecycle states.
- [ ] Ensure timeouts and SSE disconnects show a pending/error/retry state rather than fabricated live data.
- [ ] Verify ambulance assignment, paramedic name, callsign, and Badge ID are returned consistently.
- [ ] Verify ORS failures, slow responses, and unavailable routes have safe fallback behavior.
- [ ] Test concurrent reservations for the final available bed, ventilator, or specialist resource.
- [ ] Verify that rejection releases any provisional reservation and triggers a new eligible-hospital search.
- [ ] Verify all portal views receive the same authoritative incident and inventory state.
- [ ] Test the background simulator separately from real inventory mutations and clearly label simulated values.
- [ ] Confirm CSV exports include the intended fields and do not expose secrets or unnecessary patient information.
- [ ] Evaluate resource-aware routing against a nearest-hospital baseline using repeatable scenarios.
- [ ] Label simulated ETAs and research results clearly; do not claim clinical performance without evidence.

---

## 📄 License and Safety

This is an academic project and prototype, not a certified medical device or emergency dispatch service. It is **not intended for production medical use**. Do not rely on its routing, resource data, estimated arrival times, or first-aid content for a real emergency. In an actual emergency, contact the appropriate local emergency services.

---

* Crisis Care — A resource-aware emergency healthcare routing system for academic study and prototyping.*
