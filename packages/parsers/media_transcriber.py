from __future__ import annotations

import tempfile
from contextlib import suppress
from pathlib import Path
from typing import Iterator
from uuid import uuid4

import ffmpeg

from packages.common import (
    AcceleratorChoice,
    coerce_preference,
    get_logger,
    get_settings,
    resolve_accelerator,
)
from packages.vectorstore.schema import DocumentSource

from .models import DocChunk

logger = get_logger(__name__)

try:
    from faster_whisper import WhisperModel  # type: ignore

    WHISPER_AVAILABLE = True
except ImportError:  # pragma: no cover
    WhisperModel = None
    WHISPER_AVAILABLE = False

_settings = get_settings()

WHISPER_MODEL_NAME = _settings.ingest_whisper_model or "large-v3"
WHISPER_COMPUTE_TYPE = _settings.ingest_whisper_compute_type or "int8"
WHISPER_GPU_COMPUTE_TYPE = _settings.ingest_whisper_gpu_compute_type or "float16"
WHISPER_CPU_THREADS = max(1, _settings.ingest_whisper_cpu_threads or 4)
WHISPER_NUM_WORKERS = max(1, _settings.ingest_whisper_num_workers or 1)
WHISPER_LANGUAGE = _settings.ingest_whisper_language
def _active_compute_type(choice: AcceleratorChoice) -> str:
    return WHISPER_GPU_COMPUTE_TYPE if choice.using_gpu else WHISPER_COMPUTE_TYPE


_WHISPER_ACCELERATOR = resolve_accelerator(
    preference=coerce_preference(_settings.ingest_whisper_accelerator, _settings.ingest_accelerator),
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


def transcribe(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """
    Transcribe audio or video content using faster-whisper with optional GPU acceleration.

    Automatically detects the spoken language (Italian, English, or others supported by the
    configured Whisper model) and preserves the original text without translation.
    """
    if not WHISPER_AVAILABLE:  # pragma: no cover
        logger.warning("whisper-not-installed", path=str(path))
        return

    language_hint = _resolve_language_hint(WHISPER_LANGUAGE)
    model = _get_whisper_model()
    runtime = _MODEL_CHOICE or _WHISPER_ACCELERATOR

    logger.info(
        "whisper-transcribe-start",
        path=str(path),
        model=WHISPER_MODEL_NAME,
        device=runtime.compute_device,
        compute_type=_active_compute_type(runtime),
        language_hint=language_hint or "auto",
        accelerator=runtime.requested,
        gpu_available=runtime.gpu_available,
    )

    with _demux_to_wav(path) as audio_path:
        try:
            segments, detected_language = _run_transcription(
                model,
                audio_path,
                language_hint=language_hint,
            )
        except Exception as exc:  # pragma: no cover
            if runtime.using_gpu:
                logger.warning(
                    "whisper-transcribe-gpu-error",
                    path=str(path),
                    error=str(exc),
                )
                cpu_choice = resolve_accelerator(preference="cpu")
                _reset_whisper_model()
                try:
                    model = _get_whisper_model(choice=cpu_choice, cpu_threads=20)
                except Exception as model_exc:
                    logger.warning(
                        "whisper-transcribe-error",
                        path=str(path),
                        error=str(model_exc),
                    )
                    return
                runtime = cpu_choice
                logger.info(
                    "whisper-transcribe-fallback",
                    path=str(path),
                    accelerator=runtime.requested,
                    device=runtime.compute_device,
                )
                try:
                    segments, detected_language = _run_transcription(
                        model,
                        audio_path,
                        language_hint=language_hint,
                    )
                except Exception as cpu_exc:
                    logger.warning(
                        "whisper-transcribe-error",
                        path=str(path),
                        error=str(cpu_exc),
                    )
                    return
            else:
                logger.warning("whisper-transcribe-error", path=str(path), error=str(exc))
                return

    logger.info(
        "whisper-transcribe-complete",
        path=str(path),
        segments=len(segments),
        language=detected_language,
    )

    if not segments:
        return

    paragraphs = _segments_to_paragraphs(segments)
    if not paragraphs:
        return

    for chunk_id, (paragraph_text, start_ts, end_ts) in enumerate(paragraphs, start=1):
        paragraph_text = paragraph_text.strip()
        if not paragraph_text:
            continue
        paragraph_index = chunk_id
        formatted_timestamp = _format_timestamp(start_ts)
        formatted_end = _format_timestamp(end_ts)
        chunk_text = f"{paragraph_text}\n\n[{formatted_timestamp} - {formatted_end}]"
        metadata = {
            "paragraph_index": paragraph_index,
            "start": start_ts,
            "end": end_ts,
            "language": detected_language,
            "transcription_engine": "faster-whisper",
            "model": WHISPER_MODEL_NAME,
            "transcript_type": "original",
            "timestamp_range": {
                "start": formatted_timestamp,
                "end": formatted_end,
            },
        }

        yield DocChunk(
            id=uuid4().hex,
            chunk_id=chunk_id,
            text=chunk_text,
            uri=uri,
            mime=mime,
            source=source,
            metadata=metadata,
        )


def _get_whisper_model(
    choice: AcceleratorChoice | None = None,
    *,
    cpu_threads: int | None = None,
    num_workers: int | None = None,
) -> WhisperModel:
    """Load and cache the Whisper model preferring GPU when available."""
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
        if _WHISPER_ACCELERATOR.using_gpu:
            cpu_choice = resolve_accelerator(preference="cpu")
            attempts.append(cpu_choice)

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
            model=WHISPER_MODEL_NAME,
            device=candidate.compute_device,
            compute_type=compute_type,
            accelerator=candidate.requested,
            gpu_available=candidate.gpu_available,
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
                model=WHISPER_MODEL_NAME,
                device=candidate.compute_device,
                compute_type=compute_type,
                accelerator=candidate.requested,
                error=str(exc),
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
            logger.warning("audio-temp-clean-failed", path=str(self.path))


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
        logger.warning("ffmpeg-demux-error", path=str(path), error=exc.stderr.decode(errors="ignore"))
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


def _run_transcription(model: WhisperModel, audio_path: Path, *, language_hint: str | None) -> tuple[list, str | None]:
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
                    hint=language_hint,
                    detected=detected_language,
                    attempt=attempt,
                )
            else:
                logger.debug(
                    "whisper-language-selected",
                    language=detected_language or language_hint,
                    attempt=attempt,
                )
            break
        logger.info(
            "whisper-transcribe-retry",
            attempt=attempt,
            reason="no_segments",
            attempted_language=candidate or "auto",
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
