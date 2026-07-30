"""
Crisis Care — GET /resource-types router

Returns the full list of resource_type_enum values from the database.
Used by the patient app's multi-select UI to populate its options without
hardcoding the enum server-side.

The values are read directly from pg_enum so adding a new enum value
via ALTER TYPE ... ADD VALUE is automatically reflected here with no
code change required.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_pool

logger = logging.getLogger(__name__)

router = APIRouter()


class ResourceTypesResponse(BaseModel):
    resource_types: list[str]


@router.get(
    "/resource-types",
    response_model=ResourceTypesResponse,
    summary="List all valid resource type values",
    description=(
        "Returns every value in the resource_type_enum, in declaration order. "
        "Use this to populate the patient-app multi-select without hardcoding "
        "the list client-side."
    ),
)
async def get_resource_types():
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT enumlabel AS value
                FROM pg_enum
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
                WHERE pg_type.typname = 'resource_type_enum'
                ORDER BY pg_enum.enumsortorder;
                """
            )
        return ResourceTypesResponse(resource_types=[r["value"] for r in rows])
    except Exception as exc:
        logger.exception("Failed to fetch resource types")
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
