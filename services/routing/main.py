"""
Crisis Care — FastAPI Routing Service

Responsibilities (do NOT add admin-facing logic here):
  - POST /match           FR-2: spatial query, radius expansion, query logging
  - GET  /resource-types  enum list for the patient-app multi-select

Architecture note (AGENTS.md):
  This service is intentionally separate from backend/gateway (Node/Express).
  Never merge them — gateway owns admin auth/CRUD/SSE, this service owns
  patient-facing spatial queries and query logging.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database
from routers import match, resource_types, route_incident, hospitals_summary

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: create / close the asyncpg pool around the app's lifetime
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Routing service starting — creating database pool…")
    await database.create_pool()
    logger.info("Database pool ready.")
    yield
    logger.info("Routing service shutting down — closing database pool…")
    await database.close_pool()
    logger.info("Database pool closed.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Crisis Care — Routing Service",
    description=(
        "Resource-aware emergency hospital routing. "
        "See docs/PRD.md for full specification. "
        "Patient-facing only — no admin endpoints here."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# Allow the patient PWA (any origin in dev; tighten in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(match.router,              tags=["matching"])
app.include_router(route_incident.router,     tags=["routing-v2"])
app.include_router(resource_types.router,     tags=["meta"])
app.include_router(hospitals_summary.router,  tags=["live-status"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health():
    """Liveness probe — checks DB connectivity."""
    pool = database.get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "service": "crisis-care-routing", "db": "connected"}
    except Exception as exc:
        return {"status": "degraded", "service": "crisis-care-routing", "db": str(exc)}
