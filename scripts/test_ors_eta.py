#!/usr/bin/env python3
"""
Crisis Care V2 — ORS ETA sanity-check test.

Calls get_eta() for 3 real hospital pairs across Maharashtra and prints
drive-time in minutes. Compare against the expected ranges to verify the
ORS key works and coverage is correct for our four target regions.

Expected drive times (realistic; will vary by ORS traffic model):
  Pair 1  KEM Mumbai   -> Lilavati Mumbai     ~18-35 min   (S. Mumbai to Bandra, ~8 km)
  Pair 2  KEM Pune     -> Ruby Hall Pune      ~12-25 min   (within Pune city, ~7 km)
  Pair 3  KEM Mumbai   -> Ruby Hall Pune      ~120-200 min (Expressway ~150 km)

Usage (from project root):
  ORS_API_KEY is auto-loaded from .env via python-dotenv inside ors.py.
  Just run:
    py scripts/test_ors_eta.py
"""

import asyncio
import os
import re
import sys
import time

# Allow running from project root without installing the service package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "routing"))

import ors   # noqa: E402  (path insertion must come first)

# ---------------------------------------------------------------------------
# Test pairs — coordinates verified against Google Maps / OSM
# ---------------------------------------------------------------------------

PAIRS = [
    {
        "label":       "Within Mumbai  — KEM Hospital -> Lilavati Hospital",
        "description": "South Mumbai (Parel) to Bandra West, ~8 km along Mahim Causeway",
        "expected_lo": 18,
        "expected_hi": 35,
        "origin":      (18.9744, 72.8347),   # KEM Mumbai (Parel)
        "dest":        (19.0514, 72.8269),   # Lilavati (Bandra West)
    },
    {
        "label":       "Within Pune    — KEM Pune -> Ruby Hall Clinic",
        "description": "Rasta Peth to Camp area, ~6 km city roads",
        "expected_lo": 12,
        "expected_hi": 25,
        "origin":      (18.5067, 73.8647),   # KEM Hospital Pune (Rasta Peth)
        "dest":        (18.5236, 73.8798),   # Ruby Hall Clinic (Camp)
    },
    {
        "label":       "Mumbai -> Pune  — KEM Mumbai -> Ruby Hall Pune",
        "description": "Mumbai-Pune Expressway + city approach, ~150 km",
        "expected_lo": 120,
        "expected_hi": 200,
        "origin":      (18.9744, 72.8347),   # KEM Mumbai
        "dest":        (18.5236, 73.8798),   # Ruby Hall Pune
    },
]

# ---------------------------------------------------------------------------
# ANSI colour helpers
# ---------------------------------------------------------------------------

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def colour_result(eta_min: float, lo: float, hi: float) -> str:
    """Return a coloured result string based on plausibility bounds."""
    if lo * 0.7 <= eta_min <= hi * 1.5:
        return f"{GREEN}{eta_min:.1f} min{RESET} -- within expected range ({lo}-{hi} min) OK"
    elif eta_min < lo * 0.5:
        return f"{YELLOW}{eta_min:.1f} min{RESET} -- suspiciously fast (expected {lo}-{hi} min)"
    else:
        return f"{RED}{eta_min:.1f} min{RESET} -- outside expected range ({lo}-{hi} min)"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run_tests() -> None:
    print(f"\n{BOLD}ORS ETA Sanity Check — Crisis Care V2{RESET}")
    print("=" * 62)

    key_preview = ors.ORS_API_KEY[:12] + "..." if ors.ORS_API_KEY else "(not set)"
    print(f"  ORS_API_KEY : {key_preview}")
    print(f"  Endpoint    : {ors._ORS_BASE}\n")

    if not ors.ORS_API_KEY:
        print(f"{RED}ERROR: ORS_API_KEY not set. Check .env{RESET}")
        sys.exit(1)

    all_ok = True

    for i, pair in enumerate(PAIRS, 1):
        origin_lat, origin_lng = pair["origin"]
        dest_lat,   dest_lng   = pair["dest"]

        print(f"  {BOLD}[{i}] {pair['label']}{RESET}")
        print(f"      {pair['description']}")
        print(f"      Origin   : {origin_lat}, {origin_lng}")
        print(f"      Dest     : {dest_lat}, {dest_lng}")
        print(f"      Expected : {pair['expected_lo']} - {pair['expected_hi']} min")

        t0 = time.perf_counter()
        eta_min = await ors.get_eta(origin_lat, origin_lng, dest_lat, dest_lng)
        elapsed_ms = round((time.perf_counter() - t0) * 1000)

        if eta_min is None:
            print(f"      Result   : {RED}FAILED — ORS returned None{RESET}")
            all_ok = False
        else:
            result_str = colour_result(eta_min, pair["expected_lo"], pair["expected_hi"])
            print(f"      Result   : {result_str}  [{elapsed_ms} ms]")

        print()

    print("=" * 62)
    if all_ok:
        print(f"  {GREEN}{BOLD}All 3 pairs returned results.{RESET}")
    else:
        print(f"  {RED}{BOLD}Some pairs failed — check key and connectivity.{RESET}")
    print()


if __name__ == "__main__":
    asyncio.run(run_tests())
