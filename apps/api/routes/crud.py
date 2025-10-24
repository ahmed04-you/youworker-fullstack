"""
CRUD-related API endpoints.
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Depends, Query
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.auth.security import get_current_active_user
from packages.db import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")
limiter = Limiter(key_func=get_remote_address)


async def _get_current_user(current_user=Depends(get_current_active_user)):
    """Get current authenticated user."""
    user = current_user
    # Ensure root has access to default collection
    try:
        from packages.vectorstore.schema import DEFAULT_COLLECTION
        from packages.db.crud import grant_user_collection_access
        async with get_async_session() as db:
            await grant_user_collection_access(db, user_id=user.id, collection_name=DEFAULT_COLLECTION)
    except (AttributeError, ImportError, ValueError) as e:
        logger.debug(f"Could not grant default collection access: {e}")
        pass
    return {"id": user.id, "username": user.username, "is_root": user.is_root}


# ==================== SESSION ENDPOINTS ====================


@router.get("/sessions")
async def list_sessions(
    current_user=Depends(_get_current_user), 
    limit: int = Query(default=50, le=100)
):
    """List user's chat sessions."""
    async with get_async_session() as db:
        from packages.db.crud import get_user_sessions
        sessions = await get_user_sessions(db, user_id=current_user["id"], limit=limit)
        return {
            "sessions": [
                {
                    "id": s.id,
                    "external_id": s.external_id,
                    "title": s.title,
                    "model": s.model,
                    "enable_tools": s.enable_tools,
                    "created_at": s.created_at.isoformat(),
                    "updated_at": s.updated_at.isoformat(),
                }
                for s in sessions
            ]
        }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int, 
    current_user=Depends(_get_current_user)
):
    """Get a specific chat session with all messages."""
    async with get_async_session() as db:
        from packages.db.crud import get_session_with_messages
        session = await get_session_with_messages(db, session_id=session_id, user_id=current_user["id"])
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "session": {
                "id": session.id,
                "external_id": session.external_id,
                "title": session.title,
                "model": session.model,
                "enable_tools": session.enable_tools,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat(),
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "content": m.content,
                        "tool_call_name": m.tool_call_name,
                        "tool_call_id": m.tool_call_id,
                        "created_at": m.created_at.isoformat(),
                    }
                    for m in session.messages
                ],
            }
        }


@router.delete("/sessions/{session_id}")
async def delete_session_endpoint(
    session_id: int, 
    current_user=Depends(_get_current_user)
):
    """Delete a chat session and all its messages."""
    async with get_async_session() as db:
        from packages.db.crud import delete_session
        success = await delete_session(db, session_id=session_id, user_id=current_user["id"])
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        await db.commit()
        return {"success": True}


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: int, 
    title: str = Query(...), 
    current_user=Depends(_get_current_user)
):
    """Update a chat session's title."""
    async with get_async_session() as db:
        from packages.db.crud import update_session_title
        success = await update_session_title(db, session_id=session_id, user_id=current_user["id"], title=title)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        await db.commit()
        return {"success": True}


# ==================== DOCUMENT ENDPOINTS ====================


@router.get("/documents")
async def list_documents(
    current_user=Depends(_get_current_user),
    collection: str | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """List ingested documents."""
    async with get_async_session() as db:
        from packages.db.crud import get_user_documents
        documents = await get_user_documents(
            db,
            user_id=current_user["id"],
            collection=collection,
            limit=limit,
            offset=offset,
        )
        return {
            "documents": [
                {
                    "id": d.id,
                    "uri": d.uri,
                    "path": d.path,
                    "mime": d.mime,
                    "bytes_size": d.bytes_size,
                    "source": d.source,
                    "tags": d.tags,
                    "collection": d.collection,
                    "path_hash": d.path_hash,
                    "created_at": d.created_at.isoformat(),
                    "last_ingested_at": d.last_ingested_at.isoformat() if d.last_ingested_at else None,
                }
                for d in documents
            ],
            "total": len(documents),
        }


@router.delete("/documents/{document_id}")
async def delete_document_endpoint(
    document_id: int, 
    current_user=Depends(_get_current_user)
):
    """Delete a document from the catalog.

    Note: This only removes the metadata. Vector data in Qdrant must be deleted separately.
    """
    async with get_async_session() as db:
        from packages.db.crud import delete_document
        success = await delete_document(db, document_id=document_id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        await db.commit()
        return {"success": True}


# ==================== INGESTION RUN ENDPOINTS ====================


@router.get("/ingestion-runs")
async def list_ingestion_runs(
    current_user=Depends(_get_current_user),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List ingestion run history."""
    async with get_async_session() as db:
        from packages.db.crud import get_user_ingestion_runs
        runs = await get_user_ingestion_runs(
            db,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
        )
        return {
            "runs": [
                {
                    "id": r.id,
                    "target": r.target,
                    "from_web": r.from_web,
                    "recursive": r.recursive,
                    "tags": r.tags,
                    "collection": r.collection,
                    "totals_files": r.totals_files,
                    "totals_chunks": r.totals_chunks,
                    "errors": r.errors,
                    "started_at": r.started_at.isoformat(),
                    "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                    "status": r.status,
                }
                for r in runs
            ],
            "total": len(runs),
        }


@router.delete("/ingestion-runs/{run_id}")
async def delete_ingestion_run_endpoint(
    run_id: int, 
    current_user=Depends(_get_current_user)
):
    """Delete an ingestion run record."""
    async with get_async_session() as db:
        from packages.db.crud import delete_ingestion_run
        success = await delete_ingestion_run(db, run_id=run_id, user_id=current_user["id"])
        if not success:
            raise HTTPException(status_code=404, detail="Ingestion run not found")
        await db.commit()
        return {"success": True}


# ==================== TOOL RUN ENDPOINTS ====================


@router.get("/tool-runs")
async def list_tool_runs(
    current_user=Depends(_get_current_user),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """List tool execution logs."""
    async with get_async_session() as db:
        from packages.db.crud import get_user_tool_runs
        runs = await get_user_tool_runs(
            db,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
        )
        return {
            "runs": [
                {
                    "id": r.id,
                    "tool_name": r.tool_name,
                    "status": r.status,
                    "start_ts": r.start_ts.isoformat(),
                    "end_ts": r.end_ts.isoformat() if r.end_ts else None,
                    "latency_ms": r.latency_ms,
                    "args": r.args,
                    "error_message": r.error_message,
                    "result_preview": r.result_preview,
                }
                for r in runs
            ],
            "total": len(runs),
        }