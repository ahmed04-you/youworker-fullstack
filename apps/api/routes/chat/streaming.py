"""
Streaming chat endpoint with Server-Sent Events.
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError

from apps.api.config import settings
from apps.api.routes.deps import get_agent_loop, get_current_user_with_collection_access
from apps.api.utils.response_formatting import sse_format
from packages.agent import AgentLoop
from packages.db import get_async_session

from .models import ChatRequest
from .helpers import ToolEventRecorder, prepare_chat_messages, get_user_id
from .persistence import (
    persist_last_user_message,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)

router = APIRouter()

HEARTBEAT_INTERVAL_SECONDS = 15


@router.post("/chat")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Chat endpoint with streaming support and tool calling.

    IMPORTANT: This implements the strict single-tool stepper pattern.
    - Tool calls are executed internally
    - Only final answers are streamed to the client
    - Thinking traces are captured but NOT streamed

    Rate limit: 100/minute per user (enforced by global rate limiter with user identification)
    """
    messages = await prepare_chat_messages(chat_request.messages)
    request_model = chat_request.model or settings.chat_model
    user_id = get_user_id(current_user)

    logger.info(
        "Chat request: %s messages, tools=%s",
        len(messages),
        chat_request.enable_tools,
    )

    if chat_request.stream:

        async def generate():
            """Generate SSE stream."""
            pad_pending = True
            tool_recorder: ToolEventRecorder | None = None

            try:
                async with get_async_session() as db:
                    session = await get_or_create_chat_session(
                        db,
                        user_id=user_id,
                        external_id=chat_request.session_id,
                        model=request_model,
                        enable_tools=chat_request.enable_tools,
                    )
                    await persist_last_user_message(db, session, messages)
                    chat_session_id = session.id
                tool_recorder = ToolEventRecorder(user_id=user_id, session_id=chat_session_id)

                event_iterator = agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=chat_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    model=request_model,
                ).__aiter__()

                while True:
                    try:
                        event = await asyncio.wait_for(
                            event_iterator.__anext__(),
                            timeout=HEARTBEAT_INTERVAL_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        heartbeat = {"event": "heartbeat", "data": {}}
                        yield sse_format(heartbeat, pad=pad_pending)
                        pad_pending = False
                        await asyncio.sleep(0)
                        continue
                    except StopAsyncIteration:
                        break

                    pad = pad_pending
                    pad_pending = False

                    event_type = event.get("event")

                    # Handle tool events
                    if event_type == "tool":
                        payload_data = event.get("data", {}) or {}
                        if tool_recorder is not None:
                            payload_data = await tool_recorder.record(payload_data)
                        event["data"] = payload_data
                        yield sse_format({"event": "tool", "data": payload_data}, pad=pad)
                        await asyncio.sleep(0)
                        continue

                    # Handle done event
                    elif event_type == "done":
                        payload = event.setdefault("data", {})
                        if not isinstance(payload, dict):
                            payload = {}
                            event["data"] = payload

                        metadata = payload.get("metadata") or {}
                        if not isinstance(metadata, dict):
                            metadata = {}
                        payload["metadata"] = metadata

                        final = payload.get("final_text") or ""
                        async with get_async_session() as db:
                            await persist_final_assistant_message(db, chat_session_id, final)

                    # Handle log event
                    elif event_type == "log":
                        payload = event.setdefault("data", {})

                    yield sse_format(event, pad=pad)
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during chat: %s", error_msg)
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
                logger.error("Error during chat: %s", error_msg, exc_info=True)
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

    # Non-streaming response
    collected_chunks: list[str] = []
    final_text: str | None = None
    metadata: dict[str, Any] = {}

    async with get_async_session() as db:
        session = await get_or_create_chat_session(
            db,
            user_id=user_id,
            external_id=chat_request.session_id,
            model=request_model,
            enable_tools=chat_request.enable_tools,
        )
        await persist_last_user_message(db, session, messages)
        chat_session_id = session.id

    tool_recorder = ToolEventRecorder(user_id=user_id, session_id=chat_session_id)

    async for event in agent_loop.run_until_completion(
        messages=messages,
        enable_tools=chat_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        model=request_model,
    ):
        event_type = event.get("event")
        data = event.get("data", {}) or {}

        if event_type == "tool":
            await tool_recorder.record(data)
            continue

        if event_type == "token":
            text = data.get("text", "")
            if text:
                collected_chunks.append(text)
            continue

        if event_type == "done":
            meta = data.get("metadata") or {}
            if isinstance(meta, dict):
                metadata.update(meta)
            final_text = data.get("final_text", final_text)
            continue

        if event_type == "log":
            # Non-streaming mode ignores logs for now but could persist if needed.
            continue

    response_text = final_text if final_text is not None else "".join(collected_chunks)

    async with get_async_session() as db:
        await persist_final_assistant_message(db, chat_session_id, response_text)

    return {"content": response_text, "metadata": metadata}
