"""Analytics and metrics service."""

from __future__ import annotations

import logging

from packages.common.exceptions import ResourceNotFoundError
from packages.db.repositories import ToolRepository, IngestionRepository

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Business logic for analytics, metrics, and tracking."""

    def __init__(
        self,
        tool_repo: ToolRepository,
        ingestion_repo: IngestionRepository
    ):
        """
        Initialize analytics service.

        Args:
            tool_repo: Tool repository
            ingestion_repo: Ingestion repository
        """
        self.tool_repo = tool_repo
        self.ingestion_repo = ingestion_repo

    async def list_tool_runs(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> dict:
        """
        List tool execution logs for a user.

        Args:
            user_id: User ID
            limit: Maximum number of runs
            offset: Number of runs to skip

        Returns:
            Tool runs list with metadata
        """
        runs = await self.tool_repo.get_user_tool_runs(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        return {
            "runs": [
                {
                    "id": r.id,
                    "tool_name": r.tool_name,
                    "status": r.status,
                    "start_ts": r.start_ts.isoformat(),
                    "end_ts": r.end_ts.isoformat() if r.end_ts else None,
                    "latency_ms": r.latency_ms,
                    "args": r.args,
                    "error_message": r.error_message,
                    "result_preview": r.result_preview,
                }
                for r in runs
            ],
            "total": len(runs),
        }

    async def list_ingestion_runs(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        List ingestion run history for a user.

        Args:
            user_id: User ID
            limit: Maximum number of runs
            offset: Number of runs to skip

        Returns:
            Ingestion runs list with metadata
        """
        runs = await self.ingestion_repo.get_user_ingestion_runs(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        return {
            "runs": [
                {
                    "id": r.id,
                    "target": r.target,
                    "from_web": r.from_web,
                    "recursive": r.recursive,
                    "tags": r.tags,
                    "collection": r.collection,
                    "totals_files": r.totals_files,
                    "totals_chunks": r.totals_chunks,
                    "errors": r.errors,
                    "started_at": r.started_at.isoformat(),
                    "finished_at": (
                        r.finished_at.isoformat()
                        if r.finished_at
                        else None
                    ),
                    "status": r.status,
                }
                for r in runs
            ],
            "total": len(runs),
        }

    async def delete_ingestion_run(
        self,
        run_id: int,
        user_id: int
    ) -> bool:
        """
        Delete an ingestion run record.

        Args:
            run_id: Ingestion run ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted

        Raises:
            ResourceNotFoundError: If run not found
        """
        deleted = await self.ingestion_repo.delete_ingestion_run(
            run_id=run_id,
            user_id=user_id
        )

        if not deleted:
            raise ResourceNotFoundError(
                f"Ingestion run not found: {run_id}",
                code="INGESTION_RUN_NOT_FOUND"
            )

        await self.ingestion_repo.commit()

        logger.info(
            "Ingestion run deleted",
            extra={
                "run_id": run_id,
                "user_id": user_id
            }
        )

        return True
