# Crisis Care: System Design & Architecture

## 1. Dynamic Frontend & Apple-Like UI Experience
The user interface has been designed to be fully dynamic, responsive, and highly interactive, drawing inspiration from premium modern web experiences (like Apple's product sites).

*   **Glassmorphism & Neon Esthetics:** The UI uses dark mode with "glass" overlays (translucent, blurred backgrounds), subtle glowing borders, and neon gradient text to emphasize critical metrics.
*   **Micro-Interactions:** Hover states slightly lift cards, metrics animate using an eased counter, and dynamic "Live" pulsing dots indicate real-time connection status.
*   **Real-Time Live Map:** A prominent, full-width Interactive Map powered by Leaflet and OpenStreetMap now anchors the Main Dashboard. It renders the actual city layout with dynamic, glowing markers representing the live status (Tier, ICU availability) of all hospitals in the network, feeling like a real mission-control center.

## 2. Full-Stack Data Integration
The system is no longer a static UI mockup. Citizen, Ambulance, and Hospital interfaces are connected to a genuine backend cluster via a unified Database.

*   **Node.js/Express Gateway:** Handles the immediate business logic — authentication, inventory updates, and the real-time "Handshake" process between ambulances and hospitals.
*   **Server-Sent Events (SSE):** Provides real-time event streaming. When a citizen reports an emergency or an ambulance completes a clinical assessment, the gateway pushes events (like `route_proposed`) directly to the target hospital's dashboard in milliseconds.
*   **PostgreSQL + PostGIS:** A robust geospatial database stores all hospitals, their tiered resources (ICU beds, Ventilators, Antivenom), and exact GPS coordinates.

## 3. Data Science, Math, & Machine Learning Concepts
To ensure patients reach the *right* hospital on time, the system uses advanced routing logic rather than naive "closest distance" matching.

*   **Spatial Indexing (PostGIS):** The FastAPI routing service uses `ST_DWithin` and `ST_DistanceSphere` to instantly query the database for hospitals within an 8km radius of the incident.
*   **Cost Function Optimization:** Finding the "best" hospital is a multi-variable optimization problem. The system calculates a `cost` score for every nearby hospital using a weighted formula:
    *   `Cost = (Time * 0.7) + (Capacity_Penalty * 0.3)`
    *   This ensures the system doesn't route an ambulance to a hospital that is 2 minutes closer but has 0 ICU beds.
*   **Traffic Variance via Poisson Distribution:** To simulate real-world conditions (like evening rush hour), the routing engine uses a Poisson distribution model to dynamically alter ETAs based on the time of day and typical traffic density.
*   **Clinical Telemetry Routing:** If a patient has labored breathing and low SpO2, the system automatically filters the target hospital list for facilities that have available Ventilators and ICU beds.

## 4. The Closed-Loop Flow
1.  **Citizen SOS:** A citizen triggers an SOS. The location is grabbed.
2.  **Auto-Dispatch:** The closest ambulance receives the ping.
3.  **On-Scene Math:** The paramedic enters vitals. FastAPI calculates the optimal ER considering the live traffic + ICU/specialist availability.
4.  **Handshake:** The chosen ER receives a flashing prompt on their dashboard. If they decline (e.g., surgeon just went into surgery), the system automatically re-routes to the *next* best hospital mathematically.
5.  **Live GPS:** The Citizen Dashboard and Main Dashboard show the ambulance moving toward the accepted hospital via the interactive Leaflet map.