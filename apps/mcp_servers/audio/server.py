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


SESSIONS: dict[str, AudioSession] = {}
STT_MODEL: WhisperModel | None = None


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
            STT_MODEL = WhisperModel(os.getenv("STT_MODEL", "large-v3"), device=device, compute_type=compute_type)
        except Exception as exc:  # pragma: no cover
            logger.error(f"Failed to load faster-whisper: {exc}")
            STT_MODEL = None
    return STT_MODEL


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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "whisper": FW_AVAILABLE, "vad": VAD_AVAILABLE}


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
    # Load Whisper lazily (best effort)
    if FW_AVAILABLE:
        compute_type = "float16" if os.getenv("STT_COMPUTE", "gpu").lower() == "gpu" else "int8"
        await _lazy_load_whisper(device=os.getenv("STT_DEVICE", "auto"), compute_type=compute_type)
    # VAD setup
    vad = webrtcvad.Vad(2) if VAD_AVAILABLE else None
    window_samples = int(sess.sample_rate * 0.8)  # 0.8s window
    overlap = int(window_samples * 0.5)
    ring = bytearray()

    try:
        while True:
            # Expect JSON: {"audio_frame": base64, "ts": number}
            msg = await ws.receive_text()
            data = json.loads(msg)
            b64 = data.get("audio_frame")
            if not isinstance(b64, str):
                continue
            frame = base64.b64decode(b64)
            ring.extend(frame)
            if vad is not None:
                # Quick gate: only proceed if voice activity detected in last chunk
                if len(frame) >= int(sess.sample_rate * sess.frame_ms / 1000) * 2:
                    try:
                        is_speech = vad.is_speech(frame[: min(len(frame), 960)], sess.sample_rate)
                        if not is_speech and len(ring) < window_samples * 2:
                            continue
                    except Exception:
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
                        segments, info = STT_MODEL.transcribe(arr, language=None, beam_size=1, vad_filter=False)
                        text_parts = []
                        s_start = None
                        s_end = None
                        for s in segments:
                            text_parts.append(s.text.strip())
                            if s_start is None:
                                s_start = s.start
                            s_end = s.end
                        text = " ".join(tp for tp in text_parts if tp)
                        if text:
                            now = time.time()
                            await ws.send_text(json.dumps({
                                "type": "partial",
                                "text": text,
                                "start_ts": s_start,
                                "end_ts": s_end,
                                "confidence": None,
                                "ts": now,
                            }))
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
    # Simple sine-wave generator placeholder (replace with real TTS backend)
    sr = 24000
    chunk_ms = 80
    samples_per_chunk = int(sr * (chunk_ms / 1000.0))
    try:
        while True:
            payload = await ws.receive_text()
            data = json.loads(payload)
            if data.get("type") == "synthesize":
                text = data.get("text", "")
                duration = max(0.3, min(len(text) * 0.03, 3.0))  # naive mapping
                total_samples = int(sr * duration)
                t = np.arange(total_samples) / sr
                tone = 0.1 * np.sin(2 * math.pi * 440.0 * t)
                pos = 0
                while pos < total_samples:
                    if sess.barge_canceled:
                        await ws.send_text(json.dumps({"type": "done", "reason": "canceled"}))
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
                await ws.send_text(json.dumps({"type": "done"}))
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7006)

