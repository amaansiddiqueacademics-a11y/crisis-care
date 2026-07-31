"""
Crisis Care — query_log writer + baseline hospital lookup.

Implements FR-2 step 6 / FR-5 from docs/PRD.md:

  baseline_hospital_id:
    Plain nearest-distance query with NO resource filter — returns the
    closest hospital by straight-line distance regardless of availability.
    Computed in the same request as /match so every production query is
    also an evaluation data point for Section 12.A, with no separate
    baseline pass needed later.

  query_log INSERT:
    One row per /match call, including zero-match cases.
    All timing columns (db_query_time_ms, mapbox_time_ms, response_time_ms)
    are measured wall-clock values passed in by the caller — not estimates.

This module is intentionally side-effect free except for the DB write.
It never raises to the caller; any failure is logged and swallowed so
that a logging bug never breaks the patient-facing response.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Baseline query (nearest hospital, no resource filter)
# ---------------------------------------------------------------------------

_BASELINE_SQL = """
SELECT h.id
FROM hospitals h
ORDER BY h.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
LIMIT 1;
"""

# ---------------------------------------------------------------------------
# query_log INSERT
# ---------------------------------------------------------------------------

_INSERT_LOG_SQL = """
INSERT INTO query_log (
    patient_location,
    requested_resources,
    matched_hospital_id,
    baseline_hospital_id,
    search_radius_used_km,
    db_query_time_ms,
    mapbox_time_ms,
    response_time_ms
) VALUES (
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,  -- patient_location (lng, lat)
    $3::resource_type_enum[],                            -- requested_resources
    $4,                                                  -- matched_hospital_id (NULL on no-match)
    $5,                                                  -- baseline_hospital_id
    $6,                                                  -- search_radius_used_km (NULL = city-wide)
    $7,                                                  -- db_query_time_ms
    $8,                                                  -- mapbox_time_ms
    $9                                                   -- response_time_ms
)
RETURNING id;
"""


async def get_baseline_hospital_id(pool, lng: float, lat: float) -> int | None:
    """
    Return the id of the geographically nearest hospital with no resource filter.

    Uses the KNN operator (<->) against the GiST index for O(log n) lookup
    rather than a full ST_Distance scan.
    """
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(_BASELINE_SQL, lng, lat)
        return row["id"] if row else None
    except Exception as exc:
        logger.warning("baseline query failed: %s", exc)
        return None


async def write_query_log(
    pool,
    *,
    lng: float,
    lat: float,
    resource_types: list[str],
    matched_hospital_id: int | None,
    baseline_hospital_id: int | None,
    search_radius_used_km: int | None,
    db_query_time_ms: int,
    mapbox_time_ms: int,
    response_time_ms: int,
) -> int | None:
    """
    Insert one row into query_log and return its id.

    Returns None if the insert fails (logged but never raised — a logging
    failure must never break the patient-facing response).

    search_radius_used_km is None for city-wide searches; Postgres accepts
    None as NULL for the NUMERIC column.
    """
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                _INSERT_LOG_SQL,
                lng,
                lat,
                resource_types,           # asyncpg casts list[str] → resource_type_enum[]
                matched_hospital_id,      # None → NULL
                baseline_hospital_id,     # None → NULL
                search_radius_used_km,    # None → NULL
                db_query_time_ms,
                mapbox_time_ms,
                response_time_ms,
            )
        log_id = row["id"] if row else None
        logger.info(
            "query_log id=%s matched=%s baseline=%s radius=%s km "
            "db=%dms mapbox=%dms total=%dms",
            log_id,
            matched_hospital_id,
            baseline_hospital_id,
            search_radius_used_km,
            db_query_time_ms,
            mapbox_time_ms,
            response_time_ms,
        )
        return log_id
    except Exception as exc:
        logger.error("Failed to write query_log: %s", exc)
        return None
