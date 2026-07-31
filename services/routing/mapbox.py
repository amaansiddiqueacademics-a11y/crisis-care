"""
Crisis Care — Mapbox Directions API client.

Called by the /match router for FR-2 step 4–5:
  - Sends one request per top-3 candidate to the Mapbox Directions API
    (profile: driving-traffic for live ETA).
  - Returns (eta_seconds, route_geometry_polyline6) for each candidate.
  - Elapsed wall-clock time of the entire batch is returned so the caller
    can write mapbox_time_ms to query_log.

Reference:
  https://docs.mapbox.com/api/navigation/directions/
  Endpoint: GET /directions/v5/mapbox/driving-traffic/{coords}

Notes:
  - We use the public token (pk.*) which supports the Directions API.
  - route_geometry is returned as encoded polyline (precision 6) — this is
    what react-map-gl / Mapbox GL JS can consume directly.
  - On any per-candidate failure (network, rate limit, bad coords) we fall
    back to eta_seconds = None and geometry = None for that candidate only.
    The match result is still returned; the frontend can handle None geometry.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MAPBOX_API_KEY: str = os.getenv("MAPBOX_API_KEY", "")
_DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic"

# Per-request timeout for a single Mapbox call (seconds)
_MAPBOX_TIMEOUT_S = 5.0


def _directions_url(
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
) -> str:
    """Build the Mapbox Directions API URL for one origin→destination pair."""
    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    return (
        f"{_DIRECTIONS_BASE}/{coords}"
        f"?access_token={MAPBOX_API_KEY}"
        f"&geometries=polyline6"
        f"&overview=full"
        f"&steps=false"
    )


async def fetch_eta(
    client: httpx.AsyncClient,
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
) -> tuple[int | None, str | None]:
    """
    Fetch driving-traffic ETA and route geometry for one origin→destination pair.

    Returns:
        (eta_seconds, geometry_polyline6)
        Both are None if the Mapbox call fails.
    """
    if not MAPBOX_API_KEY:
        logger.warning("MAPBOX_API_KEY not set — skipping ETA fetch")
        return None, None

    url = _directions_url(origin_lng, origin_lat, dest_lng, dest_lat)

    try:
        resp = await client.get(url, timeout=_MAPBOX_TIMEOUT_S)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

        routes = data.get("routes")
        if not routes:
            logger.warning("Mapbox returned no routes for %s,%s", dest_lng, dest_lat)
            return None, None

        route = routes[0]
        eta_seconds: int = round(route["duration"])          # seconds (float → int)
        geometry: str | None = route.get("geometry")        # encoded polyline6 string

        return eta_seconds, geometry

    except httpx.TimeoutException:
        logger.warning(
            "Mapbox timeout for dest=(%s, %s)", dest_lng, dest_lat
        )
        return None, None
    except Exception as exc:
        logger.warning(
            "Mapbox error for dest=(%s, %s): %s", dest_lng, dest_lat, exc
        )
        return None, None


async def rank_by_eta(
    candidates: list[dict],
    patient_lng: float,
    patient_lat: float,
) -> tuple[list[dict], int]:
    """
    Call Mapbox for each candidate concurrently, attach eta_seconds and
    route_geometry, then return the list sorted by ETA ascending.

    Also returns mapbox_elapsed_ms — wall-clock time for the entire batch.

    Candidates whose Mapbox call fails retain eta_seconds=None and are
    sorted after all candidates with a real ETA (distance as tiebreaker).
    """
    t0 = time.perf_counter()

    async with httpx.AsyncClient() as client:
        import asyncio
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

    mapbox_elapsed_ms = round((time.perf_counter() - t0) * 1000)

    # Attach results to candidates
    for c, (eta_s, geometry) in zip(candidates, results):
        c["eta_seconds"] = eta_s
        c["route_geometry"] = geometry

    # Sort: candidates with real ETA first (by ETA), then None (by distance)
    candidates.sort(
        key=lambda c: (
            c["eta_seconds"] is None,  # False < True → real ETAs first
            c["eta_seconds"] if c["eta_seconds"] is not None else float("inf"),
            c["distance_m"],
        )
    )

    return candidates, mapbox_elapsed_ms
