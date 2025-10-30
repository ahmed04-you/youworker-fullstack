"""
Chat message models for unified chat API.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class UnifiedChatRequest(BaseModel):
    """Request model for unified chat endpoint."""

    text_input: Optional[str] = Field(None, max_length=4000)
    audio_b64: Optional[str] = Field(None, max_length=10000000)  # ~10MB base64
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    messages: Optional[list[Dict[str, Any]]] = None
    session_id: Optional[str] = None
    enable_tools: bool = True
    model: Optional[str] = None
    expect_audio: bool = False
    stream: bool = True


class UnifiedChatResponse(BaseModel):
    """Response model for unified chat endpoint."""

    content: Optional[str] = None
    transcript: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    audio_b64: Optional[str] = None
    audio_sample_rate: Optional[int] = None
    stt_confidence: Optional[float] = None
    stt_language: Optional[str] = None
    tool_events: Optional[list[Dict[str, Any]]] = None
    logs: Optional[list[Dict[str, str]]] = None


class ChatRequest(BaseModel):
    """Request model for streaming chat endpoint."""

    messages: list[Dict[str, Any]]
    session_id: Optional[str] = None
    enable_tools: bool = True
    model: Optional[str] = None
    stream: bool = True


class VoiceTurnRequest(BaseModel):
    """Request model for voice turn endpoint."""

    audio_b64: str
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    messages: Optional[list[Dict[str, Any]]] = None
    session_id: Optional[str] = None
    enable_tools: bool = True
    model: Optional[str] = None
    expect_audio: bool = False


class VoiceTurnResponse(BaseModel):
    """Response model for voice turn endpoint."""

    transcript: str
    assistant_text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    audio_b64: Optional[str] = None
    audio_sample_rate: Optional[int] = None
    stt_confidence: Optional[float] = None
    stt_language: Optional[str] = None
    tool_events: Optional[list[Dict[str, Any]]] = None
    logs: Optional[list[Dict[str, str]]] = None


class ChatMessage(BaseModel):
    """Chat message model."""

    role: str
    content: str
    timestamp: Optional[str] = None
