"""
MCP server for unit conversions using Pint.

Tools:
- convert: Convert units (length, mass, temp, etc.)

Note: Currency conversions are excluded unless explicitly implemented with a provider.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, WebSocket
from pint import UnitRegistry

from packages.mcp.base_handler import (
    MCPProtocolHandler,
    MCPServerInfo,
    mcp_websocket_handler,
)

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


# Initialize MCP protocol handler
mcp_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="units",
        version="0.1.0",
    )
)

# Register tools
# Note: 'from' is a Python keyword, so we need to handle it specially
async def convert_wrapper(**kwargs):
    """Wrapper to handle 'from' keyword."""
    return convert_units(
        value=kwargs["value"],
        from_unit=kwargs["from"],
        to_unit=kwargs["to"],
    )

mcp_handler.register_tool(
    name="convert",
    description="Convert units (length, mass, temperature, etc.) using Pint. Currency conversions are not supported.",
    input_schema={
        "type": "object",
        "properties": {
            "value": {"type": "number", "description": "Numeric value"},
            "from": {
                "type": "string",
                "description": "Unit to convert from",
                "minLength": 1,
                "maxLength": 64,
            },
            "to": {
                "type": "string",
                "description": "Unit to convert to",
                "minLength": 1,
                "maxLength": 64,
            },
        },
        "required": ["value", "from", "to"],
        "additionalProperties": False,
    },
    handler=convert_wrapper,
)


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """MCP WebSocket endpoint using base handler."""
    await mcp_websocket_handler(ws, mcp_handler)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7005)
