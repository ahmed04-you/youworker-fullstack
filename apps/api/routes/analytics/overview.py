"""
Overview metrics endpoint for dashboard.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_

from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from packages.db.models import (
    ChatSession,
    ChatMessage,
    ToolRun,
    IngestionRun,
    Document,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/overview")
async def get_overview_metrics(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get overview metrics for the dashboard."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        # Total sessions
        total_sessions_query = select(func.count(ChatSession.id)).where(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.created_at >= cutoff_date,
            )
        )
        total_sessions = await db.scalar(total_sessions_query) or 0

        # Total messages
        total_messages_query = (
            select(func.count(ChatMessage.id))
            .join(ChatSession)
            .where(
                and_(
                    ChatSession.user_id == user_id,
                    ChatMessage.created_at >= cutoff_date,
                )
            )
        )
        total_messages = await db.scalar(total_messages_query) or 0

        # Total tokens
        total_tokens_query = (
            select(func.sum(ChatMessage.tokens_in + ChatMessage.tokens_out))
            .join(ChatSession)
            .where(
                and_(
                    ChatSession.user_id == user_id,
                    ChatMessage.created_at >= cutoff_date,
                    ChatMessage.tokens_in.isnot(None),
                )
            )
        )
        total_tokens = await db.scalar(total_tokens_query) or 0

        # Total tool runs
        total_tool_runs_query = select(func.count(ToolRun.id)).where(
            and_(
                ToolRun.user_id == user_id,
                ToolRun.start_ts >= cutoff_date,
            )
        )
        total_tool_runs = await db.scalar(total_tool_runs_query) or 0

        # Successful tool runs
        successful_tool_runs_query = select(func.count(ToolRun.id)).where(
            and_(
                ToolRun.user_id == user_id,
                ToolRun.status == "success",
                ToolRun.start_ts >= cutoff_date,
            )
        )
        successful_tool_runs = await db.scalar(successful_tool_runs_query) or 0

        # Average tool latency
        avg_latency_query = select(func.avg(ToolRun.latency_ms)).where(
            and_(
                ToolRun.user_id == user_id,
                ToolRun.latency_ms.isnot(None),
                ToolRun.start_ts >= cutoff_date,
            )
        )
        avg_latency = await db.scalar(avg_latency_query) or 0

        # Total documents
        total_documents_query = select(func.count(Document.id))
        total_documents = await db.scalar(total_documents_query) or 0

        # Total ingestion runs
        total_ingestion_runs_query = select(func.count(IngestionRun.id)).where(
            and_(
                IngestionRun.user_id == user_id,
                IngestionRun.started_at >= cutoff_date,
            )
        )
        total_ingestion_runs = await db.scalar(total_ingestion_runs_query) or 0

        return {
            "period_days": days,
            "sessions": {
                "total": int(total_sessions),
                "avg_per_day": round(total_sessions / days, 1),
            },
            "messages": {
                "total": int(total_messages),
                "avg_per_session": (
                    round(total_messages / total_sessions, 1) if total_sessions > 0 else 0
                ),
            },
            "tokens": {
                "total": int(total_tokens),
                "avg_per_message": (
                    round(total_tokens / total_messages, 0) if total_messages > 0 else 0
                ),
            },
            "tools": {
                "total_runs": int(total_tool_runs),
                "success_rate": (
                    round(successful_tool_runs / total_tool_runs * 100, 1)
                    if total_tool_runs > 0
                    else 0
                ),
                "avg_latency_ms": round(float(avg_latency), 1),
            },
            "documents": {
                "total": int(total_documents),
            },
            "ingestion": {
                "total_runs": int(total_ingestion_runs),
            },
        }
