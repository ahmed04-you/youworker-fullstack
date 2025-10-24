"""
Enhanced validation schemas for API endpoints using Pydantic V2.
"""

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator, model_validator


class BaseMessage(BaseModel):
    """Base message model with enhanced validation."""

    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ["user", "assistant", "system", "tool"]:
            raise ValueError("Role must be one of: user, assistant, system, tool")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if len(v) < 1:
            raise ValueError("Content cannot be empty")
        if len(v) > 10000:
            raise ValueError("Content too long")
        # Check for potential XSS or injection patterns
        dangerous_patterns = [
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe[^>]*>",
            r"<object[^>]*>",
            r"<embed[^>]*>",
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Content contains potentially dangerous elements")
        return v


class ChatMessage(BaseMessage):
    """Chat message with optional metadata."""

    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class UnifiedChatRequest(BaseModel):
    """Enhanced unified chat request validation."""

    messages: List[ChatMessage]
    text_input: Optional[str] = None
    audio_b64: Optional[str] = None
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: Optional[str] = None
    stream: bool = False

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if len(v) < 1:
            raise ValueError("At least one message is required")
        if len(v) > 50:
            raise ValueError("Too many messages")
        return v

    @field_validator("text_input")
    @classmethod
    def validate_text_input(cls, v):
        if v is not None and len(v) > 5000:
            raise ValueError("Text input too long")
        return v

    @field_validator("audio_b64")
    @classmethod
    def validate_audio_base64(cls, v):
        if v is not None:
            # Check if it's a valid base64 string
            try:
                import base64

                # Remove potential data URL prefix
                if v.startswith("data:"):
                    v = v.split(",")[1]
                base64.b64decode(v)
            except Exception:
                raise ValueError("Invalid base64 audio data")
        return v

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v):
        if v is not None and (len(v) < 1 or len(v) > 100):
            raise ValueError("Session ID must be between 1 and 100 characters")
        return v

    @model_validator(mode="before")
    def validate_input_type(cls, data):
        text_input = data.get("text_input")
        audio_b64 = data.get("audio_b64")

        if not text_input and not audio_b64:
            raise ValueError("Either text_input or audio_b64 must be provided")

        if text_input and audio_b64:
            raise ValueError("Cannot provide both text_input and audio_b64")

        return data


class VoiceTurnRequest(BaseModel):
    """Enhanced voice turn request validation."""

    messages: List[ChatMessage]
    audio_b64: str
    sample_rate: int  # Common sample rates
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: Optional[str] = None

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if len(v) > 50:
            raise ValueError("Too many messages")
        return v

    @field_validator("audio_b64")
    @classmethod
    def validate_audio_base64(cls, v):
        try:
            import base64

            # Remove potential data URL prefix
            if v.startswith("data:"):
                v = v.split(",")[1]
            audio_data = base64.b64decode(v)

            # Check minimum audio length (at least 1 second of audio at 16kHz)
            if len(audio_data) < 32000:  # 16kHz * 2 bytes * 1 second
                raise ValueError("Audio data too short")

            # Check maximum audio length (at most 5 minutes of audio at 16kHz)
            if len(audio_data) > 9600000:  # 16kHz * 2 bytes * 5 minutes * 60 seconds
                raise ValueError("Audio data too long")

        except Exception as e:
            if "too short" in str(e) or "too long" in str(e):
                raise
            raise ValueError("Invalid base64 audio data")
        return v

    @field_validator("sample_rate")
    @classmethod
    def validate_sample_rate(cls, v):
        if v < 8000 or v > 48000:
            raise ValueError("Sample rate must be between 8000 and 48000")
        return v

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v):
        if v is not None and (len(v) < 1 or len(v) > 100):
            raise ValueError("Session ID must be between 1 and 100 characters")
        return v


class IngestRequest(BaseModel):
    """Enhanced ingestion request validation."""

    path_or_url: str
    from_web: bool = False
    recursive: bool = True
    tags: Optional[List[str]] = None
    use_examples_dir: bool = False

    @field_validator("path_or_url")
    @classmethod
    def validate_path_or_url(cls, v, info):
        from_web = info.data.get("from_web", False) if info.data else False

        if from_web:
            # Validate URL
            url_pattern = re.compile(
                r"^https?://"  # http:// or https://
                r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z]{2,6}\.?|"  # domain...
                r"localhost|"  # localhost...
                r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
                r"(?::\d+)?"  # optional port
                r"(?:/?|[/?]\S+)$",
                re.IGNORECASE,
            )
            if not url_pattern.match(v):
                raise ValueError("Invalid URL format")
        else:
            # Validate local path (basic check for path traversal)
            if ".." in v or v.startswith("/"):
                raise ValueError("Invalid path format")

        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            if len(v) > 20:
                raise ValueError("Too many tags")
            for tag in v:
                if not isinstance(tag, str) or len(tag) > 50:
                    raise ValueError("Each tag must be a string with max 50 characters")
                # Check for potentially dangerous characters
                if re.search(r'[<>"\'/\\]', tag):
                    raise ValueError("Tags contain invalid characters")
        return v


class ToolCallRequest(BaseModel):
    """Enhanced tool call request validation."""

    tool_name: str
    arguments: Dict[str, Any]

    @field_validator("tool_name")
    @classmethod
    def validate_tool_name(cls, v):
        if len(v) < 1 or len(v) > 100:
            raise ValueError("Tool name must be between 1 and 100 characters")
        # Check for potentially dangerous characters
        if re.search(r'[<>"\'/\\;|&]', v):
            raise ValueError("Tool name contains invalid characters")
        return v

    @field_validator("arguments")
    @classmethod
    def validate_arguments(cls, v):
        if len(v) < 1:
            raise ValueError("At least one argument is required")
        # Check for potentially dangerous values
        for key, value in v.items():
            if isinstance(value, str) and re.search(r'[<>"\'/\\;|&]', value):
                raise ValueError(f"Argument '{key}' contains invalid characters")
        return v


class SessionRequest(BaseModel):
    """Enhanced session request validation."""

    session_id: Optional[str] = None
    title: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if v is not None:
            if len(v) < 1 or len(v) > 200:
                raise ValueError("Title must be between 1 and 200 characters")
            # Check for potentially dangerous characters
            if re.search(r'[<>"\'/\\;|&]', v):
                raise ValueError("Title contains invalid characters")
        return v


class SearchRequest(BaseModel):
    """Enhanced search request validation."""

    query: str
    limit: int = 10
    collection: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("query")
    @classmethod
    def validate_query(cls, v):
        if len(v) < 1 or len(v) > 500:
            raise ValueError("Query must be between 1 and 500 characters")
        # Check for potentially dangerous characters
        if re.search(r'[<>"\'/\\;|&]', v):
            raise ValueError("Query contains invalid characters")
        return v

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v):
        if v < 1 or v > 100:
            raise ValueError("Limit must be between 1 and 100")
        return v

    @field_validator("collection")
    @classmethod
    def validate_collection(cls, v):
        if v is not None and (len(v) < 1 or len(v) > 100):
            raise ValueError("Collection must be between 1 and 100 characters")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            if len(v) > 10:
                raise ValueError("Too many tags")
            for tag in v:
                if not isinstance(tag, str) or len(tag) > 50:
                    raise ValueError("Each tag must be a string with max 50 characters")
                # Check for potentially dangerous characters
                if re.search(r'[<>"\'/\\]', tag):
                    raise ValueError("Tags contain invalid characters")
        return v
