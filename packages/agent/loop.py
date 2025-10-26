"""
Agent loop with strict single-tool stepper pattern.

CRITICAL: The agent must emit AT MOST ONE tool call per assistant message and STOP.
It continues only after a new completion request that includes the tool result.
"""

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator, Dict, Any

from packages.llm import OllamaClient, ChatMessage, ToolCall
from packages.agent.registry import MCPRegistry


class ToolCallViolationError(Exception):
    """Raised when agent violates single-tool rule."""


logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPTS: dict[str, str] = {
    "it": """Sei YouWorker.AI, l'assistente professionale di YouCo.
Parli esclusivamente in italiano, con un tono chiaro, concreto e orientato all'azione.

Contesto e aspettative:
- Comprendi l'intera conversazione e, quando opportuno, ricordane brevemente i punti chiave per dare continuità.
- Se l'utente fa riferimento a documenti, codice o esiti di strumenti citati in precedenza, integra tali elementi nella risposta.
- Fornisci motivazioni, ipotesi e raccomandazioni operative solo quando sono supportate dai dati a disposizione.

Politica d'uso degli strumenti (single-tool discipline):
1. In ogni turno dell'assistente puoi emettere al massimo UNA tool call.
2. Se servono più passaggi, descrivi quello che farai, richiama esattamente UN solo tool, attendi il risultato nel messaggio successivo e solo allora valuta se richiamare un altro tool.
3. Non inventare strumenti: menziona o usa esclusivamente quelli presenti nello schema fornito. Se non vi sono strumenti disponibili, dichiaralo con trasparenza.

Linee guida di stile:
- Mantieni le risposte sintetiche ma complete; usa elenco puntato o tabelle solo se aiutano la comprensione.
- Se citi codice o comandi, utilizza blocchi formattati e specifica sempre il contesto (file, directory o prerequisiti).
- In caso di limiti, incertezze o necessità di ulteriori dati dall'utente, esplicitali in modo proattivo e suggerisci i prossimi passi più efficaci.
""",
    "en": """You are YouWorker.AI, the professional assistant for YouCo.
Respond exclusively in English with a clear, actionable tone.

Context & expectations:
- Track the entire conversation and reference prior context when it helps continuity.
- When the user mentions documents, code, or previous tool results, integrate those details into your answer.
- Provide reasoning, hypotheses, and concrete recommendations only when they are backed by available information.

Tool usage policy (single-tool discipline):
1. In each assistant turn you may call at most ONE tool.
2. If multiple steps are required, explain your next action, trigger exactly ONE tool, wait for its result in the following message, and only then consider another tool call.
3. Do not invent tools: mention or use only those defined in the provided schema. If no tools are available, state it transparently.

Style guidelines:
- Keep responses succinct yet complete; use bullet points or tables only when they genuinely aid comprehension.
- When sharing code or commands, use formatted blocks and always specify the relevant context (file, directory, prerequisites).
- When limits or uncertainties exist, highlight them proactively and suggest the most effective next steps.
""",
}

DEFAULT_AGENT_LANGUAGE = "it"


def resolve_system_prompt(language: str | None) -> str:
    """Return the system prompt for the requested language, falling back gracefully."""
    if not language:
        return AGENT_SYSTEM_PROMPTS[DEFAULT_AGENT_LANGUAGE]
    normalized = language.strip().lower()
    return AGENT_SYSTEM_PROMPTS.get(normalized, AGENT_SYSTEM_PROMPTS[DEFAULT_AGENT_LANGUAGE])


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
        default_language: str = DEFAULT_AGENT_LANGUAGE,
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
        self.default_language = self._normalize_language(default_language)

    @staticmethod
    def _normalize_language(language: str | None) -> str:
        if not language:
            return DEFAULT_AGENT_LANGUAGE
        candidate = language.strip().lower()
        return candidate or DEFAULT_AGENT_LANGUAGE

    async def run_turn_stepper(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        language: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[dict]:
        """
        Execute a single agent turn with strict single-tool stepper.

        NOW YIELDS STREAMING CHUNKS in real-time as they arrive from Ollama.

        Args:
            messages: Conversation history
            enable_tools: Whether to enable tool calling
            language: Preferred assistant language for this turn

        Yields:
            Streaming events:
            - {"type": "chunk", "content": str} for each content chunk from LLM
            - {"type": "complete", "result": AgentTurnResult} when turn is complete
        """
        selected_language = self._normalize_language(language or self.default_language)
        system_prompt = resolve_system_prompt(selected_language)

        # Ensure system prompt is present (override to guarantee consistency)
        if messages and messages[0].role == "system":
            messages[0] = ChatMessage(role="system", content=system_prompt)
        else:
            messages.insert(0, ChatMessage(role="system", content=system_prompt))

        # Get tools from registry
        tools = self.registry.to_llm_tools() if enable_tools else None

        # Accumulators
        thinking_buffer = ""
        content_buffer = ""
        tool_calls_buffer: list[ToolCall] = []

        logger.info(
            f"Starting agent turn with {len(messages)} messages, tools_enabled={enable_tools}"
        )

        # Stream chat completion
        async for chunk in self.ollama_client.chat_stream(
            messages=messages,
            model=model or self.model,
            tools=tools,
            think="high",
        ):
            # Accumulate thinking (SILENT - never stream to client)
            if chunk.thinking:
                thinking_buffer += chunk.thinking

            # Stream AND accumulate content
            if chunk.content:
                content_buffer += chunk.content
                # YIELD IMMEDIATELY for real streaming
                yield {"type": "chunk", "content": chunk.content}

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
                raise ToolCallViolationError(
                    f"Agent emitted {len(tool_calls_buffer)} tool calls; only one allowed per turn"
                )

            # Keep only the first tool call
            selected_tool_call = tool_calls_buffer[0]

            yield {
                "type": "complete",
                "result": AgentTurnResult(
                    thinking=thinking_buffer,
                    content=content_buffer,
                    tool_calls=[selected_tool_call],
                    requires_followup=True,
                ),
            }
            return

        # No tool calls - return final content
        logger.info("Agent completed turn without tool calls")
        yield {
            "type": "complete",
            "result": AgentTurnResult(
                thinking=thinking_buffer,
                content=content_buffer,
                tool_calls=None,
                requires_followup=False,
            ),
        }

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

        except (ConnectionError, TimeoutError, OSError) as e:
            error_msg = f"Network error in tool execution: {str(e)}"
            logger.error(error_msg)
            return json.dumps({"error": error_msg, "type": "network_error"})

        except ValueError as e:
            error_msg = f"Invalid arguments for tool: {str(e)}"
            logger.error(error_msg)
            return json.dumps({"error": error_msg, "type": "invalid_args"})

        except Exception as e:
            error_msg = f"Unexpected error in tool execution: {str(e)}"
            logger.error(error_msg)
            return json.dumps({"error": error_msg, "type": "unexpected_error"})

    async def run_until_completion(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        max_iterations: int = 10,
        language: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Run agent until completion, handling tool calls automatically.

        This is the full agentic loop that:
        1. Runs turn (NOW WITH REAL STREAMING)
        2. If tool call, executes it and appends result
        3. Runs another turn with the tool result
        4. Repeats until no more tool calls
        5. Streams content chunks in real-time as they arrive

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

            # Run one turn and process streaming events
            turn_result = None
            final_content = ""

            async for event in self.run_turn_stepper(
                conversation,
                enable_tools=enable_tools,
                language=language,
                model=model,
            ):
                if event["type"] == "chunk":
                    # Stream content chunk immediately to client
                    yield {"event": "token", "data": {"text": event["content"]}}
                    final_content += event["content"]

                elif event["type"] == "complete":
                    turn_result = event["result"]

            # Log thinking (but don't stream it)
            if turn_result and turn_result.thinking:
                logger.debug(f"Thinking: {turn_result.thinking[:200]}...")

            # Check if tool call is required
            if turn_result and turn_result.requires_followup and turn_result.tool_calls:
                tool_call = turn_result.tool_calls[0]

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
                        content=turn_result.content,
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

                # Include a small result preview to allow persistence without huge payloads
                preview = tool_result or ""
                if isinstance(preview, str) and len(preview) > 2000:
                    preview = preview[:2000]

                yield {
                    "event": "tool",
                    "data": {
                        "tool": tool_call.name,
                        "status": "end",
                        "ts": finished_at.isoformat(),
                        "latency_ms": duration_ms,
                        "result_preview": preview,
                    },
                }

                # Check for multiple tool calls violation
                if len(turn_result.tool_calls) > 1:
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

                # Content was already streamed in real-time, just send done event
                yield {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "iterations": iterations,
                            "tool_calls": tool_calls_executed,
                            "status": "success",
                        },
                        "final_text": final_content,
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
