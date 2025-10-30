"""Account management endpoints surfaced in the settings page."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

from apps.api.dependencies import get_account_service
from apps.api.routes.deps import get_current_user_with_collection_access
from apps.api.services import AccountService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/account", tags=["account"])


@router.post("/api-key/rotate", status_code=status.HTTP_200_OK)
async def rotate_api_key(
    current_user=Depends(get_current_user_with_collection_access),
    service: AccountService = Depends(get_account_service)
):
    """
    Generate a new API key for the authenticated user.

    Errors are handled by global exception handler.
    """
    new_key = await service.regenerate_api_key(current_user.id)
    return {"api_key": new_key}


@router.delete("/history", status_code=status.HTTP_200_OK)
async def purge_history(
    current_user=Depends(get_current_user_with_collection_access),
    service: AccountService = Depends(get_account_service)
):
    """
    Delete all chat sessions (and cascaded messages) for the current user.
    """
    summary = await service.clear_history(current_user.id)
    return summary


@router.get("/export", response_class=StreamingResponse)
async def export_account(
    current_user=Depends(get_current_user_with_collection_access),
    service: AccountService = Depends(get_account_service)
):
    """
    Return a downloadable JSON export containing the user's data.

    Includes:
    - User profile
    - Chat sessions and messages
    - Documents
    - Ingestion runs
    - Tool runs
    """
    snapshot = await service.export_snapshot(current_user.id)

    payload = jsonable_encoder(snapshot)
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"youworker-export-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"

    response = StreamingResponse(iter([content]), media_type="application/json")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_account(
    current_user=Depends(get_current_user_with_collection_access),
    service: AccountService = Depends(get_account_service)
):
    """
    Delete the authenticated user and cascade to related resources.

    This action is permanent and cannot be undone.
    """
    await service.delete_account(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
