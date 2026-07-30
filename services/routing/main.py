# Crisis Care — FastAPI Routing Service
# Scaffolding only. Business logic implemented in Phase 2.
# See docs/PRD.md §8 FR-2, FR-5, FR-6 and §9 API Specification.
#
# Responsibilities of this service (do not add admin-facing logic here):
#   - POST /match           — spatial query, radius expansion, Mapbox ETA, query logging
#   - GET  /resource-types  — enum list for the patient-app multi-select

from fastapi import FastAPI

app = FastAPI(
    title="Crisis Care — Routing Service",
    description=(
        "Resource-aware emergency hospital routing. "
        "See docs/PRD.md for full specification."
    ),
    version="0.1.0",
)


@app.get("/health")
async def health():
    """Health check — no business logic."""
    return {"status": "ok", "service": "crisis-care-routing", "phase": "scaffolding"}


# TODO (Phase 2): implement POST /match
# from routers import match
# app.include_router(match.router)

# TODO (Phase 2): implement GET /resource-types
# from routers import resource_types
# app.include_router(resource_types.router)
