"""
Helpers for turn-based voice interactions (STT + TTS) within the API service.

Replaces the legacy streaming audio MCP server with a simple request/response
flow: decode PCM audio, run transcription, execute the agent, optionally
generate TTS audio, and return a WAV clip.
"""

from __future__ import annotations

import asyncio
import io
import logging
import math
import os
import wave
from typing import TYPE_CHECKING, Any, Optional, Tuple

if TYPE_CHECKING:
    from faster_whisper import WhisperModel
    from piper import PiperVoice, AudioChunk
else:
    WhisperModel = None
    PiperVoice = None
    AudioChunk = None

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional dependencies (faster-whisper for STT, piper for TTS)
# ---------------------------------------------------------------------------

try:  # pragma: no cover - optional dependency
    from faster_whisper import WhisperModel  # type: ignore

    FW_AVAILABLE = True
except Exception:  # pragma: no cover
    FW_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from piper import PiperVoice  # type: ignore

    PIPER_AVAILABLE = True
except Exception:  # pragma: no cover
    PIPER_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from faster_whisper import WhisperModel  # type: ignore

    FW_AVAILABLE = True
except Exception:  # pragma: no cover
    FW_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from piper import PiperVoice  # type: ignore

    PIPER_AVAILABLE = True
except Exception:  # pragma: no cover
    PIPER_AVAILABLE = False

# ---------------------------------------------------------------------------
# Globals for lazy-loading heavy models
# ---------------------------------------------------------------------------
WHISPER_MODEL: WhisperModel | None = None
WHISPER_LOCK = asyncio.Lock()
PIPER_VOICE: PiperVoice | None = None
PIPER_LOCK = asyncio.Lock()

WHISPER_TARGET_SR = 16000


def _resample_audio(audio: np.ndarray, source_sr: int, target_sr: int) -> np.ndarray:
    """Naive linear resampling for 1D mono audio."""
    if source_sr == target_sr:
        return audio
    if len(audio) == 0:
        return audio
    duration = len(audio) / float(source_sr)
    target_len = int(duration * target_sr)
    if target_len <= 1:
        return audio
    old_idx = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
    new_idx = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
    resampled = np.interp(new_idx, old_idx, audio).astype(np.float32)
    return resampled


async def _load_whisper() -> "WhisperModel | None":
    """Lazy-load faster-whisper model with environment overrides."""
    global WHISPER_MODEL
    if not FW_AVAILABLE:  # pragma: no cover - dependency optional
        logger.warning("faster-whisper not available; STT disabled")
        return None

    if WHISPER_MODEL is not None:
        return WHISPER_MODEL

    async with WHISPER_LOCK:
        if WHISPER_MODEL is not None:
            return WHISPER_MODEL

        loop = asyncio.get_running_loop()
        model_name = os.getenv("STT_MODEL", "large-v3")
        device = os.getenv("STT_DEVICE", "auto")
        compute_type = os.getenv("STT_COMPUTE_TYPE", "float16")

        def load() -> "WhisperModel":
            logger.info(
                "Loading faster-whisper model (model=%s, device=%s, compute_type=%s)",
                model_name,
                device,
                compute_type,
            )
            return WhisperModel(model_name, device=device, compute_type=compute_type)

        try:
            WHISPER_MODEL = await loop.run_in_executor(None, load)
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to load faster-whisper model: %s", exc)
            WHISPER_MODEL = None

    return WHISPER_MODEL


async def _load_piper_voice() -> "PiperVoice | None":
    """Lazy-load Piper TTS voice."""
    global PIPER_VOICE
    if not PIPER_AVAILABLE:  # pragma: no cover - dependency optional
        logger.warning("piper not available; TTS disabled")
        return None

    if PIPER_VOICE is not None:
        return PIPER_VOICE

    async with PIPER_LOCK:
        if PIPER_VOICE is not None:
            return PIPER_VOICE

        loop = asyncio.get_running_loop()
        voice_name = os.getenv("TTS_VOICE", "it_IT-paola-medium")
        model_dir = os.getenv("TTS_MODEL_DIR", "/app/models/tts")
        provider = os.getenv("TTS_PROVIDER", "piper")

        if provider != "piper":
            logger.info("TTS provider set to %s, skipping Piper voice load", provider)
            return None

        model_path = os.path.join(model_dir, f"{voice_name}.onnx")
        logger.info("Attempting to load Piper model from: %s", model_path)
        if not os.path.exists(model_path):
            logger.error("Piper model file missing: %s", model_path)
            return None

        def load() -> "PiperVoice":
            logger.info("Loading Piper TTS voice: %s from %s", voice_name, model_path)
            return PiperVoice.load(model_path)

        try:
            PIPER_VOICE = await loop.run_in_executor(None, load)
            logger.info("Piper voice loaded successfully")
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to load Piper voice %s: %s", voice_name, exc)
            PIPER_VOICE = None

    return PIPER_VOICE


def _pcm16_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    """Wrap raw PCM16 mono samples into a WAV container."""
    with io.BytesIO() as buf:
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm)
        return buf.getvalue()


async def transcribe_audio_pcm16(
    audio_pcm: bytes,
    sample_rate: int,
    language: str | None = None,
) -> dict[str, Any]:
    """
    Transcribe PCM16 mono audio and return text plus metadata.

    Args:
        audio_pcm: Raw PCM16 audio bytes
        sample_rate: Sample rate of the input audio
        language: Optional language code (e.g., "it", "en"). If None, uses STT_LANGUAGE env var.

    Returns:
        {"text": str, "language": Optional[str], "confidence": Optional[float]}
    """
    if not audio_pcm:
        return {"text": "", "language": None, "confidence": None}

    model = await _load_whisper()
    if not model:
        raise RuntimeError("STT model unavailable")

    beam_size_env = os.getenv("STT_BEAM_SIZE", "1")
    try:
        beam_size = max(1, int(beam_size_env))
    except ValueError:
        beam_size = 1

    # Get language from parameter or environment variable
    if language is None:
        language = os.getenv("STT_LANGUAGE")

    # Normalize language hint (handle "auto", "detect", empty strings)
    if language:
        language = language.strip().lower()
        if language in {"", "auto", "detect", "automatic"}:
            language = None
        elif "," in language:
            # Take first language from comma-separated list
            language = language.split(",", 1)[0].strip() or None

    def _run() -> dict[str, Any]:
        # Convert PCM16 to float32 [-1, 1]
        arr = np.frombuffer(audio_pcm, dtype=np.int16).astype(np.float32) / 32768
        processed = _resample_audio(arr, sample_rate, WHISPER_TARGET_SR)

        segments, info = model.transcribe(
            processed,
            beam_size=beam_size,
            vad_filter=False,
            word_timestamps=False,
            language=language,
        )

        text_parts = []
        confidences = []
        for seg in segments:
            seg_text = getattr(seg, "text", "").strip()
            if seg_text:
                text_parts.append(seg_text)
            avg_logprob = getattr(seg, "avg_logprob", None)
            if avg_logprob is not None:
                confidences.append(math.exp(avg_logprob))

        transcript = " ".join(text_parts).strip()
        avg_conf = None
        if confidences:
            avg_conf = float(sum(confidences) / len(confidences))

        detected_lang = getattr(info, "language", None) if info else None

        return {"text": transcript, "language": detected_lang, "confidence": avg_conf}

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _run)


async def synthesize_speech(
    text: str,
    *,
    fallback: bool = True,
) -> Optional[Tuple[bytes, int]]:
    """
    Generate PCM16 mono audio for the provided text.

    Returns:
        (wav_bytes, sample_rate) or None if synthesis not available.
    """
    cleaned = text.strip()
    if not cleaned:
        return None

    voice = await _load_piper_voice()

    if voice:

        def _run_voice() -> Tuple[bytes, int]:
            logger.info("Starting Piper synthesis for text: %s", cleaned[:100] + "..." if len(cleaned) > 100 else cleaned)
            # Use synthesize method which returns an iterator of AudioChunk
            audio_chunks = list(voice.synthesize(cleaned))
            if not audio_chunks:
                logger.warning("No audio chunks generated by Piper")
                return b'', 22050  # Empty audio at default rate
            audio_array = np.concatenate([chunk.samples for chunk in audio_chunks])
            logger.info("Piper synthesis completed, total audio length: %d samples", len(audio_array))
            # Convert to int16 PCM
            pcm = (audio_array * 32767.0).astype(np.int16).tobytes()
            sr = getattr(getattr(voice, "config", None), "sample_rate", None)
            if sr is None:
                sr = getattr(voice, "sample_rate", None) or 22050
            wav_bytes = _pcm16_to_wav(pcm, sr)
            logger.info("Generated WAV: %d bytes at %d Hz", len(wav_bytes), sr)
            return wav_bytes, int(sr)

        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, _run_voice)
        except Exception as exc:  # pragma: no cover
            logger.error("Piper synthesis failed: %s", exc)

    if not fallback:
        return None

    # Fallback: short sine wave tone
    duration = max(0.4, min(len(cleaned) * 0.03, 3.0))
    sample_rate = 24000
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    waveform = 0.08 * np.sin(2 * math.pi * 440.0 * t)
    pcm = (waveform * 32767.0).astype(np.int16).tobytes()
    wav_bytes = _pcm16_to_wav(pcm, sample_rate)
    return wav_bytes, sample_rate


__all__ = [
    "FW_AVAILABLE",
    "PIPER_AVAILABLE",
    "transcribe_audio_pcm16",
    "synthesize_speech",
    "_pcm16_to_wav",
]
