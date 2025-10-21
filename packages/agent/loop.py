"""
Agent loop with strict single-tool stepper pattern.

CRITICAL: The agent must emit AT MOST ONE tool call per assistant message and STOP.
It continues only after a new completion request that includes the tool result.
"""
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator, Dict, Any, Iterator

from packages.llm import OllamaClient, ChatMessage, ToolCall
from packages.agent.registry import MCPRegistry

logger = logging.getLogger(__name__)


# System prompt enforcing single-tool discipline
AGENT_SYSTEM_PROMPT = """You are a helpful AI assistant with access to tools.

CRITICAL RULE: Emit at most ONE tool call per assistant message.

If multiple steps are required:
1. Call exactly ONE tool
2. Wait for the tool's result in the next message
3. Then call the next tool if needed

Never emit multiple tool calls in a single response. Always wait for each tool result before proceeding.
"""


@dataclass
class AgentTurnResult:
    """Result of a single agent turn."""

    thinking: str = ""  # Accumulated thinking (not streamed to user)
    content: str = ""  # Final content to stream to user
    tool_calls: list[ToolCall] | None = None  # Tool calls if any (only first will be used)
    requires_followup: bool = False  # True if tool call requires execution + followup


class AgentLoop:
    """
    Agent execution loop with strict single-tool stepper.

    Flow:
    1. Stream chat completion with tools
    2. Accumulate thinking (silent), content, tool_calls
    3. If tool_calls present:
       - Select ONLY the first tool call (enforce single-tool rule)
       - DO NOT stream content to client
       - Execute tool, append result to messages
       - Return requires_followup=True
    4. If no tool_calls:
       - Stream accumulated content to client
       - Return requires_followup=False
    """

    def __init__(
        self,
        ollama_client: OllamaClient,
        registry: MCPRegistry,
        model: str = "gpt-oss:20b",
    ):
        """
        Initialize agent loop.

        Args:
            ollama_client: Ollama LLM client
            registry: MCP tool registry
            model: Model name to use
        """
        self.ollama_client = ollama_client
        self.registry = registry
        self.model = model

    async def run_turn_stepper(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
    ) -> AgentTurnResult:
        """
        Execute a single agent turn with strict single-tool stepper.

        Args:
            messages: Conversation history
            enable_tools: Whether to enable tool calling

        Returns:
            AgentTurnResult with thinking, content, and/or tool_calls
        """
        # Ensure system prompt is present
        if not messages or messages[0].role != "system":
            messages.insert(0, ChatMessage(role="system", content=AGENT_SYSTEM_PROMPT))

        # Get tools from registry
        tools = self.registry.to_llm_tools() if enable_tools else None

        # Accumulators
        thinking_buffer = ""
        content_buffer = ""
        tool_calls_buffer: list[ToolCall] = []

        logger.info(f"Starting agent turn with {len(messages)} messages, tools_enabled={enable_tools}")

        # Stream chat completion
        async for chunk in self.ollama_client.chat_stream(
            messages=messages,
            model=self.model,
            tools=tools,
            think="high",
        ):
            # Accumulate thinking (SILENT - never stream to client)
            if chunk.thinking:
                thinking_buffer += chunk.thinking

            # Accumulate content
            if chunk.content:
                content_buffer += chunk.content

            # Accumulate tool calls
            if chunk.tool_calls:
                tool_calls_buffer.extend(chunk.tool_calls)

            # Check if done
            if chunk.done:
                break

        # SINGLE-TOOL ENFORCEMENT
        if tool_calls_buffer:
            logger.info(f"Agent emitted {len(tool_calls_buffer)} tool call(s)")

            if len(tool_calls_buffer) > 1:
                logger.warning(
                    f"SINGLE-TOOL VIOLATION: Agent emitted {len(tool_calls_buffer)} tool calls. "
                    "Keeping only the first."
                )

            # Keep only the first tool call
            selected_tool_call = tool_calls_buffer[0]

            return AgentTurnResult(
                thinking=thinking_buffer,
                content=content_buffer,  # Don't stream this yet
                tool_calls=[selected_tool_call],
                requires_followup=True,
            )

        # No tool calls - return final content
        logger.info("Agent completed turn without tool calls")
        return AgentTurnResult(
            thinking=thinking_buffer,
            content=content_buffer,
            tool_calls=None,
            requires_followup=False,
        )

    async def execute_tool_call(self, tool_call: ToolCall) -> str:
        """
        Execute a single tool call via the registry.

        Args:
            tool_call: The tool call to execute

        Returns:
            Tool result as string (JSON if structured)
        """
        logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")

        try:
            result = await self.registry.call_tool(tool_call.name, tool_call.arguments)

            # Convert result to string
            if isinstance(result, dict):
                return json.dumps(result, indent=2)
            else:
                return str(result)

        except Exception as e:
            error_msg = f"Tool execution failed: {str(e)}"
            logger.error(error_msg)
            return json.dumps({"error": error_msg})

    async def run_until_completion(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        max_iterations: int = 10,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Run agent until completion, handling tool calls automatically.

        This is the full agentic loop that:
        1. Runs turn
        2. If tool call, executes it and appends result
        3. Runs another turn with the tool result
        4. Repeats until no more tool calls
        5. Streams final content to caller

        Args:
            messages: Initial conversation
            enable_tools: Enable tool calling
            max_iterations: Max tool iterations to prevent loops

        Yields:
            Dict payloads representing SSE events
        """
        conversation = list(messages)
        iterations = 0
        tool_calls_executed = 0

        while iterations < max_iterations:
            iterations += 1

            # Run one turn
            result = await self.run_turn_stepper(conversation, enable_tools=enable_tools)

            # Log thinking (but don't stream it)
            if result.thinking:
                logger.debug(f"Thinking: {result.thinking[:200]}...")

            # Check if tool call is required
            if result.requires_followup and result.tool_calls:
                tool_call = result.tool_calls[0]

                started_at = datetime.now(timezone.utc)
                timer_start = time.perf_counter()
                yield {
                    "event": "tool",
                    "data": {
                        "tool": tool_call.name,
                        "status": "start",
                        "args": tool_call.arguments,
                        "ts": started_at.isoformat(),
                    },
                }

                # Append assistant message with tool call
                conversation.append(
                    ChatMessage(
                        role="assistant",
                        content=result.content,
                        tool_calls=[tool_call],
                    )
                )

                # Execute tool
                tool_result = await self.execute_tool_call(tool_call)
                duration_ms = int((time.perf_counter() - timer_start) * 1000)
                finished_at = datetime.now(timezone.utc)

                # Append tool result message
                conversation.append(
                    ChatMessage(
                        role="tool",
                        content=tool_result,
                        name=tool_call.name,
                        tool_call_id=tool_call.id,
                    )
                )

                logger.info(f"Tool completed, continuing to iteration {iterations + 1}")
                tool_calls_executed += 1

                yield {
                    "event": "tool",
                    "data": {
                        "tool": tool_call.name,
                        "status": "end",
                        "ts": finished_at.isoformat(),
                        "latency_ms": duration_ms,
                    },
                }

                # Check for multiple tool calls violation
                if len(result.tool_calls) > 1:
                    # Add corrective system message
                    conversation.append(
                        ChatMessage(
                            role="system",
                            content=(
                                "REMINDER: You emitted multiple tool calls in one message. "
                                "Emit at most ONE tool call per message."
                            ),
                        )
                    )

                # Continue loop
                continue

            else:
                # No tool calls - final answer reached
                logger.info(f"Agent completed after {iterations} iterations")

                final_text = result.content or ""
                if final_text:
                    for token in self._tokenize_for_streaming(final_text):
                        yield {"event": "token", "data": {"text": token}}

                yield {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "iterations": iterations,
                            "tool_calls": tool_calls_executed,
                            "status": "success",
                        },
                        "final_text": final_text,
                    },
                }

                break

        if iterations >= max_iterations:
            logger.warning(f"Agent hit max iterations ({max_iterations})")
            warning_text = f"Agent hit max iterations ({max_iterations})"
            yield {"event": "log", "data": {"level": "warn", "msg": warning_text}}
            yield {
                "event": "done",
                "data": {
                    "metadata": {
                        "iterations": iterations,
                        "tool_calls": tool_calls_executed,
                        "status": "max_iterations",
                    },
                    "final_text": "",
                },
            }

    @staticmethod
    def _tokenize_for_streaming(text: str) -> Iterator[str]:
        """
        Split text into display-friendly tokens while preserving whitespace.

        We use Regex to keep trailing whitespace attached to tokens so that the
        frontend renders spacing correctly.
        """
        for match in re.finditer(r"\S+\s*", text):
            yield match.group(0)
