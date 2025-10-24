"""
Chat-related API endpoints.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.auth.security import get_current_active_user, sanitize_input
from packages.llm import ChatMessage
from packages.db import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")
limiter = Limiter(key_func=get_remote_address)

SUPPORTED_ASSISTANT_LANGUAGES = {"it", "en"}


def _resolve_assistant_language(requested: str | None) -> str:
    candidate = (requested or settings.agent_default_language).strip().lower()
    if candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    fallback = settings.agent_default_language.strip().lower()
    if fallback in SUPPORTED_ASSISTANT_LANGUAGES:
        if candidate:
            logger.debug(
                "Unsupported assistant language '%s'; falling back to '%s'",
                candidate,
                fallback,
            )
        return fallback

    if candidate and candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    if fallback:
        logger.debug(
            "Fallback assistant language '%s' is unsupported; defaulting to 'it'",
            fallback,
        )
    return "it"


def _prepare_chat_messages(raw_messages: list[dict[str, Any]]) -> list[ChatMessage]:
    """Convert raw payload messages into sanitized ChatMessage objects."""
    prepared: list[ChatMessage] = []
    for msg in raw_messages or []:
        role = (msg.get("role") or "user").strip().lower()
        if role not in {"user", "assistant", "system", "tool"}:
            role = "user"
        content = msg.get("content", "") or ""
        if role in {"user", "system"}:
            content = sanitize_input(content)
        prepared.append(ChatMessage(role=role, content=content))
    return prepared


# Request/Response models
class ChatRequest(BaseModel):
    """Chat request model."""
    messages: list[dict[str, str]]  # [{role, content}]
    session_id: str | None = None
    stream: bool = True
    enable_tools: bool = True
    model: str | None = None
    assistant_language: str | None = None


class UnifiedChatRequest(BaseModel):
    """Unified chat request that supports both text and audio input."""
    messages: list[dict[str, str]]
    text_input: str | None = None
    audio_b64: str | None = None
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    stream: bool = True
    assistant_language: str | None = None


class UnifiedChatResponse(BaseModel):
    """Unified chat response payload."""
    content: str
    transcript: str | None = None
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None


class VoiceTurnRequest(BaseModel):
    """Turn-based voice interaction request."""
    messages: list[dict[str, str]]
    audio_b64: str
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = True
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    assistant_language: str | None = None


class VoiceTurnResponse(BaseModel):
    """Voice turn response payload."""
    transcript: str
    assistant_text: str
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None


def get_agent_dependencies():
    """Get agent dependencies."""
    from apps.api.main import agent_loop, ollama_client
    from apps.api.audio_pipeline import (
        synthesize_speech,
        transcribe_audio_pcm16,
    )
    return agent_loop, ollama_client, transcribe_audio_pcm16, synthesize_speech


async def _get_current_user(current_user=Depends(get_current_active_user)):
    """Get current authenticated user."""
    user = current_user
    # Ensure root has access to default collection
    try:
        from packages.vectorstore.schema import DEFAULT_COLLECTION
        from packages.db.crud import grant_user_collection_access
        from apps.api.main import get_async_session as main_get_async_session
        async with main_get_async_session() as db:
            await grant_user_collection_access(db, user_id=user.id, collection_name=DEFAULT_COLLECTION)
    except (AttributeError, ImportError, ValueError) as e:
        logger.debug(f"Could not grant default collection access: {e}")
        pass
    return {"id": user.id, "username": user.username, "is_root": user.is_root}


@router.post("/chat")
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request, 
    chat_request: ChatRequest, 
    current_user=Depends(_get_current_user)
):
    """
    Chat endpoint with streaming support and tool calling.

    IMPORTANT: This implements the strict single-tool stepper pattern.
    - Tool calls are executed internally
    - Only final answers are streamed to the client
    - Thinking traces are captured but NOT streamed
    """
    agent_loop, ollama_client, _, _ = get_agent_dependencies()
    
    if not agent_loop:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    # Convert request messages to ChatMessage objects
    messages = _prepare_chat_messages(chat_request.messages)

    assistant_language = _resolve_assistant_language(chat_request.assistant_language)

    # Use specified model or default
    if chat_request.model:
        agent_loop.model = chat_request.model
    else:
        agent_loop.model = settings.chat_model

    logger.info(
        "Chat request: %s messages, tools=%s, language=%s",
        len(messages),
        chat_request.enable_tools,
        assistant_language,
    )

    if chat_request.stream:
        # Streaming response
        def format_sse(event: dict[str, Any]) -> str:
            event_name = event.get("event", "message")
            payload = event.get("data", {})
            # Add padding comment to force browser flush (browsers buffer small chunks)
            # Most browsers flush when they receive at least 2KB of data
            padding = ": " + (" " * 2048) + "\n"
            return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n{padding}\n"

        async def generate():
            """Generate SSE stream."""
            try:
                last_tool_run_id = [None]  # type: ignore
                # Create or get chat session
                async with get_async_session() as db:
                    from packages.db.crud import get_or_create_session, add_message
                    cs = await get_or_create_session(
                        db,
                        user_id=current_user["id"],
                        external_id=chat_request.session_id,
                        model=agent_loop.model,
                        enable_tools=chat_request.enable_tools,
                    )
                    # Persist latest user message (the last one in the provided list)
                    if messages and messages[-1].role == "user":
                        await add_message(db, session_id=cs.id, role="user", content=messages[-1].content)

                async for event in agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=chat_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
                ):
                    # Persist tool runs
                    if event.get("event") == "tool":
                        data = event.get("data", {})
                        if data.get("status") == "start":
                            # Record start
                            async with get_async_session() as db:
                                from packages.db.crud import start_tool_run
                                tr = await start_tool_run(
                                    db,
                                    user_id=current_user["id"],
                                    session_id=None,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=datetime.fromisoformat(data.get("ts")),
                                )
                                last_tool_run_id[0] = tr.id  # type: ignore
                        elif data.get("status") == "end":
                            async with get_async_session() as db:
                                from packages.db.crud import finish_tool_run
                                if last_tool_run_id[0] is not None:
                                    await finish_tool_run(
                                        db,
                                        run_id=last_tool_run_id[0],
                                        status="success",
                                        end_ts=datetime.fromisoformat(data.get("ts")),
                                        latency_ms=int(data.get("latency_ms")) if data.get("latency_ms") is not None else None,
                                        result_preview=(data.get("result_preview") or None),
                                        tool_name=data.get("tool"),
                                    )
                    elif event.get("event") == "done":
                        payload = event.setdefault("data", {})
                        if not isinstance(payload, dict):
                            payload = {}
                            event["data"] = payload
                        metadata = payload.get("metadata") or {}
                        if not isinstance(metadata, dict):
                            metadata = {}
                        metadata["assistant_language"] = assistant_language
                        payload["metadata"] = metadata

                        # Persist assistant final message
                        final = payload.get("final_text") or ""
                        async with get_async_session() as db:
                            from packages.db.crud import get_or_create_session, add_message
                            cs = await get_or_create_session(
                                db,
                                user_id=current_user["id"],
                                external_id=chat_request.session_id,
                                model=agent_loop.model,
                                enable_tools=chat_request.enable_tools,
                            )
                            await add_message(db, session_id=cs.id, role="assistant", content=final)
                    elif event.get("event") == "log":
                        payload = event.setdefault("data", {})
                        if isinstance(payload, dict):
                            payload.setdefault("assistant_language", assistant_language)
                    yield format_sse(event)
                    # Force immediate flush by yielding control to event loop
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during chat: %s", error_msg)
                yield format_sse(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                            "assistant_language": assistant_language,
                        },
                    }
                )
                yield format_sse(
                    {
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
                )
            except Exception as e:
                error_msg = str(e)
                logger.error("Error during chat: %s", error_msg)
                yield format_sse(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                            "assistant_language": assistant_language,
                        },
                    }
                )
                yield format_sse(
                    {
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
                )

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    else:
        # Non-streaming response
        collected_chunks: list[str] = []
        final_text: str | None = None

        metadata: dict[str, Any] = {"assistant_language": assistant_language}

        async for event in agent_loop.run_until_completion(
            messages=messages,
            enable_tools=chat_request.enable_tools,
            max_iterations=settings.max_agent_iterations,
            language=assistant_language,
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
        # Persist final assistant message and session update
        async with get_async_session() as db:
            from packages.db.crud import get_or_create_session, add_message
            cs = await get_or_create_session(
                db,
                user_id=current_user["id"],
                external_id=chat_request.session_id,
                model=agent_loop.model,
                enable_tools=chat_request.enable_tools,
            )
            await add_message(
                db,
                session_id=cs.id,
                role="assistant",
                content=final_text if final_text is not None else "".join(collected_chunks),
            )

        response_text = final_text if final_text is not None else "".join(collected_chunks)
        return {"content": response_text, "metadata": metadata}


@router.post("/voice-turn", response_model=VoiceTurnResponse)
@limiter.limit("20/minute")
async def voice_turn_endpoint(
    request: Request, 
    voice_request: VoiceTurnRequest, 
    current_user=Depends(_get_current_user)
):
    """
    Turn-based voice endpoint that handles audio transcription, agent reasoning,
    and optional TTS synthesis.
    """
    agent_loop, _, transcribe_audio_pcm16, synthesize_speech = get_agent_dependencies()
    
    if not agent_loop:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    import base64
    try:
        audio_bytes = base64.b64decode(voice_request.audio_b64)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

    try:
        stt_result = await transcribe_audio_pcm16(audio_bytes, voice_request.sample_rate)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Voice transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail="Transcription failed")

    transcript_raw = (stt_result.get("text") or "").strip()
    transcript = sanitize_input(transcript_raw)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcription produced empty text")

    # Build conversation history and append the new user message
    conversation: list[ChatMessage] = _prepare_chat_messages(voice_request.messages)
    conversation.append(ChatMessage(role="user", content=transcript))

    assistant_language = _resolve_assistant_language(voice_request.assistant_language)

    agent_loop.model = voice_request.model or settings.chat_model

    # Persist user turn
    chat_session_id: int | None = None
    async with get_async_session() as db:
        from packages.db.crud import get_or_create_session, add_message

        chat_session = await get_or_create_session(
            db,
            user_id=current_user["id"],
            external_id=voice_request.session_id,
            model=agent_loop.model,
            enable_tools=voice_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await add_message(
            db,
            session_id=chat_session.id,
            role="user",
            content=transcript,
        )

    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []
    pending_tool_run: int | None = None

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=voice_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
    ):
        etype = event.get("event")
        data = event.get("data", {}) or {}

        if etype == "token":
            final_text += data.get("text", "")

        elif etype == "tool":
            tool_events.append(data)
            status = data.get("status")
            ts = data.get("ts")
            try:
                parsed_ts = datetime.fromisoformat(ts) if ts else datetime.utcnow()
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid timestamp format: {e}, using current time")
                parsed_ts = datetime.utcnow()

            if status == "start":
                async with get_async_session() as db:
                    from packages.db.crud import start_tool_run

                    tr = await start_tool_run(
                        db,
                        user_id=current_user["id"],
                        session_id=chat_session_id,
                        tool_name=data.get("tool", ""),
                        args=data.get("args"),
                        start_ts=parsed_ts,
                    )
                    pending_tool_run = tr.id
            else:
                if pending_tool_run is not None:
                    async with get_async_session() as db:
                        from packages.db.crud import finish_tool_run

                        latency_val = data.get("latency_ms")
                        latency_ms = None
                        if isinstance(latency_val, (int, float)):
                            latency_ms = int(latency_val)

                        status_str = status or "unknown"
                        if status_str == "end":
                            status_str = "success"

                        await finish_tool_run(
                            db,
                            run_id=pending_tool_run,
                            status=status_str,
                            end_ts=parsed_ts,
                            latency_ms=latency_ms,
                            result_preview=data.get("result_preview"),
                            tool_name=data.get("tool"),
                        )
                    pending_tool_run = None

        elif etype == "log":
            logs.append(
                {
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", ""),
                    "assistant_language": assistant_language,
                }
            )

        elif etype == "done":
            metadata = data.get("metadata", {}) or {}
            if isinstance(metadata, dict):
                metadata.setdefault("assistant_language", assistant_language)
            if not final_text:
                final_text = data.get("final_text", "") or ""

    metadata = metadata or {}
    if isinstance(metadata, dict):
        metadata.setdefault("assistant_language", assistant_language)
    final_text = (final_text or "").strip()

    if chat_session_id is not None and final_text:
        async with get_async_session() as db:
            from packages.db.crud import add_message

            await add_message(
                db,
                session_id=chat_session_id,
                role="assistant",
                content=final_text,
            )

    audio_b64: str | None = None
    audio_sample_rate: int | None = None

    if voice_request.expect_audio and final_text:
        try:
            synth_result = await synthesize_speech(final_text)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Voice synthesis failed: %s", exc)

    return VoiceTurnResponse(
        transcript=transcript,
        assistant_text=final_text,
        metadata=metadata,
        audio_b64=audio_b64,
        audio_sample_rate=audio_sample_rate,
        stt_confidence=stt_result.get("confidence"),
        stt_language=stt_result.get("language"),
        tool_events=tool_events,
        logs=logs,
        assistant_language=assistant_language,
    )


@router.post("/unified-chat", response_model=UnifiedChatResponse)
@limiter.limit("30/minute")
async def unified_chat_endpoint(
    request: Request, 
    unified_request: UnifiedChatRequest, 
    current_user=Depends(_get_current_user)
):
    """
    Unified chat endpoint that supports both text and audio input.
    
    Handles three scenarios:
    1. Text input only -> uses chat streaming
    2. Audio input only -> transcribes and processes
    3. Both text and audio -> prioritizes text input
    
    Always returns text response, optionally with audio.
    """
    agent_loop, _, transcribe_audio_pcm16, synthesize_speech = get_agent_dependencies()
    
    if not agent_loop:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    # Determine input type and process accordingly
    if unified_request.text_input and unified_request.text_input.strip():
        # Text input takes precedence
        text_content = sanitize_input(unified_request.text_input)
        transcript = None
        stt_confidence = None
        stt_language = None
    elif unified_request.audio_b64:
        # Audio input only
        try:
            import base64
            audio_bytes = base64.b64decode(unified_request.audio_b64)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

        try:
            stt_result = await transcribe_audio_pcm16(audio_bytes, unified_request.sample_rate)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Voice transcription failed: %s", exc)
            raise HTTPException(status_code=500, detail="Transcription failed")

        detected_text = (stt_result.get("text") or "").strip()
        text_content = sanitize_input(detected_text)
        transcript = text_content
        stt_confidence = stt_result.get("confidence")
        stt_language = stt_result.get("language")
        
        if not text_content:
            raise HTTPException(status_code=400, detail="Transcription produced empty text")
    else:
        raise HTTPException(status_code=400, detail="Either text_input or audio_b64 must be provided")

    # Build conversation history and append the new user message
    conversation: list[ChatMessage] = _prepare_chat_messages(unified_request.messages)
    conversation.append(ChatMessage(role="user", content=text_content))

    assistant_language = _resolve_assistant_language(unified_request.assistant_language)

    agent_loop.model = unified_request.model or settings.chat_model

    # Persist user turn
    chat_session_id: int | None = None
    async with get_async_session() as db:
        from packages.db.crud import get_or_create_session, add_message

        chat_session = await get_or_create_session(
            db,
            user_id=current_user["id"],
            external_id=unified_request.session_id,
            model=agent_loop.model,
            enable_tools=unified_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await add_message(
            db,
            session_id=chat_session.id,
            role="user",
            content=text_content,
        )

    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []
    pending_tool_run: int | None = None

    if unified_request.stream:
        # Streaming response - similar to chat endpoint
        collected_chunks: list[str] = []

        def format_sse(event: dict[str, Any]) -> str:
            event_name = event.get("event", "message")
            payload = event.get("data", {})
            # Add padding comment to force browser flush
            padding = ": " + (" " * 2048) + "\n"
            return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n{padding}\n"

        async def generate():
            """Generate SSE stream."""
            local_final_text = ""
            local_metadata = dict(metadata)
            try:
                last_tool_run_id = [None]  # type: ignore

                async for event in agent_loop.run_until_completion(
                    messages=conversation,
                    enable_tools=unified_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
                ):
                    # Persist tool runs
                    if event.get("event") == "tool":
                        data = event.get("data", {})
                        if isinstance(data, dict):
                            tool_events.append(data)
                        if data.get("status") == "start":
                            async with get_async_session() as db:
                                from packages.db.crud import start_tool_run
                                tr = await start_tool_run(
                                    db,
                                    user_id=current_user["id"],
                                    session_id=chat_session_id,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=datetime.fromisoformat(data.get("ts")),
                                )
                                last_tool_run_id[0] = tr.id  # type: ignore
                        elif data.get("status") == "end":
                            async with get_async_session() as db:
                                from packages.db.crud import finish_tool_run
                                if last_tool_run_id[0] is not None:
                                    await finish_tool_run(
                                        db,
                                        run_id=last_tool_run_id[0],
                                        status="success",
                                        end_ts=datetime.fromisoformat(data.get("ts")),
                                        latency_ms=int(data.get("latency_ms")) if data.get("latency_ms") is not None else None,
                                        result_preview=(data.get("result_preview") or None),
                                        tool_name=data.get("tool"),
                                    )
                    elif event.get("event") == "token":
                        payload = event.setdefault("data", {})
                        if isinstance(payload, dict):
                            payload.setdefault("assistant_language", assistant_language)
                            text = payload.get("text", "")
                        else:
                            text = ""
                        collected_chunks.append(text)
                        yield format_sse(event)
                    elif event.get("event") == "done":
                        payload = event.setdefault("data", {})
                        if not isinstance(payload, dict):
                            payload = {}
                            event["data"] = payload
                        meta = payload.get("metadata") or {}
                        if not isinstance(meta, dict):
                            meta = {}
                        meta["assistant_language"] = assistant_language
                        payload["metadata"] = meta
                        local_metadata = meta

                        final = payload.get("final_text") or ""
                        if not local_final_text:
                            local_final_text = "".join(collected_chunks) + final
                        persisted_text = local_final_text or "".join(collected_chunks)

                        # Persist assistant final message
                        async with get_async_session() as db:
                            from packages.db.crud import add_message
                            await add_message(
                                db,
                                session_id=chat_session_id,
                                role="assistant",
                                content=persisted_text,
                            )

                        # Generate audio if requested
                        audio_b64 = None
                        audio_sample_rate = None
                        if unified_request.expect_audio and persisted_text:
                            try:
                                synth_result = await synthesize_speech(persisted_text)
                                if synth_result:
                                    import base64
                                    wav_bytes, sr = synth_result
                                    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                                    audio_sample_rate = sr
                            except Exception as exc:  # pragma: no cover - defensive
                                logger.error("Voice synthesis failed: %s", exc)

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
                        yield format_sse({"event": "done", "data": response.model_dump()})
                    
                    elif event.get("event") == "log":
                        log_data = event.setdefault("data", {}) or {}
                        if isinstance(log_data, dict):
                            log_data.setdefault("assistant_language", assistant_language)
                            logs.append({
                                "level": log_data.get("level", "info"),
                                "msg": log_data.get("msg", ""),
                                "assistant_language": assistant_language,
                            })
                        else:
                            logs.append({
                                "level": "info",
                                "msg": str(log_data),
                                "assistant_language": assistant_language,
                            })
                        yield format_sse(event)
                    
                    # Force immediate flush
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during unified chat: %s", error_msg)
                yield format_sse(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                            "assistant_language": assistant_language,
                        },
                    }
                )
                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=transcript,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                        "assistant_language": assistant_language,
                    },
                    audio_b64=None,
                    audio_sample_rate=None,
                    stt_confidence=stt_confidence,
                    stt_language=stt_language,
                    tool_events=tool_events,
                    logs=logs,
                    assistant_language=assistant_language,
                )
                yield format_sse({"event": "done", "data": error_response.model_dump()})
            except Exception as e:
                error_msg = str(e)
                logger.error("Error during unified chat: %s", error_msg)
                yield format_sse(
                    {
                        "event": "log",
                        "data": {
                            "level": "error",
                            "msg": error_msg,
                            "assistant_language": assistant_language,
                        },
                    }
                )
                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=transcript,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                        "assistant_language": assistant_language,
                    },
                    audio_b64=None,
                    audio_sample_rate=None,
                    stt_confidence=stt_confidence,
                    stt_language=stt_language,
                    tool_events=tool_events,
                    logs=logs,
                    assistant_language=assistant_language,
                )
                yield format_sse({"event": "done", "data": error_response.model_dump()})

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        # Non-streaming response
        metadata = {"assistant_language": assistant_language}

        async for event in agent_loop.run_until_completion(
            messages=conversation,
            enable_tools=unified_request.enable_tools,
            max_iterations=settings.max_agent_iterations,
            language=assistant_language,
        ):
            etype = event.get("event")
            data = event.get("data", {}) or {}

            if etype == "token":
                final_text += data.get("text", "")
            elif etype == "tool":
                tool_events.append(data)
                status = data.get("status")
                ts = data.get("ts")
                try:
                    parsed_ts = datetime.fromisoformat(ts) if ts else datetime.utcnow()
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid timestamp format: {e}, using current time")
                    parsed_ts = datetime.utcnow()

                if status == "start":
                    async with get_async_session() as db:
                        from packages.db.crud import start_tool_run
                        tr = await start_tool_run(
                            db,
                            user_id=current_user["id"],
                            session_id=chat_session_id,
                            tool_name=data.get("tool", ""),
                            args=data.get("args"),
                            start_ts=parsed_ts,
                        )
                        pending_tool_run = tr.id
                else:
                    if pending_tool_run is not None:
                        async with get_async_session() as db:
                            from packages.db.crud import finish_tool_run
                            latency_val = data.get("latency_ms")
                            latency_ms = None
                            if isinstance(latency_val, (int, float)):
                                latency_ms = int(latency_val)

                            status_str = status or "unknown"
                            if status_str == "end":
                                status_str = "success"

                            await finish_tool_run(
                                db,
                                run_id=pending_tool_run,
                                status=status_str,
                                end_ts=parsed_ts,
                                latency_ms=latency_ms,
                                result_preview=data.get("result_preview"),
                                tool_name=data.get("tool"),
                            )
                        pending_tool_run = None

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

        metadata = metadata or {}
        if isinstance(metadata, dict):
            metadata.setdefault("assistant_language", assistant_language)
        final_text = (final_text or "").strip()

        if chat_session_id is not None and final_text:
            async with get_async_session() as db:
                from packages.db.crud import add_message
                await add_message(
                    db,
                    session_id=chat_session_id,
                    role="assistant",
                    content=final_text,
                )

        # Generate audio if requested
        audio_b64 = None
        audio_sample_rate = None

        if unified_request.expect_audio and final_text:
            try:
                synth_result = await synthesize_speech(final_text)
                if synth_result:
                    import base64
                    wav_bytes, sr = synth_result
                    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                    audio_sample_rate = sr
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("Voice synthesis failed: %s", exc)

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
