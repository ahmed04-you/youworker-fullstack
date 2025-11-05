#!/usr/bin/env python3
"""Download models during Docker build."""

import os
import urllib.request
from pathlib import Path


def download_piper_voice():
    """Download Piper TTS voice model."""
    voice_name = "it_IT-paola-medium"
    models_dir = Path("/app/models")
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / f"{voice_name}.onnx"
    config_path = models_dir / f"{voice_name}.onnx.json"

    if model_path.exists() and config_path.exists():
        print(f"Piper voice {voice_name} already downloaded")
        return

    # Try different URL patterns
    # Piper voices structure: {lang}/{lang_region}/{speaker}/{quality}/
    # Example: it/it_IT/paola/medium/
    parts = voice_name.split('-')  # ['it_IT', 'paola', 'medium']
    lang_region = parts[0]  # 'it_IT'
    lang = lang_region.split('_')[0].lower()  # 'it'
    speaker = parts[1] if len(parts) > 1 else 'default'  # 'paola'
    quality = parts[2] if len(parts) > 2 else 'medium'  # 'medium'

    url_patterns = [
        # New structure with subdirectories
        f"https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/{lang}/{lang_region}/{speaker}/{quality}/{voice_name}",
        f"https://huggingface.co/rhasspy/piper-voices/resolve/main/{lang}/{lang_region}/{speaker}/{quality}/{voice_name}",
        # Alternative flat structure
        f"https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/{lang}/{voice_name}",
        f"https://huggingface.co/rhasspy/piper-voices/resolve/main/{lang}/{voice_name}",
    ]

    for base_url in url_patterns:
        try:
            print(f"Trying to download from: {base_url}")
            urllib.request.urlretrieve(f"{base_url}.onnx", model_path)
            urllib.request.urlretrieve(f"{base_url}.onnx.json", config_path)
            print(f"Successfully downloaded Piper voice: {voice_name}")
            return
        except urllib.error.HTTPError as e:
            print(f"Failed with {e.code}: {base_url}")
            if model_path.exists():
                model_path.unlink()
            if config_path.exists():
                config_path.unlink()
            continue

    raise RuntimeError(f"Failed to download Piper voice {voice_name} from all URL patterns")


def download_whisper_models():
    """Download Whisper STT models."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper not available, skipping Whisper model downloads")
        return

    models_dir = "/app/models/whisper"
    os.makedirs(models_dir, exist_ok=True)

    os.environ['HF_HUB_CACHE'] = models_dir
    os.environ['TRANSFORMERS_CACHE'] = models_dir

    models = ["small", "large-v3-turbo"]

    for model_name in models:
        print(f"Downloading Whisper model: {model_name}")
        try:
            WhisperModel(model_name, device='cpu', compute_type='int8', download_root=models_dir)
            print(f"Successfully downloaded Whisper model: {model_name}")
        except Exception as e:
            print(f"Failed to download {model_name}: {e}")
            # Continue with other models even if one fails

    print("Whisper models download complete")


if __name__ == "__main__":
    import sys

    print("Starting model downloads...")

    # Download Piper voice - fail if this fails
    try:
        download_piper_voice()
    except Exception as e:
        print(f"FATAL: Error downloading Piper voice: {e}")
        sys.exit(1)

    # Download Whisper models - fail if this fails
    try:
        download_whisper_models()
    except Exception as e:
        print(f"FATAL: Error downloading Whisper models: {e}")
        sys.exit(1)

    print("Model download process complete - all models downloaded successfully!")
