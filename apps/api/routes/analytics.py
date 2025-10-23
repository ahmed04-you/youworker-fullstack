"""
Analytics API endpoints for dashboard visualizations.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(prefix="/v1/analytics")


async def _get_current_user():
    """Get current authenticated user."""
    user = await get_current_active_user()
    return {"id": user.id, "username": user.username, "is_root": user.is_root}


# ==================== OVERVIEW METRICS ====================


@router.get("/overview")
async def get_overview_metrics(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get overview metrics for the dashboard."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

        # Total sessions
        total_sessions_query = select(func.count(ChatSession.id)).where(
            and_(
                ChatSession.user_id == user_id,
                ChatSession.created_at >= cutoff_date,
            )
        )
        total_sessions = await db.scalar(total_sessions_query) or 0

        # Total messages
        total_messages_query = select(func.count(ChatMessage.id)).join(
            ChatSession
        ).where(
            and_(
                ChatSession.user_id == user_id,
                ChatMessage.created_at >= cutoff_date,
            )
        )
        total_messages = await db.scalar(total_messages_query) or 0

        # Total tokens
        total_tokens_query = select(
            func.sum(ChatMessage.tokens_in + ChatMessage.tokens_out)
        ).join(ChatSession).where(
            and_(
                ChatSession.user_id == user_id,
                ChatMessage.created_at >= cutoff_date,
                ChatMessage.tokens_in.isnot(None),
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
                "avg_per_session": round(total_messages / total_sessions, 1) if total_sessions > 0 else 0,
            },
            "tokens": {
                "total": int(total_tokens),
                "avg_per_message": round(total_tokens / total_messages, 0) if total_messages > 0 else 0,
            },
            "tools": {
                "total_runs": int(total_tool_runs),
                "success_rate": round(successful_tool_runs / total_tool_runs * 100, 1) if total_tool_runs > 0 else 0,
                "avg_latency_ms": round(float(avg_latency), 1),
            },
            "documents": {
                "total": int(total_documents),
            },
            "ingestion": {
                "total_runs": int(total_ingestion_runs),
            },
        }


# ==================== TOKEN USAGE OVER TIME ====================


@router.get("/tokens-timeline")
async def get_tokens_timeline(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
    interval: str = Query(default="day", pattern="^(hour|day|week)$"),
):
    """Get token usage over time."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

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


# ==================== TOOL PERFORMANCE ====================


@router.get("/tool-performance")
async def get_tool_performance(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get tool performance metrics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

        query = (
            select(
                ToolRun.tool_name,
                func.count(ToolRun.id).label("total_runs"),
                func.sum(
                    func.cast(ToolRun.status == "success", type_=func.Integer())
                ).label("successful_runs"),
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
                    "success_rate": round(
                        (row.successful_runs or 0) / row.total_runs * 100, 1
                    ),
                    "avg_latency_ms": round(float(row.avg_latency or 0), 1),
                    "min_latency_ms": int(row.min_latency or 0),
                    "max_latency_ms": int(row.max_latency or 0),
                }
                for row in rows
            ]
        }


# ==================== TOOL USAGE TIMELINE ====================


@router.get("/tool-timeline")
async def get_tool_timeline(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
    interval: str = Query(default="day", pattern="^(hour|day|week)$"),
):
    """Get tool usage over time."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

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
                func.sum(
                    func.cast(ToolRun.status == "success", type_=func.Integer())
                ).label("success_count"),
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
                    "success_rate": round(
                        (row.success_count or 0) / row.run_count * 100, 1
                    ),
                }
                for row in rows
            ],
        }


# ==================== INGESTION STATS ====================


@router.get("/ingestion-stats")
async def get_ingestion_stats(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get ingestion statistics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

        # Timeline data
        timeline_query = (
            select(
                func.date_trunc("day", IngestionRun.started_at).label("period"),
                func.count(IngestionRun.id).label("run_count"),
                func.sum(IngestionRun.totals_files).label("total_files"),
                func.sum(IngestionRun.totals_chunks).label("total_chunks"),
                func.sum(
                    func.cast(
                        IngestionRun.status == "success", type_=func.Integer()
                    )
                ).label("success_count"),
            )
            .where(
                and_(
                    IngestionRun.user_id == user_id,
                    IngestionRun.started_at >= cutoff_date,
                )
            )
            .group_by("period")
            .order_by("period")
        )

        result = await db.execute(timeline_query)
        rows = result.all()

        # Document stats by collection
        doc_stats_query = (
            select(
                Document.collection,
                func.count(Document.id).label("doc_count"),
                func.sum(Document.bytes_size).label("total_bytes"),
            )
            .group_by(Document.collection)
            .order_by(func.count(Document.id).desc())
        )

        doc_result = await db.execute(doc_stats_query)
        doc_rows = doc_result.all()

        return {
            "timeline": [
                {
                    "period": row.period.isoformat(),
                    "run_count": int(row.run_count),
                    "total_files": int(row.total_files or 0),
                    "total_chunks": int(row.total_chunks or 0),
                    "success_count": int(row.success_count or 0),
                    "success_rate": round(
                        (row.success_count or 0) / row.run_count * 100, 1
                    ),
                }
                for row in rows
            ],
            "by_collection": [
                {
                    "collection": row.collection or "default",
                    "document_count": int(row.doc_count),
                    "total_bytes": int(row.total_bytes or 0),
                    "total_mb": round(float(row.total_bytes or 0) / 1024 / 1024, 2),
                }
                for row in doc_rows
            ],
        }


# ==================== SESSION ACTIVITY ====================


@router.get("/session-activity")
async def get_session_activity(
    current_user=Depends(_get_current_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get session activity metrics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user["id"]

        # Sessions over time
        timeline_query = (
            select(
                func.date_trunc("day", ChatSession.created_at).label("period"),
                func.count(ChatSession.id).label("session_count"),
                func.sum(
                    func.cast(ChatSession.enable_tools, type_=func.Integer())
                ).label("tools_enabled_count"),
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
