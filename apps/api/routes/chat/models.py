"""
Pydantic models for chat endpoints.
"""

from typing import Any
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Chat request model."""

    messages: list[dict[str, str]]  # [{role, content}]
    session_id: str | None = None
    stream: bool = True
    enable_tools: bool = True
    model: str | None = None
    assistant_language: str | None = None


class UnifiedChatRequest(BaseModel):
    """Unified chat request that supports both text and audio input."""

    messages: list[dict[str, str]]
    text_input: str | None = None
    audio_b64: str | None = None
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    stream: bool = True
    assistant_language: str | None = None


class UnifiedChatResponse(BaseModel):
    """Unified chat response payload."""

    content: str
    transcript: str | None = None
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None


class VoiceTurnRequest(BaseModel):
    """Turn-based voice interaction request."""

    messages: list[dict[str, str]]
    audio_b64: str
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = True
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    assistant_language: str | None = None


class VoiceTurnResponse(BaseModel):
    """Voice turn response payload."""

    transcript: str
    assistant_text: str
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None
