"""
Accelerator detection and management for GPU-accelerated processing.
"""

from enum import Enum
from typing import Literal


class AcceleratorChoice(str, Enum):
    """Available accelerator types."""

    CPU = "cpu"
    CUDA = "cuda"
    MPS = "mps"  # Apple Silicon


def coerce_preference(
    preference: str | None, fallback: str | None = None
) -> Literal["auto", "cpu", "cuda", "mps"]:
    """
    Coerce user preference to valid accelerator type.

    Args:
        preference: User preference string
        fallback: Fallback preference if primary is invalid

    Returns:
        Valid accelerator preference
    """
    value = (preference or fallback or "auto").lower().strip()

    if value in ("auto", "cpu", "cuda", "mps"):
        return value  # type: ignore

    return "auto"


def resolve_accelerator(
    preference: Literal["auto", "cpu", "cuda", "mps"] = "auto",
    explicit_device: str | None = None,
) -> AcceleratorChoice:
    """
    Resolve accelerator choice based on preference and available hardware.

    Args:
        preference: User preference
        explicit_device: Explicit device string (e.g., "cuda:0")

    Returns:
        Resolved accelerator choice
    """
    # If explicit device specified, use it
    if explicit_device:
        device_lower = explicit_device.lower()
        if "cuda" in device_lower:
            return AcceleratorChoice.CUDA
        if "mps" in device_lower:
            return AcceleratorChoice.MPS
        if "cpu" in device_lower:
            return AcceleratorChoice.CPU

    # Force CPU if requested
    if preference == "cpu":
        return AcceleratorChoice.CPU

    # Force CUDA if requested
    if preference == "cuda":
        if _is_cuda_available():
            return AcceleratorChoice.CUDA
        # Fallback to CPU if CUDA not available
        return AcceleratorChoice.CPU

    # Force MPS if requested
    if preference == "mps":
        if _is_mps_available():
            return AcceleratorChoice.MPS
        # Fallback to CPU if MPS not available
        return AcceleratorChoice.CPU

    # Auto-detect (preference == "auto")
    if _is_cuda_available():
        return AcceleratorChoice.CUDA

    if _is_mps_available():
        return AcceleratorChoice.MPS

    return AcceleratorChoice.CPU


def _is_cuda_available() -> bool:
    """Check if CUDA is available."""
    try:
        import torch

        return torch.cuda.is_available()
    except ImportError:
        return False


def _is_mps_available() -> bool:
    """Check if MPS (Apple Silicon) is available."""
    try:
        import torch

        return hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    except (ImportError, AttributeError):
        return False
