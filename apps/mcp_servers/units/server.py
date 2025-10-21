"""
MCP server for unit conversions using Pint.

Tools:
- convert: Convert units (length, mass, temp, etc.)

Note: Currency conversions are excluded unless explicitly implemented with a provider.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pint import UnitRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Units MCP Server")

ureg = UnitRegistry(autoconvert_offset_to_baseunit=True)
Q_ = ureg.Quantity


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def convert_units(value: float, from_unit: str, to_unit: str) -> dict[str, Any]:
    """Convert units using Pint."""
    if not isinstance(value, (int, float)):
        return {"error": "value must be a number"}
    if not isinstance(from_unit, str) or not from_unit.strip():
        return {"error": "from must be a non-empty string"}
    if not isinstance(to_unit, str) or not to_unit.strip():
        return {"error": "to must be a non-empty string"}

    try:
        qty = Q_(value, from_unit)
        converted = qty.to(to_unit)
        return {
            "value": float(converted.magnitude),
            "unit": f"{converted.units}",
            "input": {"value": value, "unit": from_unit},
        }
    except Exception as e:
        return {"error": str(e)}


def get_tools_schema() -> list[dict[str, Any]]:
    return [
        {
            "name": "convert",
            "description": "Convert units (length, mass, temperature, etc.) using Pint. Currency conversions are not supported.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "value": {"type": "number", "description": "Numeric value"},
                    "from": {"type": "string", "description": "Unit to convert from", "minLength": 1, "maxLength": 64},
                    "to": {"type": "string", "description": "Unit to convert to", "minLength": 1, "maxLength": 64},
                },
                "required": ["value", "from", "to"],
                "additionalProperties": False,
            },
        }
    ]


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                req = json.loads(raw)
            except Exception:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": "Parse error", "data": {"raw": str(raw)[:200]}},
                    })
                )
                continue

            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {}) or {}

            try:
                if method == "initialize":
                    result = {
                        "protocolVersion": "2024-10-01",
                        "serverInfo": {"name": "units", "version": "0.1.0"},
                        "capabilities": {"tools": {"list": True, "call": True}},
                    }
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}))

                elif method == "tools/list":
                    await ws.send_text(
                        json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"tools": get_tools_schema()}})
                    )

                elif method == "tools/call":
                    name = params.get("name")
                    arguments = params.get("arguments", {})
                    if name == "convert":
                        result = convert_units(
                            value=arguments["value"],
                            from_unit=arguments["from"],
                            to_unit=arguments["to"],
                        )
                    else:
                        await ws.send_text(
                            json.dumps({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "error": {"code": -32601, "message": f"Unknown tool: {name}", "data": {"name": name}},
                            })
                        )
                        continue

                    await ws.send_text(
                        json.dumps(
                            {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "json", "json": result}]}}
                        )
                    )

                elif method == "ping":
                    await ws.send_text(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}))

                else:
                    await ws.send_text(
                        json.dumps({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {"code": -32601, "message": "Method not found", "data": {"method": method}},
                        })
                    )

            except Exception as e:
                await ws.send_text(
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32000, "message": str(e), "data": {"type": type(e).__name__}},
                    })
                )
    except WebSocketDisconnect:
        logger.info("MCP WebSocket disconnected (units)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7005)

