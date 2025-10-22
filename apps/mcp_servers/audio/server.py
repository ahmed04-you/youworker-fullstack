"""
MCP server for real-time audio streaming (STT/TTS) and duplex control.

Tools:
- audio.input.stream: Allocate an audio session and return ingest WS endpoint
- stt.stream.transcribe: Enable online STT on a session; emits partial/final
- tts.stream.synthesize: Enable streaming TTS on a session; emits audio chunks
- barge_in.control: Pause/cancel/resume TTS for a session
- session.audio.duplex: Orchestrator for start/stop/status with basic metrics

Notes:
- This implementation is MCP-first and exposes WebSocket endpoints for low-latency streaming.
- STT uses faster-whisper if available (optional); otherwise returns a not-configured error.
- TTS provides a minimal dummy sine-wave generator by default; plug in a real TTS backend to enable.
- VAD uses webrtcvad when available to drive partial/final decisions.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import os
import struct
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

try:
    import webrtcvad  # type: ignore

    VAD_AVAILABLE = True
except Exception:  # pragma: no cover
    webrtcvad = None
    VAD_AVAILABLE = False

try:
    from faster_whisper import WhisperModel  # type: ignore

    FW_AVAILABLE = True
except Exception:  # pragma: no cover
    WhisperModel = None
    FW_AVAILABLE = False

try:
    from piper import PiperVoice  # type: ignore

    PIPER_AVAILABLE = True
except Exception:  # pragma: no cover
    PiperVoice = None
    PIPER_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Audio MCP Server")


@dataclass
class AudioSession:
    id: str
    sample_rate: int = 16000
    frame_ms: int = 20
    ns: bool = True
    agc: bool = False
    channel: int = 1
    stt_enabled: bool = False
    tts_enabled: bool = False
    speaking: bool = False
    # Buffers
    stt_buffer: bytearray = field(default_factory=bytearray)
    # Control
    barge_paused: bool = False
    barge_canceled: bool = False
    # Metrics
    t_start: float = field(default_factory=time.perf_counter)
    last_partial: float = 0.0
    # Session lifecycle tracking (for TTL cleanup)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)


SESSIONS: dict[str, AudioSession] = {}
STT_MODEL: WhisperModel | None = None
TTS_VOICE: PiperVoice | None = None


def _pcm16le_to_np(buf: bytes) -> np.ndarray:
    return np.frombuffer(buf, dtype=np.int16)


def _np_to_pcm16le(arr: np.ndarray) -> bytes:
    arr16 = arr.astype(np.int16)
    return arr16.tobytes()


async def _lazy_load_whisper(device: str = "auto", compute_type: str = "float16") -> Optional[WhisperModel]:
    global STT_MODEL
    if not FW_AVAILABLE:
        return None
    if STT_MODEL is None:
        logger.info("Loading faster-whisper model for streaming STT (lazy)")
        try:
            # Get configuration from environment
            model_name = os.getenv("STT_MODEL", "large-v3")
            device = os.getenv("STT_DEVICE", device)
            compute_type = os.getenv("STT_COMPUTE_TYPE", compute_type)
            
            logger.info(f"Loading Whisper model: {model_name}, device: {device}, compute_type: {compute_type}")
            STT_MODEL = WhisperModel(model_name, device=device, compute_type=compute_type)
        except Exception as exc:  # pragma: no cover
            logger.error(f"Failed to load faster-whisper: {exc}")
            STT_MODEL = None
    return STT_MODEL


async def _lazy_load_piper_voice(voice_name: str = "it_IT-paola-medium") -> Optional[PiperVoice]:
    """Lazy load Piper TTS voice model.

    Default voice: it_IT-paola-medium (Italian female, MIT License)

    Available Italian voices from Piper:
    - it_IT-riccardo-x_low (male, fast, low quality)
    - it_IT-paola-medium (female, smooth, natural quality)

    Download from: https://huggingface.co/rhasspy/piper-voices
    All voices are MIT licensed for commercial use.
    """
    global TTS_VOICE
    if not PIPER_AVAILABLE:
        return None
    if TTS_VOICE is None:
        # Get configuration from environment
        voice_name = os.getenv("TTS_VOICE", voice_name)
        tts_provider = os.getenv("TTS_PROVIDER", "piper")
        
        if tts_provider != "piper":
            logger.info(f"Skipping Piper TTS loading, provider is: {tts_provider}")
            return None
            
        logger.info(f"Loading Piper TTS voice: {voice_name}")
        try:
            # Check for voice model file
            model_dir = os.getenv("TTS_MODEL_DIR", "/app/models/tts")
            model_path = os.path.join(model_dir, f"{voice_name}.onnx")

            if not os.path.exists(model_path):
                logger.warning(f"TTS model not found at {model_path}. TTS will use fallback.")
                return None

            TTS_VOICE = PiperVoice.load(model_path)
            logger.info(f"Piper TTS voice loaded: {voice_name}")
        except Exception as exc:  # pragma: no cover
            logger.error(f"Failed to load Piper voice: {exc}")
            TTS_VOICE = None
    return TTS_VOICE


def get_tools_schema() -> list[dict[str, Any]]:
    return [
        {
            "name": "audio.input.stream",
            "description": "Allocate an audio input session and return a WebSocket URL to send PCM frames (mono 16/24kHz).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sample_rate": {"type": "integer", "enum": [16000, 24000], "default": 16000},
                    "frame_ms": {"type": "integer", "minimum": 10, "maximum": 30, "default": 20},
                    "noise_suppression": {"type": "boolean", "default": True},
                    "agc": {"type": "boolean", "default": False},
                    "channel": {"type": "integer", "enum": [1], "default": 1},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "stt.stream.transcribe",
            "description": "Enable online STT on a session; emits partial/final results via the same WebSocket.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "language_hint": {"type": "string"},
                    "beam_size": {"type": "integer", "default": 1},
                    "compute_type": {"type": "string", "enum": ["float16", "int8"], "default": "float16"},
                    "vad": {"type": "boolean", "default": True},
                },
                "required": ["session_id"],
                "additionalProperties": False,
            },
        },
        {
            "name": "tts.stream.synthesize",
            "description": "Enable streaming TTS for a session; returns a WebSocket to stream audio chunks for provided text.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "voice": {"type": "string", "default": "neutral"},
                    "sample_rate": {"type": "integer", "enum": [22050, 24000, 44100], "default": 24000},
                    "style": {"type": "string"},
                    "speed": {"type": "number", "default": 1.0},
                    "pitch": {"type": "number", "default": 0.0},
                },
                "required": ["session_id"],
                "additionalProperties": False,
            },
        },
        {
            "name": "barge_in.control",
            "description": "Pause/cancel/resume TTS playback for a given session.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "action": {"type": "string", "enum": ["pause", "cancel", "resume"]},
                },
                "required": ["session_id", "action"],
                "additionalProperties": False,
            },
        },
        {
            "name": "session.audio.duplex",
            "description": "Start/stop/status for duplex audio orchestration (capture→STT→agent→TTS).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "method": {"type": "string", "enum": ["start", "stop", "status"], "default": "status"},
                },
                "required": ["session_id", "method"],
                "additionalProperties": False,
            },
        },
    ]


async def cleanup_stale_sessions():
    """Background task to remove sessions idle for more than 5 minutes."""
    SESSION_TTL = int(os.getenv("SESSION_TTL_SECONDS", "300"))  # 5 minutes default
    while True:
        await asyncio.sleep(60)  # Check every minute
        now = time.time()
        stale_sessions = [
            sid for sid, sess in SESSIONS.items()
            if now - sess.last_activity > SESSION_TTL
        ]
        for sid in stale_sessions:
            logger.info(f"Cleaning up stale session {sid} (idle for >{SESSION_TTL}s)")
            SESSIONS.pop(sid, None)
        if stale_sessions:
            logger.info(f"Cleaned up {len(stale_sessions)} stale session(s). Active: {len(SESSIONS)}")


@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup."""
    asyncio.create_task(cleanup_stale_sessions())
    logger.info("Session cleanup background task started")


@app.get("/health")
async def health_check():
    """Enhanced health check with model status and session count."""
    return {
        "status": "healthy",
        "whisper_available": FW_AVAILABLE,
        "whisper_loaded": STT_MODEL is not None,
        "vad_available": VAD_AVAILABLE,
        "piper_available": PIPER_AVAILABLE,
        "piper_loaded": TTS_VOICE is not None,
        "active_sessions": len(SESSIONS),
        "session_ttl_seconds": int(os.getenv("SESSION_TTL_SECONDS", "300")),
        "stt_provider": os.getenv("STT_PROVIDER", "faster-whisper"),
        "tts_provider": os.getenv("TTS_PROVIDER", "piper"),
        "stt_compute_type": os.getenv("STT_COMPUTE_TYPE", "float16"),
        "tts_voice": os.getenv("TTS_VOICE", "it_IT-paola-medium"),
        "audio_sample_rate": int(os.getenv("AUDIO_SAMPLE_RATE", "24000")),
    }


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                req = json.loads(raw)
            except Exception:
                await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}))
                continue
            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {}) or {}
            try:
                if method == "initialize":
                    result = {"protocolVersion": "2024-10-01", "serverInfo": {"name": "audio", "version": "0.1.0"}, "capabilities": {"tools": {"list": True, "call": True}}}
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}))
                elif method == "tools/list":
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"tools": get_tools_schema()}}))
                elif method == "tools/call":
                    name = params.get("name")
                    arguments = params.get("arguments", {})
                    if name == "audio.input.stream":
                        sess = AudioSession(
                            id=str(uuid.uuid4()),
                            sample_rate=int(arguments.get("sample_rate", 16000)),
                            frame_ms=int(arguments.get("frame_ms", 20)),
                            ns=bool(arguments.get("noise_suppression", True)),
                            agc=bool(arguments.get("agc", False)),
                            channel=int(arguments.get("channel", 1)),
                        )
                        SESSIONS[sess.id] = sess
                        result = {
                            "session_id": sess.id,
                            "ingest_ws_url": f"/ws/stt/{sess.id}",
                            "params": {
                                "sample_rate": sess.sample_rate,
                                "frame_ms": sess.frame_ms,
                                "channel": sess.channel,
                            },
                        }
                    elif name == "stt.stream.transcribe":
                        sid = arguments["session_id"]
                        sess = SESSIONS.get(sid)
                        if not sess:
                            result = {"error": "invalid session"}
                        else:
                            sess.stt_enabled = True
                            result = {"session_id": sid, "ingest_ws_url": f"/ws/stt/{sid}", "whisper": FW_AVAILABLE}
                    elif name == "tts.stream.synthesize":
                        sid = arguments["session_id"]
                        sess = SESSIONS.get(sid)
                        if not sess:
                            result = {"error": "invalid session"}
                        else:
                            sess.tts_enabled = True
                            result = {"session_id": sid, "tts_ws_url": f"/ws/tts/{sid}"}
                    elif name == "barge_in.control":
                        sid = arguments["session_id"]
                        action = arguments["action"]
                        sess = SESSIONS.get(sid)
                        if not sess:
                            result = {"error": "invalid session"}
                        else:
                            if action == "pause":
                                sess.barge_paused = True
                            elif action == "cancel":
                                sess.barge_canceled = True
                            elif action == "resume":
                                sess.barge_paused = False
                                sess.barge_canceled = False
                            result = {"ok": True, "session_id": sid, "state": {"paused": sess.barge_paused, "canceled": sess.barge_canceled}}
                    elif name == "session.audio.duplex":
                        sid = arguments["session_id"]
                        method_ = arguments.get("method", "status")
                        sess = SESSIONS.get(sid)
                        if method_ == "start":
                            if not sess:
                                sess = AudioSession(id=sid)
                                SESSIONS[sid] = sess
                            result = {"ok": True, "state": "idle"}
                        elif method_ == "stop":
                            if sid in SESSIONS:
                                del SESSIONS[sid]
                            result = {"ok": True}
                        else:
                            if not sess:
                                result = {"state": "absent"}
                            else:
                                result = {
                                    "state": "speaking" if sess.speaking else "listening",
                                    "latency_ms": int((time.perf_counter() - sess.t_start) * 1000),
                                }
                    else:
                        await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown tool: {name}"}}))
                        continue

                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "json", "json": result}]}}))
                elif method == "ping":
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}))
                else:
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}))
            except Exception as e:
                await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32000, "message": str(e)}}))
    except WebSocketDisconnect:
        logger.info("MCP audio WebSocket disconnected")


@app.websocket("/ws/stt/{session_id}")
async def stt_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    sess = SESSIONS.get(session_id)
    if not sess:
        await ws.close(code=4000)
        return
    # Read configuration from environment (available even if FW not loaded)
    compute_type_env = os.getenv("STT_COMPUTE_TYPE", "float16").lower()
    if compute_type_env not in {"float16", "int8", "auto"}:
        compute_type_env = "float16"
    device = os.getenv("STT_DEVICE", "auto")
    vad_enabled = os.getenv("STT_VAD_ENABLED", "true").lower() == "true"
    min_silence_ms = int(os.getenv("STT_MIN_SILENCE_MS", "400"))
    chunk_size_ms = int(os.getenv("STT_CHUNK_SIZE_MS", "400"))

    # Load Whisper lazily (best effort)
    if FW_AVAILABLE:
        compute_type = "float16" if compute_type_env == "auto" else compute_type_env
        await _lazy_load_whisper(device=device, compute_type=compute_type)

    # VAD setup (mode 2 = balanced, less aggressive)
    vad = webrtcvad.Vad(2) if VAD_AVAILABLE and vad_enabled else None
    # Use configurable window size
    window_samples = int(sess.sample_rate * (chunk_size_ms / 1000.0))
    overlap = int(window_samples * 0.3)  # 30% overlap
    ring = bytearray()
    # Ring buffer max size to prevent memory issues (10 seconds max)
    MAX_RING_BYTES = sess.sample_rate * 2 * 10  # 10 seconds of PCM16

    try:
        while True:
            # Expect JSON: {"audio_frame": base64, "ts": number}
            msg = await ws.receive_text()
            data = json.loads(msg)
            b64 = data.get("audio_frame")
            if not isinstance(b64, str):
                continue
            frame = base64.b64decode(b64)

            # Update session activity timestamp
            sess.last_activity = time.time()

            # Add to ring buffer with overflow protection
            ring.extend(frame)
            if len(ring) > MAX_RING_BYTES:
                # Trim oldest data to prevent unbounded growth
                excess = len(ring) - MAX_RING_BYTES
                ring = bytearray(ring[excess:])
                logger.warning(f"Ring buffer overflow for session {session_id}, trimmed {excess} bytes")
            is_speech = True
            if vad is not None:
                # Quick gate: only proceed if voice activity detected in last chunk
                if len(frame) >= int(sess.sample_rate * sess.frame_ms / 1000) * 2:
                    try:
                        is_speech = vad.is_speech(frame[: min(len(frame), 960)], sess.sample_rate)
                        if not is_speech and len(ring) < window_samples * 2:
                            continue
                    except Exception:
                        pass
                        
                # Check for silence duration to trigger final transcription
                if not is_speech:
                    # Track silence duration (this is a simplified approach)
                    # In a real implementation, you'd want more sophisticated silence detection
                    pass

            if len(ring) >= window_samples * 2:
                # Prepare analysis window
                buf = bytes(ring[: window_samples * 2])
                # Keep overlap
                ring = bytearray(ring[window_samples * 2 - overlap * 2 :])

                if FW_AVAILABLE and STT_MODEL is not None:
                    # Convert to float32 normalized audio for faster-whisper
                    arr = _pcm16le_to_np(buf).astype(np.float32) / 32768.0
                    try:
                        # Get beam size from environment
                        beam_size = int(os.getenv("STT_BEAM_SIZE", "1"))
                        
                        segments, info = STT_MODEL.transcribe(
                            arr,
                            language=None,
                            beam_size=beam_size,
                            vad_filter=False,
                            word_timestamps=True
                        )
                        text_parts = []
                        s_start = None
                        s_end = None
                        confidence_scores = []
                        for s in segments:
                            text_parts.append(s.text.strip())
                            if s_start is None:
                                s_start = s.start
                            s_end = s.end
                            # Extract confidence from avg_logprob (convert log probability to 0-1 range)
                            if hasattr(s, 'avg_logprob'):
                                # avg_logprob is typically negative, convert to confidence score
                                confidence_scores.append(math.exp(s.avg_logprob))
                        text = " ".join(tp for tp in text_parts if tp)
                        # Average confidence across all segments
                        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else None
                        
                        if text:
                            now = time.time()
                            
                            # Determine if this should be a final transcript based on silence
                            is_final = False
                            if vad is not None:
                                # Simple silence detection - in production, use more sophisticated logic
                                silence_duration = len(ring) < overlap * 2  # Simplified check
                                is_final = silence_duration and len(text.strip()) > 0
                            
                            message_type = "final" if is_final else "partial"
                            
                            await ws.send_text(json.dumps({
                                "type": message_type,
                                "text": text,
                                "start_ts": s_start,
                                "end_ts": s_end,
                                "confidence": round(avg_confidence, 3) if avg_confidence is not None else None,
                                "ts": now,
                            }))
                            
                            # If final, clear the buffer to start fresh
                            if is_final:
                                ring = bytearray()
                                
                    except Exception as exc:
                        logger.warning(f"stt window error: {exc}")
                else:
                    # Not configured
                    await ws.send_text(json.dumps({"type": "error", "error": "stt_not_configured"}))
    except WebSocketDisconnect:
        return


@app.websocket("/ws/tts/{session_id}")
async def tts_ws(ws: WebSocket, session_id: str):
    await ws.accept()
    sess = SESSIONS.get(session_id)
    if not sess:
        await ws.close(code=4000)
        return

    # Try to load Piper TTS voice
    voice_name = os.getenv("TTS_VOICE", "it_IT-paola-medium")
    voice = await _lazy_load_piper_voice(voice_name)

    # Use voice's native sample rate if available, otherwise default to 24000
    sr = voice.config.sample_rate if (voice and hasattr(voice, 'config')) else 24000
    chunk_ms = 80
    samples_per_chunk = int(sr * (chunk_ms / 1000.0))

    try:
        while True:
            payload = await ws.receive_text()
            data = json.loads(payload)

            # Update session activity
            sess.last_activity = time.time()

            if data.get("type") == "synthesize":
                text = data.get("text", "")

                if not text.strip():
                    await ws.send_text(json.dumps({"type": "done", "reason": "empty_text"}))
                    continue

                # Use Piper TTS if available, otherwise fallback to sine wave
                if PIPER_AVAILABLE and voice is not None:
                    try:
                        # Synthesize with Piper - returns generator of PCM16 chunks
                        audio_chunks = []
                        for audio_chunk in voice.synthesize_stream_raw(text):
                            # audio_chunk is already PCM16 bytes from Piper
                            audio_chunks.append(audio_chunk)

                        # Combine all chunks
                        full_audio = b"".join(audio_chunks)

                        # Stream in 80ms chunks
                        pos = 0
                        chunk_size_bytes = samples_per_chunk * 2  # 2 bytes per sample (PCM16)

                        while pos < len(full_audio):
                            # Check barge-in controls
                            if sess.barge_canceled:
                                await ws.send_text(json.dumps({"type": "done", "reason": "canceled"}))
                                sess.barge_canceled = False  # Reset flag
                                break

                            if sess.barge_paused:
                                await asyncio.sleep(0.05)
                                continue

                            # Extract chunk
                            end = min(len(full_audio), pos + chunk_size_bytes)
                            chunk = full_audio[pos:end]
                            pos = end

                            # Send chunk
                            b64 = base64.b64encode(chunk).decode("ascii")
                            await ws.send_text(json.dumps({
                                "type": "audio_chunk",
                                "audio_chunk": b64,
                                "ts": time.time()
                            }))

                            # Pace the stream to match real-time playback
                            await asyncio.sleep(chunk_ms / 1000.0)

                        if not sess.barge_canceled:
                            await ws.send_text(json.dumps({"type": "done", "reason": "completed"}))

                    except Exception as exc:
                        logger.error(f"Piper TTS error: {exc}")
                        await ws.send_text(json.dumps({"type": "error", "error": f"TTS failed: {exc}"}))

                else:
                    # Fallback: sine wave generator (original placeholder)
                    logger.warning("Piper TTS not available, using fallback sine wave")
                    duration = max(0.3, min(len(text) * 0.03, 3.0))  # naive mapping
                    total_samples = int(sr * duration)
                    t = np.arange(total_samples) / sr
                    tone = 0.1 * np.sin(2 * math.pi * 440.0 * t)
                    pos = 0

                    while pos < total_samples:
                        if sess.barge_canceled:
                            await ws.send_text(json.dumps({"type": "done", "reason": "canceled"}))
                            sess.barge_canceled = False
                            break
                        if sess.barge_paused:
                            await asyncio.sleep(0.05)
                            continue

                        end = min(total_samples, pos + samples_per_chunk)
                        chunk = tone[pos:end]
                        pos = end
                        pcm = _np_to_pcm16le(chunk * 32767.0)
                        b64 = base64.b64encode(pcm).decode("ascii")
                        await ws.send_text(json.dumps({"type": "audio_chunk", "audio_chunk": b64, "ts": time.time()}))
                        await asyncio.sleep(chunk_ms / 1000.0)

                    await ws.send_text(json.dumps({"type": "done", "reason": "completed"}))

    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7006)
