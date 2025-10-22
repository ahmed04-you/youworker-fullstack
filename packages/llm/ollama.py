"""
Ollama client with streaming, thinking traces, and tool calling support.
"""
import json
import logging
from typing import AsyncIterator, Any
from dataclasses import dataclass, field

import httpx

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

    def __init__(self, base_url: str = "http://localhost:11434", timeout: float = 300.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

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
            "num_ctx": 16384,
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

        logger.debug(f"Sending chat request to Ollama: model={model}, messages={len(messages)}")

        # Accumulators for tool calls (they come in chunks)
        tool_calls_accumulator: dict[int, dict[str, Any]] = {}

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue

                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse JSON: {line}")
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
            logger.error("Ollama API error: %s - %s", e.response.status_code, body_snippet)
            raise
        except Exception as e:
            logger.error(f"Unexpected error during chat stream: {e}")
            raise

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
                logger.warning(f"Failed to parse tool arguments: {tc_data['arguments']}")
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
            response = await self.client.post(f"{self.base_url}/api/embeddings", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise
