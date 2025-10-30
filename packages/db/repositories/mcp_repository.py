"""Repository for MCP server and tool management."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import MCPServer, Tool
from .base import BaseRepository


class MCPRepository(BaseRepository[MCPServer]):
    """Repository for MCP servers and tools."""

    def __init__(self, session: AsyncSession):
        """
        Initialize MCP repository.

        Args:
            session: Database session
        """
        super().__init__(session, MCPServer)

    async def upsert_mcp_servers(
        self,
        servers: Iterable[tuple[str, str, bool]]
    ) -> dict[str, MCPServer]:
        """
        Upsert MCP servers by server_id.

        Args:
            servers: Iterable of (server_id, url, healthy) tuples

        Returns:
            Mapping of server_id to MCPServer
        """
        q = select(MCPServer)
        result = await self.session.execute(q)
        existing = result.scalars().all()
        by_id = {s.server_id: s for s in existing}
        result_map: dict[str, MCPServer] = {}
        now = datetime.now(timezone.utc)

        for server_id, url, healthy in servers:
            s = by_id.get(server_id)
            if s:
                s.url = url
                s.healthy = healthy
                s.last_seen = now
                result_map[server_id] = s
            else:
                s = MCPServer(
                    server_id=server_id,
                    url=url,
                    healthy=healthy,
                    last_seen=now
                )
                self.session.add(s)
                await self.session.flush()
                result_map[server_id] = s

        return result_map

    async def upsert_tools(
        self,
        server_map: dict[str, MCPServer],
        tools: Iterable[tuple[str, str, str, dict | None]],
    ) -> None:
        """
        Upsert tools by (server_id, qualified_name).

        Args:
            server_map: Mapping of server_id to MCPServer instances
            tools: Iterable of (server_id, qualified_name, description, input_schema) tuples
        """
        q = select(Tool)
        result = await self.session.execute(q)
        existing = result.scalars().all()
        index = {(t.mcp_server_id, t.name): t for t in existing}
        now = datetime.now(timezone.utc)

        for server_id, name, description, schema in tools:
            server = server_map.get(server_id)
            if not server:
                continue

            key = (server.id, name)
            t = index.get(key)
            if t:
                t.description = description
                t.input_schema = schema
                t.last_discovered_at = now
            else:
                self.session.add(
                    Tool(
                        mcp_server_id=server.id,
                        name=name,
                        description=description,
                        input_schema=schema,
                        last_discovered_at=now,
                    )
                )

        await self.session.flush()
