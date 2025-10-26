"""
Unified chat endpoint supporting both text and audio input.
"""

import asyncio
import base64
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.auth.security import sanitize_input
from typing import Optional

from apps.api.audio_pipeline import transcribe_audio_pcm16, synthesize_speech
from apps.api.routes.deps import get_agent_loop, get_current_user_with_collection_access
from apps.api.utils.error_handling import handle_audio_errors, handle_ollama_errors
from apps.api.utils.response_formatting import sse_format
from packages.agent import AgentLoop
from packages.db import get_async_session
from packages.llm import ChatMessage

from .helpers import handle_tool_event, prepare_chat_messages, resolve_assistant_language


from .models import UnifiedChatRequest, UnifiedChatResponse
from .persistence import (
    persist_last_user_message,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

HEARTBEAT_INTERVAL_SECONDS = 15


async def process_input(
    unified_request: UnifiedChatRequest,
) -> tuple[str, str | None, float | None, str | None]:
    """
    Process text or audio input.

    Returns:
        Tuple of (text_content, transcript, stt_confidence, stt_language)
    """
    if unified_request.text_input and unified_request.text_input.strip():
        text_content = sanitize_input(unified_request.text_input)
        return text_content, None, None, None

    elif unified_request.audio_b64:
        try:
            audio_bytes = base64.b64decode(unified_request.audio_b64)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

        try:
            stt_result = await transcribe_audio_pcm16(audio_bytes, unified_request.sample_rate)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            logger.error("Voice transcription failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail="Transcription failed")

        detected_text = (stt_result.get("text") or "").strip()
        text_content = sanitize_input(detected_text)

        if not text_content:
            raise HTTPException(status_code=400, detail="Transcription produced empty text")

        return (
            text_content,
            text_content,
            stt_result.get("confidence"),
            stt_result.get("language"),
        )
    else:
        raise HTTPException(
            status_code=400, detail="Either text_input or audio_b64 must be provided"
        )


@router.post("/unified-chat", response_model=UnifiedChatResponse)
@limiter.limit("30/minute")
@handle_audio_errors
@handle_ollama_errors
async def unified_chat_endpoint(
    request: Request,
    unified_request: UnifiedChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Unified chat endpoint that supports both text and audio input.

    Handles three scenarios:
    1. Text input only -> uses chat streaming
    2. Audio input only -> transcribes and processes
    3. Both text and audio -> prioritizes text input

    Always returns text response, optionally with audio.
    """
    # Process input (text or audio)
    text_content, transcript, stt_confidence, stt_language = await process_input(unified_request)

    # Build conversation
    conversation: list[ChatMessage] = await prepare_chat_messages(unified_request.messages or [])
    conversation.append(ChatMessage(role="user", content=text_content))

    assistant_language = resolve_assistant_language(unified_request.assistant_language or "")
    request_model = unified_request.model or settings.chat_model

    # Create/get session
    async with get_async_session() as db:
        chat_session = await get_or_create_chat_session(
            db,
            user_id=current_user["id"],
            external_id=unified_request.session_id or "default",
            model=request_model,
            enable_tools=unified_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await persist_last_user_message(db, chat_session, conversation)

    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []
    last_tool_run_id: Optional[int] = None

    # Streaming response
    if unified_request.stream:

        async def generate():
            pad_pending = True
            collected_chunks: list[str] = []
            local_final_text = ""
            local_metadata: dict[str, Any] = {"assistant_language": assistant_language}
            last_tool_run_id_local: Optional[int] = last_tool_run_id

            try:
                async for event in agent_loop.run_until_completion(
                    messages=conversation,
                    enable_tools=unified_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
                    model=request_model,
                ):
                    event_type = event.get("event")
                    data = event.get("data", {}) or {}

                    if event_type == "tool":
                        async with get_async_session() as db:
                            last_tool_run_id_local, data = await handle_tool_event(
                                db,
                                current_user["id"],
                                chat_session_id,
                                data,
                                last_tool_run_id_local,
                            )
                        tool_events.append(data)
                        pad = pad_pending
                        pad_pending = False
                        yield sse_format({"event": event_type, "data": data}, pad=pad)
                        await asyncio.sleep(0)
                        continue

                    elif event_type == "token":
                        if isinstance(data, dict):
                            data.setdefault("assistant_language", assistant_language)
                            text = data.get("text", "")
                        else:
                            text = ""
                        collected_chunks.append(text)
                        pad = pad_pending
                        pad_pending = False
                        yield sse_format(event, pad=pad)
                        await asyncio.sleep(0)
                        continue

                    elif event_type == "log":
                        if isinstance(data, dict):
                            data.setdefault("assistant_language", assistant_language)
                            logs.append(data.copy())
                        pad = pad_pending
                        pad_pending = False
                        yield sse_format(event, pad=pad)
                        await asyncio.sleep(0)
                        continue

                    elif event_type == "done":
                        if not isinstance(data, dict):
                            data = {}
                            event["data"] = data

                        meta = data.get("metadata") or {}
                        if not isinstance(meta, dict):
                            meta = {}
                        meta["assistant_language"] = assistant_language
                        local_metadata = meta
                        data["metadata"] = meta

                        # Prefer the final_text provided by the agent; if absent, join collected chunks.
                        final_piece = data.get("final_text") or ""
                        if not local_final_text:
                            # Avoid duplication when final_text already contains the accumulated chunks.
                            local_final_text = final_piece or "".join(collected_chunks)
                        persisted_text = local_final_text or "".join(collected_chunks)

                        async with get_async_session() as db:
                            await persist_final_assistant_message(
                                db, chat_session_id, persisted_text
                            )

                        # Synthesize audio if requested
                        audio_b64 = None
                        audio_sample_rate = None
                        if unified_request.expect_audio and persisted_text:
                            try:
                                # Allow fallback beep when TTS voice is unavailable.
                                synth_result = await synthesize_speech(
                                    persisted_text, fallback=True
                                )
                                if synth_result:
                                    wav_bytes, sr = synth_result
                                    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                                    audio_sample_rate = sr
                            except Exception as exc:
                                logger.error("Voice synthesis failed: %s", exc, exc_info=True)

                        response = UnifiedChatResponse(
                            content=persisted_text,
                            transcript=transcript,
                            metadata=local_metadata,
                            audio_b64=audio_b64,
                            audio_sample_rate=audio_sample_rate,
                            stt_confidence=stt_confidence,
                            stt_language=stt_language,
                            tool_events=tool_events,
                            logs=logs,
                            assistant_language=assistant_language,
                        )
                        event["data"] = response.model_dump()
                        pad = pad_pending
                        pad_pending = False
                        yield sse_format(event, pad=pad)
                        await asyncio.sleep(0)
                        continue

                    # Heartbeat for long-running
                    try:
                        await asyncio.wait_for(asyncio.sleep(0), timeout=HEARTBEAT_INTERVAL_SECONDS)
                    except asyncio.TimeoutError:
                        heartbeat = {"event": "heartbeat", "data": {}}
                        yield sse_format(heartbeat, pad=pad_pending)
                        pad_pending = False
                        continue

            except (HTTPStatusError, Exception) as e:
                error_msg = (
                    f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                    if isinstance(e, HTTPStatusError)
                    else str(e)
                )
                logger.error("Error during unified chat: %s", error_msg, exc_info=True)

                yield sse_format(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                            "assistant_language": assistant_language,
                        },
                    },
                    pad=pad_pending,
                )

                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=transcript,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                        "assistant_language": assistant_language,
                    },
                    stt_confidence=stt_confidence,
                    stt_language=stt_language,
                    tool_events=tool_events,
                    logs=logs,
                    assistant_language=assistant_language,
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

    # Non-streaming response
    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    last_tool_run_id_nonstream: Optional[int] = last_tool_run_id

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=unified_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
        model=request_model,
    ):
        etype = event.get("event")
        data = event.get("data", {}) or {}

        if etype == "tool":
            async with get_async_session() as db:
                last_tool_run_id_nonstream, data = await handle_tool_event(
                    db, current_user["id"], chat_session_id, data, last_tool_run_id_nonstream
                )
            tool_events.append(data)
        elif etype == "token":
            final_text += data.get("text", "")
        elif etype == "log":
            logs.append(
                {
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", ""),
                    "assistant_language": assistant_language,
                }
            )
        elif etype == "done":
            meta = data.get("metadata", {}) or {}
            if isinstance(meta, dict):
                metadata.update(meta)
            metadata["assistant_language"] = assistant_language
            if not final_text:
                final_text = data.get("final_text", "") or ""

    final_text = (final_text or "").strip()

    if final_text:
        async with get_async_session() as db:
            await persist_final_assistant_message(db, chat_session_id, final_text)

    # Synthesize audio if requested
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    if unified_request.expect_audio and final_text:
        try:
            # Allow fallback beep when TTS voice is unavailable.
            synth_result = await synthesize_speech(final_text, fallback=True)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as exc:
            logger.error("Voice synthesis failed: %s", exc, exc_info=True)

    return UnifiedChatResponse(
        content=final_text,
        transcript=transcript,
        metadata=metadata,
        audio_b64=audio_b64,
        audio_sample_rate=audio_sample_rate,
        stt_confidence=stt_confidence,
        stt_language=stt_language,
        tool_events=tool_events,
        logs=logs,
        assistant_language=assistant_language,
    )
