import asyncio
import json
import pytest

from packages.mcp.client import MCPClient


class FakeWebSocket:
    def __init__(self):
        self._send_q: asyncio.Queue[str] = asyncio.Queue()
        self._recv_q: asyncio.Queue[str] = asyncio.Queue()
        self.closed = False

    async def send(self, text: str):
        await self._send_q.put(text)

    async def recv(self) -> str:
        return await self._recv_q.get()

    async def close(self):
        self.closed = True


class FakeWebsockets:
    def __init__(self, ws: FakeWebSocket):
        self._ws = ws

    async def connect(self, url, open_timeout=None):  # type: ignore
        return self._ws


@pytest.mark.asyncio
async def test_ws_dispatcher_handles_out_of_order_responses(monkeypatch):
    ws = FakeWebSocket()
    fake_ws_module = FakeWebsockets(ws)

    # Monkeypatch the websockets module used inside MCPClient
    import packages.mcp.client as client_mod

    original_ws = client_mod.websockets
    client_mod.websockets = fake_ws_module  # type: ignore

    c = MCPClient(server_url="ws://local/mcp", server_id="web", timeout=2)
    c._ws_supported = True  # force WS path

    async def server():
        # Handle initialize
        init_req = json.loads(await ws._send_q.get())
        assert init_req["method"] == "initialize"
        await ws._recv_q.put(json.dumps({"jsonrpc": "2.0", "id": init_req["id"], "result": {}}))

        # Expect two RPC requests; reply in reverse order to test dispatcher
        req1 = json.loads(await ws._send_q.get())
        req2 = json.loads(await ws._send_q.get())
        # Respond to second first
        await ws._recv_q.put(json.dumps({"jsonrpc": "2.0", "id": req2["id"], "result": {"ok": 2}}))
        await ws._recv_q.put(json.dumps({"jsonrpc": "2.0", "id": req1["id"], "result": {"ok": 1}}))

    server_task = asyncio.create_task(server())

    # Fire two RPCs in parallel
    r1_task = asyncio.create_task(c._send_rpc("tools/list", {}))
    r2_task = asyncio.create_task(c._send_rpc("ping", {}))

    try:
        r2 = await r2_task
        r1 = await r1_task

        assert r2 == {"ok": 2}
        assert r1 == {"ok": 1}
    finally:
        server_task.cancel()
        try:
            await server_task
        except Exception:
            pass
        await c.close()
        client_mod.websockets = original_ws  # type: ignore
