"""Shared FastAPI dependency helpers for accessing application singletons."""

from fastapi import HTTPException, Request

from packages.agent import AgentLoop, MCPRegistry
from packages.ingestion import IngestionPipeline
from packages.llm import OllamaClient
from packages.vectorstore import QdrantStore


def _get_state(request: Request, attr: str, detail: str):
    instance = getattr(request.app.state, attr, None)
    if instance is None:
        raise HTTPException(status_code=503, detail=detail)
    return instance


def get_agent_loop(request: Request) -> AgentLoop:
    """Return the AgentLoop singleton from application state."""
    return _get_state(request, "agent_loop", "Agent not initialized")


def get_agent_loop_optional(request: Request) -> AgentLoop | None:
    """Best-effort fetch of the AgentLoop; returns None if unavailable."""
    return getattr(request.app.state, "agent_loop", None)


def get_ollama_client(request: Request) -> OllamaClient:
    """Return the Ollama client singleton."""
    return _get_state(request, "ollama_client", "Ollama client not initialized")


def get_ollama_client_optional(request: Request) -> OllamaClient | None:
    """Best-effort fetch of the Ollama client; returns None if unavailable."""
    return getattr(request.app.state, "ollama_client", None)


def get_registry(request: Request) -> MCPRegistry:
    """Return the MCP registry singleton."""
    return _get_state(request, "registry", "Tool registry not initialized")


def get_registry_optional(request: Request) -> MCPRegistry | None:
    """Best-effort fetch of the MCP registry; returns None if unavailable."""
    return getattr(request.app.state, "registry", None)


def get_vector_store(request: Request) -> QdrantStore:
    """Return the vector store singleton."""
    return _get_state(request, "vector_store", "Vector store not initialized")


def get_ingestion_pipeline(request: Request) -> IngestionPipeline:
    """Return the ingestion pipeline singleton."""
    return _get_state(request, "ingestion_pipeline", "Ingestion pipeline not initialized")
