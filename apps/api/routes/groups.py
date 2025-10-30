"""Group management endpoints for multi-tenancy and team collaboration."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from apps.api.routes.deps import get_current_user_with_collection_access
from packages.db import (
    create_group,
    get_group_by_id,
    update_group,
    delete_group,
    add_user_to_group,
    remove_user_from_group,
    get_user_groups,
    get_group_members,
    is_group_admin,
    update_member_role,
    get_async_session,
)
from packages.common.exceptions import ResourceNotFoundError, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/groups", tags=["groups"])


# ==================== REQUEST/RESPONSE MODELS ====================


class CreateGroupRequest(BaseModel):
    """Request model for creating a group."""
    name: str = Field(..., min_length=1, max_length=128, description="Group name")
    description: str | None = Field(None, max_length=500, description="Group description")


class UpdateGroupRequest(BaseModel):
    """Request model for updating a group."""
    name: str | None = Field(None, min_length=1, max_length=128, description="New group name")
    description: str | None = Field(None, max_length=500, description="New group description")


class AddMemberRequest(BaseModel):
    """Request model for adding a member to a group."""
    user_id: int = Field(..., gt=0, description="User ID to add")
    role: str = Field("member", pattern="^(member|admin)$", description="User role in the group")


class UpdateMemberRoleRequest(BaseModel):
    """Request model for updating a member's role."""
    role: str = Field(..., pattern="^(member|admin)$", description="New role for the member")


class GroupResponse(BaseModel):
    """Response model for a group."""
    id: int
    name: str
    description: str | None
    created_at: str
    updated_at: str
    member_count: int = 0


class MemberResponse(BaseModel):
    """Response model for a group member."""
    user_id: int
    username: str
    role: str
    joined_at: str


class GroupWithMembersResponse(GroupResponse):
    """Response model for a group with its members."""
    members: list[MemberResponse]


# ==================== ENDPOINTS ====================


@router.post("", status_code=status.HTTP_201_CREATED, response_model=GroupResponse)
async def create_new_group(
    request: CreateGroupRequest,
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Create a new group. The creator is automatically added as an admin.
    """
    try:
        async with get_async_session() as db:
            group = await create_group(
                db,
                name=request.name,
                description=request.description,
                creator_user_id=current_user.id
            )
            await db.commit()

            # Reload to get member count
            group = await get_group_by_id(db, group.id)

        logger.info(
            "Group created",
            extra={
                "group_id": group.id,
                "group_name": group.name,
                "creator_user_id": current_user.id,
                "operation": "create_group"
            }
        )

        return GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            created_at=group.created_at.isoformat(),
            updated_at=group.updated_at.isoformat(),
            member_count=len(group.members) if group.members else 0
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to create group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create group"
        )


@router.get("/me", response_model=list[GroupResponse])
async def list_user_groups(current_user=Depends(get_current_user_with_collection_access)):
    """
    List all groups the current user belongs to.
    """
    try:
        async with get_async_session() as db:
            groups = await get_user_groups(db, current_user.id)

        logger.info(
            "Listed user groups",
            extra={
                "user_id": current_user.id,
                "group_count": len(groups),
                "operation": "list_user_groups"
            }
        )

        return [
            GroupResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                created_at=group.created_at.isoformat(),
                updated_at=group.updated_at.isoformat(),
                member_count=len(group.members) if hasattr(group, 'members') and group.members else 0
            )
            for group in groups
        ]
    except Exception as e:
        logger.error(
            "Failed to list user groups",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list groups"
        )


@router.get("/{group_id}", response_model=GroupWithMembersResponse)
async def get_group(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Get details of a specific group including its members.
    User must be a member of the group to view it.
    """
    try:
        async with get_async_session() as db:
            group = await get_group_by_id(db, group_id)

            if not group:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Group {group_id} not found"
                )

            # Check if user is a member
            user_groups = await get_user_groups(db, current_user.id)
            if group_id not in [g.id for g in user_groups]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this group"
                )

            members = await get_group_members(db, group_id)

        logger.info(
            "Retrieved group details",
            extra={
                "group_id": group_id,
                "user_id": current_user.id,
                "operation": "get_group"
            }
        )

        return GroupWithMembersResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            created_at=group.created_at.isoformat(),
            updated_at=group.updated_at.isoformat(),
            member_count=len(members),
            members=[
                MemberResponse(
                    user_id=m.user_id,
                    username=m.user.username if hasattr(m, 'user') else f"user_{m.user_id}",
                    role=m.role,
                    joined_at=m.joined_at.isoformat()
                )
                for m in members
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve group"
        )


@router.put("/{group_id}", response_model=GroupResponse)
async def update_existing_group(
    group_id: Annotated[int, Field(gt=0)],
    request: UpdateGroupRequest,
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Update a group's name and/or description.
    Only group admins can update the group.
    """
    try:
        async with get_async_session() as db:
            # Check if user is admin
            if not await is_group_admin(db, current_user.id, group_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group admins can update the group"
                )

            group = await update_group(db, group_id, request.name, request.description)
            await db.commit()

            # Reload to get updated data
            group = await get_group_by_id(db, group_id)

        logger.info(
            "Group updated",
            extra={
                "group_id": group_id,
                "user_id": current_user.id,
                "operation": "update_group"
            }
        )

        return GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            created_at=group.created_at.isoformat(),
            updated_at=group.updated_at.isoformat(),
            member_count=len(group.members) if group.members else 0
        )
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to update group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update group"
        )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_existing_group(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Delete a group. Only group admins can delete the group.
    This will also remove all memberships.
    """
    try:
        async with get_async_session() as db:
            # Check if user is admin
            if not await is_group_admin(db, current_user.id, group_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group admins can delete the group"
                )

            deleted = await delete_group(db, group_id)
            await db.commit()

            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Group {group_id} not found"
                )

        logger.warning(
            "Group deleted",
            extra={
                "group_id": group_id,
                "user_id": current_user.id,
                "operation": "delete_group"
            }
        )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to delete group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete group"
        )


@router.get("/{group_id}/members", response_model=list[MemberResponse])
async def list_group_members(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    List all members of a group.
    User must be a member of the group to view its members.
    """
    try:
        async with get_async_session() as db:
            # Check if user is a member
            user_groups = await get_user_groups(db, current_user.id)
            if group_id not in [g.id for g in user_groups]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this group"
                )

            members = await get_group_members(db, group_id)

        logger.info(
            "Listed group members",
            extra={
                "group_id": group_id,
                "user_id": current_user.id,
                "member_count": len(members),
                "operation": "list_group_members"
            }
        )

        return [
            MemberResponse(
                user_id=m.user_id,
                username=m.user.username if hasattr(m, 'user') else f"user_{m.user_id}",
                role=m.role,
                joined_at=m.joined_at.isoformat()
            )
            for m in members
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to list group members",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list members"
        )


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED, response_model=MemberResponse)
async def add_member_to_group(
    group_id: Annotated[int, Field(gt=0)],
    request: AddMemberRequest,
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Add a member to a group. Only group admins can add members.
    """
    try:
        async with get_async_session() as db:
            # Check if user is admin
            if not await is_group_admin(db, current_user.id, group_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group admins can add members"
                )

            membership = await add_user_to_group(db, request.user_id, group_id, request.role)
            await db.commit()

            # Get username
            await db.refresh(membership, ["user"])

        logger.info(
            "Member added to group",
            extra={
                "group_id": group_id,
                "new_member_user_id": request.user_id,
                "role": request.role,
                "added_by_user_id": current_user.id,
                "operation": "add_member_to_group"
            }
        )

        return MemberResponse(
            user_id=membership.user_id,
            username=membership.user.username if hasattr(membership, 'user') else f"user_{membership.user_id}",
            role=membership.role,
            joined_at=membership.joined_at.isoformat()
        )
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to add member to group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id,
                "new_member_user_id": request.user_id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add member"
        )


@router.put("/{group_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role_endpoint(
    group_id: Annotated[int, Field(gt=0)],
    user_id: Annotated[int, Field(gt=0)],
    request: UpdateMemberRoleRequest,
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Update a member's role in a group. Only group admins can update roles.
    """
    try:
        async with get_async_session() as db:
            # Check if user is admin
            if not await is_group_admin(db, current_user.id, group_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group admins can update member roles"
                )

            membership = await update_member_role(db, user_id, group_id, request.role)
            await db.commit()

            # Get username
            await db.refresh(membership, ["user"])

        logger.info(
            "Member role updated",
            extra={
                "group_id": group_id,
                "member_user_id": user_id,
                "new_role": request.role,
                "updated_by_user_id": current_user.id,
                "operation": "update_member_role"
            }
        )

        return MemberResponse(
            user_id=membership.user_id,
            username=membership.user.username if hasattr(membership, 'user') else f"user_{membership.user_id}",
            role=membership.role,
            joined_at=membership.joined_at.isoformat()
        )
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to update member role",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id,
                "member_user_id": user_id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role"
        )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_member_from_group(
    group_id: Annotated[int, Field(gt=0)],
    user_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access)
):
    """
    Remove a member from a group.
    Group admins can remove any member. Members can remove themselves.
    """
    try:
        async with get_async_session() as db:
            # Check if user is admin or removing themselves
            is_admin = await is_group_admin(db, current_user.id, group_id)
            is_self = user_id == current_user.id

            if not (is_admin or is_self):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group admins can remove other members"
                )

            removed = await remove_user_from_group(db, user_id, group_id)
            await db.commit()

            if not removed:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Membership not found"
                )

        logger.info(
            "Member removed from group",
            extra={
                "group_id": group_id,
                "removed_user_id": user_id,
                "removed_by_user_id": current_user.id,
                "is_self_removal": is_self,
                "operation": "remove_member_from_group"
            }
        )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to remove member from group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "user_id": current_user.id,
                "removed_user_id": user_id
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove member"
        )
