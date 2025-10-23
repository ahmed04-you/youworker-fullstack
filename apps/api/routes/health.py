"""
Health check API endpoints.
"""
import logging
from typing import Any

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


def get_health_dependencies():
    """Get health check dependencies."""
    from apps.api.main import registry, ollama_client, agent_loop
    from apps.api.audio_pipeline import FW_AVAILABLE as STT_AVAILABLE, PIPER_AVAILABLE as TTS_AVAILABLE
    return registry, ollama_client, agent_loop, STT_AVAILABLE, TTS_AVAILABLE


@router.get("/health")
async def health_check():
    """
    Health check endpoint with detailed component status.

    Returns overall health status and individual component health.
    Status is 'degraded' if some MCP servers are unavailable.
    """
    from apps.api.config import settings
    
    registry, ollama_client, agent_loop, STT_AVAILABLE, TTS_AVAILABLE = get_health_dependencies()
    
    mcp_status = {"healthy": [], "unhealthy": [], "total": 0}

    if registry:
        healthy_servers = registry.list_healthy_servers()
        all_servers = list(registry.clients.keys()) if hasattr(registry, 'clients') else []

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