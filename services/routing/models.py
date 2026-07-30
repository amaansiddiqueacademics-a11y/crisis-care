"""
Crisis Care — Pydantic request/response models for the routing service.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# All 18 valid resource type values (mirrors resource_type_enum in DB)
# ---------------------------------------------------------------------------

VALID_RESOURCE_TYPES: list[str] = [
    "icu_bed",
    "blood_a_pos",
    "blood_a_neg",
    "blood_b_pos",
    "blood_b_neg",
    "blood_o_pos",
    "blood_o_neg",
    "blood_ab_pos",
    "blood_ab_neg",
    "oxygen_cylinder",
    "ventilator",
    "specialist_trauma_surgeon",
    "specialist_cardiologist",
    "specialist_neurologist",
    "specialist_pediatric_er",
    "equipment_dialysis",
    "equipment_mri_trauma_ready",
    "equipment_ct_scanner",
]


# ---------------------------------------------------------------------------
# POST /match — request
# ---------------------------------------------------------------------------

class MatchRequest(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Patient latitude")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Patient longitude")
    resource_types: list[str] = Field(
        ...,
        min_length=1,
        description="One or more resource_type_enum values required by the patient",
    )

    @field_validator("resource_types")
    @classmethod
    def validate_resource_types(cls, v: list[str]) -> list[str]:
        invalid = [r for r in v if r not in VALID_RESOURCE_TYPES]
        if invalid:
            raise ValueError(
                f"Unknown resource type(s): {invalid}. "
                f"Valid values: {VALID_RESOURCE_TYPES}"
            )
        # Deduplicate while preserving order
        seen: set[str] = set()
        deduped: list[str] = []
        for r in v:
            if r not in seen:
                seen.add(r)
                deduped.append(r)
        return deduped


# ---------------------------------------------------------------------------
# POST /match — response models
# ---------------------------------------------------------------------------

class HospitalResult(BaseModel):
    id: int
    name: str
    address: str | None
    phone: str | None
    distance_km: float = Field(
        ..., description="Straight-line distance from patient to hospital, in km"
    )


class MatchResponse(BaseModel):
    """
    Response when at least one qualifying hospital was found.
    eta_seconds and route_geometry are None until Mapbox integration (Phase 2 step 2).
    query_log_id is None until query logging is implemented.
    """

    hospital: HospitalResult
    search_radius_used_km: int | None = Field(
        None,
        description="Radius at which the match was found; None means city-wide (no filter)",
    )
    # Placeholders — populated in subsequent phases
    eta_seconds: int | None = None
    route_geometry: str | None = None
    query_log_id: int | None = None


class NoMatchResponse(BaseModel):
    """Returned when no qualifying hospital was found at any radius."""

    hospital: None = None
    search_radius_used_km: None = None
    message: str = "No qualifying hospital found at any search radius."
