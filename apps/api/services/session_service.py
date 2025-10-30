"""Session management service."""

from __future__ import annotations

import logging

from packages.common.exceptions import ResourceNotFoundError
from packages.db.repositories import ChatRepository, ToolRepository

logger = logging.getLogger(__name__)


class SessionService:
    """Business logic for chat session management."""

    def __init__(
        self,
        chat_repo: ChatRepository,
        tool_repo: ToolRepository
    ):
        """
        Initialize session service.

        Args:
            chat_repo: Chat repository
            tool_repo: Tool repository
        """
        self.chat_repo = chat_repo
        self.tool_repo = tool_repo

    async def list_sessions(
        self,
        user_id: int,
        limit: int = 50
    ) -> list[dict]:
        """
        List user's chat sessions.

        Args:
            user_id: User ID
            limit: Maximum number of sessions

        Returns:
            List of session response data
        """
        sessions = await self.chat_repo.get_user_sessions(
            user_id=user_id,
            limit=limit
        )

        return [
            {
                "id": s.id,
                "external_id": s.external_id,
                "title": s.title,
                "model": s.model,
                "enable_tools": s.enable_tools,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
            }
            for s in sessions
        ]

    async def get_session(
        self,
        session_id: int,
        user_id: int
    ) -> dict:
        """
        Get session details with messages and tool runs.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            Session response data with messages and tool events

        Raises:
            ResourceNotFoundError: If session not found
        """
        session = await self.chat_repo.get_session_with_messages(
            session_id=session_id,
            user_id=user_id
        )

        if not session:
            raise ResourceNotFoundError(
                f"Session not found: {session_id}",
                code="SESSION_NOT_FOUND"
            )

        # Get tool runs for this session
        tool_runs = await self.tool_repo.get_session_tool_runs(
            session_id=session_id,
            user_id=user_id
        )

        return {
            "id": session.id,
            "external_id": session.external_id,
            "title": session.title,
            "model": session.model,
            "enable_tools": session.enable_tools,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "tool_call_name": m.tool_call_name,
                    "tool_call_id": m.tool_call_id,
                    "created_at": m.created_at.isoformat(),
                }
                for m in session.messages
            ],
            "tool_events": [
                {
                    "tool": tr.tool_name,
                    "status": tr.status,
                    "ts": tr.start_ts.isoformat(),
                    "latency_ms": tr.latency_ms,
                }
                for tr in tool_runs
            ],
        }

    async def delete_session(
        self,
        session_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a chat session and all its messages.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted

        Raises:
            ResourceNotFoundError: If session not found
        """
        deleted = await self.chat_repo.delete_session(
            session_id=session_id,
            user_id=user_id
        )

        if not deleted:
            raise ResourceNotFoundError(
                f"Session not found: {session_id}",
                code="SESSION_NOT_FOUND"
            )

        await self.chat_repo.commit()

        logger.info(
            "Session deleted",
            extra={
                "session_id": session_id,
                "user_id": user_id
            }
        )

        return True

    async def update_session_title(
        self,
        session_id: int,
        user_id: int,
        title: str
    ) -> bool:
        """
        Update session title.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)
            title: New title

        Returns:
            True if updated

        Raises:
            ResourceNotFoundError: If session not found
        """
        updated = await self.chat_repo.update_session_title(
            session_id=session_id,
            user_id=user_id,
            title=title
        )

        if not updated:
            raise ResourceNotFoundError(
                f"Session not found: {session_id}",
                code="SESSION_NOT_FOUND"
            )

        await self.chat_repo.commit()

        logger.info(
            "Session title updated",
            extra={
                "session_id": session_id,
                "user_id": user_id,
                "title": title
            }
        )

        return True
