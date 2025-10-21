#!/usr/bin/env python3
"""
Test datetime MCP tool with logging.
"""
import sys
from pathlib import Path
import asyncio

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from packages.mcp import MCPClient

async def test_datetime():
    client = MCPClient(server_url="http://localhost:7003", server_id="datetime")
    try:
        await client.list_tools()
        print("Tools discovered successfully")
        
        # Test with invalid timezone
        result_invalid = await client.call_tool("now", {"tz": "Milano"})
        print(f"Invalid TZ result: {result_invalid}")
        
        # Test with valid timezone
        result_valid = await client.call_tool("now", {"tz": "Europe/Rome"})
        print(f"Valid TZ result: {result_valid}")
        
        # Test with default
        result_default = await client.call_tool("now", {})
        print(f"Default result: {result_default}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test_datetime())