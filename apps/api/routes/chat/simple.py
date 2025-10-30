"""
Simple chat endpoint demonstrating service layer pattern.

This endpoint is a refactored version that uses ChatService for business logic,
demonstrating clean separation of concerns between HTTP routing and business logic.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from apps.api.routes.deps import get_current_user_with_collection_access, get_chat_service
from apps.api.services import ChatService
from apps.api.utils.error_handling import handle_ollama_errors

logger = logging.getLogger(__name__)

router = APIRouter()


class SimpleChatRequest(BaseModel):
    """Request model for simple chat endpoint."""

    message: str
    session_id: str | None = None
    messages: list[dict[str, Any]] | None = None
    model: str | None = None
    enable_tools: bool = True
    max_iterations: int | None = None


class SimpleChatResponse(BaseModel):
    """Response model for simple chat endpoint."""

    content: str
    session_id: str | None = None
    metadata: dict[str, Any] | None = None
    tool_events: list[dict[str, Any]] | None = None
    logs: list[dict[str, str]] | None = None


@router.post("/simple-chat", response_model=SimpleChatResponse)
@handle_ollama_errors
async def simple_chat_endpoint(
    request: SimpleChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    chat_service: ChatService = Depends(get_chat_service),
):
    """
    Simple text-only chat endpoint using service layer pattern.

    This endpoint demonstrates clean separation of concerns:
    - HTTP routing and validation handled by FastAPI
    - Authentication handled by dependency
    - Business logic delegated to ChatService

    The route handler is thin and focuses only on:
    1. Request validation (handled by Pydantic)
    2. Calling the service layer
    3. Response formatting

    Args:
        request: Chat request with message and options
        current_user: Authenticated user (from dependency)
        chat_service: Chat service instance (from dependency)

    Returns:
        Chat response with agent's reply
    """
    # Delegate all business logic to service layer
    response = await chat_service.send_message(
        user=current_user,
        text_input=request.message,
        session_id=request.session_id,
        messages=request.messages,
        model=request.model,
        enable_tools=request.enable_tools,
        max_iterations=request.max_iterations,
    )

    # Return formatted response
    return SimpleChatResponse(
        content=response.content,
        session_id=request.session_id,
        metadata=response.metadata,
        tool_events=response.tool_events,
        logs=response.logs,
    )
