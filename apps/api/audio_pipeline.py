"""
Enhanced audio pipeline with streaming capabilities for real-time STT and TTS.
"""

import asyncio
import contextlib
import html
import io
import logging
import math
import os
import re
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncGenerator
from urllib.request import urlretrieve

import numpy as np

if TYPE_CHECKING:
    from faster_whisper import WhisperModel
    from melo.api import TTS as MeloTTS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional dependencies (faster-whisper for STT, MeloTTS for TTS)
# ---------------------------------------------------------------------------

try:  # pragma: no cover - optional dependency
    from faster_whisper import WhisperModel  # type: ignore

    FW_AVAILABLE = True
except Exception:  # pragma: no cover
    FW_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from melo.api import TTS as MeloTTS  # type: ignore

    MELO_AVAILABLE = True
except Exception:  # pragma: no cover
    MELO_AVAILABLE = False

# ---------------------------------------------------------------------------
# Globals for lazy-loading heavy models
# ---------------------------------------------------------------------------
WHISPER_MODEL: "WhisperModel | None" = None
WHISPER_LOCK = asyncio.Lock()
MELO_TTS: "MeloTTS | None" = None
MELO_LOCK = asyncio.Lock()

WHISPER_TARGET_SR = 16000

# MeloTTS supported languages and speakers
MELO_LANGUAGES = {
    "EN": "EN",  # English
    "ES": "ES",  # Spanish
    "FR": "FR",  # French
    "ZH": "ZH",  # Chinese
    "JP": "JP",  # Japanese
    "KR": "KR",  # Korean
    "IT": "IT",  # Italian
}

MELO_SPEAKERS = {
    "EN": ["EN-US", "EN-BR", "EN-INDIA", "EN-AU", "EN-Default"],
    "IT": ["IT"],  # Italian has one speaker
    "ES": ["ES"],
    "FR": ["FR"],
    "ZH": ["ZH"],
    "JP": ["JP"],
    "KR": ["KR"],
}


MARKDOWN_CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)
MARKDOWN_INLINE_CODE_RE = re.compile(r"`(?P<code>[^`]*)`")
MARKDOWN_LINK_RE = re.compile(
    r"!\[(?P<alt>[^\]]*)\]\((?P<image_target>[^)]+)\)|\[(?P<label>[^\]]*)\]\((?P<link_target>[^)]+)\)"
)
MARKDOWN_BULLET_RE = re.compile(r"^\s*[-*+]\s+", re.MULTILINE)
MARKDOWN_ORDERED_LIST_RE = re.compile(r"^\s*\d+[\.)]\s+", re.MULTILINE)
MARKDOWN_HEADING_RE = re.compile(r"^\s*#{1,6}\s*", re.MULTILINE)
MARKDOWN_BLOCKQUOTE_RE = re.compile(r"^\s*>\s?", re.MULTILINE)
MARKDOWN_CHECKBOX_RE = re.compile(r"\[(?:x|X| )\]\s*")
MARKDOWN_TABLE_BORDER_RE = re.compile(r"[|]")
MARKDOWN_RULE_RE = re.compile(r"^\s*([-_*]\s*){3,}$", re.MULTILINE)


def sanitize_tts_text(text: str, *, collapse_whitespace: bool = True) -> str:
    """
    Convert markdown-rich text into a friendlier plain string for TTS engines.

    We avoid heavy dependencies by applying fast regex-based transformations and
    falling back to the original input when cleaning would otherwise result in an
    empty string (e.g., messages containing only code).
    """

    if not text:
        return ""

    cleaned = html.unescape(text)
    cleaned = MARKDOWN_CODE_BLOCK_RE.sub(" ", cleaned)
    cleaned = MARKDOWN_INLINE_CODE_RE.sub(lambda m: m.group("code") or "", cleaned)

    def _replace_link(match: re.Match) -> str:
        label = match.group("label")
        alt = match.group("alt")
        link_target = match.group("link_target")
        image_target = match.group("image_target")
        # Prefer human-friendly labels/alt text; fall back to URL if needed.
        return (label or alt or link_target or image_target or "").strip()

    cleaned = MARKDOWN_LINK_RE.sub(_replace_link, cleaned)
    cleaned = MARKDOWN_BULLET_RE.sub("", cleaned)
    cleaned = MARKDOWN_ORDERED_LIST_RE.sub("", cleaned)
    cleaned = MARKDOWN_HEADING_RE.sub("", cleaned)
    cleaned = MARKDOWN_BLOCKQUOTE_RE.sub("", cleaned)
    cleaned = MARKDOWN_CHECKBOX_RE.sub("", cleaned)
    cleaned = MARKDOWN_RULE_RE.sub(" ", cleaned)
    # Replace table borders with pauses so content is still speakable
    cleaned = MARKDOWN_TABLE_BORDER_RE.sub(" ", cleaned)
    # Strip emphasis markers
    cleaned = re.sub(r"[*_~`]", " ", cleaned)
    # Normalize newlines into natural speech pauses
    cleaned = cleaned.replace("\r\n", "\n")

    def _newline_to_pause(match: re.Match) -> str:
        trimmed = match.string[: match.start()].rstrip()
        if trimmed and trimmed[-1] in ".?!;:,":
            return " "
        return ". "

    cleaned = re.sub(r"\n+", _newline_to_pause, cleaned)
    if collapse_whitespace:
        cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip()

    if cleaned:
        return cleaned

    # Fallback: collapse whitespace only, keeping original characters so that
    # code-heavy answers are still audible rather than silence.
    fallback = re.sub(r"\s+", " ", text.strip())
    return fallback


def _ensure_pcm16(audio_bytes: bytes, sample_rate: int) -> tuple[bytes, int]:
    """Decode containerized audio to raw PCM16 using ffmpeg when needed."""

    if not audio_bytes:
        return audio_bytes, sample_rate

    header = audio_bytes[:4]
    needs_decode = len(audio_bytes) % 2 == 1

    container_prefixes = (b"OggS", b"\x1aE\xdf\xa3", b"RIFF", b"fLaC")
    if header in container_prefixes or audio_bytes[:3] == b"ID3":
        needs_decode = True

    if not needs_decode:
        return audio_bytes, sample_rate

    cmd = [
        "ffmpeg",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "s16le",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "pipe:1",
    ]

    try:
        result = subprocess.run(
            cmd,
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return result.stdout, sample_rate
    except FileNotFoundError:  # pragma: no cover - ffmpeg missing in env
        logger.warning("ffmpeg not available; assuming raw PCM input")
    except subprocess.CalledProcessError as exc:  # pragma: no cover
        logger.warning(
            "ffmpeg failed to decode audio (%s); falling back to raw PCM", exc
        )

    return audio_bytes, sample_rate


def _resolve_melo_language() -> str:
    """Resolve MeloTTS language from environment or default to Italian."""
    lang_env = os.getenv("TTS_LANGUAGE", "IT").strip().upper()
    if lang_env in MELO_LANGUAGES:
        return lang_env
    logger.warning("Unknown TTS language '%s', defaulting to IT", lang_env)
    return "IT"


def _resolve_melo_speaker(language: str) -> str:
    """Resolve MeloTTS speaker for the given language."""
    speaker_env = os.getenv("TTS_SPEAKER", "").strip()
    available_speakers = MELO_SPEAKERS.get(language, [])

    if not available_speakers:
        logger.warning("No speakers available for language %s", language)
        return language  # Fallback to language code

    if speaker_env and speaker_env in available_speakers:
        return speaker_env

    # Return first available speaker for the language
    return available_speakers[0]


def _resolve_melo_speed() -> float:
    """Resolve speech speed from environment (0.5 to 2.0)."""
    speed_env = os.getenv("TTS_SPEED", "1.0")
    try:
        speed = float(speed_env)
    except ValueError:
        logger.warning("Invalid TTS_SPEED '%s'; defaulting to 1.0", speed_env)
        speed = 1.0
    return max(0.5, min(2.0, speed))


class StreamingAudioProcessor:
    """
    Handles streaming audio processing for real-time transcription and synthesis.

    Features:
    - Chunk-based audio processing
    - Voice activity detection
    - Noise reduction
    - Adaptive quality settings
    """

    def __init__(self, sample_rate: int = 16000, chunk_size: int = 1024):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.audio_buffer = np.array([], dtype=np.float32)
        self.is_recording = False
        self.voice_activity_threshold = 0.01
        self.silence_chunks = 0
        self.max_silence_chunks = 30  # ~2 seconds of silence

    def add_audio_chunk(self, chunk: np.ndarray) -> bool:
        """
        Add audio chunk and detect voice activity.

        Args:
            chunk: Audio chunk as float32 array

        Returns:
            True if voice activity detected, False otherwise
        """
        self.audio_buffer = np.concatenate([self.audio_buffer, chunk])

        # Calculate RMS energy
        rms = np.sqrt(np.mean(chunk**2))
        has_voice = rms > self.voice_activity_threshold

        if has_voice:
            self.silence_chunks = 0
        else:
            self.silence_chunks += 1

        return has_voice

    def should_stop_recording(self) -> bool:
        """Check if recording should stop due to silence."""
        return self.silence_chunks >= self.max_silence_chunks

    def get_buffered_audio(self) -> np.ndarray:
        """Get and clear the audio buffer."""
        audio = self.audio_buffer.copy()
        self.audio_buffer = np.array([], dtype=np.float32)
        return audio

    def reset(self):
        """Reset the processor state."""
        self.audio_buffer = np.array([], dtype=np.float32)
        self.silence_chunks = 0
        self.is_recording = False


def _resample_audio(audio: np.ndarray, source_sr: int, target_sr: int) -> np.ndarray:
    """High-quality audio resampling."""
    if source_sr == target_sr:
        return audio
    if len(audio) == 0:
        return audio

    # Use scipy for high-quality resampling if available
    try:
        from scipy import signal

        # Calculate resampling ratio
        ratio = target_sr / source_sr
        # Calculate number of samples in resampled audio
        target_length = int(len(audio) * ratio)
        # Resample using scipy's resample function
        resampled = signal.resample(audio, target_length)
        return np.array(resampled, dtype=np.float32)
    except ImportError:
        # Fallback to linear interpolation
        duration = len(audio) / float(source_sr)
        target_len = int(duration * target_sr)
        if target_len <= 1:
            return audio
        old_idx = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
        new_idx = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
        resampled = np.interp(new_idx, old_idx, audio)
        return np.array(resampled, dtype=np.float32)


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

        # Get number of workers for CPU inference (defaults to 1)
        num_workers_env = os.getenv("STT_NUM_WORKERS", "1")
        try:
            num_workers = max(1, int(num_workers_env))
        except ValueError:
            logger.warning("Invalid STT_NUM_WORKERS '%s'; defaulting to 1", num_workers_env)
            num_workers = 1

        def load_candidate(candidate: tuple[str, str, str]) -> "WhisperModel":
            candidate_model, candidate_device, candidate_compute = candidate
            logger.info(
                "Loading faster-whisper model (model=%s, device=%s, compute_type=%s, num_workers=%s, primary=%s)",
                candidate_model,
                candidate_device,
                candidate_compute,
                num_workers,
                candidate_model == model_name and candidate_device == device,
            )
            return WhisperModel(
                candidate_model,
                device=candidate_device,
                compute_type=candidate_compute,
                num_workers=num_workers,
            )

        def is_cuda_device(dev: str) -> bool:
            normalized = (dev or "").lower()
            return normalized.startswith("cuda") or normalized == "gpu"

        compute_fallbacks_env = os.getenv("STT_COMPUTE_FALLBACKS", "int8_float16,int8")
        compute_fallbacks = [
            candidate.strip()
            for candidate in compute_fallbacks_env.split(",")
            if candidate.strip()
        ]

        model_candidates: list[tuple[str, str, str, str]] = [
            (model_name, device, compute_type, "primary")
        ]

        if is_cuda_device(device):
            for compute_candidate in compute_fallbacks:
                candidate_tuple = (
                    model_name,
                    device,
                    compute_candidate,
                    f"primary-compute-fallback:{compute_candidate}",
                )
                if candidate_tuple not in model_candidates:
                    model_candidates.append(candidate_tuple)

            # Always include a CPU int8 fallback for the same model to avoid GPU OOMs
            cpu_fallback_tuple = (
                model_name,
                os.getenv("STT_CPU_FALLBACK_DEVICE", "cpu"),
                os.getenv("STT_CPU_FALLBACK_COMPUTE_TYPE", "int8"),
                "auto-cpu-fallback",
            )
            if cpu_fallback_tuple not in model_candidates:
                model_candidates.append(cpu_fallback_tuple)

        fallback_model_name = os.getenv("STT_FALLBACK_MODEL")
        fallback_device = os.getenv("STT_FALLBACK_DEVICE", "cpu")
        fallback_compute = os.getenv("STT_FALLBACK_COMPUTE_TYPE", "int8")
        if fallback_model_name:
            candidate_tuple = (
                fallback_model_name,
                fallback_device,
                fallback_compute,
                "fallback-model",
            )
            if candidate_tuple not in model_candidates:
                model_candidates.append(candidate_tuple)

        last_error: Exception | None = None
        for candidate_model, candidate_device, candidate_compute, candidate_label in model_candidates:
            try:
                WHISPER_MODEL = await loop.run_in_executor(
                    None,
                    lambda c=(candidate_model, candidate_device, candidate_compute): load_candidate(c),
                )
                logger.info(
                    "faster-whisper model ready (model=%s, device=%s, compute_type=%s, source=%s)",
                    candidate_model,
                    candidate_device,
                    candidate_compute,
                    candidate_label,
                )
                break
            except (RuntimeError, ImportError) as exc:  # pragma: no cover
                last_error = exc
                message = str(exc).lower()
                if "out of memory" in message or "cuda" in message:
                    logger.warning(
                        "Failed to load faster-whisper model %s on %s (%s); trying next candidate",
                        candidate_model,
                        candidate_device,
                        exc,
                    )
                    continue
                logger.error("Failed to load faster-whisper model: %s", exc)
                break

        if WHISPER_MODEL is None and last_error is not None:
            logger.error("Unable to initialize any faster-whisper model: %s", last_error)

    return WHISPER_MODEL


async def _load_melo_tts() -> "MeloTTS | None":
    """Lazy-load MeloTTS engine."""
    global MELO_TTS

    if not MELO_AVAILABLE:  # pragma: no cover - dependency optional
        logger.warning("MeloTTS not available; TTS disabled")
        return None

    if MELO_TTS is not None:
        return MELO_TTS

    async with MELO_LOCK:
        if MELO_TTS is not None:
            return MELO_TTS

        provider = (os.getenv("TTS_PROVIDER") or "melo").strip().lower()
        if provider in {"none", "disabled"}:
            logger.info("TTS provider explicitly disabled via TTS_PROVIDER=%s", provider)
            return None
        if provider not in {"melo", "melotts"}:
            logger.info("TTS provider set to %s, skipping MeloTTS load", provider)
            return None

        language = _resolve_melo_language()
        device = os.getenv("TTS_DEVICE", "auto").lower()

        logger.info("Loading MeloTTS (language=%s, device=%s)", language, device)

        loop = asyncio.get_running_loop()

        def _load() -> "MeloTTS":
            return MeloTTS(language=language, device=device)

        try:
            MELO_TTS = await loop.run_in_executor(None, _load)
            logger.info("MeloTTS ready (language=%s, device=%s)", language, device)
        except (RuntimeError, ImportError) as exc:  # pragma: no cover
            logger.error("Failed to load MeloTTS: %s", exc)
            MELO_TTS = None
            return None

    return MELO_TTS


def _generate_melo_wav(tts: "MeloTTS", text: str) -> tuple[bytes, int]:
    """Generate WAV bytes using MeloTTS."""
    preview = text[:100] + "..." if len(text) > 100 else text
    speed = _resolve_melo_speed()
    language = _resolve_melo_language()
    speaker = _resolve_melo_speaker(language)

    logger.info(
        "Starting MeloTTS synthesis (language=%s, speaker=%s, speed=%.2f, text=%s)",
        language,
        speaker,
        speed,
        preview,
    )

    # Generate audio with MeloTTS
    # MeloTTS returns numpy array, we need to convert to WAV
    try:
        # Create temporary file for output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_path = temp_wav.name

        # Generate speech to file
        tts.tts_to_file(text, speaker_id=speaker, output_path=temp_path, speed=speed)

        # Read the generated WAV file
        with open(temp_path, "rb") as f:
            wav_bytes = f.read()

        # Clean up temp file
        os.unlink(temp_path)

        # MeloTTS typically outputs at 44100 Hz
        sample_rate = 44100

        logger.info("Generated MeloTTS WAV: %d bytes at %d Hz", len(wav_bytes), sample_rate)
        return wav_bytes, sample_rate

    except Exception as exc:
        logger.error("MeloTTS synthesis failed: %s", exc, exc_info=True)
        raise


def _pcm16_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    """Wrap raw PCM16 mono samples into a WAV container."""
    with io.BytesIO() as buf:
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm)
        return buf.getvalue()


async def stream_transcribe_audio(
    audio_chunks: AsyncGenerator[bytes, None],
    sample_rate: int,
    language: str | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Stream transcribe audio chunks in real-time.

    Args:
        audio_chunks: Async generator of audio chunks
        sample_rate: Sample rate of the input audio
        language: Optional language code (e.g., "it", "en")

    Yields:
        Transcription results with partial and final text
    """
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

    # Normalize language hint
    if language:
        language = language.strip().lower()
        if language in {"", "auto", "detect", "automatic"}:
            language = None
        elif "," in language:
            language = language.split(",", 1)[0].strip() or None

    processor = StreamingAudioProcessor(sample_rate)
    accumulated_audio = np.array([], dtype=np.float32)

    async for chunk in audio_chunks:
        # Convert chunk to float32
        audio_array = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768

        # Add to processor
        has_voice = processor.add_audio_chunk(audio_array)
        accumulated_audio = np.concatenate([accumulated_audio, audio_array])

        # Check if we should process (voice activity or silence threshold)
        if has_voice or processor.should_stop_recording():
            if len(accumulated_audio) > 0:
                # Resample if needed
                processed = _resample_audio(accumulated_audio, sample_rate, WHISPER_TARGET_SR)

                def _transcribe_chunk():
                    segments, info = model.transcribe(
                        processed,
                        beam_size=beam_size,
                        vad_filter=True,
                        word_timestamps=True,
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

                    return {
                        "text": transcript,
                        "language": detected_lang,
                        "confidence": avg_conf,
                        "is_final": processor.should_stop_recording(),
                    }

                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, _transcribe_chunk)
                    if result["text"]:
                        yield result
                except (RuntimeError, ValueError) as e:
                    logger.error("Transcription error: %s", e)
                    yield {
                        "text": "",
                        "language": None,
                        "confidence": None,
                        "is_final": True,
                        "error": str(e),
                    }

                # Reset if final
                if processor.should_stop_recording():
                    processor.reset()
                    accumulated_audio = np.array([], dtype=np.float32)


async def stream_synthesize_speech(
    text: str,
    *,
    chunk_size: int = 1024,
) -> AsyncGenerator[tuple[bytes, int], None]:
    """
    Stream speech synthesis in chunks using MeloTTS.

    Args:
        text: Text to synthesize
        chunk_size: Size of audio chunks to yield

    Yields:
        Tuples of (audio_chunk, sample_rate)
    """
    cleaned = sanitize_tts_text(text)
    if not cleaned:
        cleaned = text.strip()
        if not cleaned:
            return

    tts = await _load_melo_tts()
    if not tts:
        logger.error("MeloTTS not available, cannot synthesize speech")
        return

    def _synthesize_stream():
        wav_bytes, sample_rate = _generate_melo_wav(tts, cleaned)
        audio_chunks: list[tuple[bytes, int]] = []
        for i in range(0, len(wav_bytes), chunk_size):
            chunk = wav_bytes[i : i + chunk_size]
            audio_chunks.append((chunk, sample_rate))
        return audio_chunks

    loop = asyncio.get_running_loop()
    try:
        chunks = await loop.run_in_executor(None, _synthesize_stream)
        for chunk in chunks:
            yield chunk
    except (RuntimeError, ValueError) as exc:  # pragma: no cover
        logger.error("MeloTTS synthesis failed: %s", exc, exc_info=True)
        return


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
        {"text": str, "language": str | None, "confidence": float | None}
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

    # Normalize language hint
    if language:
        language = language.strip().lower()
        if language in {"", "auto", "detect", "automatic"}:
            language = None
        elif "," in language:
            language = language.split(",", 1)[0].strip() or None

    audio_pcm, sample_rate = _ensure_pcm16(audio_pcm, sample_rate)

    def _run() -> dict[str, Any]:
        # Convert PCM16 to float32 [-1, 1]
        padding_length = len(audio_pcm) % 2
        if padding_length:
            padded = audio_pcm + b"\x00" * (2 - padding_length)
        else:
            padded = audio_pcm

        arr = np.frombuffer(padded, dtype=np.int16).astype(np.float32) / 32768
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
) -> tuple[bytes, int] | None:
    """
    Generate PCM16 mono audio for the provided text using MeloTTS.

    Returns:
        (wav_bytes, sample_rate) or None if synthesis not available.
    """
    cleaned = sanitize_tts_text(text)
    if not cleaned:
        cleaned = text.strip()
        if not cleaned:
            return None

    tts = await _load_melo_tts()
    if not tts:
        logger.error("MeloTTS not available, cannot synthesize speech")
        return None

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _generate_melo_wav, tts, cleaned)
    except (RuntimeError, ValueError) as exc:  # pragma: no cover
        logger.error("MeloTTS synthesis failed: %s", exc, exc_info=True)
        return None

    return None


__all__ = [
    "FW_AVAILABLE",
    "MELO_AVAILABLE",
    "StreamingAudioProcessor",
    "stream_transcribe_audio",
    "stream_synthesize_speech",
    "transcribe_audio_pcm16",
    "synthesize_speech",
    "_pcm16_to_wav",
]
