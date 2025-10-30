"""
EXAMPLE: Refactored datetime MCP server using base handler utilities.

This file demonstrates how to use the new MCPProtocolHandler to eliminate code duplication.
The original server.py has ~150 lines of boilerplate JSON-RPC handling.
This refactored version reduces that to ~30 lines using the base handler.

To use this refactored version:
1. Replace the @app.websocket("/mcp") handler in server.py with this implementation
2. Keep all the tool functions (get_now, format_time, add_time, parse_natural) unchanged
3. Replace the manual tool registration with the handler registration

Code reduction: ~70% less boilerplate code
Benefits:
- Consistent error handling across all MCP servers
- Automatic JSON-RPC protocol compliance
- Cleaner, more maintainable code
- Easier to add new tools
"""

from fastapi import FastAPI, WebSocket
from packages.mcp import MCPProtocolHandler, MCPServerInfo, mcp_websocket_handler

# Import the existing tool functions (unchanged)
from server import get_now, format_time, add_time, parse_natural
from server import (
    TZ_PATTERN, ISO_MIN_LEN, ISO_MAX_LEN,
    FMT_MAX_LEN, DELTA_LIMIT
)


# Create FastAPI app (same as before)
app = FastAPI(title="Datetime MCP Server")


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


# Initialize MCP protocol handler
datetime_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="datetime",
        version="0.1.0"
    )
)

# Register tools with their schemas
datetime_handler.register_tool(
    name="now",
    description="Get the current date and time in the specified timezone. Returns ISO format timestamp.",
    input_schema={
        "type": "object",
        "properties": {
            "tz": {
                "type": "string",
                "description": "Timezone name (e.g., 'UTC', 'America/New_York', 'Europe/London')",
                "default": "UTC",
                "minLength": 1,
                "maxLength": 64,
                "pattern": r"^[A-Za-z0-9._+\-/]+$",
            }
        },
        "additionalProperties": False,
    },
    handler=get_now,
)

datetime_handler.register_tool(
    name="format",
    description="Format a timestamp with a custom format string and timezone. Uses Python strftime format codes.",
    input_schema={
        "type": "object",
        "properties": {
            "iso": {
                "type": "string",
                "description": "ISO format timestamp to format",
                "minLength": ISO_MIN_LEN,
                "maxLength": ISO_MAX_LEN,
            },
            "fmt": {
                "type": "string",
                "description": "Format string (e.g., '%Y-%m-%d %H:%M:%S', '%B %d, %Y')",
                "default": "%Y-%m-%d %H:%M:%S",
                "minLength": 1,
                "maxLength": FMT_MAX_LEN,
            },
            "tz": {
                "type": "string",
                "description": "Target timezone",
                "default": "UTC",
                "minLength": 1,
                "maxLength": 64,
                "pattern": r"^[A-Za-z0-9._+\-/]+$",
            },
        },
        "required": ["iso"],
        "additionalProperties": False,
    },
    handler=format_time,
)

datetime_handler.register_tool(
    name="add",
    description="Add or subtract a time delta from a timestamp. Returns ISO format timestamp.",
    input_schema={
        "type": "object",
        "properties": {
            "iso": {
                "type": "string",
                "description": "ISO format timestamp",
                "minLength": ISO_MIN_LEN,
                "maxLength": ISO_MAX_LEN,
            },
            "delta": {
                "type": "object",
                "description": "Time delta to add (use negative values to subtract)",
                "properties": {
                    "days": {
                        "type": "integer",
                        "default": 0,
                        "minimum": -DELTA_LIMIT,
                        "maximum": DELTA_LIMIT,
                    },
                    "hours": {
                        "type": "integer",
                        "default": 0,
                        "minimum": -DELTA_LIMIT,
                        "maximum": DELTA_LIMIT,
                    },
                    "minutes": {
                        "type": "integer",
                        "default": 0,
                        "minimum": -DELTA_LIMIT,
                        "maximum": DELTA_LIMIT,
                    },
                    "seconds": {
                        "type": "integer",
                        "default": 0,
                        "minimum": -DELTA_LIMIT,
                        "maximum": DELTA_LIMIT,
                    },
                },
                "required": [],
                "additionalProperties": False,
            },
            "tz": {
                "type": "string",
                "description": "Timezone for the result",
                "default": "UTC",
                "minLength": 1,
                "maxLength": 64,
                "pattern": r"^[A-Za-z0-9._+\-/]+$",
            },
        },
        "required": ["iso", "delta"],
        "additionalProperties": False,
    },
    handler=add_time,
)

datetime_handler.register_tool(
    name="parse_natural",
    description="Parse natural language date/time expressions with optional timezone.",
    input_schema={
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Natural language date expression",
                "minLength": 1,
                "maxLength": 256,
            },
            "tz": {
                "type": "string",
                "description": "Timezone name (default UTC)",
                "default": "UTC",
                "minLength": 1,
                "maxLength": 64,
                "pattern": r"^[A-Za-z0-9._+\-/]+$",
            },
        },
        "required": ["text"],
        "additionalProperties": False,
    },
    handler=parse_natural,
)


# WebSocket endpoint using the base handler
# THIS REPLACES THE ENTIRE 130+ LINES OF JSON-RPC BOILERPLATE!
@app.websocket("/mcp")
async def mcp_socket(websocket: WebSocket):
    """MCP protocol endpoint - uses the base handler for all protocol logic."""
    await mcp_websocket_handler(websocket, datetime_handler)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7003)
