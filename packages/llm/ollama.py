"""Ollama client with streaming, thinking traces, and tool calling support."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx

from packages.common import get_correlation_id
from packages.common.retry import async_retry

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    """Represents a function/tool call from the LLM."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ChatMessage:
    """Chat message with role, content, and optional tool calls."""

    role: str  # "system", "user", "assistant", "tool"
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None  # For tool response messages
    name: str | None = None  # Tool name for tool messages

    def to_dict(self) -> dict[str, Any]:
        """Convert to Ollama API format."""
        msg = {"role": self.role, "content": self.content}

        if self.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": tc.arguments},
                }
                for tc in self.tool_calls
            ]

        if self.role == "tool" and self.name:
            msg["name"] = self.name
            if self.tool_call_id:
                msg["tool_call_id"] = self.tool_call_id

        return msg


@dataclass
class StreamChunk:
    """A single chunk from the streaming response."""

    thinking: str = ""
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    done: bool = False


class OllamaClient:
    """
    Client for Ollama API with streaming support.

    Handles:
    - Streaming chat completions with thinking traces
    - Tool/function calling
    - Accumulation of streamed tool calls
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        timeout: float = 300.0,
        auto_pull: bool = True,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
        self.auto_pull = auto_pull
        self._ensured_models: set[str] = set()
        self._ensure_lock = asyncio.Lock()

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: str = "gpt-oss:20b",
        tools: list[dict[str, Any]] | None = None,
        think: str = "low",
        temperature: float = 0.7,
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream a chat completion with optional tool calling and thinking.

        Args:
            messages: Conversation history
            model: Ollama model name
            tools: List of tool schemas in OpenAI format
            think: Thinking level ("low", "medium", "high", or None)
            temperature: Sampling temperature

        Yields:
            StreamChunk objects with thinking, content, and/or tool_calls
        """
        options = {
            "temperature": temperature,
            "num_ctx": 32768,
        }

        payload = {
            "model": model,
            "messages": [msg.to_dict() for msg in messages],
            "stream": True,
            "options": options,
        }

        if think:
            payload["think"] = think

        if tools:
            payload["tools"] = tools

        logger.debug("Sending chat request to Ollama: model=%s, messages=%s", model, len(messages))

        # Accumulators for tool calls (they come in chunks)
        tool_calls_accumulator: dict[int, dict[str, Any]] = {}

        try:
            await self._ensure_model_available(model)

            # Add correlation ID header for distributed tracing
            headers = {
                "Content-Type": "application/json",
                "X-Correlation-ID": get_correlation_id(),
            }

            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
                headers=headers,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue

                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        logger.warning(
                            "Failed to parse JSON from Ollama stream",
                            extra={"line": line[:200], "model": model}
                        )
                        continue

                    chunk = self._parse_chunk(data, tool_calls_accumulator)

                    if chunk.done:
                        # Finalize tool calls
                        if tool_calls_accumulator:
                            chunk.tool_calls = self._finalize_tool_calls(tool_calls_accumulator)

                    yield chunk

        except httpx.HTTPStatusError as e:
            # Avoid accessing e.response.text on a streaming response (raises
            # "Attempted to access streaming response content, without having called read()").
            body_snippet = ""
            try:
                content = await e.response.aread()
                body_snippet = content.decode("utf-8", errors="ignore")[:500]
            except Exception:
                # Fall back to reason phrase if body is unavailable
                body_snippet = getattr(e.response, "reason_phrase", "") or str(e)
            logger.error(
                "Ollama API error",
                extra={
                    "status_code": e.response.status_code,
                    "response_body": body_snippet,
                    "model": model,
                    "error_type": type(e).__name__
                }
            )
            raise
        except Exception as e:
            logger.error(
                "Unexpected error during chat stream",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "model": model
                }
            )
            raise

    async def _ensure_model_available(self, model: str) -> None:
        """Ensure the specified model is available locally, optionally pulling it."""
        if not model:
            return

        if model in self._ensured_models:
            return

        async with self._ensure_lock:
            if model in self._ensured_models:
                return

            exists = await self._model_exists(model)
            if exists:
                self._ensured_models.add(model)
                return

            if not self.auto_pull:
                raise RuntimeError(
                    f"Ollama model '{model}' is not installed. "
                    "Install it with `ollama pull {model}` or enable auto-pull."
                )

            logger.info(
                "Pulling Ollama model (this may take some time)",
                extra={"model": model, "base_url": self.base_url}
            )
            try:
                pull_resp = await self.client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": model, "stream": False},
                    timeout=None,
                )
                pull_resp.raise_for_status()
            except httpx.HTTPError as exc:
                logger.error(
                    "Failed to pull Ollama model",
                    extra={
                        "model": model,
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                        "base_url": self.base_url
                    }
                )
                raise

            logger.info(
                "Model downloaded successfully",
                extra={"model": model}
            )
            self._ensured_models.add(model)

    @async_retry(max_attempts=3, min_wait=1.0, max_wait=5.0)
    async def _model_exists(self, model: str) -> bool:
        if not model:
            return True

        try:
            response = await self.client.post(
                f"{self.base_url}/api/show",
                json={"name": model},
            )
        except httpx.HTTPError as exc:
            logger.error(
                "Failed to query Ollama model",
                extra={
                    "model": model,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                    "base_url": self.base_url
                }
            )
            raise

        if response.status_code == 200:
            return True
        if response.status_code == 404:
            return False

        response.raise_for_status()
        return False

    async def model_exists(self, model: str) -> bool:
        """Public helper to check if a model is already available."""
        try:
            return await self._model_exists(model)
        except httpx.HTTPError:
            return False

    def _parse_chunk(
        self, data: dict[str, Any], tool_calls_accumulator: dict[int, dict[str, Any]]
    ) -> StreamChunk:
        """Parse a single streaming chunk from Ollama."""
        chunk = StreamChunk()

        # Check if done
        chunk.done = data.get("done", False)

        message = data.get("message", {})

        # Extract thinking (if present)
        thinking = message.get("thinking")
        if thinking:
            chunk.thinking = thinking

        # Extract content
        content = message.get("content", "")
        if content:
            chunk.content = content

        # Extract tool calls (they stream incrementally)
        tool_calls = message.get("tool_calls", [])
        for tc in tool_calls:
            idx = tc.get("index", 0)

            if idx not in tool_calls_accumulator:
                tool_calls_accumulator[idx] = {
                    "id": tc.get("id", ""),
                    "name": "",
                    "arguments": "",
                }

            # Accumulate function name
            if "function" in tc:
                func = tc["function"]
                if "name" in func:
                    tool_calls_accumulator[idx]["name"] += func.get("name", "")
                if "arguments" in func:
                    args = func.get("arguments", "")
                    # Handle both string (incremental) and dict (complete) formats
                    if isinstance(args, dict):
                        tool_calls_accumulator[idx]["arguments"] = json.dumps(args)
                    else:
                        tool_calls_accumulator[idx]["arguments"] += args

        return chunk

    def _finalize_tool_calls(
        self, tool_calls_accumulator: dict[int, dict[str, Any]]
    ) -> list[ToolCall]:
        """Convert accumulated tool call chunks into ToolCall objects."""
        tool_calls = []

        for idx in sorted(tool_calls_accumulator.keys()):
            tc_data = tool_calls_accumulator[idx]

            # Parse arguments JSON
            try:
                args = json.loads(tc_data["arguments"]) if tc_data["arguments"] else {}
            except json.JSONDecodeError:
                logger.warning(
                    "Failed to parse tool arguments",
                    extra={
                        "arguments": tc_data["arguments"][:200],
                        "tool_name": tc_data.get("name"),
                        "tool_id": tc_data.get("id")
                    }
                )
                args = {}

            tool_calls.append(
                ToolCall(
                    id=tc_data["id"] or f"call_{idx}",
                    name=tc_data["name"],
                    arguments=args,
                )
            )

        return tool_calls

    async def embed(self, text: str, model: str = "embeddinggemma:300m") -> list[float]:
        """
        Generate embeddings for text.

        Args:
            text: Text to embed
            model: Embedding model name

        Returns:
            Embedding vector
        """
        payload = {"model": model, "prompt": text}

        try:
            await self._ensure_model_available(model)
            response = await self.client.post(f"{self.base_url}/api/embeddings", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except Exception as e:
            logger.error(
                "Failed to generate embedding",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "model": model,
                    "text_length": len(text)
                }
            )
            raise
