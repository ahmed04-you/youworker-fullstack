"""Repository for tool-related database operations."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Tool, ToolRun
from .base import BaseRepository


class ToolRepository(BaseRepository[ToolRun]):
    """Repository for tool execution tracking."""

    def __init__(self, session: AsyncSession):
        """
        Initialize tool repository.

        Args:
            session: Database session
        """
        super().__init__(session, ToolRun)

    async def start_tool_run(
        self,
        user_id: int,
        session_id: int | None,
        message_id: int | None,
        tool_name: str,
        args: dict | None,
        start_ts: datetime,
    ) -> ToolRun:
        """
        Start tracking a tool execution.

        Args:
            user_id: User ID
            session_id: Session ID (optional)
            message_id: Message ID (optional)
            tool_name: Tool name
            args: Tool arguments
            start_ts: Start timestamp

        Returns:
            Created tool run
        """
        # Try resolve tool_id
        tool_id = None
        try:
            q = select(Tool).where(Tool.name == tool_name)
            result = await self.session.execute(q)
            t = result.scalar_one_or_none()
            if t:
                tool_id = t.id
        except Exception:
            pass

        tr = ToolRun(
            user_id=user_id,
            session_id=session_id,
            message_id=message_id,
            tool_name=tool_name,
            tool_id=tool_id,
            status="start",
            args=args,
            start_ts=start_ts,
        )
        self.session.add(tr)
        await self.session.flush()
        return tr

    async def finish_tool_run(
        self,
        run_id: int,
        status: str,
        end_ts: datetime,
        latency_ms: int | None,
        result_preview: str | None = None,
        error_message: str | None = None,
        tool_name: str | None = None,
    ) -> None:
        """
        Finish tracking a tool execution.

        Args:
            run_id: Tool run ID
            status: Final status
            end_ts: End timestamp
            latency_ms: Latency in milliseconds
            result_preview: Result preview (optional)
            error_message: Error message if failed (optional)
            tool_name: Tool name for ID resolution (optional)
        """
        q = select(ToolRun).where(ToolRun.id == run_id)
        result = await self.session.execute(q)
        tr = result.scalar_one_or_none()
        if not tr:
            return

        tr.status = status
        tr.end_ts = end_ts
        tr.latency_ms = latency_ms
        tr.result_preview = result_preview
        tr.error_message = error_message

        if tr.tool_id is None and tool_name:
            try:
                q2 = select(Tool).where(Tool.name == tool_name)
                result2 = await self.session.execute(q2)
                t = result2.scalar_one_or_none()
                if t:
                    tr.tool_id = t.id
            except Exception:
                pass

        await self.session.flush()

    async def get_user_tool_runs(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> list[ToolRun]:
        """
        Get tool runs for a user.

        Args:
            user_id: User ID
            limit: Maximum number of runs
            offset: Number of runs to skip

        Returns:
            List of tool runs
        """
        result = await self.session.execute(
            select(ToolRun)
            .where(ToolRun.user_id == user_id)
            .order_by(ToolRun.start_ts.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_session_tool_runs(
        self,
        session_id: int,
        user_id: int
    ) -> list[ToolRun]:
        """
        Get tool runs for a specific session.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            List of tool runs
        """
        result = await self.session.execute(
            select(ToolRun)
            .where(
                ToolRun.session_id == session_id,
                ToolRun.user_id == user_id
            )
            .order_by(ToolRun.start_ts.asc())
        )
        return list(result.scalars().all())
