"""
Crisis Care — Database connection pool (asyncpg).

Provides a module-level pool created at app startup and closed at shutdown.
All routers import `get_pool()` rather than creating their own connections.

The DATABASE_URL format asyncpg expects:
    postgresql://user:password@host:port/dbname
    (no dialect prefix — NOT postgresql+asyncpg://...)
"""

import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://crisis_user:crisis_password@localhost:5433/crisis_care",
)


async def create_pool() -> asyncpg.Pool:
    """Create the module-level connection pool. Called once at app startup."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def close_pool() -> None:
    """Close the pool gracefully. Called at app shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the active pool. Raises if called before startup."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialised.")
    return _pool
