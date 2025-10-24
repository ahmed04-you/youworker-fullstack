"""
Enhanced validation schemas for API endpoints.
"""

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, root_validator


class BaseMessage(BaseModel):
    """Base message model with enhanced validation."""

    role: str
    content: str = Field(..., min_length=1, max_length=10000)

    @validator("content")
    def validate_content(cls, v):
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
    text_input: Optional[str] = Field(None, max_length=5000)
    audio_b64: Optional[str] = None
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: Optional[str] = Field(None, min_length=1, max_length=100)
    stream: bool = False

    @validator("audio_b64")
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

    @root_validator
    def validate_input_type(cls, values):
        text_input = values.get("text_input")
        audio_b64 = values.get("audio_b64")

        if not text_input and not audio_b64:
            raise ValueError("Either text_input or audio_b64 must be provided")

        if text_input and audio_b64:
            raise ValueError("Cannot provide both text_input and audio_b64")

        return values


class VoiceTurnRequest(BaseModel):
    """Enhanced voice turn request validation."""

    messages: List[ChatMessage]
    audio_b64: str
    sample_rate: int = Field(..., ge=8000, le=48000)  # Common sample rates
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: Optional[str] = Field(None, min_length=1, max_length=100)

    @validator("audio_b64")
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


class IngestRequest(BaseModel):
    """Enhanced ingestion request validation."""

    path_or_url: str
    from_web: bool = False
    recursive: bool = True
    tags: Optional[List[str]] = None
    use_examples_dir: bool = False

    @validator("path_or_url")
    def validate_path_or_url(cls, v):
        if len(v) < 1 or len(v) > 1000:
            raise ValueError("Path or URL must be between 1 and 1000 characters")
        return v

    @validator("tags")
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

    @validator("path_or_url")
    def validate_path_or_url(cls, v, values):
        from_web = values.get("from_web", False)

        if from_web:
            # Validate URL
            import re

            url_pattern = re.compile(
                r"^https?://"  # http:// or https://
                r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain...
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

    @validator("tags")
    def validate_tags(cls, v):
        if v is not None:
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

    @validator("tool_name")
    def validate_tool_name(cls, v):
        # Check for potentially dangerous characters
        if re.search(r'[<>"\'/\\;|&]', v):
            raise ValueError("Tool name contains invalid characters")
        return v

    @validator("arguments")
    def validate_arguments(cls, v):
        # Check for potentially dangerous values
        for key, value in v.items():
            if isinstance(value, str) and re.search(r'[<>"\'/\\;|&]', value):
                raise ValueError(f"Argument '{key}' contains invalid characters")
        return v


class SessionRequest(BaseModel):
    """Enhanced session request validation."""

    session_id: Optional[str] = Field(None, min_length=1, max_length=100)
    title: Optional[str] = Field(None, min_length=1, max_length=200)

    @validator("title")
    def validate_title(cls, v):
        if v is not None:
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

    @validator("query")
    def validate_query(cls, v):
        # Check for potentially dangerous characters
        if re.search(r'[<>"\'/\\;|&]', v):
            raise ValueError("Query contains invalid characters")
        return v

    @validator("tags")
    def validate_tags(cls, v):
        if v is not None:
            for tag in v:
                if not isinstance(tag, str) or len(tag) > 50:
                    raise ValueError("Each tag must be a string with max 50 characters")
                # Check for potentially dangerous characters
                if re.search(r'[<>"\'/\\]', tag):
                    raise ValueError("Tags contain invalid characters")
        return v
