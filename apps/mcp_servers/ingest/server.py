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
import json
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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from packages.ingestion import IngestionPipeline
from packages.common import get_settings
from packages.db import init_db as init_database, get_async_session
from packages.db.crud import record_ingestion_run, upsert_document

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
    # Allowlist: /data, repo-local to_ingest, examples/ingestion
    allow: list[Path] = []
    for base in ("/data", str(Path.cwd() / "to_ingest"), str(Path.cwd() / "examples" / "ingestion")):
        try:
            allow.append(Path(base).resolve())
        except Exception:
            continue
    for base in allow:
        try:
            p.relative_to(base)
            return p
        except Exception:
            continue
    raise ValueError("Path not allowed; must be under /data, to_ingest, or examples/ingestion")


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


async def ingest_url(url: str, tags: list[str] | None = None, collection: str | None = None) -> dict[str, Any]:
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
        )
        finished = datetime.now(timezone.utc).isoformat()

        errors = [
            f"{err.get('target') or err.get('path')}: {err.get('error')}"
            if isinstance(err, dict)
            else str(err)
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
                    user_id=1,
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
                for f in (report.files or []):
                    uri = f.get("uri")
                    path = f.get("path")
                    ph = hashlib.sha256((uri or path or "").encode("utf-8")).hexdigest()
                    await upsert_document(
                        db,
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


async def ingest_path(path: str, recursive: bool = False, tags: list[str] | None = None, collection: str | None = None) -> dict[str, Any]:
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
        )
        finished = datetime.now(timezone.utc).isoformat()
        errors = [
            f"{err.get('target') or err.get('path')}: {err.get('error')}"
            if isinstance(err, dict)
            else str(err)
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
                    user_id=1,
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
                for f in (report.files or []):
                    uri = f.get("uri")
                    path = f.get("path")
                    ph = hashlib.sha256((uri or path or "").encode("utf-8")).hexdigest()
                    await upsert_document(
                        db,
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


def get_tools_schema() -> list[dict[str, Any]]:
    return [
        {
            "name": "url",
            "description": "Ingest a URL and its content into the vector store; returns job status and counts.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to ingest",
                        "minLength": 8,
                        "maxLength": 2048,
                        "pattern": r"^https?://.+$",
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
                "required": ["url"],
                "additionalProperties": False,
            },
        },
        {
            "name": "path",
            "description": "Ingest a file or directory from an allowlisted mounted path (internal workflows).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to file or directory under allowed roots",
                        "minLength": 1,
                        "maxLength": 4096,
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
                "required": ["path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "status",
            "description": "Show last N ingestion runs with counts and errors.",
            "inputSchema": {
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
        },
    ]


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                req = json.loads(raw)
            except Exception:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": "Parse error", "data": {"raw": str(raw)[:200]}},
                    })
                )
                continue

            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {}) or {}

            try:
                if method == "initialize":
                    result = {
                        "protocolVersion": "2024-10-01",
                        "serverInfo": {"name": "ingest", "version": "0.1.0"},
                        "capabilities": {"tools": {"list": True, "call": True}},
                    }
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}))

                elif method == "tools/list":
                    await ws.send_text(
                        json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"tools": get_tools_schema()}})
                    )

                elif method == "tools/call":
                    name = params.get("name")
                    arguments = params.get("arguments", {})
                    if name == "url":
                        result = await ingest_url(
                            url=arguments["url"],
                            tags=arguments.get("tags"),
                            collection=arguments.get("collection"),
                        )
                    elif name == "path":
                        result = await ingest_path(
                            path=arguments["path"],
                            recursive=arguments.get("recursive", False),
                            tags=arguments.get("tags"),
                            collection=arguments.get("collection"),
                        )
                    elif name == "status":
                        result = ingest_status(limit=arguments.get("limit", 10))
                    else:
                        await ws.send_text(
                            json.dumps({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "error": {"code": -32601, "message": f"Unknown tool: {name}", "data": {"name": name}},
                            })
                        )
                        continue

                    await ws.send_text(
                        json.dumps(
                            {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "json", "json": result}]}}
                        )
                    )

                elif method == "ping":
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}))

                else:
                    await ws.send_text(
                        json.dumps({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {"code": -32601, "message": "Method not found", "data": {"method": method}},
                        })
                    )

            except Exception as e:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32000, "message": str(e), "data": {"type": type(e).__name__}},
                    })
                )
    except WebSocketDisconnect:
        logger.info("MCP WebSocket disconnected (ingest)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7004)
