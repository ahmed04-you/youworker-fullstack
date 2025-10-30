"""
Ingestion-related API endpoints.
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.routes.deps import get_ingestion_service, get_current_user_with_collection_access
from apps.api.services import IngestionService


def _get_user_id(user) -> int:
    if isinstance(user, dict):
        value = user.get("id")
    else:
        value = getattr(user, "id", None)
    if value is None:
        raise ValueError("Authenticated user missing id")
    return int(value)

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
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    """
    Document ingestion endpoint.

    Accepts local paths or URLs, parses with Docling, and upserts to Qdrant.
    """
    logger.info("Ingestion request received")

    try:
        # Delegate to service layer
        result = await ingestion_service.ingest_path(
            user_id=_get_user_id(current_user),
            path_or_url=ingest_request.path_or_url,
            from_web=ingest_request.from_web,
            recursive=ingest_request.recursive,
            tags=ingest_request.tags,
        )

        # Return formatted response
        return result.to_dict()

    except ValueError as e:
        # Validation errors (400)
        logger.warning(
            "Ingestion validation failed",
            extra={
                "error": str(e),
                "path": ingest_request.path_or_url,
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        # Runtime errors (500)
        logger.error(
            "Ingestion failed",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "path": ingest_request.path_or_url,
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        # Unexpected errors (500)
        logger.error(
            "Unexpected ingestion error",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "path": ingest_request.path_or_url,
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/ingest/upload")
async def ingest_upload_endpoint(
    request: Request,
    files: list[UploadFile] = File(...),
    tags: list[str] | None = Form(default=None),
    current_user=Depends(get_current_user_with_collection_access),
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    """Upload files, save them to a fixed directory, and ingest them.

    Files are stored under a per-request folder inside the upload root directory.

    Note: Rate limiting for file uploads should be configured at the reverse proxy level
    due to compatibility issues with multipart/form-data endpoints.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    try:
        # Delegate to service layer
        result = await ingestion_service.ingest_uploaded_files(
            user_id=_get_user_id(current_user),
            files=files,
            tags=tags,
        )

        # Return formatted response
        return result.to_dict()

    except ValueError as e:
        # Validation errors (400)
        logger.warning(
            "Upload validation failed",
            extra={
                "error": str(e),
                "file_count": len(files),
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        # Runtime errors (500)
        logger.error(
            "Upload ingestion failed",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "file_count": len(files),
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        # Unexpected errors (500)
        logger.error(
            "Unexpected upload error",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "file_count": len(files),
                "user_id": _get_user_id(current_user),
            },
        )
        raise HTTPException(status_code=500, detail="Internal server error")
