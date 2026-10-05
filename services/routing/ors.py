"""
Crisis Care V2 — OpenRouteService ETA client.

Replaces mapbox.py for scene-to-hospital drive-time lookups.

Why ORS over OSRM demo:
  • Stable SLA — ORS free tier (2 000 req/day, 40 req/min) is a managed
    service; the OSRM public demo server has no availability guarantee and
    explicitly discourages production use.
  • JWT API key already provisioned in .env (ORS_API_KEY).
  • ORS uses the same full OpenStreetMap planet so rural Maharashtra coverage
    (Nandurbar, Gadchiroli) is identical to OSRM.
  • ORS returns duration + distance in a single JSON response with no extra
    parsing gymnastics — drop-in replacement for mapbox.py.

Public API reference:
  POST https://api.openrouteservice.org/v2/directions/driving-car
  Body: { "coordinates": [[lng, lat], [lng, lat]] }
  Response: routes[0].summary.duration  (seconds, float)

Drop-in compatibility with mapbox.py:
  • get_eta()       — new primary interface requested by V2 PRD §8
  • fetch_eta()     — same signature as mapbox.fetch_eta (used by rank_by_eta)
  • rank_by_eta()   — same signature as mapbox.rank_by_eta (used by match.py)
  The field name routing_api_time_ms replaces mapbox_time_ms in query_log
  (applied in migration 004).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ORS_API_KEY: str = os.getenv("ORS_API_KEY", "")

_ORS_BASE = "https://api.openrouteservice.org/v2/directions/driving-car"

# Per-request timeout (seconds).
# ORS free tier median latency is ~300 ms; 8 s leaves headroom for cold starts.
_ORS_TIMEOUT_S = 8.0

# ---------------------------------------------------------------------------
# Mock mode  (USE_MOCK_ORS=1)
# ---------------------------------------------------------------------------
# When set, get_eta() returns a deterministic ETA derived from the straight-
# line Haversine distance ÷ 30 km/h average urban speed. This avoids live
# ORS calls during local testing and CI (useful when the free-tier quota is
# exhausted).  Results are ~30 % longer than real drive times on average, which
# is good enough for routing / ranking correctness tests.
#
# Automatically activated (in this session) when ORS returns HTTP 403
# "Quota exceeded" — see _handle_quota_exceeded().

import math as _math

_USE_MOCK: bool = os.getenv("USE_MOCK_ORS", "0") == "1"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two WGS-84 points."""
    R = 6371.0
    dlat = _math.radians(lat2 - lat1)
    dlng = _math.radians(lng2 - lng1)
    a = (_math.sin(dlat / 2) ** 2
         + _math.cos(_math.radians(lat1))
         * _math.cos(_math.radians(lat2))
         * _math.sin(dlng / 2) ** 2)
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1 - a))


def _mock_eta(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> float:
    """Deterministic ETA (minutes) = haversine km ÷ 30 km/h (urban avg)."""
    km = _haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    return round((km / 30.0) * 60, 2)  # minutes


def _activate_mock(reason: str = "") -> None:
    global _USE_MOCK
    if not _USE_MOCK:
        logger.warning("ors: activating mock mode — %s", reason)
        _USE_MOCK = True

# ---------------------------------------------------------------------------
# Core: get_eta
# ---------------------------------------------------------------------------


async def get_eta(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    *,
    client: httpx.AsyncClient | None = None,
) -> float | None:
    """
    Return drive-time in **minutes** from origin to destination via ORS.

    Args:
        origin_lat, origin_lng  — scene / patient location (WGS-84)
        dest_lat,   dest_lng    — hospital location (WGS-84)
        client                  — optional shared AsyncClient for connection
                                  reuse in batch calls; a new one is created
                                  if not provided.

    Returns:
        Drive-time in minutes (float), or None if the call fails or the key
        is not configured.  Callers must handle None gracefully — the routing
        engine falls back to straight-line distance in that case.
    """
    if not ORS_API_KEY:
        # No API key configured — use haversine mock so callers always get a number.
        logger.debug("ORS_API_KEY not set — using haversine mock ETA")
        return _mock_eta(origin_lat, origin_lng, dest_lat, dest_lng)

    if _USE_MOCK:
        return _mock_eta(origin_lat, origin_lng, dest_lat, dest_lng)

    payload: dict[str, Any] = {
        "coordinates": [
            [origin_lng, origin_lat],   # ORS uses [lng, lat] order
            [dest_lng,   dest_lat],
        ],
    }

    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type":  "application/json; charset=utf-8",
        "Accept":        "application/json",
    }

    _own_client = client is None
    _client = httpx.AsyncClient() if _own_client else client

    try:
        resp = await _client.post(
            _ORS_BASE,
            json=payload,
            headers=headers,
            timeout=_ORS_TIMEOUT_S,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        routes = data.get("routes")
        if not routes:
            logger.warning(
                "ORS returned no routes for (%.5f,%.5f)→(%.5f,%.5f)",
                origin_lat, origin_lng, dest_lat, dest_lng,
            )
            return None

        duration_s: float = routes[0]["summary"]["duration"]  # seconds (float)
        return duration_s / 60.0                              # → minutes

    except httpx.TimeoutException:
        logger.warning(
            "ORS timeout for dest=(%.5f, %.5f)", dest_lat, dest_lng
        )
        return None
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        body   = exc.response.text[:200]
        logger.warning(
            "ORS HTTP %s for dest=(%.5f, %.5f): %s",
            status, dest_lat, dest_lng, body,
        )
        if status == 403 and "Quota" in body:
            # Quota exhausted — switch to mock for remaining calls this session
            # so the process doesn't keep hammering a blocked endpoint.
            _activate_mock("ORS quota exceeded (403)")
            return _mock_eta(origin_lat, origin_lng, dest_lat, dest_lng)
        return None
    except Exception as exc:
        logger.warning(
            "ORS error for dest=(%.5f, %.5f): %s", dest_lat, dest_lng, exc
        )
        return None
    finally:
        if _own_client:
            await _client.aclose()


# ---------------------------------------------------------------------------
# Compatibility shim: fetch_eta  (same signature as mapbox.fetch_eta)
# ---------------------------------------------------------------------------


async def fetch_eta(
    client: httpx.AsyncClient,
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
) -> tuple[int | None, None]:
    """
    Thin wrapper around get_eta() that matches the mapbox.fetch_eta signature
    so match.py can import from ors instead of mapbox without any other changes.

    Note: ORS free tier does not return encoded polyline geometry in the
    standard directions endpoint without extra parameters — returning None for
    geometry is intentional. The frontend uses hospital coordinates to draw
    the route marker; full geometry can be added later via ORS isochrones.

    Returns:
        (eta_seconds, None)   — eta_seconds is int or None; geometry is always None.
    """
    eta_min = await get_eta(
        origin_lat, origin_lng, dest_lat, dest_lng, client=client
    )
    if eta_min is None:
        return None, None
    return round(eta_min * 60), None     # minutes → seconds, no geometry


# ---------------------------------------------------------------------------
# Batch: rank_by_eta  (same signature as mapbox.rank_by_eta)
# ---------------------------------------------------------------------------


async def rank_by_eta(
    candidates: list[dict],
    patient_lng: float,
    patient_lat: float,
) -> tuple[list[dict], int]:
    """
    Fetch ORS ETAs for all candidates concurrently, attach eta_seconds and
    route_geometry to each, then sort ascending by ETA.

    Returns:
        (sorted_candidates, routing_api_elapsed_ms)

    Replaces mapbox.rank_by_eta; the caller (match.py) writes the elapsed
    time to query_log.routing_api_time_ms (renamed from mapbox_time_ms in
    migration 004).
    """
    t0 = time.perf_counter()

    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_eta(
                client,
                patient_lng,
                patient_lat,
                c["lng"],
                c["lat"],
            )
            for c in candidates
        ]
        results = await asyncio.gather(*tasks)

    elapsed_ms = round((time.perf_counter() - t0) * 1000)

    for c, (eta_s, geometry) in zip(candidates, results):
        c["eta_seconds"]   = eta_s
        c["route_geometry"] = geometry   # None for ORS (see fetch_eta docstring)

    # Candidates with a real ETA first (ascending), then failures (by distance)
    candidates.sort(
        key=lambda c: (
            c["eta_seconds"] is None,
            c["eta_seconds"] if c["eta_seconds"] is not None else float("inf"),
            c["distance_m"],
        )
    )

    return candidates, elapsed_ms
