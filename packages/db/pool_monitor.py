"""Database connection pool monitoring and diagnostics."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)


@dataclass
class PoolStats:
    """Database connection pool statistics."""

    pool_size: int
    """Maximum pool size"""

    checked_out: int
    """Number of connections currently checked out"""

    overflow: int
    """Number of overflow connections (beyond pool_size)"""

    idle: int
    """Number of idle connections available"""

    max_overflow: int
    """Maximum overflow allowed"""

    pool_utilization: float
    """Pool utilization percentage (0-100)"""

    overflow_utilization: float
    """Overflow utilization percentage (0-100)"""

    is_overflowing: bool
    """Whether pool is using overflow connections"""

    is_saturated: bool
    """Whether pool is at or near capacity"""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "pool_size": self.pool_size,
            "checked_out": self.checked_out,
            "overflow": self.overflow,
            "idle": self.idle,
            "max_overflow": self.max_overflow,
            "pool_utilization": round(self.pool_utilization, 2),
            "overflow_utilization": round(self.overflow_utilization, 2),
            "is_overflowing": self.is_overflowing,
            "is_saturated": self.is_saturated,
        }


class PoolMonitor:
    """Monitor and report on database connection pool health."""

    def __init__(self, engine: AsyncEngine):
        """
        Initialize pool monitor.

        Args:
            engine: SQLAlchemy async engine to monitor
        """
        self.engine = engine
        self.pool: Pool = engine.pool  # type: ignore

    def get_stats(self) -> PoolStats:
        """
        Get current pool statistics.

        Returns:
            Pool statistics snapshot
        """
        pool = self.pool

        # Get pool configuration
        pool_size = pool.size()
        max_overflow = getattr(pool, '_max_overflow', 0)

        # Get current state
        checked_out = pool.checkedout()
        overflow = pool.overflow()
        idle = pool_size - checked_out

        # Calculate utilization
        pool_utilization = (checked_out / pool_size * 100) if pool_size > 0 else 0
        overflow_utilization = (overflow / max_overflow * 100) if max_overflow > 0 else 0

        # Determine health status
        is_overflowing = overflow > 0
        is_saturated = checked_out >= pool_size and overflow >= (max_overflow * 0.8)

        return PoolStats(
            pool_size=pool_size,
            checked_out=checked_out,
            overflow=overflow,
            idle=idle,
            max_overflow=max_overflow,
            pool_utilization=pool_utilization,
            overflow_utilization=overflow_utilization,
            is_overflowing=is_overflowing,
            is_saturated=is_saturated,
        )

    def log_stats(self, level: int = logging.INFO) -> None:
        """
        Log current pool statistics.

        Args:
            level: Logging level to use
        """
        stats = self.get_stats()

        log_data = {
            "operation": "pool_monitor",
            **stats.to_dict()
        }

        # Upgrade log level if pool is saturated
        if stats.is_saturated:
            level = logging.WARNING
            log_data["warning"] = "Connection pool is saturated"

        logger.log(
            level,
            f"DB Pool: {stats.checked_out}/{stats.pool_size} in use, "
            f"{stats.idle} idle, {stats.overflow} overflow "
            f"({stats.pool_utilization:.1f}% utilized)",
            extra=log_data
        )

    def check_health(self) -> tuple[bool, str]:
        """
        Check pool health status.

        Returns:
            Tuple of (is_healthy, message)
        """
        stats = self.get_stats()

        if stats.is_saturated:
            return False, (
                f"Connection pool saturated: {stats.checked_out}/{stats.pool_size} "
                f"+ {stats.overflow}/{stats.max_overflow} overflow"
            )

        if stats.is_overflowing:
            return True, (
                f"Connection pool using overflow: {stats.overflow}/{stats.max_overflow} "
                "(consider increasing pool_size)"
            )

        if stats.pool_utilization > 80:
            return True, (
                f"Connection pool high utilization: {stats.pool_utilization:.1f}% "
                "(monitor closely)"
            )

        return True, f"Connection pool healthy: {stats.checked_out}/{stats.pool_size} in use"


async def get_pool_status(engine: AsyncEngine) -> dict[str, Any]:
    """
    Get comprehensive pool status for monitoring endpoints.

    Args:
        engine: SQLAlchemy async engine

    Returns:
        Dictionary with pool status information
    """
    monitor = PoolMonitor(engine)
    stats = monitor.get_stats()
    is_healthy, message = monitor.check_health()

    return {
        "healthy": is_healthy,
        "message": message,
        "stats": stats.to_dict(),
    }
