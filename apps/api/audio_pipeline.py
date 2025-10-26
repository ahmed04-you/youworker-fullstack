"""
Enhanced audio pipeline with streaming capabilities for real-time STT and TTS.
"""

from __future__ import annotations

import asyncio
import io
import logging
import math
import os
import wave
from typing import TYPE_CHECKING, Any, AsyncGenerator, Optional, Tuple, Union

import numpy as np

if TYPE_CHECKING:
    from faster_whisper import WhisperModel
    from piper import PiperVoice

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

# ---------------------------------------------------------------------------
# Globals for lazy-loading heavy models
# ---------------------------------------------------------------------------
WHISPER_MODEL: WhisperModel | None = None
WHISPER_LOCK = asyncio.Lock()
PIPER_VOICE: PiperVoice | None = None
PIPER_LOCK = asyncio.Lock()

WHISPER_TARGET_SR = 16000


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
        rms = np.sqrt(np.mean(chunk ** 2))
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

        def load() -> WhisperModel:
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


async def _load_piper_voice() -> PiperVoice | None:
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
        voice_name = os.getenv("TTS_VOICE", "it_IT-riccardo-x_low")
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

        def load() -> PiperVoice:
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
                        "is_final": processor.should_stop_recording()
                    }
                
                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, _transcribe_chunk)
                    if result["text"]:
                        yield result
                except Exception as e:
                    logger.error("Transcription error: %s", e)
                
                # Reset if final
                if processor.should_stop_recording():
                    processor.reset()
                    accumulated_audio = np.array([], dtype=np.float32)


async def stream_synthesize_speech(
    text: str,
    *,
    chunk_size: int = 1024,
    fallback: bool = True,
) -> AsyncGenerator[Tuple[bytes, int], None]:
    """
    Stream speech synthesis in chunks.
    
    Args:
        text: Text to synthesize
        chunk_size: Size of audio chunks to yield
        fallback: Whether to use fallback synthesis
        
    Yields:
        Tuples of (audio_chunk, sample_rate)
    """
    cleaned = text.strip()
    if not cleaned:
        return

    voice = await _load_piper_voice()
    
    if voice:
        def _synthesize_stream():
            logger.info("Starting Piper synthesis for text: %s", cleaned[:100] + "..." if len(cleaned) > 100 else cleaned)
            
            # Use synthesize method to get audio chunks
            audio_chunks = []
            sample_rate = voice.config.sample_rate if hasattr(voice, 'config') and hasattr(voice.config, 'sample_rate') else 22050
            
            # Generate full audio first
            with io.BytesIO() as wav_buffer:
                with wave.open(wav_buffer, "wb") as wav_file:
                    voice.synthesize_wav(cleaned, wav_file)
                wav_bytes = wav_buffer.getvalue()
            
            # Split into chunks
            for i in range(0, len(wav_bytes), chunk_size):
                chunk = wav_bytes[i:i + chunk_size]
                audio_chunks.append((chunk, sample_rate))
            
            return audio_chunks
        
        loop = asyncio.get_running_loop()
        try:
            chunks = await loop.run_in_executor(None, _synthesize_stream)
            for chunk in chunks:
                yield chunk
        except Exception as exc:  # pragma: no cover
            logger.error("Piper synthesis failed: %s", exc, exc_info=True)
    
    if not fallback:
        return
    
    # Fallback: generate sine wave tone in chunks
    duration = max(0.4, min(len(cleaned) * 0.03, 3.0))
    sample_rate = 24000
    total_samples = int(sample_rate * duration)
    
    for i in range(0, total_samples, chunk_size):
        end_sample = min(i + chunk_size, total_samples)
        t = np.linspace(i / sample_rate, end_sample / sample_rate, end_sample - i)
        waveform = 0.08 * np.sin(2 * math.pi * 440.0 * t)
        pcm = (waveform * 32767.0).astype(np.int16).tobytes()
        yield (pcm, sample_rate)


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

    # Normalize language hint
    if language:
        language = language.strip().lower()
        if language in {"", "auto", "detect", "automatic"}:
            language = None
        elif "," in language:
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
            # Use synthesize_wav method to write directly to a WAV file
            with io.BytesIO() as wav_buffer:
                with wave.open(wav_buffer, "wb") as wav_file:
                    voice.synthesize_wav(cleaned, wav_file)
                wav_bytes = wav_buffer.getvalue()
            
            sr = voice.config.sample_rate if hasattr(voice, 'config') and hasattr(voice.config, 'sample_rate') else 22050
            logger.info("Generated WAV: %d bytes at %d Hz", len(wav_bytes), sr)
            return wav_bytes, int(sr)

        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, _run_voice)
        except Exception as exc:  # pragma: no cover
            logger.error("Piper synthesis failed: %s", exc, exc_info=True)

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
    "StreamingAudioProcessor",
    "stream_transcribe_audio",
    "stream_synthesize_speech",
    "transcribe_audio_pcm16",
    "synthesize_speech",
    "_pcm16_to_wav",
]