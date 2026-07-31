"""
Crisis Care — Pydantic request/response models for the routing service.

Response shapes match PRD §9 exactly:

  POST /match success:
  {
    "hospital": { "id", "name", "address", "phone" },
    "eta_seconds": 312,
    "distance_km": 4.1,
    "route_geometry": "<polyline6 string>",
    "search_radius_used_km": 10,
    "query_log_id": 88213
  }

  POST /match no-match:
  {
    "hospital": null,
    "eta_seconds": null,
    "distance_km": null,
    "route_geometry": null,
    "search_radius_used_km": null,
    "query_log_id": <id>,
    "message": "No qualifying hospital found at any search radius."
  }
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

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
# POST /match — response (PRD §9)
# ---------------------------------------------------------------------------

class HospitalResult(BaseModel):
    """Nested hospital object in the match response."""
    id: int
    name: str
    address: str | None = None
    phone: str | None = None


class MatchResponse(BaseModel):
    """
    Returned when at least one qualifying hospital is found.

    Fields map 1-to-1 with PRD §9:
      hospital             — nested object (id, name, address, phone)
      eta_seconds          — driving-traffic ETA from Mapbox; None if Mapbox unavailable
      distance_km          — straight-line distance, always present
      route_geometry       — encoded polyline6 from Mapbox; None if Mapbox unavailable
      search_radius_used_km — radius at which match was found; None = city-wide
      query_log_id         — id of the query_log row written for this call
    """
    hospital: HospitalResult
    eta_seconds: int | None = Field(
        None, description="Driving-traffic ETA in seconds from Mapbox"
    )
    distance_km: float = Field(
        ..., description="Straight-line distance from patient to matched hospital, km"
    )
    route_geometry: str | None = Field(
        None, description="Encoded polyline6 route geometry from Mapbox"
    )
    search_radius_used_km: int | None = Field(
        None,
        description="Search radius used; None means city-wide (no distance filter)",
    )
    query_log_id: int | None = Field(
        None, description="Primary key of the query_log row written for this request"
    )


class NoMatchResponse(BaseModel):
    """
    Returned (HTTP 200) when no qualifying hospital is found at any radius.

    A query_log row is still written; query_log_id is included so the
    zero-match case is still a usable evaluation data point (FR-5).
    """
    hospital: None = None
    eta_seconds: None = None
    distance_km: None = None
    route_geometry: None = None
    search_radius_used_km: None = None
    query_log_id: int | None = Field(
        None, description="Primary key of the query_log row written for this request"
    )
    message: str = "No qualifying hospital found at any search radius."
