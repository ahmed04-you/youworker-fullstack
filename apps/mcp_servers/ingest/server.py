"""
MCP server for ingestion utilities.

Tools:
- url: Ingest a URL (crawl and parse) into the vector store
- path: Ingest a file or directory from an allowlisted path
- status: Show last N ingestion runs with counts and errors
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from collections import deque
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, WebSocket

from packages.ingestion import IngestionPipeline
from packages.common import get_settings
from packages.db import init_db as init_database, get_async_session
from packages.db.crud import record_ingestion_run, upsert_document
from packages.mcp.base_handler import (
    MCPProtocolHandler,
    MCPServerInfo,
    mcp_websocket_handler,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Ingest MCP Server")

# Global instances
pipeline: IngestionPipeline | None = None
http_client: httpx.AsyncClient | None = None

INGEST_HISTORY_LIMIT = 100
_history: deque[dict[str, Any]] = deque(maxlen=INGEST_HISTORY_LIMIT)


@app.on_event("startup")
async def startup():
    global pipeline, http_client
    logger.info("Initializing ingestion pipeline and HTTP client...")
    settings = get_settings()
    await init_database(settings)
    pipeline = IngestionPipeline(settings=settings)
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0, read=10.0, connect=5.0))
    logger.info("Ingest server ready")


@app.on_event("shutdown")
async def shutdown():
    global pipeline, http_client
    if http_client:
        await http_client.aclose()
    http_client = None
    pipeline = None


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def _allowlisted_path(raw: str) -> Path:
    p = Path(raw).resolve()
    # Allowlist: /data (containers mount uploads here)
    try:
        base = Path("/data").resolve()
    except Exception as exc:
        raise ValueError("Upload root unavailable") from exc
    try:
        p.relative_to(base)
        return p
    except Exception as exc:
        raise ValueError("Path not allowed; must be under /data") from exc


async def _ensure_safe_url(raw_url: str) -> str:
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ValueError("url must be a non-empty string")
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are allowed")
    if not parsed.hostname:
        raise ValueError("URL must include a hostname")
    host = parsed.hostname
    try:
        ipaddress.ip_address(host)
        addresses = {host}
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            infos = await loop.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
        except Exception as exc:
            raise ValueError("Unable to resolve host") from exc
        addresses = {info[4][0] for info in infos if info and info[4]}
    if not addresses:
        raise ValueError("Unable to resolve host")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError("URL resolves to a disallowed IP address")
    return parsed.geturl()


@dataclass
class JobResult:
    job_id: str
    target: str
    started_at: str
    finished_at: str
    totals: dict[str, int]
    errors: list[str]


async def ingest_url(
    url: str, user_id: int, tags: list[str] | None = None, collection: str | None = None
) -> dict[str, Any]:
    if not pipeline:
        return {"error": "Ingestion pipeline not initialized"}
    try:
        safe_url = await _ensure_safe_url(url)
    except ValueError as exc:
        return {"error": str(exc)}

    from uuid import uuid4

    job_id = uuid4().hex
    started = datetime.now(timezone.utc).isoformat()
    try:
        report = await pipeline.ingest_path(
            safe_url,
            recursive=False,
            from_web=True,
            tags=tags or [],
            collection_name=collection,
            user_id=user_id,
        )
        finished = datetime.now(timezone.utc).isoformat()

        errors = [
            (
                f"{err.get('target') or err.get('path')}: {err.get('error')}"
                if isinstance(err, dict)
                else str(err)
            )
            for err in (report.errors or [])
        ]
        rec = {
            "job_id": job_id,
            "type": "url",
            "target": safe_url,
            "started_at": started,
            "finished_at": finished,
            "totals": {"files": report.total_files, "chunks": report.total_chunks},
            "errors": errors,
        }
        # Persist ingestion run + docs
        try:
            async with get_async_session() as db:
                await record_ingestion_run(
                    db,
                    user_id=user_id,
                    target=safe_url,
                    from_web=True,
                    recursive=False,
                    tags=tags or [],
                    collection=collection,
                    totals_files=report.total_files,
                    totals_chunks=report.total_chunks,
                    errors=errors,
                    started_at=datetime.fromisoformat(started),
                    finished_at=datetime.fromisoformat(finished),
                    status="success" if not errors else "partial",
                )
                for f in report.files or []:
                    uri = f.get("uri")
                    path = f.get("path")
                    ph = hashlib.sha256((uri or path or "").encode("utf-8")).hexdigest()
                    await upsert_document(
                        db,
                        user_id=user_id,
                        path_hash=ph,
                        uri=uri,
                        path=path,
                        mime=f.get("mime"),
                        bytes_size=f.get("size_bytes"),
                        source="web",
                        tags=tags or [],
                        collection=collection,
                    )
        except Exception as e:
            logger.error(f"failed to persist ingestion url run: {e}")
        _history.append(rec)
        return rec
    except Exception as exc:
        finished = datetime.now(timezone.utc).isoformat()
        rec = {
            "job_id": job_id,
            "type": "url",
            "target": url,
            "started_at": started,
            "finished_at": finished,
            "totals": {"files": 0, "chunks": 0},
            "errors": [str(exc)],
        }
        _history.append(rec)
        return rec


async def ingest_path(
    path: str, user_id: int, recursive: bool = False, tags: list[str] | None = None, collection: str | None = None
) -> dict[str, Any]:
    if not pipeline:
        return {"error": "Ingestion pipeline not initialized"}
    try:
        safe_path = _allowlisted_path(path)
    except ValueError as exc:
        return {"error": str(exc)}

    from uuid import uuid4

    job_id = uuid4().hex
    started = datetime.now(timezone.utc).isoformat()
    try:
        report = await pipeline.ingest_path(
            str(safe_path),
            recursive=recursive,
            from_web=False,
            tags=tags or [],
            collection_name=collection,
            user_id=user_id,
        )
        finished = datetime.now(timezone.utc).isoformat()
        errors = [
            (
                f"{err.get('target') or err.get('path')}: {err.get('error')}"
                if isinstance(err, dict)
                else str(err)
            )
            for err in (report.errors or [])
        ]
        rec = {
            "job_id": job_id,
            "type": "path",
            "target": str(safe_path),
            "started_at": started,
            "finished_at": finished,
            "totals": {"files": report.total_files, "chunks": report.total_chunks},
            "errors": errors,
        }
        try:
            async with get_async_session() as db:
                await record_ingestion_run(
                    db,
                    user_id=user_id,
                    target=str(safe_path),
                    from_web=False,
                    recursive=recursive,
                    tags=tags or [],
                    collection=collection,
                    totals_files=report.total_files,
                    totals_chunks=report.total_chunks,
                    errors=errors,
                    started_at=datetime.fromisoformat(started),
                    finished_at=datetime.fromisoformat(finished),
                    status="success" if not errors else "partial",
                )
                for f in report.files or []:
                    uri = f.get("uri")
                    path = f.get("path")
                    ph = hashlib.sha256((uri or path or "").encode("utf-8")).hexdigest()
                    await upsert_document(
                        db,
                        user_id=user_id,
                        path_hash=ph,
                        uri=uri,
                        path=path,
                        mime=f.get("mime"),
                        bytes_size=f.get("size_bytes"),
                        source="file",
                        tags=tags or [],
                        collection=collection,
                    )
        except Exception as e:
            logger.error(f"failed to persist ingestion path run: {e}")
        _history.append(rec)
        return rec
    except Exception as exc:
        finished = datetime.now(timezone.utc).isoformat()
        rec = {
            "job_id": job_id,
            "type": "path",
            "target": path,
            "started_at": started,
            "finished_at": finished,
            "totals": {"files": 0, "chunks": 0},
            "errors": [str(exc)],
        }
        _history.append(rec)
        return rec


def ingest_status(limit: int = 10) -> dict[str, Any]:
    try:
        lim = max(1, min(int(limit), 100))
    except Exception:
        lim = 10
    entries = list(_history)[-lim:]
    return {"runs": entries, "count": len(entries)}


# Initialize MCP protocol handler
mcp_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="ingest",
        version="0.1.0",
    )
)

# Register tools
mcp_handler.register_tool(
    name="url",
    description="Ingest a URL and its content into the vector store; returns job status and counts.",
    input_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL to ingest",
                "minLength": 8,
                "maxLength": 2048,
                "pattern": r"^https?://.+$",
            },
            "user_id": {
                "type": "integer",
                "description": "User ID for document ownership",
                "minimum": 1,
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Tags to apply to ingested chunks",
                "maxItems": 20,
            },
            "collection": {
                "type": "string",
                "description": "Optional collection name",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9._-]+$",
            },
        },
        "required": ["url", "user_id"],
        "additionalProperties": False,
    },
    handler=lambda url, user_id, tags=None, collection=None: ingest_url(
        url=url, user_id=user_id, tags=tags, collection=collection
    ),
)

mcp_handler.register_tool(
    name="path",
    description="Ingest a file or directory from an allowlisted mounted path (internal workflows).",
    input_schema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to file or directory under allowed roots",
                "minLength": 1,
                "maxLength": 4096,
            },
            "user_id": {
                "type": "integer",
                "description": "User ID for document ownership",
                "minimum": 1,
            },
            "recursive": {
                "type": "boolean",
                "description": "Recurse into directories",
                "default": False,
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": 20,
            },
            "collection": {
                "type": "string",
                "description": "Optional collection name",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9._-]+$",
            },
        },
        "required": ["path", "user_id"],
        "additionalProperties": False,
    },
    handler=lambda path, user_id, recursive=False, tags=None, collection=None: ingest_path(
        path=path, user_id=user_id, recursive=recursive, tags=tags, collection=collection
    ),
)

mcp_handler.register_tool(
    name="status",
    description="Show last N ingestion runs with counts and errors.",
    input_schema={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Number of runs to return",
                "default": 10,
                "minimum": 1,
                "maximum": 100,
            }
        },
        "additionalProperties": False,
    },
    handler=lambda limit=10: ingest_status(limit=limit),
)


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """MCP WebSocket endpoint using base handler."""
    await mcp_websocket_handler(ws, mcp_handler)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7004)
