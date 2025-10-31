"""
Unified chat endpoint supporting both text and audio input.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError

from apps.api.config import settings
from apps.api.routes.deps import (
    get_current_user_with_collection_access,
    get_chat_service,
    get_agent_loop,
)
from apps.api.utils.error_handling import handle_audio_errors, handle_ollama_errors
from apps.api.utils.response_formatting import sse_format
from packages.agent import AgentLoop

from .models import UnifiedChatRequest, UnifiedChatResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/unified-chat", response_model=UnifiedChatResponse)
@handle_audio_errors
@handle_ollama_errors
async def unified_chat_endpoint(
    request: Request,
    unified_request: UnifiedChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    agent_loop: AgentLoop = Depends(get_agent_loop),
    chat_service=Depends(get_chat_service),
):
    """
    Unified chat endpoint that supports both text and audio input.

    Handles three scenarios:
    1. Text input only -> uses chat streaming
    2. Audio input only -> transcribes and processes
    3. Both text and audio -> prioritizes text input

    Always returns text response, optionally with audio.
    """
    # Streaming response
    if unified_request.stream:
        async def generate():
            pad_pending = True

            try:
                # Use ChatService for all business logic
                async for event in chat_service.send_message_streaming(
                    user=current_user,
                    text_input=unified_request.text_input,
                    audio_b64=unified_request.audio_b64,
                    sample_rate=unified_request.sample_rate,
                    session_id=unified_request.session_id,
                    messages=unified_request.messages,
                    model=unified_request.model,
                    enable_tools=unified_request.enable_tools,
                    expect_audio=unified_request.expect_audio,
                    max_iterations=settings.max_agent_iterations,
                ):
                    # Format event as SSE
                    pad = pad_pending
                    pad_pending = False

                    # Convert done event data to UnifiedChatResponse format
                    if event.get("event") == "done":
                        data = event.get("data", {})
                        response = UnifiedChatResponse(
                            content=data.get("content", ""),
                            transcript=data.get("transcript"),
                            metadata=data.get("metadata", {}),
                            audio_b64=data.get("audio_b64"),
                            audio_sample_rate=data.get("audio_sample_rate"),
                            stt_confidence=data.get("stt_confidence"),
                            stt_language=data.get("stt_language"),
                            tool_events=data.get("tool_events", []),
                            logs=data.get("logs", []),
                        )
                        event["data"] = response.model_dump()

                    yield sse_format(event, pad=pad)
                    await asyncio.sleep(0)

            except (HTTPStatusError, Exception) as e:
                error_msg = (
                    f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                    if isinstance(e, HTTPStatusError)
                    else str(e)
                )
                logger.error(
                    "Error during unified chat streaming",
                    extra={"error": error_msg, "error_type": type(e).__name__},
                    exc_info=True,
                )

                yield sse_format(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                        },
                    },
                    pad=pad_pending,
                )

                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=None,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                    },
                    stt_confidence=None,
                    stt_language=None,
                    tool_events=[],
                    logs=[],
                )
                yield sse_format({"event": "done", "data": error_response.model_dump()})

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming response - Use ChatService for clean separation of concerns
    response = await chat_service.send_message(
        user=current_user,
        text_input=unified_request.text_input,
        audio_b64=unified_request.audio_b64,
        sample_rate=unified_request.sample_rate,
        session_id=unified_request.session_id,
        messages=unified_request.messages,
        model=unified_request.model,
        enable_tools=unified_request.enable_tools,
        expect_audio=unified_request.expect_audio,
        max_iterations=settings.max_agent_iterations,
    )

    return UnifiedChatResponse(
        content=response.content,
        transcript=response.transcript,
        metadata=response.metadata,
        audio_b64=response.audio_b64,
        audio_sample_rate=response.audio_sample_rate,
        stt_confidence=response.stt_confidence,
        stt_language=response.stt_language,
        tool_events=response.tool_events,
        logs=response.logs,
    )
