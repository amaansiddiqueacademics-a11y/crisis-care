#!/usr/bin/env python3
"""
Crisis Care V2 — POST /route-incident integration test.

Fires a single synthetic incident against the running FastAPI service
and pretty-prints the full response so you can sanity-check:
  • Which hospital was selected and why
  • The ranked candidate list with ETAs and costs
  • Whether secondary_transfer_flag was triggered
  • Round-trip latency breakdown

Synthetic incident:
  Triage:   high_velocity_polytrauma   (requires ICU, ventilator, trauma surgeon,
                                        blood O-neg, CT scanner)
  Scene:    Near Dharavi, Mumbai        (lat=19.0422, lng=72.8551)
            One of the densest urban areas in the dataset — should find
            multiple Tier-1 hospitals within 45 min.

Usage:
  py scripts/test_route_incident.py [--host http://localhost:8000]
  (FastAPI service must be running: node scripts/dev.js OR uvicorn in services/routing)
"""

import argparse
import json
import sys
import urllib.request
import urllib.error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="http://localhost:8000",
                        help="FastAPI service base URL")
    args = parser.parse_args()

    url = f"{args.host}/route-incident"

    payload = {
        "triage_category": "high_velocity_polytrauma",
        "scene_lat": 19.0422,
        "scene_lng": 72.8551,
    }

    print("\n" + "=" * 68)
    print("  Crisis Care V2 — POST /route-incident Test")
    print("=" * 68)
    print(f"  Endpoint : {url}")
    print(f"  Payload  : {json.dumps(payload, indent=None)}\n")

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"  Connection error: {e.reason}")
        print("  Is the FastAPI service running? (node scripts/dev.js)")
        sys.exit(1)

    # ── Summary ────────────────────────────────────────────────────────────
    s = body["selected"]
    flag = body["secondary_transfer_flag"]
    mode = body["routing_mode"]

    print(f"  Incident ID        : {body['incident_id']}")
    print(f"  Triage             : {body['triage_category']}")
    print(f"  Required resources : {', '.join(body['required_resources'])}")
    print(f"  Routing mode       : {mode}")
    print(f"  Secondary transfer : {'YES ⚠' if flag else 'No'}")
    print()

    print("  ── Selected Hospital ─────────────────────────────────────────")
    print(f"  [{s['rank']}] {s['name']}")
    print(f"      Tier       : {s['tier']}")
    print(f"      Distance   : {s['distance_km']} km")
    print(f"      ETA        : {s['eta_minutes']} min")
    print(f"      Cap. ratio : {s['min_capacity_ratio']:.3f}   "
          f"(queue delay: {s['queue_delay_minutes']:.1f} min)")
    print(f"      Cost       : {s['cost']}   "
          f"(α={body['cost_weights']['alpha']}, β={body['cost_weights']['beta']})")
    print(f"      Feasible   : {'Yes' if s['is_feasible'] else 'No (Tier B fallback)'}")
    print()

    # ── Ranked candidates ──────────────────────────────────────────────────
    candidates = body["ranked_candidates"]
    print(f"  ── Ranked Candidates ({len(candidates)} within 45 min) ─────────────────")
    header = (
        f"  {'#':>2}  {'Hospital':<42}  {'ETA':>6}  {'Cap':>5}  {'Cost':>7}"
    )
    print(header)
    print("  " + "-" * 66)
    for c in candidates:
        eta_s  = f"{c['eta_minutes']:.1f}" if c['eta_minutes'] is not None else " n/a"
        cost_s = f"{c['cost']:.2f}"         if c['cost']        is not None else " n/a"
        tier_b = " [Tier B]" if not c["is_feasible"] else ""
        print(
            f"  {c['rank']:>2}  {(c['name'][:42]):<42}  "
            f"{eta_s:>6}  {c['min_capacity_ratio']:>5.3f}  {cost_s:>7}{tier_b}"
        )

    print()
    print("  ── Timing ───────────────────────────────────────────────────")
    print(f"  DB query   : {body['db_query_time_ms']} ms")
    print(f"  ORS ETAs   : {body['routing_api_time_ms']} ms")
    print(f"  Total      : {body['response_time_ms']} ms")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    main()
