from __future__ import annotations

import tempfile
from contextlib import suppress
from pathlib import Path
from typing import Any

import ffmpeg

from packages.common import (
    AcceleratorChoice,
    coerce_preference,
    get_logger,
    get_settings,
    resolve_accelerator,
)

logger = get_logger(__name__)

try:
    from faster_whisper import WhisperModel  # type: ignore

    WHISPER_AVAILABLE = True
except ImportError:  # pragma: no cover
    WhisperModel = None
    WHISPER_AVAILABLE = False

_settings = get_settings()

WHISPER_MODEL_NAME = _settings.ingest_whisper_model or "large-v3-turbo"
WHISPER_COMPUTE_TYPE = _settings.ingest_whisper_compute_type or "float16"  # GPU default
WHISPER_GPU_COMPUTE_TYPE = _settings.ingest_whisper_gpu_compute_type or "float16"
WHISPER_CPU_THREADS = max(1, _settings.ingest_whisper_cpu_threads or 4)
WHISPER_NUM_WORKERS = max(1, _settings.ingest_whisper_num_workers or 1)
WHISPER_LANGUAGE = _settings.ingest_whisper_language


def _active_compute_type(choice: AcceleratorChoice) -> str:
    return WHISPER_GPU_COMPUTE_TYPE if choice.using_gpu else WHISPER_COMPUTE_TYPE


_WHISPER_ACCELERATOR = resolve_accelerator(
    preference="gpu",  # Media transcription always uses GPU
    explicit_device=_settings.ingest_whisper_device or _settings.ingest_gpu_device,
)
_MODEL_CACHE: WhisperModel | None = None
_MODEL_CHOICE: AcceleratorChoice | None = None


def _reset_whisper_model() -> None:
    """Release the cached Whisper model so a new configuration can be loaded."""
    global _MODEL_CACHE, _MODEL_CHOICE
    if _MODEL_CACHE is not None:
        release = getattr(_MODEL_CACHE, "release_model", None)
        if callable(release):
            with suppress(Exception):
                release()
    _MODEL_CACHE = None
    _MODEL_CHOICE = None


def release_resources() -> None:
    """Public helper to free any cached Whisper resources."""
    _reset_whisper_model()


def _get_whisper_model(
    choice: AcceleratorChoice | None = None,
    *,
    cpu_threads: int | None = None,
    num_workers: int | None = None,
) -> WhisperModel:
    """Load and cache the Whisper model on GPU (required for media transcription)."""
    global _MODEL_CACHE, _MODEL_CHOICE
    if choice is None and _MODEL_CACHE is not None:
        return _MODEL_CACHE
    if choice is not None and _MODEL_CACHE is not None:
        if _MODEL_CHOICE == choice:
            return _MODEL_CACHE
        _reset_whisper_model()

    if WhisperModel is None:  # pragma: no cover
        raise RuntimeError("WhisperModel is not available. Install faster-whisper.")

    attempts: list[AcceleratorChoice]
    if choice is not None:
        attempts = [choice]
    else:
        attempts = [_WHISPER_ACCELERATOR]
        # No CPU fallback - media transcription requires GPU

    last_error: Exception | None = None
    for candidate in attempts:
        threads = (
            max(1, cpu_threads)
            if cpu_threads is not None and not candidate.using_gpu
            else WHISPER_CPU_THREADS
        )
        workers = max(1, num_workers) if num_workers is not None else WHISPER_NUM_WORKERS
        compute_type = _active_compute_type(candidate)
        kwargs = {
            "device": candidate.device,
            "compute_type": compute_type,
            "cpu_threads": threads,
            "num_workers": workers,
        }
        if candidate.using_gpu and candidate.device_index is not None:
            kwargs["device_index"] = candidate.device_index

        logger.info(
            "whisper-model-load",
            extra={
                "model": WHISPER_MODEL_NAME,
                "device": candidate.compute_device,
                "compute_type": compute_type,
                "accelerator": candidate.requested,
                "gpu_available": candidate.gpu_available,
            },
        )
        try:
            model = WhisperModel(
                WHISPER_MODEL_NAME,
                **kwargs,
            )
        except Exception as exc:  # pragma: no cover
            last_error = exc
            logger.warning(
                "whisper-model-load-failed",
                extra={
                    "model": WHISPER_MODEL_NAME,
                    "device": candidate.compute_device,
                    "compute_type": compute_type,
                    "accelerator": candidate.requested,
                    "error": str(exc),
                },
            )
            continue

        _MODEL_CACHE = model
        _MODEL_CHOICE = candidate
        return model

    if last_error is not None:  # pragma: no cover
        raise RuntimeError("Failed to initialise Whisper model on all accelerators") from last_error
    raise RuntimeError("Failed to initialise Whisper model")


class _DemuxedAudio:
    def __init__(self, path: Path) -> None:
        self.path = path

    def __enter__(self) -> Path:
        return self.path

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            self.path.unlink(missing_ok=True)
        except Exception:  # pragma: no cover
            logger.warning("audio-temp-clean-failed", extra={"path": str(self.path)})


def _demux_to_wav(path: Path) -> _DemuxedAudio:
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        (
            ffmpeg.input(str(path))
            .output(str(tmp_path), format="wav", ac=1, ar=16000)
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:  # pragma: no cover
        logger.warning(
            "ffmpeg-demux-error",
            extra={"path": str(path), "error": exc.stderr.decode(errors="ignore")},
        )
        tmp_path.unlink(missing_ok=True)
        raise
    return _DemuxedAudio(tmp_path)


def _segments_to_paragraphs(segments) -> list[tuple[str, float, float]]:
    paragraphs: list[tuple[str, float, float]] = []
    buffer: list[str] = []
    paragraph_start: float | None = None
    paragraph_end: float | None = None

    for segment in segments:
        text = (getattr(segment, "text", "") or "").strip()
        if not text:
            continue
        start = float(getattr(segment, "start", 0.0) or 0.0)
        end = float(getattr(segment, "end", start) or start)

        if paragraph_start is None:
            paragraph_start = start
        paragraph_end = end
        buffer.append(text)

        if _ends_paragraph(text):
            paragraph_text = " ".join(buffer).strip()
            if paragraph_text:
                paragraphs.append((paragraph_text, paragraph_start, paragraph_end))
            buffer = []
            paragraph_start = None
            paragraph_end = None

    if buffer and paragraph_start is not None:
        paragraph_text = " ".join(buffer).strip()
        if paragraph_text:
            paragraphs.append((paragraph_text, paragraph_start, paragraph_end or paragraph_start))

    return paragraphs


def _ends_paragraph(text: str) -> bool:
    """Heuristic to decide when a paragraph should end."""
    if not text:
        return False
    stripped = text.rstrip()
    return stripped.endswith((".", "?", "!", "…")) or "\n" in stripped


def _format_timestamp(value: float | None) -> str:
    if value is None or value < 0:
        value = 0.0
    total_seconds = int(round(value))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _resolve_language_hint(language: str | None) -> str | None:
    if not language:
        return None
    normalized = language.strip().lower()
    if normalized in {"", "auto", "detect", "automatic"}:
        return None
    if "," in normalized:
        # Allow comma-separated hints like "it,en" while prioritising the first language.
        normalized = normalized.split(",", 1)[0].strip()
    return normalized or None


def _transcribe_kwargs() -> dict:
    return {
        "beam_size": 5,
        "best_of": 5,
        "temperature": 0.0,
        "vad_filter": True,
        "vad_parameters": {
            "threshold": 0.5,
            "min_speech_duration_ms": 250,
            "max_speech_duration_s": 30,
            "min_silence_duration_ms": 500,
        },
    }


def _run_transcription(
    model: WhisperModel, audio_path: Path, *, language_hint: str | None
) -> tuple[list, str | None]:
    """Run the Whisper transcription pass preferring auto-detection, with fallback to hints."""
    candidates: list[str | None] = [None]
    if language_hint:
        candidates.append(language_hint)

    last_detected: str | None = None
    segments: list = []

    for attempt, candidate in enumerate(candidates, start=1):
        segments_iter, info = model.transcribe(
            str(audio_path),
            language=candidate,
            task="transcribe",
            **_transcribe_kwargs(),
        )
        segments = list(segments_iter)
        detected_language = _extract_language(info, fallback=candidate if candidate else None)
        if segments:
            last_detected = detected_language or language_hint
            if language_hint and detected_language and detected_language != language_hint:
                logger.info(
                    "whisper-language-detected",
                    extra={
                        "hint": language_hint,
                        "detected": detected_language,
                        "attempt": attempt,
                    },
                )
            else:
                logger.debug(
                    "whisper-language-selected",
                    extra={
                        "language": detected_language or language_hint,
                        "attempt": attempt,
                    },
                )
            break
        logger.info(
            "whisper-transcribe-retry",
            extra={
                "attempt": attempt,
                "reason": "no_segments",
                "attempted_language": candidate or "auto",
            },
        )
    else:
        detected_language = language_hint

    final_language = last_detected or detected_language or language_hint
    return segments, final_language


def _extract_language(info, *, fallback: str | None) -> str | None:
    language = getattr(info, "language", None)
    if language:
        return str(language).lower()
    return fallback.lower() if isinstance(fallback, str) else fallback


def _transcribe_simple_sync(file_path: Path) -> dict[str, Any]:
    """
    Synchronous helper for transcription using GPU.

    Returns dict with:
    - text: Full transcript as single string
    - language: Detected language code
    - duration: Audio duration in seconds
    """
    if not WHISPER_AVAILABLE:
        logger.warning(f"Whisper not available, cannot transcribe {file_path}")
        return {"text": "", "language": None, "duration": 0}

    language_hint = _resolve_language_hint(WHISPER_LANGUAGE)
    model = _get_whisper_model()

    logger.info(f"Starting transcription: {file_path}")

    with _demux_to_wav(file_path) as audio_path:
        try:
            segments, detected_language = _run_transcription(
                model,
                audio_path,
                language_hint=language_hint,
            )
        except Exception as exc:
            logger.error(f"Transcription failed: {exc}", exc_info=True)
            return {"text": "", "language": None, "duration": 0}

    if not segments:
        return {"text": "", "language": detected_language, "duration": 0}

    # Extract full text and calculate duration
    full_text = " ".join(
        (getattr(seg, "text", "") or "").strip()
        for seg in segments
    ).strip()

    # Get duration from last segment
    duration = 0.0
    if segments:
        last_seg = segments[-1]
        duration = float(getattr(last_seg, "end", 0.0) or 0.0)

    logger.info(f"Transcription complete: {len(segments)} segments, {duration:.1f}s")

    return {
        "text": full_text,
        "language": detected_language,
        "duration": duration,
    }


async def transcribe_simple(file_path: Path) -> dict[str, Any]:
    """
    Async GPU transcription for vision-based pipeline.

    Runs transcription in thread pool to avoid blocking event loop.

    Returns dict with:
    - text: Full transcript as single string
    - language: Detected language code
    - duration: Audio duration in seconds
    """
    import asyncio
    return await asyncio.to_thread(_transcribe_simple_sync, file_path)


# ============================================================================
# High-level media parsing functions for vision-based ingestion pipeline
# ============================================================================


async def parse_audio_to_markdown(file_path: Path) -> str:
    """
    Parse audio file to formatted markdown.

    Args:
        file_path: Path to audio file

    Returns:
        Transcribed markdown with metadata
    """
    try:
        transcript_data = await transcribe_simple(file_path)

        if not transcript_data or "text" not in transcript_data:
            logger.warning(f"No transcript returned for {file_path}")
            return ""

        transcript_text = transcript_data["text"]

        # Format as markdown
        markdown = f"""# Audio Transcription

**File**: {file_path.name}

## Transcript

{transcript_text}
"""

        # Add metadata if available
        if "language" in transcript_data:
            markdown += f"\n**Language**: {transcript_data['language']}\n"
        if "duration" in transcript_data:
            duration_mins = int(transcript_data["duration"] // 60)
            duration_secs = int(transcript_data["duration"] % 60)
            markdown += f"**Duration**: {duration_mins}:{duration_secs:02d}\n"

        return markdown

    except Exception as e:
        logger.error(f"Error parsing audio {file_path}: {e}", exc_info=True)
        return ""


async def parse_video_to_markdown(file_path: Path) -> str:
    """
    Parse video file with vision + transcription to formatted markdown.

    Process:
    1. Extract keyframes (1 every 5 seconds)
    2. Analyze each frame with Qwen3-VL
    3. Transcribe audio track
    4. Merge visual descriptions with transcript

    Args:
        file_path: Path to video file

    Returns:
        Rich markdown with visual + audio content
    """
    import asyncio
    from .doc_to_image import DocumentToImageConverter
    from .vision_parser import VisionParser

    image_converter = DocumentToImageConverter()
    vision_parser = VisionParser()

    try:
        # Step 1: Extract keyframes
        logger.info(f"Extracting keyframes from {file_path}")
        frames = await image_converter._convert_video(file_path)

        if not frames:
            logger.warning(f"No frames extracted from {file_path}, trying audio only")
            return await parse_audio_to_markdown(file_path)

        # Step 2 & 3: Analyze frames + transcribe audio in parallel
        logger.info(f"Analyzing {len(frames)} frames and transcribing audio")

        # Run vision analysis and transcription concurrently
        vision_task = vision_parser.analyze_images_batch(frames, max_concurrent=2)
        transcription_task = transcribe_simple(file_path)

        vision_markdown, transcript_data = await asyncio.gather(
            vision_task,
            transcription_task,
            return_exceptions=True,
        )

        # Handle errors
        if isinstance(vision_markdown, Exception):
            logger.error(f"Vision analysis failed: {vision_markdown}")
            vision_markdown = ""

        if isinstance(transcript_data, Exception):
            logger.error(f"Transcription failed: {transcript_data}")
            transcript_data = {}

        # Step 4: Merge results
        markdown = _merge_video_content(
            file_path=file_path,
            visual_content=vision_markdown,
            transcript_data=transcript_data,
            frame_count=len(frames),
        )

        return markdown

    except Exception as e:
        logger.error(f"Error parsing video {file_path}: {e}", exc_info=True)
        return ""


def _merge_video_content(
    file_path: Path,
    visual_content: str,
    transcript_data: dict[str, Any],
    frame_count: int,
) -> str:
    """
    Merge visual analysis and transcript into coherent markdown.

    Creates sections for:
    - Video metadata
    - Visual content (frame descriptions)
    - Full transcript
    """
    markdown_parts = [
        f"# Video Analysis: {file_path.name}",
        "",
        "## Metadata",
        f"- **Frames analyzed**: {frame_count}",
    ]

    # Add duration if available
    if transcript_data and "duration" in transcript_data:
        duration = transcript_data["duration"]
        mins = int(duration // 60)
        secs = int(duration % 60)
        markdown_parts.append(f"- **Duration**: {mins}:{secs:02d}")

    # Add language if available
    if transcript_data and "language" in transcript_data:
        markdown_parts.append(f"- **Language**: {transcript_data['language']}")

    markdown_parts.append("")

    # Visual content section
    if visual_content and visual_content.strip():
        markdown_parts.extend(
            [
                "## Visual Content",
                "",
                "The following visual elements were extracted from video frames:",
                "",
                visual_content,
                "",
            ]
        )

    # Transcript section
    if transcript_data and "text" in transcript_data and transcript_data["text"].strip():
        markdown_parts.extend(
            [
                "## Audio Transcript",
                "",
                transcript_data["text"],
                "",
            ]
        )

    # Combine
    return "\n".join(markdown_parts)
