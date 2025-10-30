"""Group management service."""

from __future__ import annotations

import logging
from datetime import datetime

from packages.common.exceptions import (
    AuthorizationError,
    ResourceNotFoundError,
    ValidationError,
)
from packages.db.repositories import GroupRepository, UserRepository

logger = logging.getLogger(__name__)


class GroupService:
    """Business logic for group management."""

    def __init__(
        self,
        group_repo: GroupRepository,
        user_repo: UserRepository
    ):
        """
        Initialize group service.

        Args:
            group_repo: Group repository
            user_repo: User repository
        """
        self.group_repo = group_repo
        self.user_repo = user_repo

    async def create_group(
        self,
        name: str,
        description: str | None,
        creator_user_id: int
    ) -> dict:
        """
        Create a new group with the creator as admin.

        Args:
            name: Group name
            description: Group description (optional)
            creator_user_id: User ID of the creator

        Returns:
            Group response data

        Raises:
            ValidationError: If group name already exists
        """
        # Verify user exists
        user = await self.user_repo.get_by_id(creator_user_id)
        if not user:
            raise ResourceNotFoundError(
                f"User not found: {creator_user_id}",
                code="USER_NOT_FOUND"
            )

        # Create group with creator as admin
        group = await self.group_repo.create_with_creator(
            name=name,
            description=description,
            creator_user_id=creator_user_id
        )
        await self.group_repo.commit()

        # Fetch group with members
        group = await self.group_repo.get_by_id_with_members(group.id)

        logger.info(
            "Group created",
            extra={
                "group_id": group.id,
                "group_name": name,
                "creator_user_id": creator_user_id
            }
        )

        return self._to_response(group)

    async def get_group(self, group_id: int, user_id: int) -> dict:
        """
        Get group details with members.

        Args:
            group_id: Group ID
            user_id: User ID (for authorization check)

        Returns:
            Group response data with members

        Raises:
            ResourceNotFoundError: If group not found
            AuthorizationError: If user is not a member
        """
        group = await self.group_repo.get_by_id_with_members(group_id)
        if not group:
            raise ResourceNotFoundError(
                f"Group not found: {group_id}",
                code="GROUP_NOT_FOUND"
            )

        # Check if user is a member
        is_member = any(m.user_id == user_id for m in group.members)
        if not is_member:
            raise AuthorizationError(
                "User is not a member of this group",
                code="NOT_GROUP_MEMBER"
            )

        return self._to_response_with_members(group)

    async def update_group(
        self,
        group_id: int,
        user_id: int,
        name: str | None,
        description: str | None
    ) -> dict:
        """
        Update group details.

        Args:
            group_id: Group ID
            user_id: User ID (must be admin)
            name: New group name (optional)
            description: New group description (optional)

        Returns:
            Updated group response data

        Raises:
            ResourceNotFoundError: If group not found
            AuthorizationError: If user is not admin
            ValidationError: If new name already exists
        """
        # Check admin permission
        is_admin = await self.group_repo.is_admin(user_id, group_id)
        if not is_admin:
            raise AuthorizationError(
                "Only group admins can update group details",
                code="NOT_GROUP_ADMIN"
            )

        # Update group
        group = await self.group_repo.update_group(
            group_id=group_id,
            name=name,
            description=description
        )
        await self.group_repo.commit()

        # Fetch with members
        group = await self.group_repo.get_by_id_with_members(group.id)

        logger.info(
            "Group updated",
            extra={
                "group_id": group_id,
                "user_id": user_id
            }
        )

        return self._to_response(group)

    async def delete_group(self, group_id: int, user_id: int) -> bool:
        """
        Delete a group.

        Args:
            group_id: Group ID
            user_id: User ID (must be admin)

        Returns:
            True if deleted

        Raises:
            ResourceNotFoundError: If group not found
            AuthorizationError: If user is not admin
        """
        # Check admin permission
        is_admin = await self.group_repo.is_admin(user_id, group_id)
        if not is_admin:
            raise AuthorizationError(
                "Only group admins can delete the group",
                code="NOT_GROUP_ADMIN"
            )

        # Delete group
        deleted = await self.group_repo.delete_group(group_id)
        if not deleted:
            raise ResourceNotFoundError(
                f"Group not found: {group_id}",
                code="GROUP_NOT_FOUND"
            )

        await self.group_repo.commit()

        logger.info(
            "Group deleted",
            extra={
                "group_id": group_id,
                "user_id": user_id
            }
        )

        return True

    async def add_member(
        self,
        group_id: int,
        user_id_to_add: int,
        role: str,
        requester_user_id: int
    ) -> dict:
        """
        Add a member to a group.

        Args:
            group_id: Group ID
            user_id_to_add: User ID to add
            role: Role ("member" or "admin")
            requester_user_id: User ID making the request (must be admin)

        Returns:
            Member response data

        Raises:
            ResourceNotFoundError: If group or user not found
            AuthorizationError: If requester is not admin
            ValidationError: If user is already a member
        """
        # Check admin permission
        is_admin = await self.group_repo.is_admin(requester_user_id, group_id)
        if not is_admin:
            raise AuthorizationError(
                "Only group admins can add members",
                code="NOT_GROUP_ADMIN"
            )

        # Verify user exists
        user = await self.user_repo.get_by_id(user_id_to_add)
        if not user:
            raise ResourceNotFoundError(
                f"User not found: {user_id_to_add}",
                code="USER_NOT_FOUND"
            )

        # Add member
        membership = await self.group_repo.add_member(
            user_id=user_id_to_add,
            group_id=group_id,
            role=role
        )
        await self.group_repo.commit()

        logger.info(
            "Member added to group",
            extra={
                "group_id": group_id,
                "user_id": user_id_to_add,
                "role": role,
                "requester_user_id": requester_user_id
            }
        )

        return {
            "user_id": membership.user_id,
            "username": user.username,
            "role": membership.role,
            "joined_at": membership.joined_at.isoformat()
        }

    async def remove_member(
        self,
        group_id: int,
        user_id_to_remove: int,
        requester_user_id: int
    ) -> bool:
        """
        Remove a member from a group.

        Args:
            group_id: Group ID
            user_id_to_remove: User ID to remove
            requester_user_id: User ID making the request (must be admin)

        Returns:
            True if removed

        Raises:
            ResourceNotFoundError: If group not found
            AuthorizationError: If requester is not admin
            ValidationError: If trying to remove the last admin
        """
        # Check admin permission
        is_admin = await self.group_repo.is_admin(requester_user_id, group_id)
        if not is_admin:
            raise AuthorizationError(
                "Only group admins can remove members",
                code="NOT_GROUP_ADMIN"
            )

        # Check if removing an admin - ensure at least one admin remains
        is_removing_admin = await self.group_repo.is_admin(
            user_id_to_remove,
            group_id
        )
        if is_removing_admin:
            members = await self.group_repo.get_members(group_id)
            admin_count = sum(1 for m in members if m.role == "admin")
            if admin_count <= 1:
                raise ValidationError(
                    "Cannot remove the last admin from the group",
                    code="LAST_ADMIN"
                )

        # Remove member
        removed = await self.group_repo.remove_member(user_id_to_remove, group_id)
        if not removed:
            raise ResourceNotFoundError(
                "Membership not found",
                code="MEMBERSHIP_NOT_FOUND"
            )

        await self.group_repo.commit()

        logger.info(
            "Member removed from group",
            extra={
                "group_id": group_id,
                "user_id": user_id_to_remove,
                "requester_user_id": requester_user_id
            }
        )

        return True

    async def update_member_role(
        self,
        group_id: int,
        user_id_to_update: int,
        role: str,
        requester_user_id: int
    ) -> dict:
        """
        Update a member's role.

        Args:
            group_id: Group ID
            user_id_to_update: User ID to update
            role: New role ("member" or "admin")
            requester_user_id: User ID making the request (must be admin)

        Returns:
            Updated member response data

        Raises:
            ResourceNotFoundError: If group or membership not found
            AuthorizationError: If requester is not admin
            ValidationError: If trying to demote the last admin
        """
        # Check admin permission
        is_admin = await self.group_repo.is_admin(requester_user_id, group_id)
        if not is_admin:
            raise AuthorizationError(
                "Only group admins can update member roles",
                code="NOT_GROUP_ADMIN"
            )

        # Check if demoting an admin to member - ensure at least one admin remains
        if role == "member":
            is_currently_admin = await self.group_repo.is_admin(
                user_id_to_update,
                group_id
            )
            if is_currently_admin:
                members = await self.group_repo.get_members(group_id)
                admin_count = sum(1 for m in members if m.role == "admin")
                if admin_count <= 1:
                    raise ValidationError(
                        "Cannot demote the last admin",
                        code="LAST_ADMIN"
                    )

        # Update role
        membership = await self.group_repo.update_member_role(
            user_id=user_id_to_update,
            group_id=group_id,
            role=role
        )
        await self.group_repo.commit()

        # Get user for username
        user = await self.user_repo.get_by_id(user_id_to_update)

        logger.info(
            "Member role updated",
            extra={
                "group_id": group_id,
                "user_id": user_id_to_update,
                "role": role,
                "requester_user_id": requester_user_id
            }
        )

        return {
            "user_id": membership.user_id,
            "username": user.username if user else "unknown",
            "role": membership.role,
            "joined_at": membership.joined_at.isoformat()
        }

    async def get_user_groups(self, user_id: int) -> list[dict]:
        """
        Get all groups a user belongs to.

        Args:
            user_id: User ID

        Returns:
            List of group response data
        """
        groups = await self.group_repo.get_user_groups(user_id)
        return [self._to_response(group) for group in groups]

    async def get_group_members(self, group_id: int, user_id: int) -> list[dict]:
        """
        Get all members of a group.

        Args:
            group_id: Group ID
            user_id: User ID (for authorization check)

        Returns:
            List of member response data

        Raises:
            ResourceNotFoundError: If group not found
            AuthorizationError: If user is not a member
        """
        # Check if user is a member
        members = await self.group_repo.get_members(group_id)
        is_member = any(m.user_id == user_id for m in members)
        if not is_member:
            raise AuthorizationError(
                "User is not a member of this group",
                code="NOT_GROUP_MEMBER"
            )

        return [
            {
                "user_id": m.user_id,
                "username": m.user.username if m.user else "unknown",
                "role": m.role,
                "joined_at": m.joined_at.isoformat()
            }
            for m in members
        ]

    def _to_response(self, group) -> dict:
        """Convert group model to response dict."""
        return {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "created_at": group.created_at.isoformat(),
            "updated_at": group.updated_at.isoformat(),
            "member_count": len(group.members) if hasattr(group, "members") else 0
        }

    def _to_response_with_members(self, group) -> dict:
        """Convert group model to response dict with members."""
        response = self._to_response(group)
        response["members"] = [
            {
                "user_id": m.user_id,
                "username": m.user.username if m.user else "unknown",
                "role": m.role,
                "joined_at": m.joined_at.isoformat()
            }
            for m in group.members
        ]
        return response
