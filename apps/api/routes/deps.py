"""Shared FastAPI dependency helpers for accessing application singletons."""

from fastapi import HTTPException, Request, Depends

from packages.agent import AgentLoop, MCPRegistry
from packages.ingestion import IngestionPipeline
from packages.llm import OllamaClient
from packages.vectorstore import QdrantStore
from apps.api.auth.security import get_current_active_user


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


async def get_current_user_with_collection_access(
    current_user=Depends(get_current_active_user),
):
    """
    Get current authenticated user and ensure access to default collection.

    This is a shared dependency used across multiple route modules.
    Returns the User object.
    """
    from packages.db import get_async_session
    from packages.db.repositories import DocumentRepository

    # Ensure root has access to default collection
    try:
        from packages.vectorstore.schema import DEFAULT_COLLECTION

        async with get_async_session() as db:
            doc_repo = DocumentRepository(db)
            await doc_repo.grant_user_collection_access(
                user_id=current_user.id,
                collection_name=DEFAULT_COLLECTION
            )
    except (AttributeError, ImportError, ValueError):
        # Silent fail - collection access is a nice-to-have
        pass

    return current_user


async def get_chat_service(
    request: Request,
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Dependency injection for ChatService.

    Creates a ChatService instance with all required dependencies.
    Note: Database session is managed by the service internally using get_async_session().

    Args:
        request: FastAPI request (for accessing settings)
        agent_loop: Agent execution engine

    Returns:
        ChatService instance
    """
    from packages.db import get_async_session
    from apps.api.services import ChatService

    # Get a database session
    async with get_async_session() as db:
        yield ChatService(
            db_session=db,
            agent_loop=agent_loop,
        )


async def get_ingestion_service(
    request: Request,
    ingestion_pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    """
    Dependency injection for IngestionService.

    Creates an IngestionService instance with all required dependencies.
    Note: Database session is managed by the service internally using get_async_session().

    Args:
        request: FastAPI request (for accessing settings)
        ingestion_pipeline: Document ingestion pipeline

    Returns:
        IngestionService instance
    """
    from packages.db import get_async_session
    from apps.api.services import IngestionService

    # Get a database session
    async with get_async_session() as db:
        yield IngestionService(
            db_session=db,
            ingestion_pipeline=ingestion_pipeline,
        )
