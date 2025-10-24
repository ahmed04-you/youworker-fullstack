"""
Tool performance and usage analytics endpoints.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_, case

from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from packages.db.models import ToolRun

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/tool-performance")
async def get_tool_performance(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get tool performance metrics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        query = (
            select(
                ToolRun.tool_name,
                func.count(ToolRun.id).label("total_runs"),
                func.sum(case((ToolRun.status == "success", 1), else_=0)).label(
                    "successful_runs"
                ),
                func.avg(ToolRun.latency_ms).label("avg_latency"),
                func.min(ToolRun.latency_ms).label("min_latency"),
                func.max(ToolRun.latency_ms).label("max_latency"),
            )
            .where(
                and_(
                    ToolRun.user_id == user_id,
                    ToolRun.start_ts >= cutoff_date,
                )
            )
            .group_by(ToolRun.tool_name)
            .order_by(func.count(ToolRun.id).desc())
        )

        result = await db.execute(query)
        rows = result.all()

        return {
            "data": [
                {
                    "tool_name": row.tool_name,
                    "total_runs": int(row.total_runs),
                    "successful_runs": int(row.successful_runs or 0),
                    "success_rate": round((row.successful_runs or 0) / row.total_runs * 100, 1),
                    "avg_latency_ms": round(float(row.avg_latency or 0), 1),
                    "min_latency_ms": int(row.min_latency or 0),
                    "max_latency_ms": int(row.max_latency or 0),
                }
                for row in rows
            ]
        }


@router.get("/tool-timeline")
async def get_tool_timeline(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
    interval: str = Query(default="day", pattern="^(hour|day|week)$"),
):
    """Get tool usage over time."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        # Determine the date truncation based on interval
        if interval == "hour":
            date_trunc = func.date_trunc("hour", ToolRun.start_ts)
        elif interval == "week":
            date_trunc = func.date_trunc("week", ToolRun.start_ts)
        else:  # day
            date_trunc = func.date_trunc("day", ToolRun.start_ts)

        query = (
            select(
                date_trunc.label("period"),
                ToolRun.tool_name,
                func.count(ToolRun.id).label("run_count"),
                func.sum(case((ToolRun.status == "success", 1), else_=0)).label(
                    "success_count"
                ),
            )
            .where(
                and_(
                    ToolRun.user_id == user_id,
                    ToolRun.start_ts >= cutoff_date,
                )
            )
            .group_by("period", ToolRun.tool_name)
            .order_by("period")
        )

        result = await db.execute(query)
        rows = result.all()

        return {
            "interval": interval,
            "data": [
                {
                    "period": row.period.isoformat(),
                    "tool_name": row.tool_name,
                    "run_count": int(row.run_count),
                    "success_count": int(row.success_count or 0),
                    "success_rate": round((row.success_count or 0) / row.run_count * 100, 1),
                }
                for row in rows
            ],
        }
