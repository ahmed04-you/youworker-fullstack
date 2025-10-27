"""
Ingestion-related API endpoints.
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.auth.security import sanitize_input
from apps.api.routes.deps import get_ingestion_pipeline, get_current_user_with_collection_access
from packages.db import get_async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")
limiter = Limiter(key_func=get_remote_address)


# Request/Response models
class IngestRequest(BaseModel):
    """Ingestion request model."""

    path_or_url: str
    from_web: bool = False
    recursive: bool = False
    tags: list[str] | None = None
    use_examples_dir: bool = False


class IngestResponse(BaseModel):
    """Ingestion response model."""

    files_processed: int
    chunks_written: int
    files: list[dict[str, Any]] = []
    errors: list[str] | None = None


@router.post("/ingest")
@limiter.limit("10/minute")
async def ingest_endpoint(
    ingest_request: IngestRequest,
    request: Request,
    current_user=Depends(get_current_user_with_collection_access),
    ingestion_pipeline=Depends(get_ingestion_pipeline),
):
    """
    Document ingestion endpoint.

    Accepts local paths or URLs, parses with Docling, and upserts to Qdrant.
    """
    logger.info("Ingestion request received")

    try:
        target = sanitize_input(ingest_request.path_or_url, max_length=2048)
        from_web = ingest_request.from_web
        recursive = ingest_request.recursive
        sanitized_tags: list[str] = []
        for tag in ingest_request.tags or []:
            cleaned = sanitize_input(tag, max_length=128)
            if cleaned:
                sanitized_tags.append(cleaned)

        logger.info("Ingestion request: path=%s, tags=%s", target, sanitized_tags)

        # Allow ingesting the pre-approved uploads directory without exposing filesystem paths in the UI
        if ingest_request.use_examples_dir:
            target = settings.ingest_upload_root
            from_web = False
            recursive = True
        elif not from_web:
            # Validate local paths to prevent path traversal attacks
            try:
                # Resolve the path and ensure it doesn't escape allowed directories
                resolved_path = Path(target).resolve()
                upload_root = Path(settings.ingest_upload_root).resolve()

                # Check if path is within the upload directory
                if not (resolved_path == upload_root or upload_root in resolved_path.parents):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Path must be within allowed directory: {settings.ingest_upload_root}",
                    )
            except (ValueError, OSError) as e:
                raise HTTPException(status_code=400, detail=f"Invalid path: {e}")

        # Ingest from web or local path
        result = await ingestion_pipeline.ingest_path(
            target,
            recursive=recursive,
            from_web=from_web,
            tags=sanitized_tags,
        )

        error_messages = [
            f"{err.get('target')}: {err.get('error')}" if isinstance(err, dict) else str(err)
            for err in (result.errors or [])
        ]

        # Persist ingestion run + documents
        try:
            from packages.db.crud import record_ingestion_run, upsert_document

            started_at = datetime.now().astimezone()
            finished_at = datetime.now().astimezone()
            async with get_async_session() as db:
                await record_ingestion_run(
                    db,
                    user_id=current_user["id"],
                    target=ingest_request.path_or_url,
                    from_web=ingest_request.from_web,
                    recursive=ingest_request.recursive,
                    tags=ingest_request.tags or [],
                    collection=None,
                    totals_files=result.total_files,
                    totals_chunks=result.total_chunks,
                    errors=error_messages or [],
                    started_at=started_at,
                    finished_at=finished_at,
                    status="success" if not error_messages else "partial",
                )
                for f in result.files or []:
                    uri = f.get("uri")
                    path = f.get("path")
                    basis = uri or path or ""
                    ph = hashlib.sha256(basis.encode("utf-8")).hexdigest() if basis else None
                    await upsert_document(
                        db,
                        path_hash=ph or "",
                        uri=uri,
                        path=path,
                        mime=f.get("mime"),
                        bytes_size=f.get("size_bytes"),
                        source="web" if ingest_request.from_web else "file",
                        tags=sanitized_tags,
                        collection=None,
                    )
        except (ValueError, TypeError, OSError) as persist_exc:
            logger.error(f"Failed to persist ingestion run: {persist_exc}")

        return {
            "success": not error_messages,
            "files_processed": result.total_files,
            "chunks_written": result.total_chunks,
            "totals": {
                "files": result.total_files,
                "chunks": result.total_chunks,
                "total_bytes": sum(f.get("size_bytes", 0) for f in (result.files or [])),
            },
            "files": [dict(file) for file in (result.files or [])],
            "errors": error_messages or [],
        }

    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/upload")
async def ingest_upload_endpoint(
    request: Request,
    files: list[UploadFile] = File(...),
    tags: list[str] | None = Form(default=None),
    current_user=Depends(get_current_user_with_collection_access),
    ingestion_pipeline=Depends(get_ingestion_pipeline),
):
    """Upload files, save them to a fixed directory, and ingest them.

    Files are stored under a per-request folder inside `settings.ingest_upload_root`.

    Note: Rate limiting for file uploads should be configured at the reverse proxy level
    due to compatibility issues with multipart/form-data endpoints.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # Validate MIME types and sizes (<100MB per file)
    allowed_mimes = {
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "image/png",
        "image/jpeg",
        "audio/mpeg",
        "audio/wav",
    }
    max_size_bytes = 100 * 1024 * 1024  # 100MB

    valid_files = []
    for f in files:
        if f.content_type not in allowed_mimes:
            logger.warning(f"Rejected file {f.filename} with invalid MIME type: {f.content_type}")
            continue

        # Check size if available
        if f.size and f.size > max_size_bytes:
            logger.warning(f"Rejected file {f.filename}: size {f.size} exceeds {max_size_bytes}")
            continue

        valid_files.append(f)

    if not valid_files:
        raise HTTPException(
            status_code=400,
            detail="No valid files provided. Supported types: PDF, text, CSV, JSON, PNG, JPEG, MP3, WAV. Max size: 100MB per file.",
        )

    sanitized_tags: list[str] = []
    for tag in tags or []:
        cleaned = sanitize_input(tag, max_length=128)
        if cleaned:
            sanitized_tags.append(cleaned)

    # Create per-request directory inside the upload root
    run_dir = Path(settings.ingest_upload_root) / f"run-{uuid.uuid4().hex}"
    try:
        run_dir.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create upload directory: {exc}")

    saved_paths: list[Path] = []
    for f in valid_files:
        try:
            # Sanitize filename (very basic)
            name = os.path.basename(f.filename or "uploaded-file")
            if not name:
                name = f"file-{uuid.uuid4().hex}"
            target_path = run_dir / name
            # Ensure unique filename
            counter = 1
            while target_path.exists():
                stem = target_path.stem
                suffix = target_path.suffix
                target_path = run_dir / f"{stem}-{counter}{suffix}"
                counter += 1

            with open(target_path, "wb") as out:
                while True:
                    chunk = await f.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            await f.close()
            saved_paths.append(target_path)
        except Exception as exc:
            # Best-effort cleanup for this file, proceed with others
            try:
                await f.close()
            except Exception:
                pass
            # Collect partial error response
            return {
                "success": False,
                "totals": {"files": 0, "chunks": 0, "total_bytes": 0},
                "files": [],
                "errors": [f"Failed to save file {f.filename}: {exc}"],
            }

    # Ingest the per-request directory (limited scope, avoids reprocessing other uploads)
    try:
        result = await ingestion_pipeline.ingest_path(
            str(run_dir),
            recursive=False,
            from_web=False,
            tags=sanitized_tags,
        )

        error_messages = [
            (
                f"{err.get('path') or err.get('target')}: {err.get('error')}"
                if isinstance(err, dict)
                else str(err)
            )
            for err in (result.errors or [])
        ]

        # Persist ingestion run + documents
        try:
            from packages.db.crud import record_ingestion_run, upsert_document

            started_at = datetime.now().astimezone()
            finished_at = datetime.now().astimezone()
            async with get_async_session() as db:
                await record_ingestion_run(
                    db,
                    user_id=current_user["id"],
                    target=str(run_dir),
                    from_web=False,
                    recursive=False,
                    tags=sanitized_tags,
                    collection=None,
                    totals_files=result.total_files,
                    totals_chunks=result.total_chunks,
                    errors=error_messages or [],
                    started_at=started_at,
                    finished_at=finished_at,
                    status="success" if not error_messages else "partial",
                )
                for f in result.files or []:
                    uri = f.get("uri")
                    path = f.get("path")
                    basis = uri or path or ""
                    ph = hashlib.sha256(basis.encode("utf-8")).hexdigest() if basis else None
                    await upsert_document(
                        db,
                        path_hash=ph or "",
                        uri=uri,
                        path=path,
                        mime=f.get("mime"),
                        bytes_size=f.get("size_bytes"),
                        source="file",
                        tags=sanitized_tags,
                        collection=None,
                    )
        except (ValueError, TypeError, OSError) as persist_exc:
            logger.error(f"Failed to persist upload ingestion run: {persist_exc}")

        return {
            "success": not error_messages,
            "files_processed": result.total_files,
            "chunks_written": result.total_chunks,
            "totals": {
                "files": result.total_files,
                "chunks": result.total_chunks,
                "total_bytes": sum(f.get("size_bytes", 0) for f in (result.files or [])),
            },
            "files": [dict(file) for file in (result.files or [])],
            "errors": error_messages or [],
        }
    except Exception as e:
        logger.error(f"Upload ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
