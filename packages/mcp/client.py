"""
MCP (Model Context Protocol) client for dynamic tool discovery and invocation.

This implementation uses JSON-RPC 2.0 over WebSocket with a minimal
`initialize` handshake and the `tools/list` and `tools/call` methods.
"""
import asyncio
import json
import logging
import random
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse, urlunparse

from tenacity import retry, stop_after_attempt, wait_exponential
import websockets
from websockets.protocol import State

logger = logging.getLogger(__name__)


class MCPError(Exception):
    """Base class for MCP client errors."""


class MCPTransportError(MCPError):
    """Raised for transport-level issues (connectivity, timeouts)."""


class MCPRpcError(MCPError):
    """Raised when the MCP server returns a JSON-RPC error."""

    def __init__(self, code: int | None, message: str, data: Any | None = None):
        self.code = code
        self.message = message
        self.data = data
        detail = f"RPC error {code}: {message}"
        if data is not None:
            detail = f"{detail} | data={data}"
        super().__init__(detail)


@dataclass
class MCPTool:
    """Represents a tool from an MCP server."""

    name: str
    description: str
    input_schema: dict[str, Any]
    server_id: str
    server_url: str
    tags: list[str] | None = None

    def to_llm_schema(self) -> dict[str, Any]:
        """Convert to OpenAI/Ollama tool schema format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema,
            },
        }


class MCPClient:
    """
    Client for communicating with MCP servers via JSON-RPC over WebSocket.

    Handles:
    - initialize handshake
    - tools/list
    - tools/call
    """

    def __init__(self, server_url: str, server_id: str, timeout: float = 30.0):
        self.server_id = server_id
        self.timeout = timeout

        # Normalize to WebSocket URL, append `/mcp` if no path given
        parsed = urlparse(server_url.rstrip("/"))
        scheme = parsed.scheme
        if scheme in ("http", ""):
            ws_scheme = "ws"
        elif scheme == "https":
            ws_scheme = "wss"
        elif scheme in ("ws", "wss"):
            ws_scheme = scheme
        else:
            ws_scheme = "ws"

        path = parsed.path or ""
        if not path or path == "/":
            path = "/mcp"
        # If a user already provided a non-empty path, respect it

        self.ws_url = urlunparse((
            ws_scheme,
            parsed.netloc,
            path,
            "",
            "",
            "",
        ))

        self._healthy = True
        self._ws: Any | None = None
        self._id_counter = 0
        self._send_lock = asyncio.Lock()
        self._initialized = False
        self._last_ws_activity: float = 0.0
        self._heartbeat_interval: float = 30.0
        self._pending: dict[int, asyncio.Future] = {}
        self._recv_task: asyncio.Task | None = None
        self._init_lock = asyncio.Lock()

    async def _connect(self) -> None:
        # Already initialized
        if self._ws is not None and not self._is_ws_closed(self._ws) and self._initialized:
            return
        # Socket exists but not initialized yet
        if self._ws is not None and not self._is_ws_closed(self._ws) and not self._initialized:
            async with self._init_lock:
                if not self._initialized:
                    await self._initialize()
            return
        logger.info(f"Connecting to MCP server {self.server_id} at {self.ws_url}")
        self._ws = await websockets.connect(self.ws_url, open_timeout=self.timeout)  # type: ignore
        async with self._init_lock:
            if not self._initialized:
                await self._initialize()
        self._last_ws_activity = time.time()
        if self._recv_task is None or self._recv_task.done():
            self._recv_task = asyncio.create_task(self._recv_loop())

    async def _initialize(self) -> None:
        if self._initialized:
            return
        assert self._ws is not None
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-10-01",
                "clientInfo": {"name": "youworker-agent", "version": "0.1.0"},
                "capabilities": {"tools": {"list": True, "call": True}},
            },
        }
        async with self._send_lock:
            await self._ws.send(json.dumps(payload))
            raw = await asyncio.wait_for(self._ws.recv(), timeout=self.timeout)
        resp = json.loads(raw)
        if "error" in resp:
            raise RuntimeError(f"MCP initialize failed: {resp['error']}")
        self._initialized = True
        
        # record activity for heartbeat
        self._last_ws_activity = time.time()

    def _next_id(self) -> int:
        self._id_counter += 1
        return self._id_counter

    async def close(self):
        if self._recv_task and not self._recv_task.done():
            self._recv_task.cancel()
            try:
                await self._recv_task
            except (asyncio.CancelledError, Exception):
                pass
        self._recv_task = None

        for fut in list(self._pending.values()):
            if not fut.done():
                fut.set_exception(MCPTransportError("Client closed"))
        self._pending.clear()

        if self._ws is not None and not self._is_ws_closed(self._ws):
            await self._ws.close()
        self._ws = None
        self._initialized = False

    @property
    def is_healthy(self) -> bool:
        return self._healthy

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10), reraise=True)
    async def list_tools(self) -> list[MCPTool]:
        """Discover tools from the MCP server via WebSocket."""
        try:
            result = await self._send_rpc("tools/list", {})
            tools_data = result.get("tools", [])
            tools = self._parse_tools(tools_data)
            self._healthy = True
            logger.info(f"Discovered {len(tools)} tools from {self.server_id}")
            return tools
        except Exception as e:
            logger.error(f"Failed to list tools from {self.server_id}: {e}")
            self._healthy = False
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10), reraise=True)
    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Execute a tool on the MCP server via WebSocket."""
        # Strip server prefix if present
        if tool_name.startswith(f"{self.server_id}."):
            tool_name = tool_name[len(self.server_id) + 1 :]

        try:
            result = await self._send_rpc(
                "tools/call", {"name": tool_name, "arguments": arguments}
            )
            self._healthy = True
            return self._parse_result(result)
        except Exception as e:
            logger.error(f"Failed to call tool {tool_name} on {self.server_id}: {e}")
            self._healthy = False
            raise

    async def _send_rpc(
        self,
        method: str,
        params: dict[str, Any],
        *,
        allow_heartbeat: bool = True,
    ) -> dict[str, Any]:
        """Send JSON-RPC over WebSocket, handling reconnects and heartbeats."""
        await self._connect()
        attempts = 0
        last_exc: Exception | None = None

        while attempts < 2:
            attempts += 1
            req_id: int | None = None
            try:
                if allow_heartbeat and method != "ping":
                    await self._maybe_heartbeat()

                assert self._ws is not None
                req_id = self._next_id()
                request = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
                loop = asyncio.get_running_loop()
                fut: asyncio.Future = loop.create_future()
                self._pending[req_id] = fut

                async with self._send_lock:
                    await self._ws.send(json.dumps(request))
                    self._last_ws_activity = time.time()

                try:
                    result: dict[str, Any] = await asyncio.wait_for(fut, timeout=self.timeout)
                    self._pending.pop(req_id, None)
                    self._healthy = True
                    return result
                except MCPRpcError as rpc_err:
                    raise rpc_err
                except Exception as exc:
                    raise MCPTransportError("RPC response wait failed") from exc

            except MCPRpcError:
                if req_id is not None:
                    self._pending.pop(req_id, None)
                raise
            except MCPTransportError as exc:
                if req_id is not None:
                    self._pending.pop(req_id, None)
                last_exc = exc
                self._healthy = False
                try:
                    await self._reconnect()
                except Exception as reconnect_exc:
                    last_exc = reconnect_exc
                    break
            except Exception as exc:
                if req_id is not None:
                    self._pending.pop(req_id, None)
                last_exc = exc
                self._healthy = False
                try:
                    await self._reconnect()
                except Exception as reconnect_exc:
                    last_exc = reconnect_exc
                    break

        raise MCPTransportError("RPC failed after reconnect attempts") from last_exc

    async def _reconnect(self) -> None:
        try:
            if self._ws is not None and not self._is_ws_closed(self._ws):
                await self._ws.close()
        finally:
            self._ws = None
            self._initialized = False
            # Fail all pending futures
            for fut in list(self._pending.values()):
                if not fut.done():
                    fut.set_exception(MCPTransportError("WebSocket reconnect"))
            self._pending.clear()
            if self._recv_task and not self._recv_task.done():
                self._recv_task.cancel()
                try:
                    await self._recv_task
                except Exception:
                    pass
            self._recv_task = None

        await asyncio.sleep(0.1 + random.random() * 0.4)

        try:
            await self._connect()
        except Exception as exc:
            raise MCPTransportError("Failed to reconnect to MCP server") from exc

    async def _maybe_heartbeat(self) -> None:
        now = time.time()
        if now - self._last_ws_activity > self._heartbeat_interval:
            if self._pending:
                return
            try:
                await self._send_rpc("ping", {}, allow_heartbeat=False)
            except Exception:
                # Ignore; reconnect will be attempted by caller
                pass

    async def _recv_loop(self) -> None:
        assert self._ws is not None
        try:
            while True:
                raw = await self._ws.recv()
                self._last_ws_activity = time.time()
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                req_id = msg.get("id")
                if req_id is None:
                    continue
                fut = self._pending.pop(req_id, None)
                if fut is None or fut.done():
                    continue
                if "error" in msg:
                    err = msg["error"]
                    fut.set_exception(MCPRpcError(err.get("code"), err.get("message", ""), err.get("data")))
                else:
                    fut.set_result(msg.get("result", {}))
        except Exception:
            # Terminate all pending futures on receive failure
            for fut in list(self._pending.values()):
                if not fut.done():
                    fut.set_exception(MCPTransportError("WebSocket receive loop terminated"))
            self._pending.clear()

    def _is_ws_closed(self, ws: Any) -> bool:
        """Best-effort check whether a websocket is closed.

        Supports both real `websockets` objects (with a `.state` attribute)
        and simple fakes that expose a boolean `.closed` attribute.
        """
        try:
            state = getattr(ws, "state", None)
            if state is not None:
                return state == State.CLOSED
            closed_flag = getattr(ws, "closed", None)
            if isinstance(closed_flag, bool):
                return closed_flag
        except Exception:
            pass
        # If we cannot determine, assume not closed
        return False

    def _parse_tools(self, tools_data: list[dict[str, Any]]) -> list[MCPTool]:
        tools: list[MCPTool] = []
        for tool_data in tools_data:
            name = f"{self.server_id}.{tool_data['name']}"
            tools.append(
                MCPTool(
                    name=name,
                    description=tool_data.get("description", ""),
                    input_schema=tool_data.get("inputSchema", {}),
                    server_id=self.server_id,
                    server_url=self.ws_url,
                    tags=tool_data.get("tags"),
                )
            )
        return tools

    def _parse_result(self, result: dict[str, Any]) -> Any:
        # Prefer structured content
        content = result.get("content")
        if isinstance(content, list) and content:
            for item in content:
                if item.get("type") == "json":
                    self._healthy = True
                    return item.get("json")
            text = "".join([i.get("text", "") for i in content if i.get("type") == "text"])
            self._healthy = True
            return {"result": text}
        self._healthy = True
        return result
