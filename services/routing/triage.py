"""
Crisis Care V2 — Triage category → resource mapping  (PRD §6)
and routing cost-function constants  (PRD §7).

This module is intentionally pure-data (no I/O, no DB calls) so it can be
imported by both the router and the evaluation harness with zero side effects.

─── Triage → Required Resources (PRD §6, deterministic rule table) ───────────

| Triage Category              | Required Resources                          |
|------------------------------|---------------------------------------------|
| high_velocity_polytrauma     | icu_bed, ventilator, specialist_trauma_surgeon,
|                              | blood_o_neg, equipment_ct_scanner           |
| acute_coronary_syndrome_stemi| specialist_cardiologist, icu_bed, oxygen_cylinder |
| acute_ischemic_stroke        | equipment_ct_scanner, specialist_neurologist,
|                              | icu_bed                                     |
| severe_respiratory_distress  | oxygen_cylinder, ventilator                 |

Notes:
  • PRD §6 says "cardiac ICU" for STEMI — mapped to icu_bed (same physical
    bed type in our 18-resource schema; no separate cardiac-ICU enum).
  • No fuzzy matching or LLM inference — this is a life-safety decision;
    deterministic and auditable is the design requirement.

─── Cost Function Constants (PRD §7) ─────────────────────────────────────────

  Cost(h) = α · ETA(scene, h)  +  β · QueueDelay(h)

  QueueDelay(h) = (1 − available_capacity_ratio(h)) × FIXED_PENALTY_MINUTES

  available_capacity_ratio(h):
    For each required resource type, compute:
        ratio_r = effective_available_r / quantity_available_r
    Take the minimum ratio across all required resources (worst-case bottleneck).
    Clamp to [0, 1].

  DRIVE_TIME_THRESHOLD_MINUTES  = 45   (Tier A upper bound, PRD §8)
  FIXED_PENALTY_MINUTES         = 30   (proxy for unmodelled queue delay)
  ALPHA                         = 1.0  (ETA weight)
  BETA                          = 0.3  (queue-delay weight)

  These values are documented as starting-point placeholders (PRD §7);
  tune them during evaluation and report final values in the paper.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Triage → Required Resources
# ---------------------------------------------------------------------------

# Maps triage_category enum value → list of resource_type_enum values.
# Order within the list is arbitrary; all must be present for a hospital
# to pass the hard-feasibility filter.

TRIAGE_RESOURCE_MAP: dict[str, list[str]] = {
    # GCS ≤ 8, hemorrhagic shock
    "high_velocity_polytrauma": [
        "icu_bed",
        "ventilator",
        "specialist_trauma_surgeon",
        "blood_o_neg",
        "equipment_ct_scanner",
    ],

    # Clinical STEMI presentation
    "acute_coronary_syndrome_stemi": [
        "specialist_cardiologist",
        "icu_bed",         # cardiac ICU → mapped to icu_bed in our schema
        "oxygen_cylinder",
    ],

    # Within 4.5-hour thrombolysis window
    "acute_ischemic_stroke": [
        "equipment_ct_scanner",
        "specialist_neurologist",
        "icu_bed",
    ],

    # SpO2 drop / respiratory failure
    "severe_respiratory_distress": [
        "oxygen_cylinder",
        "ventilator",
    ],
}

ALL_TRIAGE_CATEGORIES: list[str] = list(TRIAGE_RESOURCE_MAP.keys())


def get_required_resources(triage_category: str) -> list[str]:
    """
    Return the list of required resource_type_enum values for a triage category.

    Raises ValueError if the category is not in the mapping table —
    keeps this path deterministic and auditable (no silent misses).
    """
    if triage_category not in TRIAGE_RESOURCE_MAP:
        raise ValueError(
            f"Unknown triage_category '{triage_category}'. "
            f"Valid values: {ALL_TRIAGE_CATEGORIES}"
        )
    return TRIAGE_RESOURCE_MAP[triage_category]


# ---------------------------------------------------------------------------
# Cost Function Constants (PRD §7)
# ---------------------------------------------------------------------------

# Drive-time threshold for Tier A (feasibility-filtered) routing (PRD §8).
# If no feasible hospital is reachable within this window, escalate to Tier B.
DRIVE_TIME_THRESHOLD_MINUTES: float = 45.0

# Proxy for unmodelled queueing time.
# QueueDelay(h) = (1 - capacity_ratio) * FIXED_PENALTY_MINUTES
# Interpretation: a fully-depleted hospital adds FIXED_PENALTY_MINUTES to cost;
# a fully-stocked hospital adds 0. Linear interpolation between.
FIXED_PENALTY_MINUTES: float = 30.0

# Weighting coefficients — tune during evaluation, report final values in paper.
ALPHA: float = 1.0   # ETA weight
BETA:  float = 0.3   # QueueDelay weight


def cost(eta_minutes: float, capacity_ratio: float) -> float:
    """
    Compute Cost(h) = α · ETA + β · QueueDelay(h).

    Args:
        eta_minutes     — ORS drive time from scene to hospital, minutes.
        capacity_ratio  — min(effective_available / quantity_available) across
                          all required resources; clamped to [0, 1].

    Returns:
        Cost in (dimensionless) cost-minutes.
    """
    capacity_ratio = max(0.0, min(1.0, capacity_ratio))
    queue_delay = (1.0 - capacity_ratio) * FIXED_PENALTY_MINUTES
    return ALPHA * eta_minutes + BETA * queue_delay
