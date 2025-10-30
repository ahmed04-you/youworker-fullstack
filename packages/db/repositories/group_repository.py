"""Repository for group-related database operations."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.exceptions import (
    DatabaseError,
    ResourceNotFoundError,
    ValidationError,
)

from ..models import Document, Group, UserGroupMembership
from .base import BaseRepository

logger = logging.getLogger(__name__)


class GroupRepository(BaseRepository[Group]):
    """Repository for group-related database operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize group repository.

        Args:
            session: Database session
        """
        super().__init__(session, Group)

    async def get_by_name(self, name: str) -> Group | None:
        """
        Get group by name.

        Args:
            name: Group name to search for

        Returns:
            Group or None if not found
        """
        result = await self.session.execute(
            select(Group).where(Group.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_members(self, group_id: int) -> Group | None:
        """
        Get a group by its ID with members eagerly loaded.

        Args:
            group_id: Group ID

        Returns:
            Group with members or None if not found
        """
        try:
            result = await self.session.execute(
                select(Group)
                .options(selectinload(Group.members))
                .where(Group.id == group_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(
                "Failed to fetch group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "group_id": group_id,
                    "operation": "get_by_id_with_members"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to fetch group: {str(e)}",
                details={"operation": "get_by_id_with_members", "group_id": group_id}
            ) from e

    async def create_with_creator(
        self,
        name: str,
        description: str | None,
        creator_user_id: int
    ) -> Group:
        """
        Create a new group and add the creator as an admin.

        Args:
            name: Group name
            description: Optional group description
            creator_user_id: User ID of the group creator

        Returns:
            Created group

        Raises:
            ValidationError: If group name already exists
            DatabaseError: If database operation fails
        """
        # Check if group with this name already exists
        existing_group = await self.get_by_name(name)

        if existing_group:
            raise ValidationError(
                f"Group with name '{name}' already exists",
                code="GROUP_NAME_EXISTS",
                details={"name": name}
            )

        try:
            # Create the group
            group = Group(
                name=name,
                description=description,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            self.session.add(group)
            await self.session.flush()

            # Add creator as admin
            membership = UserGroupMembership(
                user_id=creator_user_id,
                group_id=group.id,
                role="admin",
                joined_at=datetime.now(timezone.utc)
            )
            self.session.add(membership)
            await self.session.flush()

            logger.info(
                "Group created successfully",
                extra={
                    "group_id": group.id,
                    "group_name": name,
                    "creator_user_id": creator_user_id,
                    "operation": "create_with_creator"
                }
            )

            return group
        except (ValidationError, ResourceNotFoundError):
            raise
        except Exception as e:
            logger.error(
                "Failed to create group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "group_name": name,
                    "creator_user_id": creator_user_id,
                    "operation": "create_with_creator"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to create group: {str(e)}",
                details={"operation": "create_with_creator", "name": name}
            ) from e

    async def update_group(
        self,
        group_id: int,
        name: str | None,
        description: str | None
    ) -> Group:
        """
        Update a group's name and/or description.

        Args:
            group_id: Group ID
            name: New group name (optional)
            description: New group description (optional)

        Returns:
            Updated group

        Raises:
            ResourceNotFoundError: If group not found
            ValidationError: If new name already exists
            DatabaseError: If database operation fails
        """
        group = await self.session.get(Group, group_id)
        if not group:
            raise ResourceNotFoundError(
                f"Group not found: {group_id}",
                code="GROUP_NOT_FOUND",
                details={"group_id": group_id}
            )

        try:
            if name is not None:
                # Check if another group with this name exists
                existing_group = await self.get_by_name(name)
                if existing_group and existing_group.id != group_id:
                    raise ValidationError(
                        f"Group with name '{name}' already exists",
                        code="GROUP_NAME_EXISTS",
                        details={"name": name}
                    )
                group.name = name

            if description is not None:
                group.description = description

            group.updated_at = datetime.now(timezone.utc)
            await self.session.flush()

            logger.info(
                "Group updated successfully",
                extra={
                    "group_id": group_id,
                    "operation": "update_group"
                }
            )

            return group
        except (ValidationError, ResourceNotFoundError):
            raise
        except Exception as e:
            logger.error(
                "Failed to update group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "group_id": group_id,
                    "operation": "update_group"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to update group: {str(e)}",
                details={"operation": "update_group", "group_id": group_id}
            ) from e

    async def delete_group(self, group_id: int) -> bool:
        """
        Delete a group.

        Args:
            group_id: Group ID

        Returns:
            True if deleted, False if not found
        """
        try:
            delete_result = await self.session.execute(
                delete(Group).where(Group.id == group_id)
            )
            await self.session.flush()

            if delete_result.rowcount:
                logger.info(
                    "Group deleted successfully",
                    extra={"group_id": group_id, "operation": "delete_group"}
                )

            return bool(delete_result.rowcount)
        except Exception as e:
            logger.error(
                "Failed to delete group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "group_id": group_id,
                    "operation": "delete_group"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to delete group: {str(e)}",
                details={"operation": "delete_group", "group_id": group_id}
            ) from e

    async def add_member(
        self,
        user_id: int,
        group_id: int,
        role: str = "member"
    ) -> UserGroupMembership:
        """
        Add a user to a group with a specified role.

        Args:
            user_id: User ID
            group_id: Group ID
            role: User role ("member" or "admin")

        Returns:
            Created membership

        Raises:
            ValidationError: If role is invalid or membership exists
            DatabaseError: If database operation fails
        """
        # Validate role
        if role not in ("member", "admin"):
            raise ValidationError(
                f"Invalid role: {role}. Must be 'member' or 'admin'",
                code="INVALID_ROLE",
                details={"role": role}
            )

        # Check if membership already exists
        existing_membership_result = await self.session.execute(
            select(UserGroupMembership).where(
                UserGroupMembership.user_id == user_id,
                UserGroupMembership.group_id == group_id
            )
        )
        existing_membership = existing_membership_result.scalar_one_or_none()

        if existing_membership:
            raise ValidationError(
                f"User {user_id} is already a member of group {group_id}",
                code="MEMBERSHIP_EXISTS",
                details={"user_id": user_id, "group_id": group_id}
            )

        try:
            membership = UserGroupMembership(
                user_id=user_id,
                group_id=group_id,
                role=role,
                joined_at=datetime.now(timezone.utc)
            )
            self.session.add(membership)
            await self.session.flush()

            logger.info(
                "User added to group",
                extra={
                    "user_id": user_id,
                    "group_id": group_id,
                    "role": role,
                    "operation": "add_member"
                }
            )

            return membership
        except (ValidationError, ResourceNotFoundError):
            raise
        except Exception as e:
            logger.error(
                "Failed to add user to group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "group_id": group_id,
                    "operation": "add_member"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to add user to group: {str(e)}",
                details={"operation": "add_member", "user_id": user_id, "group_id": group_id}
            ) from e

    async def remove_member(self, user_id: int, group_id: int) -> bool:
        """
        Remove a user from a group.

        Args:
            user_id: User ID
            group_id: Group ID

        Returns:
            True if removed, False if not found
        """
        try:
            delete_result = await self.session.execute(
                delete(UserGroupMembership).where(
                    UserGroupMembership.user_id == user_id,
                    UserGroupMembership.group_id == group_id
                )
            )
            await self.session.flush()

            if delete_result.rowcount:
                logger.info(
                    "User removed from group",
                    extra={
                        "user_id": user_id,
                        "group_id": group_id,
                        "operation": "remove_member"
                    }
                )

            return bool(delete_result.rowcount)
        except Exception as e:
            logger.error(
                "Failed to remove user from group",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "group_id": group_id,
                    "operation": "remove_member"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to remove user from group: {str(e)}",
                details={"operation": "remove_member", "user_id": user_id, "group_id": group_id}
            ) from e

    async def get_user_groups(self, user_id: int) -> list[Group]:
        """
        Get all groups a user belongs to.

        Args:
            user_id: User ID

        Returns:
            List of groups
        """
        try:
            result = await self.session.execute(
                select(Group)
                .join(UserGroupMembership)
                .where(UserGroupMembership.user_id == user_id)
                .order_by(Group.created_at.desc())
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(
                "Failed to fetch user groups",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "operation": "get_user_groups"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to fetch user groups: {str(e)}",
                details={"operation": "get_user_groups", "user_id": user_id}
            ) from e

    async def get_members(self, group_id: int) -> list[UserGroupMembership]:
        """
        Get all members of a group.

        Args:
            group_id: Group ID

        Returns:
            List of memberships with user data eagerly loaded
        """
        try:
            result = await self.session.execute(
                select(UserGroupMembership)
                .options(selectinload(UserGroupMembership.user))
                .where(UserGroupMembership.group_id == group_id)
                .order_by(UserGroupMembership.joined_at.asc())
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(
                "Failed to fetch group members",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "group_id": group_id,
                    "operation": "get_members"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to fetch group members: {str(e)}",
                details={"operation": "get_members", "group_id": group_id}
            ) from e

    async def is_admin(self, user_id: int, group_id: int) -> bool:
        """
        Check if a user is an admin of a group.

        Args:
            user_id: User ID
            group_id: Group ID

        Returns:
            True if user is admin, False otherwise
        """
        try:
            result = await self.session.execute(
                select(UserGroupMembership).where(
                    UserGroupMembership.user_id == user_id,
                    UserGroupMembership.group_id == group_id,
                    UserGroupMembership.role == "admin"
                )
            )
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.error(
                "Failed to check group admin status",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "group_id": group_id,
                    "operation": "is_admin"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to check admin status: {str(e)}",
                details={"operation": "is_admin", "user_id": user_id, "group_id": group_id}
            ) from e

    async def update_member_role(
        self,
        user_id: int,
        group_id: int,
        role: str
    ) -> UserGroupMembership:
        """
        Update a member's role in a group.

        Args:
            user_id: User ID
            group_id: Group ID
            role: New role ("member" or "admin")

        Returns:
            Updated membership

        Raises:
            ValidationError: If role is invalid
            ResourceNotFoundError: If membership not found
            DatabaseError: If database operation fails
        """
        # Validate role
        if role not in ("member", "admin"):
            raise ValidationError(
                f"Invalid role: {role}. Must be 'member' or 'admin'",
                code="INVALID_ROLE",
                details={"role": role}
            )

        try:
            result = await self.session.execute(
                select(UserGroupMembership).where(
                    UserGroupMembership.user_id == user_id,
                    UserGroupMembership.group_id == group_id
                )
            )
            membership = result.scalar_one_or_none()

            if not membership:
                raise ResourceNotFoundError(
                    f"Membership not found for user {user_id} in group {group_id}",
                    code="MEMBERSHIP_NOT_FOUND",
                    details={"user_id": user_id, "group_id": group_id}
                )

            membership.role = role
            await self.session.flush()

            logger.info(
                "Member role updated",
                extra={
                    "user_id": user_id,
                    "group_id": group_id,
                    "role": role,
                    "operation": "update_member_role"
                }
            )

            return membership
        except (ValidationError, ResourceNotFoundError):
            raise
        except Exception as e:
            logger.error(
                "Failed to update member role",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "group_id": group_id,
                    "operation": "update_member_role"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to update member role: {str(e)}",
                details={"operation": "update_member_role", "user_id": user_id, "group_id": group_id}
            ) from e

    async def get_user_group_ids(self, user_id: int) -> list[int]:
        """
        Get all group IDs a user belongs to (for efficient filtering).

        Args:
            user_id: User ID

        Returns:
            List of group IDs
        """
        try:
            result = await self.session.execute(
                select(UserGroupMembership.group_id).where(
                    UserGroupMembership.user_id == user_id
                )
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(
                "Failed to fetch user group IDs",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "operation": "get_user_group_ids"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to fetch user group IDs: {str(e)}",
                details={"operation": "get_user_group_ids", "user_id": user_id}
            ) from e

    async def can_user_access_document(
        self,
        user_id: int,
        document_id: int
    ) -> bool:
        """
        Check if a user can access a document based on ownership or group membership.

        Args:
            user_id: User ID
            document_id: Document ID

        Returns:
            True if user can access document, False otherwise
        """
        try:
            # Get the document
            result = await self.session.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()

            if not document:
                return False

            # User owns the document
            if document.user_id == user_id:
                return True

            # Document is private - only owner can access
            if document.is_private:
                return False

            # Document belongs to a group - check if user is a member
            if document.group_id:
                membership_result = await self.session.execute(
                    select(UserGroupMembership).where(
                        UserGroupMembership.user_id == user_id,
                        UserGroupMembership.group_id == document.group_id
                    )
                )
                return membership_result.scalar_one_or_none() is not None

            # Document has no group and is not private - not accessible
            return False
        except Exception as e:
            logger.error(
                "Failed to check document access",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "user_id": user_id,
                    "document_id": document_id,
                    "operation": "can_user_access_document"
                },
                exc_info=True
            )
            raise DatabaseError(
                f"Failed to check document access: {str(e)}",
                details={"operation": "can_user_access_document", "user_id": user_id, "document_id": document_id}
            ) from e
