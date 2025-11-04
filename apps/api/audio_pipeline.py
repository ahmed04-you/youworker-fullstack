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
    from kokoro_onnx import Kokoro

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional dependencies (faster-whisper for STT, Kokoro for TTS)
# ---------------------------------------------------------------------------

try:  # pragma: no cover - optional dependency
    from faster_whisper import WhisperModel  # type: ignore

    FW_AVAILABLE = True
except Exception:  # pragma: no cover
    FW_AVAILABLE = False

try:  # pragma: no cover - optional dependency
    from kokoro_onnx import Kokoro  # type: ignore

    KOKORO_AVAILABLE = True
except Exception:  # pragma: no cover
    KOKORO_AVAILABLE = False

# ---------------------------------------------------------------------------
# Globals for lazy-loading heavy models
# ---------------------------------------------------------------------------
WHISPER_MODEL: WhisperModel | None = None
WHISPER_LOCK = asyncio.Lock()
KOKORO_ENGINE: "Kokoro | None" = None
KOKORO_VOICE_NAME: str | None = None
KOKORO_LOCK = asyncio.Lock()

WHISPER_TARGET_SR = 16000

KOKORO_RELEASE_VERSION = os.getenv("KOKORO_RELEASE_VERSION", "v1.0.0")
KOKORO_ASSETS_BASE = os.getenv(
    "KOKORO_ASSETS_BASE_URL",
    f"https://github.com/nazdridoy/kokoro-tts/releases/download/{KOKORO_RELEASE_VERSION}",
)
KOKORO_MODEL_FILENAME_DEFAULT = "kokoro-v1.0.onnx"
KOKORO_VOICES_FILENAME_DEFAULT = "voices-v1.0.bin"


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


def _ensure_kokoro_assets(model_dir: str) -> tuple[Path, Path] | None:
    """Ensure Kokoro model and voices files are present locally."""

    model_path_env = os.getenv("KOKORO_MODEL_PATH")
    voices_path_env = os.getenv("KOKORO_VOICES_PATH")

    target_dir = Path(model_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    model_filename = os.getenv("KOKORO_MODEL_FILENAME", KOKORO_MODEL_FILENAME_DEFAULT)
    voices_filename = os.getenv("KOKORO_VOICES_FILENAME", KOKORO_VOICES_FILENAME_DEFAULT)

    model_path = Path(model_path_env) if model_path_env else target_dir / model_filename
    voices_path = Path(voices_path_env) if voices_path_env else target_dir / voices_filename

    downloads: list[tuple[str, Path]] = []

    if not model_path.exists():
        if model_path_env:
            logger.error("Kokoro model not found at configured path: %s", model_path)
            return None
        model_url = os.getenv("KOKORO_MODEL_URL") or f"{KOKORO_ASSETS_BASE}/{model_filename}"
        downloads.append((model_url, model_path))

    if not voices_path.exists():
        if voices_path_env:
            logger.error("Kokoro voices file not found at configured path: %s", voices_path)
            return None
        voices_url = os.getenv("KOKORO_VOICES_URL") or f"{KOKORO_ASSETS_BASE}/{voices_filename}"
        downloads.append((voices_url, voices_path))

    def _download(url: str, dest: Path) -> None:
        temp_file: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, dir=str(dest.parent)) as tmp:
                temp_file = Path(tmp.name)
            logger.info("Downloading Kokoro asset '%s' -> %s", url, dest)
            urlretrieve(url, temp_file)
            if not temp_file.exists() or temp_file.stat().st_size == 0:
                raise RuntimeError(f"Empty download from {url}")
            temp_file.replace(dest)
        except Exception:
            if temp_file is not None:
                with contextlib.suppress(Exception):
                    temp_file.unlink(missing_ok=True)
            raise

    if downloads:
        try:
            for url, dest in downloads:
                _download(url, dest)
        except Exception as exc:  # pragma: no cover - network dependant
            logger.error("Failed to download Kokoro assets: %s", exc, exc_info=True)
            with contextlib.suppress(Exception):
                model_path.unlink(missing_ok=True)
                voices_path.unlink(missing_ok=True)
            return None

    return model_path, voices_path


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


async def _load_whisper() -> WhisperModel | None:
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

        def load_candidate(candidate: tuple[str, str, str]) -> WhisperModel:
            candidate_model, candidate_device, candidate_compute = candidate
            logger.info(
                "Loading faster-whisper model (model=%s, device=%s, compute_type=%s, primary=%s)",
                candidate_model,
                candidate_device,
                candidate_compute,
                candidate_model == model_name and candidate_device == device,
            )
            return WhisperModel(
                candidate_model,
                device=candidate_device,
                compute_type=candidate_compute,
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


KOKORO_VOICE_PRIORITY = ["if_sara", "im_nicola"]


def _resolve_kokoro_voice(engine: "Kokoro") -> str | None:
    """Determine which Kokoro voice to use, preferring high-quality Italian options."""
    requested_voice = (os.getenv("TTS_VOICE") or "").strip()
    available = set(engine.get_voices())

    if requested_voice and requested_voice in available:
        return requested_voice

    if requested_voice and requested_voice not in available:
        logger.warning(
            "Requested Kokoro voice '%s' unavailable; searching for Italian alternatives",
            requested_voice,
        )

    for candidate in KOKORO_VOICE_PRIORITY:
        if candidate in available:
            if requested_voice and requested_voice != candidate:
                logger.info("Falling back to Kokoro voice '%s'", candidate)
            return candidate

    if available:
        fallback = sorted(available)[0]
        logger.warning(
            "No preferred Kokoro Italian voice available; falling back to '%s'", fallback
        )
        return fallback

    logger.error("No Kokoro voices available in loaded assets")
    return None


def _resolve_kokoro_language() -> str:
    language = (os.getenv("TTS_LANGUAGE") or "").strip().lower()
    if not language:
        language = "it"
    return language


def _resolve_kokoro_speed() -> float:
    speed_env = os.getenv("TTS_SPEED", "1.0")
    try:
        speed = float(speed_env)
    except ValueError:
        logger.warning("Invalid TTS_SPEED '%s'; defaulting to 1.0", speed_env)
        speed = 1.0
    return max(0.5, min(2.0, speed))


async def _load_kokoro_engine() -> "Kokoro | None":
    """Lazy-load Kokoro TTS engine and ensure assets exist."""
    global KOKORO_ENGINE
    global KOKORO_VOICE_NAME

    if not KOKORO_AVAILABLE:  # pragma: no cover - dependency optional
        logger.warning("kokoro-onnx not available; TTS disabled")
        return None

    if KOKORO_ENGINE is not None:
        return KOKORO_ENGINE

    async with KOKORO_LOCK:
        if KOKORO_ENGINE is not None:
            return KOKORO_ENGINE

        loop = asyncio.get_running_loop()
        provider = (os.getenv("TTS_PROVIDER") or "kokoro").strip().lower()
        if provider not in {"kokoro", "kokoro-onnx"}:
            logger.info("TTS provider set to %s, skipping Kokoro load", provider)
            return None

        model_dir = os.getenv("TTS_MODEL_DIR", "/app/models/tts")
        assets = _ensure_kokoro_assets(model_dir)
        if assets is None:
            logger.error("Unable to prepare Kokoro assets; TTS disabled")
            return None

        model_path, voices_path = assets
        logger.info("Loading Kokoro TTS (model=%s, voices=%s)", model_path, voices_path)

        def _load() -> Kokoro:
            return Kokoro(str(model_path), str(voices_path))

        try:
            KOKORO_ENGINE = await loop.run_in_executor(None, _load)
        except (RuntimeError, ImportError, FileNotFoundError, AssertionError) as exc:  # pragma: no cover
            logger.error("Failed to initialize Kokoro TTS engine: %s", exc)
            KOKORO_ENGINE = None
            return None

        voice_name = _resolve_kokoro_voice(KOKORO_ENGINE)
        if not voice_name:
            KOKORO_ENGINE = None
            return None

        KOKORO_VOICE_NAME = voice_name
        logger.info(
            "Kokoro TTS ready with voice '%s' (language=%s, speed=%.2f)",
            voice_name,
            _resolve_kokoro_language(),
            _resolve_kokoro_speed(),
        )

    return KOKORO_ENGINE


def _generate_kokoro_wav(engine: "Kokoro", text: str) -> tuple[bytes, int]:
    """Generate WAV bytes using the Kokoro engine."""
    global KOKORO_VOICE_NAME

    voice_name = _resolve_kokoro_voice(engine)
    if not voice_name:
        raise RuntimeError("No Kokoro voice available for synthesis")

    if KOKORO_VOICE_NAME != voice_name:
        KOKORO_VOICE_NAME = voice_name

    language = _resolve_kokoro_language()
    speed = _resolve_kokoro_speed()

    preview = text[:100] + "..." if len(text) > 100 else text
    logger.info(
        "Starting Kokoro synthesis (voice=%s, lang=%s, speed=%.2f, text=%s)",
        voice_name,
        language,
        speed,
        preview,
    )

    audio, sample_rate = engine.create(text, voice=voice_name, lang=language, speed=speed)
    clipped = np.clip(audio, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype(np.int16).tobytes()
    wav_bytes = _pcm16_to_wav(pcm16, int(sample_rate))
    logger.info("Generated Kokoro WAV: %d bytes at %d Hz", len(wav_bytes), int(sample_rate))
    return wav_bytes, int(sample_rate)


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
    Stream speech synthesis in chunks using Kokoro TTS.

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

    engine = await _load_kokoro_engine()
    if not engine:
        logger.error("Kokoro engine not available, cannot synthesize speech")
        return

    def _synthesize_stream():
        wav_bytes, sample_rate = _generate_kokoro_wav(engine, cleaned)
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
        logger.error("Kokoro synthesis failed: %s", exc, exc_info=True)
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
    Generate PCM16 mono audio for the provided text using Kokoro TTS.

    Returns:
        (wav_bytes, sample_rate) or None if synthesis not available.
    """
    cleaned = sanitize_tts_text(text)
    if not cleaned:
        cleaned = text.strip()
        if not cleaned:
            return None

    engine = await _load_kokoro_engine()
    if not engine:
        logger.error("Kokoro engine not available, cannot synthesize speech")
        return None

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _generate_kokoro_wav, engine, cleaned)
    except (RuntimeError, ValueError) as exc:  # pragma: no cover
        logger.error("Kokoro synthesis failed: %s", exc, exc_info=True)
        return None

    return None


__all__ = [
    "FW_AVAILABLE",
    "KOKORO_AVAILABLE",
    "StreamingAudioProcessor",
    "stream_transcribe_audio",
    "stream_synthesize_speech",
    "transcribe_audio_pcm16",
    "synthesize_speech",
    "_pcm16_to_wav",
]
