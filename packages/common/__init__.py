"""
Common utilities, settings, and logging for the ingestion pipeline.
"""
from .logger import get_logger
from .settings import Settings, get_settings
from .accelerator import AcceleratorChoice, coerce_preference, resolve_accelerator

__all__ = [
    "get_logger",
    "Settings",
    "get_settings",
    "AcceleratorChoice",
    "coerce_preference",
    "resolve_accelerator",
]
