"""
Crisis Care — /hospitals-summary endpoint  (PRD §13 Live Status)

Returns a lightweight JSON list of all hospitals with:
  • Basic metadata (id, name, tier, lat, lng)
  • availability_score  — fraction of resource types with effective qty > 0
    (effective qty = quantity_available minus active non-expired reservations)
  • Per-key-resource counts (icu_bed, ventilator, oxygen_cylinder)
  • active_reservations count

This endpoint is unauthenticated by design — it powers the public-facing
live status map.  No PHI or patient-specific data is returned.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

import database

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class HospitalSummary(BaseModel):
    id:                   int
    name:                 str
    tier:                 int
    lat:                  float
    lng:                  float
    availability_score:   float   # 0.0 – 1.0
    icu_beds:             int
    ventilators:          int
    oxygen_cylinders:     int
    active_reservations:  int


class HospitalSummaryResponse(BaseModel):
    hospitals: list[HospitalSummary]
    total:     int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/hospitals-summary",
    response_model=HospitalSummaryResponse,
    summary="Live hospital availability summary (unauthenticated)",
)
async def hospitals_summary() -> HospitalSummaryResponse:
    """
    Returns all hospitals with their current availability scores.

    Availability score = number of resource types whose *effective*
    quantity (qty_available − active pending reservations) is > 0,
    divided by the total number of resource types for that hospital.

    Staleness: resources whose last_updated_at is older than
    staleness_threshold_minutes are treated as unavailable (effective qty = 0).
    """
    pool = database.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            WITH effective AS (
                -- Compute effective quantity per resource row
                -- Reservations join by (hospital_id, resource_type) since there is no resource_id FK
                SELECT
                    r.id,
                    r.hospital_id,
                    r.resource_type::text           AS resource_type,
                    CASE
                        WHEN r.last_updated_at < NOW() - (r.staleness_threshold_minutes || ' minutes')::interval
                        THEN 0
                        ELSE GREATEST(0,
                            r.quantity_available::numeric - COALESCE((
                                SELECT SUM(rv.quantity)
                                FROM   reservations rv
                                WHERE  rv.hospital_id   = r.hospital_id
                                AND    rv.resource_type = r.resource_type
                                AND    rv.status        = 'pending'
                                AND    rv.expires_at    > NOW()
                            ), 0)
                        )
                    END AS effective_qty
                FROM resources r
            ),
            per_hospital AS (
                SELECT
                    hospital_id,
                    COUNT(*)                                                                    AS total_types,
                    COUNT(*) FILTER (WHERE effective_qty > 0)                                  AS available_types,
                    MAX(effective_qty) FILTER (WHERE resource_type = 'icu_bed')::int           AS icu_beds,
                    MAX(effective_qty) FILTER (WHERE resource_type = 'ventilator')::int        AS ventilators,
                    MAX(effective_qty) FILTER (WHERE resource_type = 'oxygen_cylinder')::int   AS oxygen_cylinders
                FROM effective
                GROUP BY hospital_id
            ),
            resv_counts AS (
                SELECT hospital_id, COUNT(*) AS active_reservations
                FROM   reservations
                WHERE  status     = 'pending'
                AND    expires_at > NOW()
                GROUP BY hospital_id
            )
            SELECT
                h.id,
                h.name,
                h.tier,
                ST_Y(h.geom::geometry)                              AS lat,
                ST_X(h.geom::geometry)                              AS lng,
                ROUND(
                    COALESCE(ph.available_types, 0)::numeric /
                    GREATEST(COALESCE(ph.total_types, 1), 1)::numeric,
                    4
                )                                                   AS availability_score,
                COALESCE(ph.icu_beds, 0)                            AS icu_beds,
                COALESCE(ph.ventilators, 0)                         AS ventilators,
                COALESCE(ph.oxygen_cylinders, 0)                    AS oxygen_cylinders,
                COALESCE(rc.active_reservations, 0)::int            AS active_reservations
            FROM hospitals h
            LEFT JOIN per_hospital ph ON ph.hospital_id = h.id
            LEFT JOIN resv_counts  rc ON rc.hospital_id = h.id
            ORDER BY h.tier, h.id
        """)

    hospitals = [
        HospitalSummary(
            id=r["id"],
            name=r["name"],
            tier=r["tier"],
            lat=float(r["lat"]),
            lng=float(r["lng"]),
            availability_score=float(r["availability_score"] or 0.0),
            icu_beds=r["icu_beds"],
            ventilators=r["ventilators"],
            oxygen_cylinders=r["oxygen_cylinders"],
            active_reservations=r["active_reservations"],
        )
        for r in rows
    ]

    return HospitalSummaryResponse(hospitals=hospitals, total=len(hospitals))
