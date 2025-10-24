"""
Token usage analytics endpoints.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_

from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from packages.db.models import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/tokens-timeline")
async def get_tokens_timeline(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
    interval: str = Query(default="day", pattern="^(hour|day|week)$"),
):
    """Get token usage over time."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        # Determine the date truncation based on interval
        if interval == "hour":
            date_trunc = func.date_trunc("hour", ChatMessage.created_at)
        elif interval == "week":
            date_trunc = func.date_trunc("week", ChatMessage.created_at)
        else:  # day
            date_trunc = func.date_trunc("day", ChatMessage.created_at)

        query = (
            select(
                date_trunc.label("period"),
                func.sum(ChatMessage.tokens_in).label("tokens_in"),
                func.sum(ChatMessage.tokens_out).label("tokens_out"),
                func.count(ChatMessage.id).label("message_count"),
            )
            .join(ChatSession)
            .where(
                and_(
                    ChatSession.user_id == user_id,
                    ChatMessage.created_at >= cutoff_date,
                    ChatMessage.tokens_in.isnot(None),
                )
            )
            .group_by("period")
            .order_by("period")
        )

        result = await db.execute(query)
        rows = result.all()

        return {
            "interval": interval,
            "data": [
                {
                    "period": row.period.isoformat(),
                    "tokens_in": int(row.tokens_in or 0),
                    "tokens_out": int(row.tokens_out or 0),
                    "total_tokens": int((row.tokens_in or 0) + (row.tokens_out or 0)),
                    "message_count": int(row.message_count),
                }
                for row in rows
            ],
        }
