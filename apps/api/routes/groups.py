"""Group management endpoints for multi-tenancy and team collaboration."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field

from apps.api.dependencies import get_group_service
from apps.api.routes.deps import get_current_user_with_collection_access
from apps.api.services import GroupService

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
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Create a new group. The creator is automatically added as an admin.

    Errors are handled by global exception handler.
    """
    result = await service.create_group(
        name=request.name,
        description=request.description,
        creator_user_id=current_user.id
    )
    return GroupResponse(**result)


@router.get("/me", response_model=list[GroupResponse])
async def list_user_groups(
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    List all groups the current user belongs to.
    """
    groups = await service.get_user_groups(current_user.id)
    return [GroupResponse(**group) for group in groups]


@router.get("/{group_id}", response_model=GroupWithMembersResponse)
async def get_group(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Get details of a specific group including its members.
    User must be a member of the group to view it.
    """
    result = await service.get_group(group_id, current_user.id)
    return GroupWithMembersResponse(**result)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_existing_group(
    group_id: Annotated[int, Field(gt=0)],
    request: UpdateGroupRequest,
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Update a group's name and/or description.
    Only group admins can update the group.
    """
    result = await service.update_group(
        group_id=group_id,
        user_id=current_user.id,
        name=request.name,
        description=request.description
    )
    return GroupResponse(**result)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_existing_group(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Delete a group. Only group admins can delete the group.
    This will also remove all memberships.
    """
    await service.delete_group(group_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{group_id}/members", response_model=list[MemberResponse])
async def list_group_members(
    group_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    List all members of a group.
    User must be a member of the group to view its members.
    """
    members = await service.get_group_members(group_id, current_user.id)
    return [MemberResponse(**member) for member in members]


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED, response_model=MemberResponse)
async def add_member_to_group(
    group_id: Annotated[int, Field(gt=0)],
    request: AddMemberRequest,
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Add a member to a group. Only group admins can add members.
    """
    result = await service.add_member(
        group_id=group_id,
        user_id_to_add=request.user_id,
        role=request.role,
        requester_user_id=current_user.id
    )
    return MemberResponse(**result)


@router.put("/{group_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role_endpoint(
    group_id: Annotated[int, Field(gt=0)],
    user_id: Annotated[int, Field(gt=0)],
    request: UpdateMemberRoleRequest,
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Update a member's role in a group. Only group admins can update roles.
    """
    result = await service.update_member_role(
        group_id=group_id,
        user_id_to_update=user_id,
        role=request.role,
        requester_user_id=current_user.id
    )
    return MemberResponse(**result)


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_member_from_group(
    group_id: Annotated[int, Field(gt=0)],
    user_id: Annotated[int, Field(gt=0)],
    current_user=Depends(get_current_user_with_collection_access),
    service: GroupService = Depends(get_group_service)
):
    """
    Remove a member from a group.
    Group admins can remove any member. Members can remove themselves.
    """
    # Allow self-removal or admin removal
    if user_id == current_user.id:
        # Self-removal - use the service but allow it
        await service.remove_member(
            group_id=group_id,
            user_id_to_remove=user_id,
            requester_user_id=current_user.id
        )
    else:
        # Admin removing another member
        await service.remove_member(
            group_id=group_id,
            user_id_to_remove=user_id,
            requester_user_id=current_user.id
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
