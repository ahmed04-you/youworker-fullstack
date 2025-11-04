"""
Agent loop with strict single-tool stepper pattern.

CRITICAL: The agent must emit AT MOST ONE tool call per assistant message and STOP.
It continues only after a new completion request that includes the tool result.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator, Any

from packages.llm import OllamaClient, ChatMessage, ToolCall
from packages.agent.registry import MCPRegistry
from packages.common import get_settings, Settings


class ToolCallViolationError(Exception):
    """Raised when agent violates single-tool rule."""


logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPT = """Sei YouWorker, l'assistente AI professionale di YouCo srl. Rispondi SEMPRE in italiano con tono chiaro, operativo e rispettoso.

## Missione
- Comprendi a fondo l'obiettivo dell'utente, pianifica i passaggi e completa il lavoro con accuratezza.
- Usa strumenti MCP per ottenere dati reali. Se le informazioni non sono sufficienti, dichiaralo apertamente e suggerisci come procedere.
- Rispondi sempre in italiano salvo quando l'utente richiede esplicitamente un'altra lingua; in quel caso adegua la risposta segnalando il cambio.

## Gerarchia delle fonti
1. **Conoscenza locale (`local_rag_search`)**: Prima di considerare qualunque fonte esterna, interroga il database vettoriale locale. Puoi richiamare `local_rag_search` più volte con parametri diversi (es. `top_k`, `tags`) per coprire la richiesta. Riporta le citazioni usando i numeri restituiti (es. [1], [2]) e descrivi sinteticamente cosa proviene da ciascuna fonte.
3. **Altri strumenti**: Consulta e combina gli altri tool MCP presenti nello schema (ingestion, conversioni, ecc.) solo quando servono davvero per completare il compito.

## Gestione del tempo
- Prima di avviare attività che dipendono dal contesto temporale (news, scadenze, valutazioni di attualità, comparazioni di date) chiama `datetime.now` con `tz="Europe/Rome"` a meno che l'utente non specifichi un fuso diverso. Riutilizza questo dato per l'intero ragionamento; se il flusso dura a lungo, aggiorna il timestamp quando cambiano le condizioni.

## Disciplina nell’uso degli strumenti
- **Regola ferrea**: in ogni turno dell’assistente puoi invocare **al massimo UNO** strumento.
- Prima di chiamare un tool, spiega in breve cosa stai per fare e con quali parametri chiave.
- Dopo la chiamata, attendi il risultato, analizzalo criticamente e decidi il passo seguente. Se serve un’altra chiamata, effettuala in un turno successivo.
- Non citare strumenti inesistenti; se lo schema non offre ciò che serve, dichiaralo e proponi alternative realistiche.

## Stile di risposta
- Mantieni le risposte concise ma complete. Usa elenchi o tabelle solo se migliorano la leggibilità.
- Specifica sempre il contesto rilevante per codice, file o percorsi. Quando utilizzi output di strumenti, spiegane il significato prima di trarre conclusioni.
- Riporta le fonti con le citazioni fornite da `local_rag_search`;
- Evidenzia limiti, ipotesi o incertezze e suggerisci i migliori passi successivi.

## Flusso operativo sintetico
1. Analizza la richiesta, chiarisci eventuali ambiguità e imposta il piano.
2. Recupera prima la conoscenza locale con `local_rag_search`.
3. Se serve contesto temporale, chiama `datetime.now` (fuso predefinito: Europe/Rome).
4. Usa al massimo uno strumento per turno, valutando i risultati prima di proseguire.
6. Redigi una risposta finale basata sui dati ottenuti, con citazioni e prossimi passi.

Ricorda: la priorità è fornire risposte affidabili, verificabili e allineate agli interessi dell’utente, mantenendo trasparente ogni decisione presa."""


def resolve_system_prompt() -> str:
    """Return the default system prompt."""
    return AGENT_SYSTEM_PROMPT


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
        max_iterations: int | None = None,
        settings: Settings | None = None,
    ):
        """
        Initialize agent loop.

        Args:
            ollama_client: Ollama LLM client
            registry: MCP tool registry
            model: Model name to use
            max_iterations: Maximum tool call iterations (uses settings if not provided)
            settings: Settings instance (uses default if not provided)
        """
        self.ollama_client = ollama_client
        self.registry = registry
        self.model = model
        self._settings = settings or get_settings()
        self._max_iterations = max_iterations or self._settings.max_agent_iterations

    async def run_turn_stepper(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        model: str | None = None,
        disable_web: bool = False,
    ) -> AsyncIterator[dict]:
        """
        Execute a single agent turn with strict single-tool stepper.

        NOW YIELDS STREAMING CHUNKS in real-time as they arrive from Ollama.

        Args:
            messages: Conversation history
            enable_tools: Whether to enable tool calling
            model: Optional model override
            disable_web: Whether to disable web MCP tools

        Yields:
            Streaming events:
            - {"type": "chunk", "content": str} for each content chunk from LLM
            - {"type": "complete", "result": AgentTurnResult} when turn is complete
        """
        system_prompt = resolve_system_prompt()

        # Ensure system prompt is present (override to guarantee consistency)
        if messages and messages[0].role == "system":
            messages[0] = ChatMessage(role="system", content=system_prompt)
        else:
            messages.insert(0, ChatMessage(role="system", content=system_prompt))

        # Get tools from registry
        if enable_tools:
            all_tools = self.registry.to_llm_tools()
            # Filter out web tools if disabled
            if disable_web:
                tools = [
                    tool for tool in all_tools
                    if not tool.get("function", {}).get("name", "").startswith(("web_", "web."))
                ]
            else:
                tools = all_tools
        else:
            tools = None

        # Accumulators
        thinking_buffer = ""
        content_buffer = ""
        tool_calls_buffer: list[ToolCall] = []

        logger.info(
            "Starting agent turn",
            extra={
                "message_count": len(messages),
                "tools_enabled": enable_tools,
                "model": model or self.model
            }
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
            logger.info(
                "Agent emitted tool calls",
                extra={"tool_call_count": len(tool_calls_buffer)}
            )

            if len(tool_calls_buffer) > 1:
                logger.warning(
                    "Agent emitted multiple tool calls; keeping only first",
                    extra={
                        "tool_call_count": len(tool_calls_buffer),
                        "first_tool": tool_calls_buffer[0].name
                    }
                )
                tool_calls_buffer = tool_calls_buffer[:1]

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
        logger.info(
            "Executing tool",
            extra={
                "tool_name": tool_call.name,
                "tool_args": tool_call.arguments,
                "tool_call_id": tool_call.id
            }
        )

        try:
            result = await self.registry.call_tool(tool_call.name, tool_call.arguments)

            # Convert result to string
            if isinstance(result, dict):
                return json.dumps(result, indent=2)
            else:
                return str(result)

        except (ConnectionError, TimeoutError, OSError) as e:
            error_msg = f"Network error in tool execution: {str(e)}"
            logger.error(
                "Network error in tool execution",
                extra={
                    "tool_name": tool_call.name,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            return json.dumps({"error": error_msg, "type": "network_error"})

        except ValueError as e:
            error_msg = f"Invalid arguments for tool: {str(e)}"
            logger.error(
                "Invalid arguments for tool",
                extra={
                    "tool_name": tool_call.name,
                    "error": str(e),
                    "tool_args": tool_call.arguments
                }
            )
            return json.dumps({"error": error_msg, "type": "invalid_args"})

        except Exception as e:
            error_msg = f"Unexpected error in tool execution: {str(e)}"
            logger.error(
                "Unexpected error in tool execution",
                extra={
                    "tool_name": tool_call.name,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            return json.dumps({"error": error_msg, "type": "unexpected_error"})

    async def run_until_completion(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        max_iterations: int | None = None,
        model: str | None = None,
        disable_web: bool = False,
    ) -> AsyncIterator[dict[str, Any]]:
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
            max_iterations: Max tool iterations to prevent loops (uses instance default if None)
            model: Model override
            disable_web: Whether to disable web MCP tools

        Yields:
            Dict payloads representing SSE events
        """
        # Use provided max_iterations or fall back to instance default
        effective_max_iterations = max_iterations if max_iterations is not None else self._max_iterations

        conversation = list(messages)
        iterations = 0
        tool_calls_executed = 0

        while iterations < effective_max_iterations:
            iterations += 1

            # Run one turn and process streaming events
            turn_result = None
            final_content = ""

            async for event in self.run_turn_stepper(
                conversation,
                enable_tools=enable_tools,
                model=model,
                disable_web=disable_web,
            ):
                if event["type"] == "chunk":
                    # Stream content chunk immediately to client
                    yield {"event": "token", "data": {"text": event["content"]}}
                    final_content += event["content"]

                elif event["type"] == "complete":
                    turn_result = event["result"]

            # Log thinking (but don't stream it)
            if turn_result and turn_result.thinking:
                logger.debug(
                    "Thinking output",
                    extra={"thinking_preview": turn_result.thinking[:200]}
                )

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

                # Check if tool execution had an error
                tool_status = "end"
                try:
                    if isinstance(tool_result, str):
                        result_json = json.loads(tool_result)
                        if isinstance(result_json, dict) and "error" in result_json:
                            tool_status = "error"
                except (json.JSONDecodeError, ValueError):
                    # Not JSON or malformed, treat as success
                    pass

                logger.info(
                    "Tool completed, continuing",
                    extra={
                        "tool_name": tool_call.name,
                        "next_iteration": iterations + 1,
                        "duration_ms": duration_ms,
                        "status": tool_status
                    }
                )
                tool_calls_executed += 1

                # Include a small result preview to allow persistence without huge payloads
                preview = tool_result or ""
                if isinstance(preview, str) and len(preview) > 2000:
                    preview = preview[:2000]

                yield {
                    "event": "tool",
                    "data": {
                        "tool": tool_call.name,
                        "status": tool_status,
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
                logger.info(
                    "Agent completed",
                    extra={
                        "iterations": iterations,
                        "tool_calls_executed": tool_calls_executed
                    }
                )

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
            logger.warning(
                "Agent hit max iterations",
                extra={
                    "max_iterations": max_iterations,
                    "tool_calls_executed": tool_calls_executed
                }
            )
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
