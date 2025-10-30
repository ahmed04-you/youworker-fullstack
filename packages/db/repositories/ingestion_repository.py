"""Repository for ingestion-related database operations."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import IngestionRun
from .base import BaseRepository


class IngestionRepository(BaseRepository[IngestionRun]):
    """Repository for ingestion run tracking."""

    def __init__(self, session: AsyncSession):
        """
        Initialize ingestion repository.

        Args:
            session: Database session
        """
        super().__init__(session, IngestionRun)

    async def record_ingestion_run(
        self,
        user_id: int,
        target: str,
        from_web: bool,
        recursive: bool,
        tags: list[str] | None,
        collection: str | None,
        totals_files: int,
        totals_chunks: int,
        errors: list[str] | None,
        started_at: datetime,
        finished_at: datetime,
        status: str = "success",
    ) -> IngestionRun:
        """
        Record an ingestion run.

        Args:
            user_id: User ID
            target: Ingestion target path/URL
            from_web: Whether ingestion was from web
            recursive: Whether ingestion was recursive
            tags: Document tags
            collection: Collection name
            totals_files: Total files processed
            totals_chunks: Total chunks created
            errors: List of errors encountered
            started_at: Start timestamp
            finished_at: Finish timestamp
            status: Ingestion status

        Returns:
            Created ingestion run
        """
        run = IngestionRun(
            user_id=user_id,
            target=target,
            from_web=from_web,
            recursive=recursive,
            tags={"tags": tags or []},
            collection=collection,
            totals_files=totals_files,
            totals_chunks=totals_chunks,
            errors={"errors": errors or []} if errors else None,
            started_at=started_at,
            finished_at=finished_at,
            status=status,
        )
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_user_ingestion_runs(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> list[IngestionRun]:
        """
        Get ingestion runs for a user.

        Args:
            user_id: User ID
            limit: Maximum number of runs
            offset: Number of runs to skip

        Returns:
            List of ingestion runs
        """
        result = await self.session.execute(
            select(IngestionRun)
            .where(IngestionRun.user_id == user_id)
            .order_by(IngestionRun.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def delete_ingestion_run(
        self,
        run_id: int,
        user_id: int
    ) -> bool:
        """
        Delete an ingestion run.

        Args:
            run_id: Ingestion run ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted, False if not found
        """
        result = await self.session.execute(
            delete(IngestionRun).where(
                IngestionRun.id == run_id,
                IngestionRun.user_id == user_id
            )
        )
        await self.session.flush()
        return result.rowcount > 0
