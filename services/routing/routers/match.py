"""
Crisis Care — POST /match router  (FR-2, all 6 steps)

Full request flow per docs/PRD.md §8 FR-2:

  1. Spatial + inventory query at radius_km = 10.
  2. AND logic: hospital qualifies only if EVERY requested resource_type has
     quantity_available > 0 AND last_updated_at within staleness_threshold_minutes.
  3. Radius expansion: 10 km → 25 km → 50 km → city-wide. Stop at first hit.
  4. Call Mapbox Directions API (driving-traffic) for each of the top-3
     candidates concurrently. Elapsed time measured precisely.
  5. Re-rank by real ETA (lowest first). Return the winner.
  6. Compute baseline_hospital_id via plain nearest-distance query (no
     resource filter). Write one query_log row — including zero-match cases.

Timing is wall-clock via time.perf_counter:
  db_query_time_ms  — covers steps 1–3 (all radius attempts)
  mapbox_time_ms    — covers step 4 (entire concurrent batch)
  response_time_ms  — total from first byte of request to log write
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request

import ors as mapbox_client          # drop-in: same rank_by_eta / fetch_eta interface
import query_logger
from database import get_pool
from models import (
    HospitalResult,
    MatchRequest,
    MatchResponse,
    NoMatchResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Radius expansion sequence per PRD §8 FR-2 step 3.
# None = city-wide (no ST_DWithin filter).
SEARCH_RADII_KM: list[int | None] = [10, 25, 50, None]

# ---------------------------------------------------------------------------
# SQL: spatial + inventory match
# ---------------------------------------------------------------------------

# We SELECT lat/lng explicitly (extracted from geography) so mapbox.py has
# real coordinates without a second DB round-trip.
_MATCH_SQL_WITH_RADIUS = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    ST_Y(h.geom::geometry) AS lat,
    ST_X(h.geom::geometry) AS lng,
    ST_Distance(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) AS distance_m
FROM hospitals h
WHERE
    ST_DWithin(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
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

_MATCH_SQL_CITY_WIDE = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    ST_Y(h.geom::geometry) AS lat,
    ST_X(h.geom::geometry) AS lng,
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
# Helper: execute one radius attempt
# ---------------------------------------------------------------------------

async def _query_at_radius(
    pool,
    lng: float,
    lat: float,
    resource_types: list[str],
    radius_km: int | None,
) -> list[dict[str, Any]]:
    num_types = len(resource_types)

    async with pool.acquire() as conn:
        if radius_km is None:
            rows = await conn.fetch(
                _MATCH_SQL_CITY_WIDE, lng, lat, resource_types, num_types
            )
        else:
            rows = await conn.fetch(
                _MATCH_SQL_WITH_RADIUS,
                lng, lat,
                float(radius_km * 1000),  # metres
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
        "Radius-expanding spatial search with AND-logic resource filtering. "
        "Candidates are re-ranked by Mapbox driving-traffic ETA. "
        "One query_log row is written per call, including zero-match cases."
    ),
)
async def match(body: MatchRequest, request: Request):
    t_request_start = time.perf_counter()
    pool = get_pool()

    # ------------------------------------------------------------------
    # Steps 1–3: spatial + inventory query, radius expansion
    # ------------------------------------------------------------------
    t_db_start = time.perf_counter()

    candidates: list[dict[str, Any]] = []
    matched_radius: int | None = -1   # sentinel; -1 = not yet set

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
            logger.exception("DB error at radius=%s", label)
            raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc

        if candidates:
            matched_radius = radius_km   # None is valid (city-wide)
            break

    db_query_time_ms = round((time.perf_counter() - t_db_start) * 1000)

    # ------------------------------------------------------------------
    # Step 6 (partial): baseline hospital — runs concurrently with Mapbox
    # ------------------------------------------------------------------
    # We always compute this, even on zero-match, so every log row has it.
    baseline_task = asyncio.create_task(
        query_logger.get_baseline_hospital_id(pool, body.lng, body.lat)
    )

    # ------------------------------------------------------------------
    # Steps 4–5: Mapbox ETA fetch + re-rank (only when candidates exist)
    # ------------------------------------------------------------------
    mapbox_time_ms = 0

    if candidates:
        ranked, mapbox_time_ms = await mapbox_client.rank_by_eta(
            candidates, body.lng, body.lat
        )
        best = ranked[0]
    else:
        best = None

    # ------------------------------------------------------------------
    # Step 6 (complete): await baseline + write query_log
    # ------------------------------------------------------------------
    baseline_hospital_id = await baseline_task

    response_time_ms = round((time.perf_counter() - t_request_start) * 1000)

    log_id = await query_logger.write_query_log(
        pool,
        lng=body.lng,
        lat=body.lat,
        resource_types=body.resource_types,
        matched_hospital_id=best["id"] if best else None,
        baseline_hospital_id=baseline_hospital_id,
        search_radius_used_km=matched_radius if matched_radius != -1 else None,
        db_query_time_ms=db_query_time_ms,
        routing_api_time_ms=mapbox_time_ms,
        response_time_ms=response_time_ms,
    )

    # ------------------------------------------------------------------
    # Build response
    # ------------------------------------------------------------------
    if best is None:
        logger.info(
            "match: no qualifying hospital | log_id=%s baseline=%s",
            log_id, baseline_hospital_id,
        )
        return NoMatchResponse(query_log_id=log_id)

    distance_km = round(best["distance_m"] / 1000.0, 3)

    logger.info(
        "match: winner=%s eta=%ss dist=%.3fkm radius=%s | log_id=%s",
        best["name"],
        best.get("eta_seconds"),
        distance_km,
        matched_radius,
        log_id,
    )

    return MatchResponse(
        hospital=HospitalResult(
            id=best["id"],
            name=best["name"],
            address=best.get("address"),
            phone=best.get("phone"),
        ),
        eta_seconds=best.get("eta_seconds"),
        distance_km=distance_km,
        route_geometry=best.get("route_geometry"),
        search_radius_used_km=matched_radius,   # None = city-wide
        query_log_id=log_id,
    )
