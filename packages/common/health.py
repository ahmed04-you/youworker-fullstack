"""Health check framework for monitoring service dependencies."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum

import httpx
from qdrant_client import AsyncQdrantClient
from sqlalchemy import text

from packages.common.settings import get_settings
from packages.db.session import get_async_session, async_engine
from packages.db.pool_monitor import PoolMonitor

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health status levels."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class HealthCheck:
    """Health check result for a service dependency."""

    name: str
    status: HealthStatus
    message: str
    latency_ms: int | None = None
    details: dict | None = None


async def check_postgres_health() -> HealthCheck:
    """Check PostgreSQL database health and connection pool status."""
    start = time.perf_counter()
    try:
        async with get_async_session() as db:
            await db.execute(text("SELECT 1"))
        latency = int((time.perf_counter() - start) * 1000)

        # Get pool statistics
        monitor = PoolMonitor(async_engine)
        pool_stats = monitor.get_stats()
        is_healthy, pool_message = monitor.check_health()

        # Determine overall status based on both connection and pool health
        if not is_healthy and pool_stats.is_saturated:
            status = HealthStatus.DEGRADED
            message = f"Connected but {pool_message.lower()}"
        else:
            status = HealthStatus.HEALTHY
            message = f"Connected - {pool_stats.checked_out}/{pool_stats.pool_size} connections"

        return HealthCheck(
            name="postgres",
            status=status,
            message=message,
            latency_ms=latency,
            details={
                "pool": pool_stats.to_dict(),
                "pool_health": pool_message,
            }
        )
    except Exception as e:
        latency = int((time.perf_counter() - start) * 1000)
        logger.error("PostgreSQL health check failed: %s", e)
        return HealthCheck(
            name="postgres",
            status=HealthStatus.UNHEALTHY,
            message=f"Connection failed: {str(e)[:100]}",
            latency_ms=latency,
        )


async def check_qdrant_health() -> HealthCheck:
    """Check Qdrant vector database health."""
    settings = get_settings()
    start = time.perf_counter()
    try:
        client = AsyncQdrantClient(url=settings.qdrant_url, timeout=5.0)
        # Check if we can connect and get collections
        collections = await client.get_collections()
        latency = int((time.perf_counter() - start) * 1000)

        # Check if our main collection exists
        collection_exists = any(
            col.name == settings.qdrant_collection for col in collections.collections
        )

        if collection_exists:
            status = HealthStatus.HEALTHY
            message = f"Connected ({len(collections.collections)} collections)"
        else:
            status = HealthStatus.DEGRADED
            message = f"Collection '{settings.qdrant_collection}' not found"

        return HealthCheck(
            name="qdrant",
            status=status,
            message=message,
            latency_ms=latency,
            details={
                "collections": len(collections.collections),
                "main_collection_exists": collection_exists,
            },
        )
    except Exception as e:
        latency = int((time.perf_counter() - start) * 1000)
        logger.error("Qdrant health check failed: %s", e)
        return HealthCheck(
            name="qdrant",
            status=HealthStatus.UNHEALTHY,
            message=f"Connection failed: {str(e)[:100]}",
            latency_ms=latency,
        )


async def check_ollama_health() -> HealthCheck:
    """Check Ollama LLM service health."""
    settings = get_settings()
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = data.get("models", [])

        latency = int((time.perf_counter() - start) * 1000)

        # Check if required models are available
        model_names = [m.get("name", "") for m in models]
        chat_model_available = any(
            settings.chat_model in name for name in model_names
        )
        embed_model_available = any(
            settings.embed_model in name for name in model_names
        )

        if chat_model_available and embed_model_available:
            status = HealthStatus.HEALTHY
            message = f"Connected ({len(models)} models)"
        elif chat_model_available or embed_model_available:
            status = HealthStatus.DEGRADED
            message = "Some required models missing"
        else:
            status = HealthStatus.DEGRADED
            message = "Required models not found"

        return HealthCheck(
            name="ollama",
            status=status,
            message=message,
            latency_ms=latency,
            details={
                "models": len(models),
                "chat_model_available": chat_model_available,
                "embed_model_available": embed_model_available,
            },
        )
    except Exception as e:
        latency = int((time.perf_counter() - start) * 1000)
        logger.error("Ollama health check failed: %s", e)
        return HealthCheck(
            name="ollama",
            status=HealthStatus.UNHEALTHY,
            message=f"Connection failed: {str(e)[:100]}",
            latency_ms=latency,
        )


async def check_mcp_servers_health() -> HealthCheck:
    """Check MCP servers health (basic connectivity check)."""
    settings = get_settings()
    start = time.perf_counter()

    if not settings.mcp_server_urls:
        return HealthCheck(
            name="mcp_servers",
            status=HealthStatus.HEALTHY,
            message="No MCP servers configured",
            latency_ms=0,
            details={"servers": 0},
        )

    try:
        server_urls = [
            url.strip()
            for url in settings.mcp_server_urls.split(",")
            if url.strip()
        ]
        latency = int((time.perf_counter() - start) * 1000)

        return HealthCheck(
            name="mcp_servers",
            status=HealthStatus.HEALTHY,
            message=f"{len(server_urls)} server(s) configured",
            latency_ms=latency,
            details={"servers": len(server_urls)},
        )
    except Exception as e:
        latency = int((time.perf_counter() - start) * 1000)
        logger.error("MCP servers health check failed: %s", e)
        return HealthCheck(
            name="mcp_servers",
            status=HealthStatus.DEGRADED,
            message=f"Configuration error: {str(e)[:100]}",
            latency_ms=latency,
        )


async def get_aggregate_health() -> dict:
    """
    Run all health checks and return aggregated results.

    Returns:
        Dictionary with overall status and individual check results.
    """
    # Run all checks concurrently
    checks = await asyncio.gather(
        check_postgres_health(),
        check_qdrant_health(),
        check_ollama_health(),
        check_mcp_servers_health(),
        return_exceptions=False,
    )

    # Determine overall status
    if any(c.status == HealthStatus.UNHEALTHY for c in checks):
        overall_status = HealthStatus.UNHEALTHY
    elif any(c.status == HealthStatus.DEGRADED for c in checks):
        overall_status = HealthStatus.DEGRADED
    else:
        overall_status = HealthStatus.HEALTHY

    return {
        "status": overall_status.value,
        "checks": [
            {
                "name": c.name,
                "status": c.status.value,
                "message": c.message,
                "latency_ms": c.latency_ms,
                "details": c.details,
            }
            for c in checks
        ],
    }
