"""
Chat message models for unified chat API.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class UnifiedChatRequest(BaseModel):
    """Request model for unified chat endpoint."""

    text_input: str | None = Field(None, max_length=4000)
    audio_b64: str | None = Field(None, max_length=10000000)  # ~10MB base64
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    messages: list[dict[str, Any]] | None = None
    session_id: str | None = None
    enable_tools: bool = True
    model: str | None = None
    expect_audio: bool = False
    stream: bool = True


class UnifiedChatResponse(BaseModel):
    """Response model for unified chat endpoint."""

    content: str | None = None
    transcript: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] | None = None
    logs: list[dict[str, str]] | None = None


class ChatMessage(BaseModel):
    """Chat message model."""

    role: str
    content: str
    timestamp: str | None = None


class ChatRequest(BaseModel):
    """Request model for streaming chat endpoint."""

    messages: list[ChatMessage]
    session_id: str | None = None
    enable_tools: bool = True
    model: str | None = None
    expect_audio: bool = False
    stream: bool = True


class VoiceTurnRequest(BaseModel):
    """Request model for voice turn endpoint."""

    audio_b64: str
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    messages: list[dict[str, Any]] | None = None
    session_id: str | None = None
    enable_tools: bool = True
    model: str | None = None
    expect_audio: bool = False


class VoiceTurnResponse(BaseModel):
    """Response model for voice turn endpoint."""

    transcript: str
    assistant_text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] | None = None
    logs: list[dict[str, str]] | None = None
