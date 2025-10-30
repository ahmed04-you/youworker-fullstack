"""Account management endpoints surfaced in the settings page."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

from apps.api.routes.deps import get_current_user_with_collection_access
from packages.db import (
    clear_user_history,
    delete_user_account,
    export_user_snapshot,
    get_async_session,
    regenerate_user_api_key,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/account", tags=["account"])


@router.post("/api-key/rotate", status_code=status.HTTP_200_OK)
async def rotate_api_key(current_user=Depends(get_current_user_with_collection_access)):
    """Generate a new API key for the authenticated user."""
    async with get_async_session() as db:
        new_key = await regenerate_user_api_key(db, current_user.id)

    logger.info("api-key-rotated user_id=%s", current_user.id)
    return {"api_key": new_key}


@router.delete("/history", status_code=status.HTTP_200_OK)
async def purge_history(current_user=Depends(get_current_user_with_collection_access)):
    """Delete all chat sessions (and cascaded messages) for the current user."""
    async with get_async_session() as db:
        summary = await clear_user_history(db, current_user.id)

    logger.info(
        "history-cleared user_id=%s sessions=%s messages=%s",
        current_user.id,
        summary["sessions_deleted"],
        summary["messages_deleted"],
    )
    return summary


@router.get("/export", response_class=StreamingResponse)
async def export_account(current_user=Depends(get_current_user_with_collection_access)):
    """Return a downloadable JSON export containing the user's data."""
    async with get_async_session() as db:
        snapshot = await export_user_snapshot(db, current_user.id)

    payload = jsonable_encoder(snapshot)
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"youworker-export-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"

    logger.info("account-export-generated user_id=%s bytes=%s", current_user.id, len(content))

    response = StreamingResponse(iter([content]), media_type="application/json")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_account(current_user=Depends(get_current_user_with_collection_access)):
    """Delete the authenticated user and cascade to related resources."""
    async with get_async_session() as db:
        deleted = await delete_user_account(db, current_user.id)

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    logger.warning("account-deleted user_id=%s", current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
