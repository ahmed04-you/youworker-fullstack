"""Repository for chat-related database operations."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import ChatMessage, ChatSession
from .base import BaseRepository


class ChatRepository(BaseRepository[ChatSession]):
    """Repository for chat sessions and messages."""

    def __init__(self, session: AsyncSession):
        """
        Initialize chat repository.

        Args:
            session: Database session
        """
        super().__init__(session, ChatSession)

    async def get_or_create_session(
        self,
        user_id: int,
        external_id: str | None,
        model: str | None,
        enable_tools: bool,
    ) -> ChatSession:
        """
        Get existing session or create new one.

        Args:
            user_id: User ID
            external_id: External session identifier
            model: Model name
            enable_tools: Whether tools are enabled

        Returns:
            Chat session
        """
        if external_id:
            q = select(ChatSession).where(
                ChatSession.user_id == user_id,
                ChatSession.external_id == external_id
            )
            result = await self.session.execute(q)
            cs = result.scalar_one_or_none()
            if cs:
                cs.updated_at = datetime.now(timezone.utc)
                cs.model = model or cs.model
                cs.enable_tools = enable_tools
                await self.session.flush()
                return cs

        cs = ChatSession(
            user_id=user_id,
            external_id=external_id,
            model=model,
            enable_tools=enable_tools
        )
        self.session.add(cs)
        await self.session.flush()
        return cs

    async def add_message(
        self,
        session_id: int,
        role: str,
        content: str,
        tool_call_name: str | None = None,
        tool_call_id: str | None = None,
    ) -> ChatMessage:
        """
        Add a message to a chat session.

        Args:
            session_id: Session ID
            role: Message role (user, assistant, tool)
            content: Message content
            tool_call_name: Tool call name (optional)
            tool_call_id: Tool call ID (optional)

        Returns:
            Created message
        """
        msg = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            tool_call_name=tool_call_name,
            tool_call_id=tool_call_id,
        )
        self.session.add(msg)
        await self.session.flush()
        return msg

    async def get_user_sessions(
        self,
        user_id: int,
        limit: int = 50
    ) -> list[ChatSession]:
        """
        Get all sessions for a user.

        Args:
            user_id: User ID
            limit: Maximum number of sessions to return

        Returns:
            List of chat sessions
        """
        result = await self.session.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_session_with_messages(
        self,
        session_id: int,
        user_id: int
    ) -> ChatSession | None:
        """
        Get a session with all its messages.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            Chat session with messages, or None if not found
        """
        result = await self.session.execute(
            select(ChatSession)
            .where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            )
            .options(selectinload(ChatSession.messages))
        )
        return result.scalar_one_or_none()

    async def delete_session(
        self,
        session_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a session and all its messages.

        Args:
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted, False if not found
        """
        # First delete all messages
        await self.session.execute(
            delete(ChatMessage).where(ChatMessage.session_id == session_id)
        )

        # Then delete the session
        result = await self.session.execute(
            delete(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            )
        )
        await self.session.flush()
        return result.rowcount > 0

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
            True if updated, False if not found
        """
        result = await self.session.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            return False

        session.title = title
        session.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return True
