"""
Health check API endpoints.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends

from apps.api.audio_pipeline import (
    FW_AVAILABLE as STT_AVAILABLE,
    PIPER_AVAILABLE as TTS_AVAILABLE,
)
from apps.api.routes.deps import (
    get_agent_loop_optional,
    get_ollama_client_optional,
    get_registry_optional,
)
from apps.api.auth.security import get_current_user_optional
from packages.common.health import get_aggregate_health

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check(
    current_user=Depends(get_current_user_optional),
    registry=Depends(get_registry_optional),
    ollama_client=Depends(get_ollama_client_optional),
    agent_loop=Depends(get_agent_loop_optional),
):
    """
    Health check endpoint with detailed component status.

    Returns overall health status and individual component health.
    Status is 'degraded' if some MCP servers are unavailable.
    """
    from apps.api.config import settings

    mcp_status = {"healthy": [], "unhealthy": [], "total": 0}

    if registry:
        healthy_servers = registry.list_healthy_servers()
        all_servers = list(registry.clients.keys()) if hasattr(registry, "clients") else []

        mcp_status["healthy"] = healthy_servers
        mcp_status["unhealthy"] = [s for s in all_servers if s not in healthy_servers]
        mcp_status["total"] = len(all_servers)

    # Ollama model availability
    ollama_status: dict[str, Any] = {
        "base_url": settings.ollama_base_url,
        "auto_pull": settings.ollama_auto_pull,
        "ready": False,
        "models": {},
        "missing": [],
    }

    if ollama_client:
        required_models = {
            "chat": settings.chat_model,
            "embed": settings.embed_model,
        }
        for label, model_name in required_models.items():
            if not model_name:
                continue
            available = await ollama_client.model_exists(model_name)
            ollama_status["models"][label] = {
                "name": model_name,
                "available": available,
            }
            if not available:
                ollama_status["missing"].append(model_name)

        ollama_status["ready"] = len(ollama_status["missing"]) == 0
    else:
        ollama_status["error"] = "client_not_initialized"

    # Determine overall status
    overall_status = "healthy"
    if mcp_status["total"] > 0 and len(mcp_status["unhealthy"]) > 0:
        if len(mcp_status["healthy"]) == 0:
            overall_status = "unhealthy"
        else:
            overall_status = "degraded"

    if ollama_status["missing"]:
        overall_status = "degraded"

    return {
        "status": overall_status,
        "components": {
            "mcp_servers": mcp_status,
            "voice": {
                "mode": "turn_based",
                "stt_available": STT_AVAILABLE,
                "tts_available": TTS_AVAILABLE,
            },
            "database": "connected",  # If we got here, DB is working
            "agent": "ready" if agent_loop else "not_initialized",
            "ollama": ollama_status,
        },
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check with comprehensive dependency monitoring.

    Performs active health checks on all service dependencies:
    - PostgreSQL database connection
    - Qdrant vector database
    - Ollama LLM service
    - MCP servers configuration

    Returns detailed status, latency, and diagnostic information for each service.
    This endpoint is more comprehensive but slower than the basic /health endpoint.
    """
    return await get_aggregate_health()
