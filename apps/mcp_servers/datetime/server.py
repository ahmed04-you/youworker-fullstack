"""
MCP server for datetime utilities.

Tools:
- now: Get current time in specified timezone
- format: Format an ISO timestamp with custom format and timezone
- add: Add/subtract time delta from a timestamp
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Any

from fastapi import FastAPI, WebSocket
import pytz
from dateutil.parser import parse as parse_date

from packages.mcp.base_handler import (
    MCPProtocolHandler,
    MCPServerInfo,
    mcp_websocket_handler,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Datetime MCP Server")

TZ_PATTERN = re.compile(r"^[A-Za-z0-9._+\-/]+$")
ISO_MIN_LEN = 10
ISO_MAX_LEN = 128
FMT_MAX_LEN = 128
DELTA_LIMIT = 1000


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


def get_now(tz: str = "UTC") -> dict[str, Any]:
    """
    Get current time in specified timezone.

    Args:
        tz: Timezone name

    Returns:
        Current time info
    """
    if not isinstance(tz, str) or not tz:
        return {"error": "tz must be a non-empty string"}
    tz = tz.strip()
    if len(tz) > 64 or not TZ_PATTERN.fullmatch(tz):
        return {"error": r"tz must match ^[A-Za-z0-9._+\-/]+$ and be <= 64 chars"}

    logger.info("get_now called", extra={"timezone": tz})

    try:
        timezone = pytz.timezone(tz)
        now = datetime.now(timezone)

        result = {
            "timestamp": now.isoformat(),
            "timezone": tz,
            "formatted": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        }
        logger.info(
            "get_now success",
            extra={"timezone": tz, "timestamp": result["timestamp"]}
        )
        return result

    except Exception as e:
        error_msg = f"Invalid timezone: {tz}"
        logger.error(
            "get_now failed",
            extra={"timezone": tz, "error": str(e), "error_type": type(e).__name__}
        )
        return {"error": error_msg}


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
    if not isinstance(iso, str) or len(iso) < ISO_MIN_LEN or len(iso) > ISO_MAX_LEN:
        return {
            "error": f"iso timestamp must be between {ISO_MIN_LEN} and {ISO_MAX_LEN} characters",
        }
    if not isinstance(fmt, str) or not fmt or len(fmt) > FMT_MAX_LEN:
        return {"error": f"fmt must be a non-empty string up to {FMT_MAX_LEN} characters"}
    if not isinstance(tz, str) or not tz:
        return {"error": "tz must be a non-empty string"}
    tz = tz.strip()
    if len(tz) > 64 or not TZ_PATTERN.fullmatch(tz):
        return {"error": r"tz must match ^[A-Za-z0-9._+\-/]+$ and be <= 64 chars"}

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
    if not isinstance(iso, str) or len(iso) < ISO_MIN_LEN or len(iso) > ISO_MAX_LEN:
        return {
            "error": f"iso timestamp must be between {ISO_MIN_LEN} and {ISO_MAX_LEN} characters",
        }
    if not isinstance(delta, dict):
        return {"error": "delta must be an object"}
    if not isinstance(tz, str) or not tz:
        return {"error": "tz must be a non-empty string"}
    tz = tz.strip()
    if len(tz) > 64 or not TZ_PATTERN.fullmatch(tz):
        return {"error": r"tz must match ^[A-Za-z0-9._+\-/]+$ and be <= 64 chars"}

    for key in ("days", "hours", "minutes", "seconds"):
        if key in delta:
            value = delta[key]
            if not isinstance(value, int) or abs(value) > DELTA_LIMIT:
                return {
                    "error": f"delta.{key} must be an integer between -{DELTA_LIMIT} and {DELTA_LIMIT}"
                }

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


# Initialize MCP protocol handler
mcp_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="datetime",
        version="0.1.0",
    )
)

# Register tools
mcp_handler.register_tool(
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
    handler=lambda tz="UTC": get_now(tz=tz),
)

mcp_handler.register_tool(
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
    handler=lambda iso, fmt="%Y-%m-%d %H:%M:%S", tz="UTC": format_time(iso=iso, fmt=fmt, tz=tz),
)

mcp_handler.register_tool(
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
    handler=lambda iso, delta, tz="UTC": add_time(iso=iso, delta=delta, tz=tz),
)

@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """MCP WebSocket endpoint using base handler."""
    await mcp_websocket_handler(ws, mcp_handler)
