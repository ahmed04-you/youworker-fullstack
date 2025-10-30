"""
CRUD-related API endpoints.

This module has been refactored to use the service layer pattern.
All business logic is now handled by dedicated services:
- SessionService: Manages chat sessions and messages
- DocumentService: Manages document metadata
- AnalyticsService: Manages tool runs and ingestion runs
"""

import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.routes.deps import get_current_user_with_collection_access
from apps.api.dependencies import (
    get_session_service,
    get_document_service,
    get_analytics_service,
)
from apps.api.services import SessionService, DocumentService, AnalyticsService
from packages.common.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")
limiter = Limiter(key_func=get_remote_address)


def _extract_user_id(user) -> int:
    """Return user id supporting ORM model or dict."""
    if hasattr(user, "id"):
        return getattr(user, "id")
    if isinstance(user, dict) and "id" in user:
        return user["id"]
    raise TypeError("Unable to determine user id")


# ==================== SESSION ENDPOINTS ====================


@router.get("/sessions")
async def list_sessions(
    current_user=Depends(get_current_user_with_collection_access),
    limit: int = Query(default=50, le=100),
    session_service: SessionService = Depends(get_session_service),
):
    """List user's chat sessions."""
    user_id = _extract_user_id(current_user)

    sessions = await session_service.list_sessions(
        user_id=user_id,
        limit=limit
    )

    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int,
    current_user=Depends(get_current_user_with_collection_access),
    session_service: SessionService = Depends(get_session_service),
):
    """Get a specific chat session with all messages and tool runs."""
    user_id = _extract_user_id(current_user)

    try:
        session = await session_service.get_session(
            session_id=session_id,
            user_id=user_id
        )
        return {"session": session}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session_endpoint(
    session_id: int,
    current_user=Depends(get_current_user_with_collection_access),
    session_service: SessionService = Depends(get_session_service),
):
    """Delete a chat session and all its messages."""
    user_id = _extract_user_id(current_user)

    try:
        await session_service.delete_session(
            session_id=session_id,
            user_id=user_id
        )
        return {"success": True}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: int,
    title: str = Query(...),
    current_user=Depends(get_current_user_with_collection_access),
    session_service: SessionService = Depends(get_session_service),
):
    """Update a chat session's title."""
    user_id = _extract_user_id(current_user)

    try:
        await session_service.update_session_title(
            session_id=session_id,
            user_id=user_id,
            title=title
        )
        return {"success": True}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== DOCUMENT ENDPOINTS ====================


@router.get("/documents")
async def list_documents(
    current_user=Depends(get_current_user_with_collection_access),
    collection: str | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    document_service: DocumentService = Depends(get_document_service),
):
    """List ingested documents."""
    user_id = _extract_user_id(current_user)

    result = await document_service.list_documents(
        user_id=user_id,
        collection=collection,
        limit=limit,
        offset=offset
    )

    return result


@router.delete("/documents/{document_id}")
async def delete_document_endpoint(
    document_id: int,
    current_user=Depends(get_current_user_with_collection_access),
    document_service: DocumentService = Depends(get_document_service),
):
    """Delete a document from the catalog.

    Note: This only removes the metadata. Vector data in Qdrant must be deleted separately.
    """
    try:
        await document_service.delete_document(document_id=document_id)
        return {"success": True}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== INGESTION RUN ENDPOINTS ====================


@router.get("/ingestion-runs")
async def list_ingestion_runs(
    current_user=Depends(get_current_user_with_collection_access),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    """List ingestion run history."""
    user_id = _extract_user_id(current_user)

    result = await analytics_service.list_ingestion_runs(
        user_id=user_id,
        limit=limit,
        offset=offset
    )

    return result


@router.delete("/ingestion-runs/{run_id}")
async def delete_ingestion_run_endpoint(
    run_id: int,
    current_user=Depends(get_current_user_with_collection_access),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    """Delete an ingestion run record."""
    user_id = _extract_user_id(current_user)

    try:
        await analytics_service.delete_ingestion_run(
            run_id=run_id,
            user_id=user_id
        )
        return {"success": True}
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== TOOL RUN ENDPOINTS ====================


@router.get("/tool-runs")
async def list_tool_runs(
    current_user=Depends(get_current_user_with_collection_access),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    """List tool execution logs."""
    user_id = _extract_user_id(current_user)

    result = await analytics_service.list_tool_runs(
        user_id=user_id,
        limit=limit,
        offset=offset
    )

    return result
