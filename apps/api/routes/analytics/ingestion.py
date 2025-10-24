"""
Ingestion statistics endpoints.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, and_, case

from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from packages.db.models import IngestionRun, Document

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ingestion-stats")
async def get_ingestion_stats(
    current_user=Depends(get_current_active_user),
    days: int = Query(default=30, ge=1, le=365),
):
    """Get ingestion statistics."""
    async with get_async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        user_id = current_user.id

        # Timeline data
        timeline_query = (
            select(
                func.date_trunc("day", IngestionRun.started_at).label("period"),
                func.count(IngestionRun.id).label("run_count"),
                func.sum(IngestionRun.totals_files).label("total_files"),
                func.sum(IngestionRun.totals_chunks).label("total_chunks"),
                func.sum(case((IngestionRun.status == "success", 1), else_=0)).label(
                    "success_count"
                ),
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
                    "success_rate": round((row.success_count or 0) / row.run_count * 100, 1),
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
