"""
Crisis Care V2 — POST /route-incident  (PRD §§7–9)

Full request flow:

  1. Validate triage_category → look up required resources (PRD §6, triage.py).
  2. Hard-feasibility filter (PRD §7 Step 1):
       - Use resource_effective_availability view (quantity_available minus
         active non-expired reservations).
       - Exclude any hospital where any required resource has
         effective_available ≤ 0 OR last_updated_at is stale.
       - AND logic: hospital must satisfy ALL required resources.
  3. ORS ETA for every feasible candidate (concurrent, PRD §§7–8).
  4. Tier A filter: keep only hospitals with ETA ≤ 45 min (PRD §8).
  5. Cost ranking (PRD §7 Step 2):
       Cost(h) = α · ETA_min + β · QueueDelay(h)
       QueueDelay(h) = (1 − min_capacity_ratio) · FIXED_PENALTY_MINUTES
  6. Winner = lowest Cost(h).
  7. Tier B fallback (PRD §8): if no feasible hospital within 45 min,
       route to nearest hospital regardless of resources;
       secondary_transfer_flag = True on the incident row.
  8. Create/update incident row; create pending reservations for winner
     inside a SELECT...FOR UPDATE transaction to prevent double-booking.
  9. Write query_log row (FR-5 compliance).
 10. Return ranked list + selected hospital + incident metadata.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

import ors
import query_logger
import triage as triage_module
from database import get_pool
from triage import (
    ALPHA,
    BETA,
    DRIVE_TIME_THRESHOLD_MINUTES,
    FIXED_PENALTY_MINUTES,
    cost,
    get_required_resources,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Maximum feasible candidates to call ORS for.
# Keeps ORS usage within free-tier budget (40 req/min).
# ---------------------------------------------------------------------------
MAX_ETA_CANDIDATES = 12


# ---------------------------------------------------------------------------
# SQL: feasible hospital query
#
# Uses resource_effective_availability view (created in migration 002).
# Parameters:
#   $1 lng (float)
#   $2 lat (float)
#   $3 resource_types (resource_type_enum[])
#   $4 num_resource_types (int)
#
# Returns one row per qualifying hospital with:
#   id, name, address, phone, tier, lat, lng, distance_m, min_capacity_ratio
#
# Hard filter: effective_available > 0 AND not stale, for EVERY required type.
# AND logic enforced by HAVING COUNT(DISTINCT resource_type) = num_types.
# ---------------------------------------------------------------------------

_FEASIBLE_SQL = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    h.tier,
    ST_Y(h.geom::geometry)                                             AS lat,
    ST_X(h.geom::geometry)                                             AS lng,
    ST_Distance(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    )                                                                  AS distance_m,
    MIN(
        CASE
            WHEN rea.quantity_available = 0 THEN 0.0
            ELSE GREATEST(
                0.0,
                rea.effective_available::float / rea.quantity_available
            )
        END
    )                                                                  AS min_capacity_ratio
FROM hospitals h
JOIN resource_effective_availability rea ON rea.hospital_id = h.id
WHERE
    rea.resource_type = ANY($3::resource_type_enum[])
    AND rea.effective_available > 0
    AND rea.last_updated_at >
        now() - (rea.staleness_threshold_minutes || ' minutes')::interval
    AND ($6::int[] IS NULL OR h.id != ALL($6::int[]))  -- exclude rejected hospitals
GROUP BY h.id, h.name, h.address, h.phone, h.tier, h.geom
HAVING COUNT(DISTINCT rea.resource_type) = $4
ORDER BY distance_m ASC
LIMIT $5;
"""

# Nearest hospital by KNN — no resource filter (Tier B fallback + baseline).
_NEAREST_SQL = """
SELECT
    h.id,
    h.name,
    h.address,
    h.phone,
    h.tier,
    ST_Y(h.geom::geometry) AS lat,
    ST_X(h.geom::geometry) AS lng,
    ST_Distance(
        h.geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    )                      AS distance_m
FROM hospitals h
ORDER BY h.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
LIMIT 1;
"""

# Create an incident row.
_INSERT_INCIDENT_SQL = """
INSERT INTO incidents (
    triage_category, scene_lat, scene_lng, scene_location, status
) VALUES (
    $1::triage_category,
    $2, $3,
    ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
    'routing'
)
RETURNING id;
"""

# Update incident after routing decision is made.
_UPDATE_INCIDENT_SQL = """
UPDATE incidents
SET
    status                  = $2::incident_status,
    routed_hospital_id      = $3,
    secondary_transfer_flag = $4
WHERE id = $1;
"""

# Create a pending reservation for one resource at the winning hospital.
# expires_at is set explicitly (= now() + 15 min) so we can log it and
# the availability view's  `AND expires_at > now()`  predicate naturally
# expires the row — no background cron sweep is needed (PRD §9).
_INSERT_RESERVATION_SQL = """
INSERT INTO reservations (
    incident_id, hospital_id, resource_type, quantity, status, expires_at
) VALUES (
    $1, $2, $3::resource_type_enum, 1, 'pending',
    now() + INTERVAL '15 minutes'
)
RETURNING id, expires_at;
"""

# Atomically re-validate winner feasibility inside a transaction.
# SELECT...FOR UPDATE locks the resource rows so a concurrent commit
# cannot double-book the same slot before we insert our reservations.
# Returns one row per resource type that is still fresh AND available.
_RECHECK_SQL = """
SELECT
    r.resource_type,
    GREATEST(0,
        r.quantity_available - COALESCE(rsv.reserved_qty, 0)
    ) AS effective_available
FROM resources r
LEFT JOIN (
    SELECT resource_type, SUM(quantity) AS reserved_qty
    FROM   reservations
    WHERE  hospital_id = $1
      AND  resource_type = ANY($2::resource_type_enum[])
      AND  status IN ('pending', 'confirmed')
      AND  expires_at > now()
    GROUP BY resource_type
) rsv ON rsv.resource_type = r.resource_type
WHERE r.hospital_id = $1
  AND r.resource_type = ANY($2::resource_type_enum[])
  AND r.last_updated_at > now() - (r.staleness_threshold_minutes || ' minutes')::interval
FOR UPDATE OF r;
"""


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RouteIncidentRequest(BaseModel):
    triage_category: str = Field(
        ...,
        description=(
            "One of: high_velocity_polytrauma, acute_coronary_syndrome_stemi, "
            "acute_ischemic_stroke, severe_respiratory_distress"
        ),
    )
    scene_lat: float = Field(..., ge=-90.0,  le=90.0,  description="Patient scene latitude")
    scene_lng: float = Field(..., ge=-180.0, le=180.0, description="Patient scene longitude")

    # Re-routing fields (PRD §10): used by dispatch loop on reject/timeout.
    # incident_id: continue an existing incident row instead of creating a new one.
    # exclude_hospital_ids: skip hospitals that already rejected this incident.
    incident_id: int | None = Field(
        None,
        description="Existing incident id to continue (re-route pass). Omit to create new.",
    )
    exclude_hospital_ids: list[int] = Field(
        default_factory=list,
        description="Hospital ids already rejected for this incident — excluded from feasibility.",
    )

    # Preview flag (PRD §DISPATCH-FIX):
    #   True  → read-only ranking; NO reservations created, NO incident row written.
    #           Used by the triage console preview before the dispatcher commits.
    #           Safe to call repeatedly — no state changes.
    #   False → full commit: creates incident row + pending reservations for the winner
    #           inside a SELECT...FOR UPDATE transaction (atomically re-validates feasibility).
    #           Returns HTTP 409 if winner no longer available (concurrent booking race).
    #           Used by the gateway dispatch loop (POST /dispatch-incident).
    preview: bool = Field(
        default=False,
        description=(
            "If true, return the ranked result WITHOUT creating reservations or "
            "advancing the incident status. Safe to call repeatedly."
        ),
    )

    @field_validator("triage_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in triage_module.ALL_TRIAGE_CATEGORIES:
            raise ValueError(
                f"Unknown triage_category '{v}'. "
                f"Valid values: {triage_module.ALL_TRIAGE_CATEGORIES}"
            )
        return v


class RankedHospital(BaseModel):
    """One entry in the ranked candidate list."""
    rank: int
    id: int
    name: str
    address: str | None = None
    phone: str | None = None
    tier: int
    lat: float
    lng: float
    distance_km: float
    eta_minutes: float | None = None
    min_capacity_ratio: float
    queue_delay_minutes: float
    cost: float | None = None
    is_feasible: bool
    """True = passed resource filter; False = Tier B fallback only."""


class RouteIncidentResponse(BaseModel):
    incident_id: int
    triage_category: str
    required_resources: list[str]
    secondary_transfer_flag: bool
    selected: RankedHospital
    ranked_candidates: list[RankedHospital]
    routing_mode: str        # 'resource_aware' | 'tier_b_fallback'
    routing_api_time_ms: int
    db_query_time_ms: int
    response_time_ms: int
    cost_weights: dict[str, float]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_ranked(
    row: dict,
    rank: int,
    eta_min: float | None,
    is_feasible: bool,
) -> RankedHospital:
    cap_ratio = float(row.get("min_capacity_ratio") or 0.0)
    q_delay   = (1.0 - cap_ratio) * FIXED_PENALTY_MINUTES
    c = cost(eta_min, cap_ratio) if eta_min is not None else None
    return RankedHospital(
        rank=rank,
        id=row["id"],
        name=row["name"],
        address=row.get("address"),
        phone=row.get("phone"),
        tier=row["tier"],
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        distance_km=round(float(row["distance_m"]) / 1000.0, 3),
        eta_minutes=round(eta_min, 2) if eta_min is not None else None,
        min_capacity_ratio=round(cap_ratio, 4),
        queue_delay_minutes=round(q_delay, 2),
        cost=round(c, 3) if c is not None else None,
        is_feasible=is_feasible,
    )


# ---------------------------------------------------------------------------
# POST /route-incident
# ---------------------------------------------------------------------------

@router.post(
    "/route-incident",
    summary="Route a triage incident to the optimal hospital (PRD §§7–9)",
    description=(
        "Full V2 routing: triage→resources lookup, hard feasibility filter "
        "(resource_effective_availability), ORS ETAs, cost ranking, "
        "45-min Tier-A/B escalation, incident + reservation creation."
    ),
)
async def route_incident(body: RouteIncidentRequest, request: Request):
    t_start = time.perf_counter()
    pool = get_pool()

    # ── 1. Triage → required resources ────────────────────────────────────────
    required = get_required_resources(body.triage_category)
    num_req  = len(required)
    logger.info(
        "route_incident: category=%s scene=(%.5f,%.5f) resources=%s preview=%s",
        body.triage_category, body.scene_lat, body.scene_lng, required, body.preview,
    )

    # ── 2. Create or reuse incident row ───────────────────────────────────────
    # preview=True: skip incident creation entirely — read-only ranking.
    # On re-route passes (dispatch loop), body.incident_id is already set —
    # skip INSERT and reuse the same incident row.
    if body.preview:
        incident_id: int = body.incident_id or -1   # sentinel; never written to DB
        logger.info("route_incident: preview=True — skipping incident create/update")
    elif body.incident_id is not None:
        incident_id = body.incident_id
        logger.info("route_incident: re-routing on existing incident id=%s", incident_id)
    else:
        async with pool.acquire() as conn:
            incident_row = await conn.fetchrow(
                _INSERT_INCIDENT_SQL,
                body.triage_category,
                body.scene_lat,
                body.scene_lng,
                body.scene_lng,   # MakePoint(lng, lat)
                body.scene_lat,
            )
        incident_id = incident_row["id"]
        logger.info("route_incident: created incident id=%s", incident_id)

    # ── 3. DB feasibility query ────────────────────────────────────────────────
    t_db = time.perf_counter()

    async with pool.acquire() as conn:
        feasible_rows = await conn.fetch(
            _FEASIBLE_SQL,
            body.scene_lng,
            body.scene_lat,
            required,
            num_req,
            MAX_ETA_CANDIDATES,
            body.exclude_hospital_ids or None,  # None → $6 IS NULL → no exclusions
        )
        nearest_row = await conn.fetchrow(
            _NEAREST_SQL, body.scene_lng, body.scene_lat
        )

    db_query_time_ms = round((time.perf_counter() - t_db) * 1000)
    feasible = [dict(r) for r in feasible_rows]
    logger.info(
        "route_incident: %d feasible hospitals found | db=%dms",
        len(feasible), db_query_time_ms,
    )

    # baseline_hospital_id: nearest by distance, no resource filter (FR-5)
    baseline_id: int | None = nearest_row["id"] if nearest_row else None

    # ── 4. ORS ETAs for feasible set ──────────────────────────────────────────
    t_ors = time.perf_counter()

    async with pool.acquire() as _:   # keep pool warm; ORS is external
        pass

    ors_results: list[float | None] = []
    if feasible:
        async with asyncio.TaskGroup() as tg:
            tasks = [
                tg.create_task(
                    ors.get_eta(
                        body.scene_lat, body.scene_lng,
                        float(h["lat"]), float(h["lng"]),
                    )
                )
                for h in feasible
            ]
        ors_results = [t.result() for t in tasks]
    else:
        ors_results = []

    routing_api_time_ms = round((time.perf_counter() - t_ors) * 1000)

    # ── 5. Tier A filter + cost ranking ───────────────────────────────────────
    # Attach ETAs; filter to ≤ DRIVE_TIME_THRESHOLD_MINUTES
    tier_a: list[tuple[dict, float]] = []   # (row, eta_min)
    for row, eta_min in zip(feasible, ors_results):
        if eta_min is not None and eta_min <= DRIVE_TIME_THRESHOLD_MINUTES:
            tier_a.append((row, eta_min))

    logger.info(
        "route_incident: %d/%d feasible hospitals within %.0f min drive",
        len(tier_a), len(feasible), DRIVE_TIME_THRESHOLD_MINUTES,
    )

    # Sort by Cost(h)
    tier_a.sort(key=lambda t: cost(t[1], float(t[0].get("min_capacity_ratio") or 0.0)))

    # ── 6. Build ranked candidates list ───────────────────────────────────────
    ranked_candidates: list[RankedHospital] = []
    for i, (row, eta_min) in enumerate(tier_a):
        ranked_candidates.append(_build_ranked(row, rank=i + 1, eta_min=eta_min, is_feasible=True))

    # ── 7. Tier B fallback ────────────────────────────────────────────────────
    secondary_transfer_flag = False
    routing_mode = "resource_aware"

    if tier_a:
        # Winner: lowest cost feasible hospital
        winner_row, winner_eta = tier_a[0]
        winner_rh = ranked_candidates[0]
    else:
        # No feasible hospital in Tier A → nearest hospital regardless of stock
        secondary_transfer_flag = True
        routing_mode = "tier_b_fallback"
        logger.warning(
            "route_incident: no Tier-A hospital found — escalating to Tier B "
            "(nearest, secondary_transfer_flag=True)"
        )
        if nearest_row is None:
            raise HTTPException(status_code=503, detail="No hospitals in database.")

        nearest_dict = dict(nearest_row)
        # Get ORS ETA for the nearest hospital (may already have it if it was in feasible)
        nearest_eta = await ors.get_eta(
            body.scene_lat, body.scene_lng,
            float(nearest_dict["lat"]), float(nearest_dict["lng"]),
        )
        # Add a synthetic capacity_ratio of 0 — we're going here because it's nearest,
        # not because it's well-stocked.
        nearest_dict.setdefault("min_capacity_ratio", 0.0)

        winner_rh = _build_ranked(nearest_dict, rank=1, eta_min=nearest_eta, is_feasible=False)
        winner_row = nearest_dict
        winner_eta = nearest_eta

        # Prepend fallback to candidate list
        ranked_candidates.insert(0, winner_rh)

    # ── 8. Create pending reservations for the winner ─────────────────────────
    # SKIPPED when preview=True — ranking is read-only; no DB side-effects.
    #
    # When preview=False (commit path): wrap reservation inserts in a transaction
    # with SELECT...FOR UPDATE on the winning hospital's resource rows.
    # This atomically re-validates feasibility; if any resource is now exhausted
    # (concurrent booking race), the transaction aborts and we return HTTP 409
    # with the fresh ranked list so the caller can switch to the next candidate.
    reservation_ids: list[int] = []
    if not body.preview and routing_mode != "tier_b_fallback":
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    # Re-validate availability under lock (prevents double-booking)
                    recheck_rows = await conn.fetch(
                        _RECHECK_SQL,
                        winner_row["id"],
                        required,
                    )
                    # Build resource_type → effective_available map
                    avail_map = {r["resource_type"]: r["effective_available"] for r in recheck_rows}
                    missing = [rt for rt in required if avail_map.get(rt, 0) <= 0]
                    stale_types = [rt for rt in required if rt not in avail_map]
                    all_missing = missing + stale_types

                    if all_missing:
                        # Raise outside the transaction context so it rolls back cleanly
                        logger.warning(
                            "route_incident: 409 — winner hospital_id=%s no longer has %s",
                            winner_row["id"], all_missing,
                        )
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "error": "Selected hospital no longer available",
                                "hospital_id": winner_row["id"],
                                "hospital_name": winner_row["name"],
                                "missing_resources": all_missing,
                                "ranked_candidates": [r.model_dump() for r in ranked_candidates],
                                "incident_id": incident_id if incident_id > 0 else None,
                            },
                        )

                    # Feasibility confirmed — insert reservations atomically
                    for resource_type in required:
                        row = await conn.fetchrow(
                            _INSERT_RESERVATION_SQL,
                            incident_id,
                            winner_row["id"],
                            resource_type,
                        )
                        if row:
                            reservation_ids.append(row["id"])

            logger.info(
                "route_incident: created %d pending reservations (ids=%s) "
                "for hospital id=%s incident=%s — lease expires in 15 min",
                len(required), reservation_ids, winner_row["id"], incident_id,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("route_incident: reservation insert failed: %s", exc)
            # Non-fatal — continue; admin can ACK without a reservation row
    elif not body.preview and routing_mode == "tier_b_fallback":
        # Tier B: no resource reservation (nearest stabilization only)
        logger.info(
            "route_incident: tier_b_fallback — no reservations for hospital id=%s",
            winner_row["id"],
        )
    else:
        logger.info(
            "route_incident: preview=True — skipping reservations for hospital id=%s",
            winner_row.get("id"),
        )

    # ── 9. Update incident record ──────────────────────────────────────────────
    # SKIPPED when preview=True — incident stays untouched.
    if not body.preview:
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    _UPDATE_INCIDENT_SQL,
                    incident_id,
                    "routed",
                    winner_row["id"],
                    secondary_transfer_flag,
                )
        except Exception as exc:
            logger.error("route_incident: incident update failed: %s", exc)

    # ── 10. Write query_log row ────────────────────────────────────────────────
    # Only write query_log on full commits (preview=False) to avoid flooding logs.
    response_time_ms = round((time.perf_counter() - t_start) * 1000)

    if not body.preview:
        await query_logger.write_query_log(
            pool,
            lng=body.scene_lng,
            lat=body.scene_lat,
            resource_types=required,
            matched_hospital_id=winner_row["id"],
            baseline_hospital_id=baseline_id,
            search_radius_used_km=None,          # V2 uses drive-time, not km radius
            db_query_time_ms=db_query_time_ms,
            routing_api_time_ms=routing_api_time_ms,
            response_time_ms=response_time_ms,
        )

    logger.info(
        "route_incident: selected=%s eta=%.1f min cost=%.2f "
        "secondary_transfer=%s | total=%dms",
        winner_row["name"],
        winner_eta or -1,
        winner_rh.cost or -1,
        secondary_transfer_flag,
        response_time_ms,
    )

    # ── 11. Build response ─────────────────────────────────────────────────────
    return RouteIncidentResponse(
        incident_id=incident_id,
        triage_category=body.triage_category,
        required_resources=required,
        secondary_transfer_flag=secondary_transfer_flag,
        selected=winner_rh,
        ranked_candidates=ranked_candidates,
        routing_mode=routing_mode,
        routing_api_time_ms=routing_api_time_ms,
        db_query_time_ms=db_query_time_ms,
        response_time_ms=response_time_ms,
        cost_weights={"alpha": ALPHA, "beta": BETA,
                      "fixed_penalty_minutes": FIXED_PENALTY_MINUTES,
                      "drive_time_threshold_minutes": DRIVE_TIME_THRESHOLD_MINUTES},
    )
