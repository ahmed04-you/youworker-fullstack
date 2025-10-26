# MCP Servers Documentation

Guide to Model Context Protocol (MCP) servers providing extensible tool capabilities for YouWorker.AI.

## Table of Contents

- [Overview](#overview)
- [Available Servers](#available-servers)
- [Server Architecture](#server-architecture)
- [Creating Custom Servers](#creating-custom-servers)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

Model Context Protocol (MCP) is a standard for LLM tool integration. Each MCP server exposes a set of tools that the AI agent can dynamically discover and use.

### Key Features

- **Dynamic Discovery**: Tools are discovered at runtime via WebSocket
- **Language Agnostic**: Servers can be written in any language
- **Modular**: Add/remove servers without code changes
- **Scalable**: Each server runs independently

### Architecture

```
Agent Loop
    │
    ├─► MCP Registry (discovers tools)
    │
    └─► MCP Clients (one per server)
        │
        ├─► mcp_web (Port 7001)
        ├─► mcp_semantic (Port 7002)
        ├─► mcp_datetime (Port 7003)
        ├─► mcp_ingest (Port 7004)
        └─► mcp_units (Port 7005)
```

## Available Servers

### 1. Web Server (`mcp_web`)

**Port**: 7001  
**Location**: [`apps/mcp_servers/web/`](../apps/mcp_servers/web/)

**Tools**:
- `web_search`: Search the web using DuckDuckGo
- `web_scrape`: Extract content from URLs
- `web_screenshot`: Capture webpage screenshots

**Example Usage**:
```json
{
  "tool": "web_search",
  "arguments": {
    "query": "Python tutorial",
    "max_results": 5
  }
}
```

**Response**:
```json
{
  "results": [
    {
      "title": "Python Tutorial",
      "url": "https://example.com",
      "snippet": "Learn Python..."
    }
  ]
}
```

---

### 2. Semantic Search Server (`mcp_semantic`)

**Port**: 7002  
**Location**: [`apps/mcp_servers/semantic/`](../apps/mcp_servers/semantic/)

**Tools**:
- `semantic_search`: Search ingested documents by semantic similarity
- `list_collections`: List available document collections

**Example Usage**:
```json
{
  "tool": "semantic_search",
  "arguments": {
    "query": "machine learning algorithms",
    "collection": "documents",
    "limit": 5
  }
}
```

**Response**:
```json
{
  "results": [
    {
      "content": "Machine learning is...",
      "score": 0.92,
      "metadata": {
        "source": "ml_guide.pdf",
        "page": 3
      }
    }
  ]
}
```

---

### 3. DateTime Server (`mcp_datetime`)

**Port**: 7003  
**Location**: [`apps/mcp_servers/datetime/`](../apps/mcp_servers/datetime/)

**Tools**:
- `current_time`: Get current time in various timezones
- `date_diff`: Calculate difference between dates
- `format_date`: Format dates in various formats
- `parse_date`: Parse date strings

**Example Usage**:
```json
{
  "tool": "current_time",
  "arguments": {
    "timezone": "Europe/Rome",
    "format": "%Y-%m-%d %H:%M:%S"
  }
}
```

**Response**:
```json
{
  "time": "2025-01-26 15:30:00",
  "timezone": "Europe/Rome",
  "utc_offset": "+01:00"
}
```

---

### 4. Ingestion Server (`mcp_ingest`)

**Port**: 7004  
**Location**: [`apps/mcp_servers/ingest/`](../apps/mcp_servers/ingest/)

**Tools**:
- `ingest_file`: Process and index a file
- `ingest_url`: Ingest content from a URL
- `ingest_text`: Ingest raw text
- `list_documents`: List ingested documents

**GPU Acceleration**: This server uses GPU for:
- PDF parsing (Docling)
- Audio transcription (Faster Whisper)
- OCR (Tesseract with GPU backend)

**Example Usage**:
```json
{
  "tool": "ingest_file",
  "arguments": {
    "file_path": "/data/uploads/document.pdf",
    "collection": "documents"
  }
}
```

**Response**:
```json
{
  "document_id": "doc_123",
  "chunks": 45,
  "processing_time_ms": 5230,
  "status": "success"
}
```

---

### 5. Units Server (`mcp_units`)

**Port**: 7005  
**Location**: [`apps/mcp_servers/units/`](../apps/mcp_servers/units/)

**Tools**:
- `convert_units`: Convert between measurement units
- `list_categories`: List available unit categories

**Supported Categories**:
- Length (meter, kilometer, mile, etc.)
- Weight (kilogram, pound, ounce, etc.)
- Temperature (Celsius, Fahrenheit, Kelvin)
- Volume (liter, gallon, cup, etc.)
- Time (second, minute, hour, day, etc.)

**Example Usage**:
```json
{
  "tool": "convert_units",
  "arguments": {
    "value": 100,
    "from_unit": "kilometers",
    "to_unit": "miles"
  }
}
```

**Response**:
```json
{
  "result": 62.137,
  "from": {
    "value": 100,
    "unit": "kilometers"
  },
  "to": {
    "value": 62.137,
    "unit": "miles"
  }
}
```

---

## Server Architecture

### Base Server Structure

All MCP servers follow this structure:

```python
# apps/mcp_servers/<server_name>/server.py

from mcp import Server, Tool
import asyncio

class MyMCPServer(Server):
    def __init__(self):
        super().__init__()
        self.register_tools()
    
    def register_tools(self):
        """Register all available tools"""
        self.add_tool(Tool(
            name="tool_name",
            description="Tool description",
            input_schema={
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                },
                "required": ["param"]
            },
            handler=self.tool_handler
        ))
    
    async def tool_handler(self, arguments: dict) -> dict:
        """Handle tool execution"""
        result = await self.process(arguments)
        return {"result": result}

if __name__ == "__main__":
    server = MyMCPServer()
    asyncio.run(server.run(host="0.0.0.0", port=7001))
```

### Tool Schema

Each tool must define:

1. **Name**: Unique identifier
2. **Description**: What the tool does
3. **Input Schema**: JSON Schema for parameters
4. **Handler**: Async function that executes the tool

### WebSocket Protocol

MCP servers communicate via WebSocket:

```
Client                          Server
  │                               │
  ├──── connect ─────────────────►│
  │◄──── connected ──────────────┤
  │                               │
  ├──── list_tools ──────────────►│
  │◄──── tools: [{...}] ─────────┤
  │                               │
  ├──── call_tool ───────────────►│
  │     {name, args}              │
  │◄──── result ──────────────────┤
  │                               │
  ├──── disconnect ──────────────►│
  └───────────────────────────────┘
```

## Creating Custom Servers

### Step 1: Create Server Directory

```bash
mkdir -p apps/mcp_servers/my_server
touch apps/mcp_servers/my_server/__init__.py
touch apps/mcp_servers/my_server/server.py
```

### Step 2: Implement Server

```python
# apps/mcp_servers/my_server/server.py

import asyncio
import logging
from typing import Any, Dict

# Import MCP base classes (you'll need the MCP Python library)
from packages.mcp.client import MCPServer, Tool

logger = logging.getLogger(__name__)

class MyCustomServer:
    """Custom MCP server for specific functionality."""
    
    def __init__(self):
        self.tools = self._register_tools()
    
    def _register_tools(self) -> list[Tool]:
        """Register available tools."""
        return [
            Tool(
                name="my_tool",
                description="Does something useful",
                input_schema={
                    "type": "object",
                    "properties": {
                        "input": {
                            "type": "string",
                            "description": "Input parameter"
                        }
                    },
                    "required": ["input"]
                }
            )
        ]
    
    async def handle_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tool execution."""
        if tool_name == "my_tool":
            return await self._my_tool_handler(arguments)
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
    
    async def _my_tool_handler(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle my_tool calls."""
        input_value = args.get("input")
        
        # Your custom logic here
        result = f"Processed: {input_value}"
        
        return {
            "result": result,
            "metadata": {
                "tool": "my_tool",
                "timestamp": "2025-01-26T15:00:00Z"
            }
        }

async def main():
    """Start the MCP server."""
    server = MyCustomServer()
    
    # Start WebSocket server
    # Implementation depends on MCP library
    logger.info("Starting custom MCP server on port 7006")
    
    # Server loop
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
```

### Step 3: Create Dockerfile

```dockerfile
# ops/docker/Dockerfile.mcp_my_server

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements/mcp-my-server.txt .
RUN pip install --no-cache-dir -r mcp-my-server.txt

# Copy server code
COPY packages/ packages/
COPY apps/mcp_servers/my_server/ apps/mcp_servers/my_server/

# Set Python path
ENV PYTHONPATH=/app

# Run server
CMD ["python", "apps/mcp_servers/my_server/server.py"]
```

### Step 4: Add to Docker Compose

```yaml
# ops/compose/docker-compose.yml

services:
  # ... existing services ...
  
  mcp_my_server:
    build:
      context: ../..
      dockerfile: ops/docker/Dockerfile.mcp_my_server
    ports:
      - "7006:7006"
    environment:
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    networks:
      - youworker-network
    restart: unless-stopped
```

### Step 5: Register in Configuration

Add to `.env`:

```bash
MCP_SERVER_URLS=http://mcp_web:7001,http://mcp_semantic:7002,http://mcp_datetime:7003,http://mcp_ingest:7004,http://mcp_units:7005,http://mcp_my_server:7006
```

### Step 6: Test Your Server

```bash
# Build and start
docker compose build mcp_my_server
docker compose up -d mcp_my_server

# Check logs
docker compose logs -f mcp_my_server

# Test tool discovery
curl http://localhost:8001/v1/tools
```

## Deployment

### Production Considerations

1. **Health Checks**: Implement `/health` endpoint
2. **Monitoring**: Expose Prometheus metrics
3. **Logging**: Structured JSON logs
4. **Error Handling**: Graceful degradation
5. **Rate Limiting**: Protect against abuse

### Resource Requirements

| Server | CPU | Memory | GPU |
|--------|-----|--------|-----|
| mcp_web | 0.5 | 512MB | No |
| mcp_semantic | 1.0 | 1GB | No |
| mcp_datetime | 0.25 | 256MB | No |
| mcp_ingest | 2.0 | 4GB | Yes |
| mcp_units | 0.25 | 256MB | No |

### Scaling Strategies

**Horizontal Scaling**:
- Run multiple instances behind load balancer
- Use service discovery (Consul, etcd)
- Share state via Redis

**Vertical Scaling**:
- Increase CPU/memory allocation
- Add GPU for compute-intensive servers
- Optimize tool implementations

## Troubleshooting

### Server Not Responding

**Check if server is running**:
```bash
docker compose ps mcp_web
```

**View logs**:
```bash
docker compose logs mcp_web
```

**Test connectivity**:
```bash
curl http://localhost:7001/health
```

### Tool Not Discovered

**Check MCP registry logs**:
```bash
docker compose logs api | grep -i mcp
```

**Verify server URL in `.env`**:
```bash
grep MCP_SERVER_URLS .env
```

**Test direct connection**:
```python
from packages.mcp.client import MCPClient

client = MCPClient("http://mcp_web:7001")
await client.connect()
tools = await client.list_tools()
print(tools)
```

### Tool Execution Errors

**Enable debug logging**:
```bash
# In .env
LOG_LEVEL=DEBUG
```

**Check tool schema**:
- Ensure input schema matches arguments
- Verify required fields are provided
- Check data types

**Test tool directly**:
```bash
# Using curl
curl -X POST http://localhost:7001/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "web_search",
    "arguments": {
      "query": "test"
    }
  }'
```

### Performance Issues

**Monitor resource usage**:
```bash
docker stats mcp_ingest
```

**Check for bottlenecks**:
- CPU: Optimize algorithms
- Memory: Reduce batch sizes
- Network: Add caching
- GPU: Check CUDA/ROCm configuration

**Optimize tool implementations**:
- Add caching for repeated calls
- Use async/await properly
- Implement request batching
- Add connection pooling

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design
- [API Documentation](API.md) - API reference
- [Development Guide](DEVELOPMENT.md) - Contributing guide
- [Setup Guide](SETUP.md) - Installation instructions