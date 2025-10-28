"""
Streaming chat endpoint with Server-Sent Events.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.routes.deps import get_agent_loop, get_current_user_with_collection_access
from apps.api.utils.response_formatting import sse_format
from packages.agent import AgentLoop
from packages.db import get_async_session

from .models import ChatRequest
from .helpers import prepare_chat_messages, resolve_assistant_language, get_user_id
from .persistence import (
    persist_last_user_message,
    record_tool_start,
    record_tool_end,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

HEARTBEAT_INTERVAL_SECONDS = 15


@router.post("/chat")
@limiter.limit("30/minute")
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
    """
    messages = await prepare_chat_messages(chat_request.messages)
    assistant_language = resolve_assistant_language(chat_request.assistant_language)
    request_model = chat_request.model or settings.chat_model
    user_id = get_user_id(current_user)

    logger.info(
        "Chat request: %s messages, tools=%s, language=%s",
        len(messages),
        chat_request.enable_tools,
        assistant_language,
    )

    if chat_request.stream:

        async def generate():
            """Generate SSE stream."""
            pad_pending = True
            last_tool_run_id: int | None = None

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

                event_iterator = agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=chat_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
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
                        data = event.get("data", {}) or {}
                        ts_raw = data.get("ts")
                        try:
                            parsed_ts = (
                                datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
                            )
                        except (TypeError, ValueError):
                            logger.warning("Invalid tool timestamp '%s'", ts_raw)
                            parsed_ts = datetime.utcnow()

                        if data.get("status") == "start":
                            async with get_async_session() as db:
                                last_tool_run_id = await record_tool_start(
                                    db,
                                    user_id=user_id,
                                    session_id=None,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=parsed_ts,
                                )
                        else:
                            latency_val = data.get("latency_ms")
                            latency_ms = None
                            if isinstance(latency_val, (int, float)):
                                latency_ms = int(latency_val)

                            async with get_async_session() as db:
                                await record_tool_end(
                                    db,
                                    run_id=last_tool_run_id,
                                    status=data.get("status"),
                                    end_ts=parsed_ts,
                                    latency_ms=latency_ms,
                                    result_preview=(data.get("result_preview") or None),
                                    tool_name=data.get("tool"),
                                )
                            last_tool_run_id = None

                    # Handle done event
                    elif event_type == "done":
                        payload = event.setdefault("data", {})
                        if not isinstance(payload, dict):
                            payload = {}
                            event["data"] = payload

                        metadata = payload.get("metadata") or {}
                        if not isinstance(metadata, dict):
                            metadata = {}
                        metadata["assistant_language"] = assistant_language
                        payload["metadata"] = metadata

                        final = payload.get("final_text") or ""
                        async with get_async_session() as db:
                            await persist_final_assistant_message(db, chat_session_id, final)

                    # Handle log event
                    elif event_type == "log":
                        payload = event.setdefault("data", {})
                        if isinstance(payload, dict):
                            payload.setdefault("assistant_language", assistant_language)

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
                        "assistant_language": assistant_language,
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
                            "assistant_language": assistant_language,
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
                        "assistant_language": assistant_language,
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
                            "assistant_language": assistant_language,
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
    metadata: dict[str, Any] = {"assistant_language": assistant_language}

    async for event in agent_loop.run_until_completion(
        messages=messages,
        enable_tools=chat_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
        model=request_model,
    ):
        if event.get("event") == "token":
            text = event.get("data", {}).get("text", "")
            collected_chunks.append(text)
        elif event.get("event") == "done":
            payload = event.get("data", {}) or {}
            meta = payload.get("metadata") or {}
            if isinstance(meta, dict):
                metadata.update(meta)
            metadata["assistant_language"] = assistant_language
            final_text = payload.get("final_text", final_text)

    response_text = final_text if final_text is not None else "".join(collected_chunks)

    async with get_async_session() as db:
        session = await get_or_create_chat_session(
            db,
            user_id=user_id,
            external_id=chat_request.session_id,
            model=request_model,
            enable_tools=chat_request.enable_tools,
        )
        await persist_final_assistant_message(db, session.id, response_text)

    return {"content": response_text, "metadata": metadata}
