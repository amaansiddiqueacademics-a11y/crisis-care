"""
Crisis Care — POST /match router

Implements FR-2 steps 1–3 from docs/PRD.md:

  1. Spatial + inventory query at radius_km = 10.
  2. AND logic: hospital qualifies only if it has EVERY requested resource type
     with quantity_available > 0 AND last_updated_at within its own
     staleness_threshold_minutes. A stale or zero-quantity resource disqualifies
     the hospital entirely.
  3. Radius-expansion loop: 10 km → 25 km → 50 km → city-wide (no distance
     filter). Stop at the first radius that returns ≥ 1 qualifying hospital.
  4. Return top 3 by straight-line distance (ST_Distance, metres → km).

Mapbox ETA re-ranking (step 4–5) and query_log writing (step 6) are
intentionally omitted here; they are the next integration step.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from database import get_pool
from models import (
    HospitalResult,
    MatchRequest,
    MatchResponse,
    NoMatchResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Radius expansion sequence defined in PRD §8 FR-2 step 3.
# None = city-wide search (no ST_DWithin filter).
SEARCH_RADII_KM: list[int | None] = [10, 25, 50, None]

# ---------------------------------------------------------------------------
# Core SQL
# ---------------------------------------------------------------------------

# Used when a distance radius is supplied (steps 1–3 normal case).
_MATCH_SQL_WITH_RADIUS = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    ST_Distance(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance_m
FROM hospitals h
WHERE
    ST_DWithin(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3            -- radius in metres
    )
    AND h.id IN (
        SELECT hospital_id
        FROM resources
        WHERE resource_type = ANY($4::resource_type_enum[])
          AND quantity_available > 0
          AND last_updated_at > now() - (staleness_threshold_minutes || ' minutes')::interval
        GROUP BY hospital_id
        HAVING COUNT(DISTINCT resource_type) = $5
    )
ORDER BY distance_m ASC
LIMIT 3;
"""

# City-wide fallback — no ST_DWithin, still returns distance for ordering.
_MATCH_SQL_CITY_WIDE = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    ST_Distance(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance_m
FROM hospitals h
WHERE
    h.id IN (
        SELECT hospital_id
        FROM resources
        WHERE resource_type = ANY($3::resource_type_enum[])
          AND quantity_available > 0
          AND last_updated_at > now() - (staleness_threshold_minutes || ' minutes')::interval
        GROUP BY hospital_id
        HAVING COUNT(DISTINCT resource_type) = $4
    )
ORDER BY distance_m ASC
LIMIT 3;
"""


# ---------------------------------------------------------------------------
# Helper: run one radius attempt
# ---------------------------------------------------------------------------

async def _query_at_radius(
    pool,
    lng: float,
    lat: float,
    resource_types: list[str],
    radius_km: int | None,
) -> list[dict[str, Any]]:
    """
    Execute the spatial + inventory query for one radius.

    Returns a (possibly empty) list of matching hospital records.
    radius_km=None triggers the city-wide (no distance filter) query.
    """
    num_types = len(resource_types)

    async with pool.acquire() as conn:
        if radius_km is None:
            rows = await conn.fetch(
                _MATCH_SQL_CITY_WIDE,
                lng,
                lat,
                resource_types,   # asyncpg sends list[str] as text[] then Postgres casts
                num_types,
            )
        else:
            radius_m = radius_km * 1000.0
            rows = await conn.fetch(
                _MATCH_SQL_WITH_RADIUS,
                lng,
                lat,
                radius_m,
                resource_types,
                num_types,
            )

    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# POST /match
# ---------------------------------------------------------------------------

@router.post(
    "/match",
    response_model=MatchResponse | NoMatchResponse,
    summary="Find the nearest qualifying hospital",
    description=(
        "Runs a radius-expanding spatial search. "
        "A hospital qualifies only if it holds every requested resource type "
        "with quantity_available > 0 and last_updated_at within its "
        "staleness_threshold_minutes. "
        "Tries 10 km → 25 km → 50 km → city-wide; stops at first hit."
    ),
)
async def match(body: MatchRequest, request: Request):
    pool = get_pool()

    candidates: list[dict[str, Any]] = []
    matched_radius: int | None = -1   # sentinel: -1 means not yet found

    for radius_km in SEARCH_RADII_KM:
        label = f"{radius_km} km" if radius_km is not None else "city-wide"
        logger.info(
            "match: lat=%.5f lng=%.5f types=%s radius=%s",
            body.lat, body.lng, body.resource_types, label,
        )

        try:
            candidates = await _query_at_radius(
                pool, body.lng, body.lat, body.resource_types, radius_km
            )
        except Exception as exc:
            logger.exception("DB error during radius=%s query", label)
            raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc

        if candidates:
            matched_radius = radius_km  # None is valid (city-wide)
            break

    # No qualifying hospital at any radius
    if not candidates:
        logger.info(
            "match: no qualifying hospital found for types=%s",
            body.resource_types,
        )
        return NoMatchResponse()

    # Return the closest qualifying hospital (already ordered by distance_m ASC)
    best = candidates[0]
    distance_km = round(best["distance_m"] / 1000.0, 3)

    return MatchResponse(
        hospital=HospitalResult(
            id=best["id"],
            name=best["name"],
            address=best["address"],
            phone=best["phone"],
            distance_km=distance_km,
        ),
        search_radius_used_km=matched_radius,  # None = city-wide
        # eta_seconds and route_geometry remain None until Mapbox integration
        # query_log_id remains None until query logging is implemented
    )
