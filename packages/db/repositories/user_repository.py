"""Repository for user-related database operations."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.exceptions import (
    DatabaseError,
    ResourceNotFoundError,
    ValidationError,
)

from ..models import ChatMessage, ChatSession, User
from .base import BaseRepository

logger = logging.getLogger(__name__)


def _hash_api_key(api_key: str) -> str:
    """Hash an API key using SHA256."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


class UserRepository(BaseRepository[User]):
    """Repository for user-related database operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize user repository.

        Args:
            session: Database session
        """
        super().__init__(session, User)

    async def get_by_username(self, username: str) -> User | None:
        """
        Get user by username.

        Args:
            username: Username to search for

        Returns:
            User or None if not found
        """
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_by_api_key(self, api_key: str) -> User:
        """
        Get user by API key.

        Args:
            api_key: API key to validate

        Returns:
            User matching the API key

        Raises:
            ValidationError: If API key is missing
            ResourceNotFoundError: If no user matches the API key
            DatabaseError: If database operation fails
        """
        if not api_key:
            raise ValidationError("API key is required", code="MISSING_API_KEY")

        try:
            hashed = _hash_api_key(api_key)
            result = await self.session.execute(
                select(User).where(User.api_key_hash == hashed)
            )
            user = result.scalar_one_or_none()

            if not user:
                raise ResourceNotFoundError(
                    "Invalid API key",
                    code="INVALID_API_KEY"
                )

            return user
        except (ResourceNotFoundError, ValidationError):
            raise
        except Exception as e:
            logger.error(
                "Database error in get_by_api_key",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "operation": "get_by_api_key"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to fetch user: {str(e)}",
                details={"operation": "get_by_api_key"}
            ) from e

    async def ensure_user_with_api_key(self, username: str, api_key: str, *, is_root: bool = False) -> User:
        """
        Ensure a user exists and is associated with the provided API key.

        If the API key already exists it takes precedence. Otherwise the user is located
        by username and updated. A new record is created when both lookups miss.
        """
        if not api_key:
            raise ValidationError("API key is required", code="MISSING_API_KEY")

        normalized_username = (username or "").strip() or "root"
        hashed_key = _hash_api_key(api_key)

        try:
            user = await self.get_by_api_key(api_key)
            updated = False
            if user.username != normalized_username:
                user.username = normalized_username
                updated = True
            if is_root and not user.is_root:
                user.is_root = True
                updated = True
            if updated:
                await self.session.flush()
            return user
        except ResourceNotFoundError:
            pass

        existing = await self.get_by_username(normalized_username)
        if existing:
            updated = False
            if existing.api_key_hash != hashed_key:
                existing.api_key_hash = hashed_key
                updated = True
            if is_root and not existing.is_root:
                existing.is_root = True
                updated = True
            if updated:
                await self.session.flush()
            return existing

        user = User(
            username=normalized_username,
            is_root=is_root,
            api_key_hash=hashed_key,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def ensure_root_user(self, username: str, api_key: str) -> User:
        """
        Ensure root user exists with given credentials.

        If user exists, updates API key hash if changed.
        If user doesn't exist, creates a new root user.

        Args:
            username: Root username
            api_key: API key for the root user

        Returns:
            Root user
        """
        return await self.ensure_user_with_api_key(username=username, api_key=api_key, is_root=True)

    async def regenerate_api_key(self, user_id: int) -> str:
        """
        Generate and persist a new API key for the given user.

        Args:
            user_id: User ID

        Returns:
            New API key (plain text - only shown once)

        Raises:
            ResourceNotFoundError: If user not found
        """
        user = await self.session.get(User, user_id)
        if not user:
            raise ResourceNotFoundError(
                f"User not found: {user_id}",
                code="USER_NOT_FOUND",
                details={"user_id": user_id}
            )
        new_key = secrets.token_urlsafe(32)
        user.api_key_hash = _hash_api_key(new_key)
        await self.session.flush()
        return new_key

    async def clear_history(self, user_id: int) -> dict[str, int]:
        """
        Delete all chat sessions (and cascaded messages) for a user.

        Args:
            user_id: User ID

        Returns:
            Summary containing counts for deleted sessions and messages
        """
        session_ids_result = await self.session.execute(
            select(ChatSession.id).where(ChatSession.user_id == user_id)
        )
        session_ids = session_ids_result.scalars().all()

        if not session_ids:
            return {"sessions_deleted": 0, "messages_deleted": 0}

        message_count_result = await self.session.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.session_id.in_(session_ids)
            )
        )
        messages_deleted = message_count_result.scalar_one() or 0

        delete_result = await self.session.execute(
            delete(ChatSession).where(ChatSession.id.in_(session_ids))
        )
        sessions_deleted = delete_result.rowcount or 0
        await self.session.flush()

        return {
            "sessions_deleted": sessions_deleted,
            "messages_deleted": int(messages_deleted),
        }

    async def delete_account(self, user_id: int) -> bool:
        """
        Permanently delete a user and cascade to all related entities.

        Args:
            user_id: User ID

        Returns:
            True if deleted, False if not found
        """
        delete_result = await self.session.execute(
            delete(User).where(User.id == user_id)
        )
        await self.session.flush()
        return bool(delete_result.rowcount)

    async def export_snapshot(self, user_id: int) -> dict:
        """
        Collect a snapshot of the user's data for export.

        Args:
            user_id: User ID

        Returns:
            Complete user data snapshot

        Raises:
            ResourceNotFoundError: If user not found
        """
        user = await self.session.get(User, user_id)
        if not user:
            raise ResourceNotFoundError(
                f"User not found: {user_id}",
                code="USER_NOT_FOUND",
                details={"user_id": user_id}
            )

        sessions_result = await self.session.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.created_at.asc())
        )
        sessions = sessions_result.scalars().unique().all()

        # Import here to avoid circular imports
        from . import DocumentRepository, ToolRepository, IngestionRepository

        doc_repo = DocumentRepository(self.session)
        tool_repo = ToolRepository(self.session)
        ingestion_repo = IngestionRepository(self.session)

        documents = await doc_repo.get_user_documents(
            user_id=user_id,
            limit=10_000,
            offset=0
        )
        ingestion_runs = await ingestion_repo.get_user_ingestion_runs(
            user_id=user_id,
            limit=10_000
        )
        tool_runs = await tool_repo.get_user_tool_runs(
            user_id=user_id,
            limit=10_000
        )

        sessions_payload = []
        for chat_session in sessions:
            messages = sorted(
                chat_session.messages,
                key=lambda message: message.created_at or datetime.now(timezone.utc),
            )
            sessions_payload.append(
                {
                    "id": chat_session.id,
                    "external_id": chat_session.external_id,
                    "title": chat_session.title,
                    "model": chat_session.model,
                    "enable_tools": chat_session.enable_tools,
                    "created_at": chat_session.created_at,
                    "updated_at": chat_session.updated_at,
                    "message_count": len(messages),
                    "messages": [
                        {
                            "id": message.id,
                            "role": message.role,
                            "content": message.content,
                            "tool_call_id": message.tool_call_id,
                            "tool_call_name": message.tool_call_name,
                            "created_at": message.created_at,
                            "tokens_in": message.tokens_in,
                            "tokens_out": message.tokens_out,
                        }
                        for message in messages
                    ],
                }
            )

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "created_at": user.created_at,
                "is_root": user.is_root,
            },
            "exported_at": datetime.now(timezone.utc),
            "sessions": sessions_payload,
            "documents": [
                {
                    "id": document.id,
                    "uri": document.uri,
                    "path": document.path,
                    "mime": document.mime,
                    "bytes_size": document.bytes_size,
                    "source": document.source,
                    "tags": document.tags,
                    "collection": document.collection,
                    "path_hash": document.path_hash,
                    "created_at": document.created_at,
                    "last_ingested_at": document.last_ingested_at,
                }
                for document in documents
            ],
            "ingestion_runs": [
                {
                    "id": run.id,
                    "target": run.target,
                    "from_web": run.from_web,
                    "recursive": run.recursive,
                    "tags": run.tags,
                    "collection": run.collection,
                    "totals_files": run.totals_files,
                    "totals_chunks": run.totals_chunks,
                    "errors": run.errors,
                    "started_at": run.started_at,
                    "finished_at": run.finished_at,
                    "status": run.status,
                }
                for run in ingestion_runs
            ],
            "tool_runs": [
                {
                    "id": tool_run.id,
                    "tool_name": tool_run.tool_name,
                    "status": tool_run.status,
                    "start_ts": tool_run.start_ts,
                    "end_ts": tool_run.end_ts,
                    "latency_ms": tool_run.latency_ms,
                    "args": tool_run.args,
                    "error_message": tool_run.error_message,
                    "result_preview": tool_run.result_preview,
                }
                for tool_run in tool_runs
            ],
        }
