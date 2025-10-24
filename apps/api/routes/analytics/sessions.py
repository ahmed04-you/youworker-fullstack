"""
Session activity analytics endpoints.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_, case

from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from packages.db.models import ChatSession

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/session-activity")
async def get_session_activity(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get session activity metrics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        # Sessions over time
        timeline_query = (
            select(
                func.date_trunc("day", ChatSession.created_at).label("period"),
                func.count(ChatSession.id).label("session_count"),
                func.sum(case((ChatSession.enable_tools, 1), else_=0)).label(
                    "tools_enabled_count"
                ),
            )
            .where(
                and_(
                    ChatSession.user_id == user_id,
                    ChatSession.created_at >= cutoff_date,
                )
            )
            .group_by("period")
            .order_by("period")
        )

        result = await db.execute(timeline_query)
        rows = result.all()

        # Model usage distribution
        model_query = (
            select(
                ChatSession.model,
                func.count(ChatSession.id).label("session_count"),
            )
            .where(
                and_(
                    ChatSession.user_id == user_id,
                    ChatSession.created_at >= cutoff_date,
                    ChatSession.model.isnot(None),
                )
            )
            .group_by(ChatSession.model)
            .order_by(func.count(ChatSession.id).desc())
        )

        model_result = await db.execute(model_query)
        model_rows = model_result.all()

        return {
            "timeline": [
                {
                    "period": row.period.isoformat(),
                    "session_count": int(row.session_count),
                    "tools_enabled_count": int(row.tools_enabled_count or 0),
                    "tools_enabled_rate": round(
                        (row.tools_enabled_count or 0) / row.session_count * 100, 1
                    ),
                }
                for row in rows
            ],
            "by_model": [
                {
                    "model": row.model,
                    "session_count": int(row.session_count),
                }
                for row in model_rows
            ],
        }
