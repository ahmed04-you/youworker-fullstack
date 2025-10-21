"""
MCP server for datetime utilities.

Tools:
- now: Get current time in specified timezone
- format: Format an ISO timestamp with custom format and timezone
- add: Add/subtract time delta from a timestamp
"""
import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
import pytz
from dateutil.parser import parse as parse_date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Datetime MCP Server")


class ToolsListRequest(BaseModel):
    """Empty request for tools/list."""

    pass


class ToolCallRequest(BaseModel):
    """Tool call request."""

    name: str
    arguments: dict[str, Any]


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


@app.post("/tools/list")
async def list_tools(request: ToolsListRequest | None = None):
    """Return available tools."""
    return {
        "tools": [
            {
                "name": "now",
                "description": "Get the current date and time in the specified timezone. Returns ISO format timestamp.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "tz": {
                            "type": "string",
                            "description": "Timezone name (e.g., 'UTC', 'America/New_York', 'Europe/London')",
                            "default": "UTC",
                        },
                    },
                },
            },
            {
                "name": "format",
                "description": "Format a timestamp with a custom format string and timezone. Uses Python strftime format codes.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "iso": {
                            "type": "string",
                            "description": "ISO format timestamp to format",
                        },
                        "fmt": {
                            "type": "string",
                            "description": "Format string (e.g., '%Y-%m-%d %H:%M:%S', '%B %d, %Y')",
                            "default": "%Y-%m-%d %H:%M:%S",
                        },
                        "tz": {
                            "type": "string",
                            "description": "Target timezone",
                            "default": "UTC",
                        },
                    },
                    "required": ["iso"],
                },
            },
            {
                "name": "add",
                "description": "Add or subtract a time delta from a timestamp. Returns ISO format timestamp.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "iso": {
                            "type": "string",
                            "description": "ISO format timestamp",
                        },
                        "delta": {
                            "type": "object",
                            "description": "Time delta to add (use negative values to subtract)",
                            "properties": {
                                "days": {"type": "integer", "default": 0},
                                "hours": {"type": "integer", "default": 0},
                                "minutes": {"type": "integer", "default": 0},
                                "seconds": {"type": "integer", "default": 0},
                            },
                        },
                        "tz": {
                            "type": "string",
                            "description": "Timezone for the result",
                            "default": "UTC",
                        },
                    },
                    "required": ["iso", "delta"],
                },
            },
        ]
    }


@app.post("/tools/call")
async def call_tool(request: ToolCallRequest):
    """Execute a tool."""
    tool_name = request.name
    arguments = request.arguments

    logger.info(f"Tool call: {tool_name} with args: {arguments}")

    try:
        if tool_name == "now":
            result = get_now(tz=arguments.get("tz", "UTC"))
        elif tool_name == "format":
            result = format_time(
                iso=arguments["iso"],
                fmt=arguments.get("fmt", "%Y-%m-%d %H:%M:%S"),
                tz=arguments.get("tz", "UTC"),
            )
        elif tool_name == "add":
            result = add_time(
                iso=arguments["iso"],
                delta=arguments["delta"],
                tz=arguments.get("tz", "UTC"),
            )
        else:
            result = {"error": f"Unknown tool: {tool_name}"}

        return {"content": [{"type": "text", "text": str(result)}]}

    except Exception as e:
        logger.error(f"Tool execution failed: {e}")
        return {"content": [{"type": "text", "text": str({"error": str(e)})}]}


def get_now(tz: str = "UTC") -> dict[str, Any]:
    """
    Get current time in specified timezone.

    Args:
        tz: Timezone name

    Returns:
        Current time info
    """
    try:
        timezone = pytz.timezone(tz)
        now = datetime.now(timezone)

        return {
            "timestamp": now.isoformat(),
            "timezone": tz,
            "formatted": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        }

    except Exception as e:
        return {"error": f"Invalid timezone: {tz}"}


def format_time(iso: str, fmt: str = "%Y-%m-%d %H:%M:%S", tz: str = "UTC") -> dict[str, Any]:
    """
    Format a timestamp.

    Args:
        iso: ISO timestamp
        fmt: Format string
        tz: Target timezone

    Returns:
        Formatted time
    """
    try:
        dt = parse_date(iso)
        timezone = pytz.timezone(tz)

        # Convert to target timezone
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)

        dt = dt.astimezone(timezone)

        return {
            "formatted": dt.strftime(fmt),
            "timezone": tz,
            "iso": dt.isoformat(),
        }

    except Exception as e:
        return {"error": str(e)}


def add_time(iso: str, delta: dict[str, int], tz: str = "UTC") -> dict[str, Any]:
    """
    Add time delta to timestamp.

    Args:
        iso: ISO timestamp
        delta: Time delta dict
        tz: Result timezone

    Returns:
        New timestamp
    """
    try:
        dt = parse_date(iso)
        timezone = pytz.timezone(tz)

        # Apply delta
        td = timedelta(
            days=delta.get("days", 0),
            hours=delta.get("hours", 0),
            minutes=delta.get("minutes", 0),
            seconds=delta.get("seconds", 0),
        )

        new_dt = dt + td

        # Convert to target timezone
        if new_dt.tzinfo is None:
            new_dt = pytz.UTC.localize(new_dt)

        new_dt = new_dt.astimezone(timezone)

        return {
            "timestamp": new_dt.isoformat(),
            "timezone": tz,
            "formatted": new_dt.strftime("%Y-%m-%d %H:%M:%S %Z"),
        }

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7003)
