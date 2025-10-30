"""
Streaming chat endpoint with Server-Sent Events.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError

from apps.api.config import settings
from apps.api.routes.deps import get_current_user_with_collection_access, get_chat_service
from apps.api.utils.response_formatting import sse_format

from .models import ChatRequest

logger = logging.getLogger(__name__)

router = APIRouter()

HEARTBEAT_INTERVAL_SECONDS = 15


@router.post("/chat")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    chat_service=Depends(get_chat_service),
):
    """
    Chat endpoint with streaming support and tool calling.

    IMPORTANT: This implements the strict single-tool stepper pattern.
    - Tool calls are executed internally
    - Only final answers are streamed to the client
    - Thinking traces are captured but NOT streamed

    Rate limit: 100/minute per user (enforced by global rate limiter with user identification)
    """
    logger.info(
        "Chat request received",
        extra={
            "message_count": len(chat_request.messages),
            "enable_tools": chat_request.enable_tools,
            "stream": chat_request.stream,
        },
    )

    if chat_request.stream:

        async def generate():
            """Generate SSE stream."""
            pad_pending = True

            try:
                # Use ChatService for business logic
                # Convert messages list to the format expected by send_message_streaming
                messages_data = [{"role": msg.role, "content": msg.content} for msg in chat_request.messages]

                async for event in chat_service.send_message_streaming(
                    user=current_user,
                    text_input=messages_data[-1]["content"] if messages_data else "",
                    session_id=chat_request.session_id or "default",
                    messages=messages_data[:-1] if len(messages_data) > 1 else [],
                    model=chat_request.model,
                    enable_tools=chat_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                ):
                    pad = pad_pending
                    pad_pending = False
                    yield sse_format(event, pad=pad)
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error(
                    "Error during chat streaming",
                    extra={"error": error_msg, "status_code": e.response.status_code},
                )
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                    },
                }
                yield sse_format(log_frame, pad=pad_pending)
                pad_pending = False
                done_frame = {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "status": "error",
                            "error": error_msg,
                        },
                        "final_text": f"Errore: {error_msg}",
                    },
                }
                yield sse_format(done_frame, pad=False)
            except Exception as e:
                error_msg = str(e)
                logger.error(
                    "Error during chat streaming",
                    extra={"error": error_msg, "error_type": type(e).__name__},
                    exc_info=True,
                )
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                    },
                }
                yield sse_format(log_frame, pad=pad_pending)
                pad_pending = False
                done_frame = {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "status": "error",
                            "error": error_msg,
                        },
                        "final_text": f"Errore: {error_msg}",
                    },
                }
                yield sse_format(done_frame, pad=False)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming response - Use ChatService
    messages_data = [{"role": msg.role, "content": msg.content} for msg in chat_request.messages]

    response = await chat_service.send_message(
        user=current_user,
        text_input=messages_data[-1]["content"] if messages_data else "",
        session_id=chat_request.session_id or "default",
        messages=messages_data[:-1] if len(messages_data) > 1 else [],
        model=chat_request.model,
        enable_tools=chat_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
    )

    return {"content": response.content, "metadata": response.metadata}
