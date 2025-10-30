"""
Ingestion service layer for business logic.

This service encapsulates all business logic for document ingestion operations,
separating concerns from HTTP routing and enabling better testability.
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from apps.api.auth.security import sanitize_input
from packages.ingestion import IngestionPipeline
from packages.db.repositories import DocumentRepository, IngestionRepository

from .base import BaseService

logger = logging.getLogger(__name__)


class IngestPathResult:
    """Result of path ingestion operation."""

    def __init__(
        self,
        success: bool,
        files_processed: int,
        chunks_written: int,
        total_bytes: int,
        files: list[dict[str, Any]],
        errors: list[str],
    ):
        self.success = success
        self.files_processed = files_processed
        self.chunks_written = chunks_written
        self.total_bytes = total_bytes
        self.files = files
        self.errors = errors

    def to_dict(self) -> dict[str, Any]:
        """Convert result to API response format."""
        return {
            "success": self.success,
            "files_processed": self.files_processed,
            "chunks_written": self.chunks_written,
            "totals": {
                "files": self.files_processed,
                "chunks": self.chunks_written,
                "total_bytes": self.total_bytes,
            },
            "files": self.files,
            "errors": self.errors,
        }


class FileUploadResult:
    """Result of file upload operation."""

    def __init__(
        self,
        saved_paths: list[Path],
        run_dir: Path,
    ):
        self.saved_paths = saved_paths
        self.run_dir = run_dir


class IngestionService(BaseService):
    """
    Business logic for document ingestion operations.

    This service orchestrates:
    - Path validation and sanitization
    - File upload handling
    - Document ingestion via pipeline
    - Persistence of ingestion runs and documents
    """

    # Allowed MIME types for file uploads
    ALLOWED_MIME_TYPES = {
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

    # Maximum file size: 100MB
    MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

    def __init__(self, db_session, ingestion_pipeline: IngestionPipeline, settings=None):
        """
        Initialize ingestion service.

        Args:
            db_session: Database session for persistence
            ingestion_pipeline: Pipeline for processing documents
            settings: Application settings
        """
        from apps.api.config import settings as app_settings

        super().__init__(db_session, settings or app_settings)
        self.pipeline = ingestion_pipeline

    def sanitize_tags(self, tags: list[str] | None) -> list[str]:
        """
        Sanitize and validate tags.

        Args:
            tags: List of tag strings

        Returns:
            List of sanitized tags
        """
        sanitized: list[str] = []
        for tag in tags or []:
            cleaned = sanitize_input(tag, max_length=128)
            if cleaned:
                sanitized.append(cleaned)
        return sanitized

    def validate_local_path(self, path: str) -> Path:
        """
        Validate that a local path is within allowed directory.

        Args:
            path: Path to validate

        Returns:
            Resolved Path object

        Raises:
            ValueError: If path is invalid or outside allowed directory
        """
        try:
            resolved_path = Path(path).resolve()
            upload_root = Path(self.settings.ingest_upload_root).resolve()

            # Check if path is within the upload directory
            if not (resolved_path == upload_root or upload_root in resolved_path.parents):
                raise ValueError(
                    f"Path must be within allowed directory: {self.settings.ingest_upload_root}"
                )

            return resolved_path

        except (OSError, RuntimeError) as e:
            raise ValueError(f"Invalid path: {e}")

    async def validate_upload_files(
        self, files: list[UploadFile]
    ) -> list[UploadFile]:
        """
        Validate uploaded files for MIME type and size.

        Args:
            files: List of uploaded files

        Returns:
            List of valid files

        Raises:
            ValueError: If no valid files provided
        """
        valid_files = []

        for f in files:
            # Check MIME type
            if f.content_type not in self.ALLOWED_MIME_TYPES:
                logger.warning(
                    "Rejected file with invalid MIME type",
                    extra={
                        "filename": f.filename,
                        "mime_type": f.content_type,
                        "allowed_mimes": list(self.ALLOWED_MIME_TYPES),
                    },
                )
                continue

            # Check size if available
            if f.size and f.size > self.MAX_FILE_SIZE_BYTES:
                logger.warning(
                    "Rejected file: size exceeds limit",
                    extra={
                        "filename": f.filename,
                        "size_bytes": f.size,
                        "max_size_bytes": self.MAX_FILE_SIZE_BYTES,
                    },
                )
                continue

            valid_files.append(f)

        if not valid_files:
            raise ValueError(
                "No valid files provided. Supported types: PDF, text, CSV, JSON, PNG, JPEG, MP3, WAV. "
                "Max size: 100MB per file."
            )

        return valid_files

    async def save_uploaded_files(
        self, files: list[UploadFile]
    ) -> FileUploadResult:
        """
        Save uploaded files to disk.

        Args:
            files: List of validated uploaded files

        Returns:
            FileUploadResult with saved paths

        Raises:
            RuntimeError: If file saving fails
        """
        # Create per-request directory inside the upload root
        run_dir = Path(self.settings.ingest_upload_root) / f"run-{uuid.uuid4().hex}"
        try:
            run_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            raise RuntimeError(f"Failed to create upload directory: {exc}")

        saved_paths: list[Path] = []
        for f in files:
            try:
                # Sanitize filename
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

                # Write file
                with open(target_path, "wb") as out:
                    while True:
                        chunk = await f.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)

                await f.close()
                saved_paths.append(target_path)

            except Exception as exc:
                # Best-effort cleanup
                try:
                    await f.close()
                except Exception:
                    pass
                raise RuntimeError(f"Failed to save file {f.filename}: {exc}")

        return FileUploadResult(saved_paths=saved_paths, run_dir=run_dir)

    async def ingest_path(
        self,
        user_id: int,
        path_or_url: str,
        from_web: bool = False,
        recursive: bool = False,
        tags: list[str] | None = None,
    ) -> IngestPathResult:
        """
        Ingest documents from a path or URL.

        Args:
            user_id: User identifier
            path_or_url: Path or URL to ingest
            from_web: Whether to ingest from web
            recursive: Whether to recurse into subdirectories
            tags: Optional tags to apply

        Returns:
            IngestPathResult with operation details

        Raises:
            ValueError: If path validation fails
            RuntimeError: If ingestion fails
        """
        # Sanitize input
        target = sanitize_input(path_or_url, max_length=2048)
        sanitized_tags = self.sanitize_tags(tags)

        logger.info(
            "Ingestion request",
            extra={
                "path": target,
                "tags": sanitized_tags,
                "from_web": from_web,
                "recursive": recursive,
                "user_id": user_id,
            },
        )

        # Validate local paths
        if not from_web:
            self.validate_local_path(target)

        # Run ingestion pipeline
        try:
            result = await self.pipeline.ingest_path(
                target,
                recursive=recursive,
                from_web=from_web,
                tags=sanitized_tags,
                user_id=user_id,
            )
        except Exception as e:
            logger.error(
                "Ingestion pipeline failed",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "path": target,
                    "user_id": user_id,
                },
            )
            raise RuntimeError(f"Ingestion failed: {e}")

        # Format error messages
        error_messages = [
            (
                f"{err.get('target')}: {err.get('error')}"
                if isinstance(err, dict)
                else str(err)
            )
            for err in (result.errors or [])
        ]

        # Persist to database
        await self._persist_ingestion_run(
            user_id=user_id,
            target=path_or_url,
            from_web=from_web,
            recursive=recursive,
            tags=sanitized_tags,
            result=result,
            error_messages=error_messages,
        )

        # Calculate total bytes
        total_bytes = sum(
            f.get("size_bytes", 0) for f in (result.files or [])
        )

        return IngestPathResult(
            success=not error_messages,
            files_processed=result.total_files,
            chunks_written=result.total_chunks,
            total_bytes=total_bytes,
            files=[dict(file) for file in (result.files or [])],
            errors=error_messages,
        )

    async def ingest_uploaded_files(
        self,
        user_id: int,
        files: list[UploadFile],
        tags: list[str] | None = None,
    ) -> IngestPathResult:
        """
        Ingest uploaded files.

        Args:
            user_id: User identifier
            files: List of uploaded files
            tags: Optional tags to apply

        Returns:
            IngestPathResult with operation details

        Raises:
            ValueError: If file validation fails
            RuntimeError: If file saving or ingestion fails
        """
        # Validate files
        valid_files = await self.validate_upload_files(files)
        sanitized_tags = self.sanitize_tags(tags)

        # Save files to disk
        upload_result = await self.save_uploaded_files(valid_files)

        # Ingest the uploaded directory
        try:
            result = await self.pipeline.ingest_path(
                str(upload_result.run_dir),
                recursive=False,
                from_web=False,
                tags=sanitized_tags,
                user_id=user_id,
            )
        except Exception as e:
            logger.error(
                "Upload ingestion pipeline failed",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_count": len(valid_files),
                    "user_id": user_id,
                },
            )
            raise RuntimeError(f"Upload ingestion failed: {e}")

        # Format error messages
        error_messages = [
            (
                f"{err.get('path') or err.get('target')}: {err.get('error')}"
                if isinstance(err, dict)
                else str(err)
            )
            for err in (result.errors or [])
        ]

        # Persist to database
        await self._persist_ingestion_run(
            user_id=user_id,
            target=str(upload_result.run_dir),
            from_web=False,
            recursive=False,
            tags=sanitized_tags,
            result=result,
            error_messages=error_messages,
        )

        # Calculate total bytes
        total_bytes = sum(
            f.get("size_bytes", 0) for f in (result.files or [])
        )

        return IngestPathResult(
            success=not error_messages,
            files_processed=result.total_files,
            chunks_written=result.total_chunks,
            total_bytes=total_bytes,
            files=[dict(file) for file in (result.files or [])],
            errors=error_messages,
        )

    async def _persist_ingestion_run(
        self,
        user_id: int,
        target: str,
        from_web: bool,
        recursive: bool,
        tags: list[str],
        result: Any,
        error_messages: list[str],
    ) -> None:
        """
        Persist ingestion run and documents to database.

        Args:
            user_id: User identifier
            target: Target path or URL
            from_web: Whether ingested from web
            recursive: Whether recursive ingestion
            tags: Applied tags
            result: Pipeline result object
            error_messages: Formatted error messages
        """
        try:
            started_at = datetime.now().astimezone()
            finished_at = datetime.now().astimezone()

            # Record ingestion run
            ingestion_repo = IngestionRepository(self.db)
            await ingestion_repo.record_ingestion_run(
                user_id=user_id,
                target=target,
                from_web=from_web,
                recursive=recursive,
                tags=tags,
                collection=None,
                totals_files=result.total_files,
                totals_chunks=result.total_chunks,
                errors=error_messages or [],
                started_at=started_at,
                finished_at=finished_at,
                status="success" if not error_messages else "partial",
            )

            # Record individual documents
            doc_repo = DocumentRepository(self.db)
            for f in result.files or []:
                uri = f.get("uri")
                path = f.get("path")
                basis = uri or path or ""
                path_hash = (
                    hashlib.sha256(basis.encode("utf-8")).hexdigest()
                    if basis
                    else None
                )

                await doc_repo.upsert_document(
                    user_id=user_id,
                    path_hash=path_hash or "",
                    uri=uri,
                    path=path,
                    mime=f.get("mime"),
                    bytes_size=f.get("size_bytes"),
                    source="web" if from_web else "file",
                    tags=tags,
                    collection=None,
                )

        except (ValueError, TypeError, OSError) as persist_exc:
            logger.error(
                "Failed to persist ingestion run",
                extra={
                    "error": str(persist_exc),
                    "error_type": type(persist_exc).__name__,
                    "user_id": user_id,
                    "target": target,
                },
            )
