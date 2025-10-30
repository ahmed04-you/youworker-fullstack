"""Account management service."""

from __future__ import annotations

import logging

from packages.common.exceptions import ResourceNotFoundError
from packages.db.repositories import UserRepository

logger = logging.getLogger(__name__)


class AccountService:
    """Business logic for user account operations."""

    def __init__(self, user_repo: UserRepository):
        """
        Initialize account service.

        Args:
            user_repo: User repository
        """
        self.user_repo = user_repo

    async def regenerate_api_key(self, user_id: int) -> str:
        """
        Generate and persist a new API key for user.

        Args:
            user_id: User ID

        Returns:
            New API key (plain text - only shown once)

        Raises:
            ResourceNotFoundError: If user not found
        """
        new_key = await self.user_repo.regenerate_api_key(user_id)
        await self.user_repo.commit()

        logger.info(
            "API key regenerated",
            extra={"user_id": user_id}
        )

        return new_key

    async def clear_history(self, user_id: int) -> dict[str, int]:
        """
        Delete all chat sessions and messages for user.

        Args:
            user_id: User ID

        Returns:
            Summary with counts of deleted items
        """
        summary = await self.user_repo.clear_history(user_id)
        await self.user_repo.commit()

        logger.info(
            "History cleared",
            extra={
                "user_id": user_id,
                "sessions_deleted": summary["sessions_deleted"],
                "messages_deleted": summary["messages_deleted"]
            }
        )

        return summary

    async def export_snapshot(self, user_id: int) -> dict:
        """
        Export all user data for GDPR compliance.

        Args:
            user_id: User ID

        Returns:
            Complete user data snapshot

        Raises:
            ResourceNotFoundError: If user not found
        """
        snapshot = await self.user_repo.export_snapshot(user_id)

        logger.info(
            "Account export generated",
            extra={
                "user_id": user_id,
                "sessions_count": len(snapshot.get("sessions", [])),
                "documents_count": len(snapshot.get("documents", []))
            }
        )

        return snapshot

    async def delete_account(self, user_id: int) -> bool:
        """
        Permanently delete user account and all data.

        Args:
            user_id: User ID

        Returns:
            True if deleted, False if not found

        Raises:
            ResourceNotFoundError: If user not found
        """
        deleted = await self.user_repo.delete_account(user_id)
        if not deleted:
            raise ResourceNotFoundError(
                f"User not found: {user_id}",
                code="USER_NOT_FOUND"
            )

        await self.user_repo.commit()

        logger.warning(
            "Account deleted",
            extra={"user_id": user_id}
        )

        return True
