"""
WebSocket connection manager for real-time chat communication.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


from packages.db import get_async_session
from packages.db.models import ChatSession

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time chat.

    Features:
    - Connection pooling and session management
    - Heartbeat monitoring
    - Message broadcasting
    - Graceful error handling
    """

    def __init__(self):
        # Active connections by session ID
        self.active_connections: dict[str, Any] = {}
        # User sessions mapping
        self.user_sessions: dict[int, set[str]] = {}
        # Connection metadata
        self.connection_metadata: dict[str, dict[str, Any]] = {}
        # Heartbeat tracking
        self.last_heartbeat: dict[str, datetime] = {}
        # Lock for thread safety
        self._lock = asyncio.Lock()

    async def connect(self, websocket: Any, user_id: int, session_id: str | None = None) -> str:
        """
        Accept and register a new WebSocket connection.

        Args:
            websocket: WebSocket connection
            user_id: User identifier
            session_id: Optional existing session ID

        Returns:
            Connection ID for tracking
        """
        connection_id = str(uuid4())

        async with self._lock:
            # Store connection
            self.active_connections[connection_id] = websocket

            # Create or associate session
            if not session_id:
                session_id = str(uuid4())
                # Create new session in database
                async with get_async_session() as db:
                    db_session = ChatSession(
                        external_id=session_id,
                        user_id=user_id,
                        model="gpt-oss:20b",
                        enable_tools=True,
                    )
                    db.add(db_session)
                    await db.commit()

            # Track user sessions
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = set()
            self.user_sessions[user_id].add(session_id)

            # Store metadata
            self.connection_metadata[connection_id] = {
                "user_id": user_id,
                "session_id": session_id,
                "connected_at": datetime.now(timezone.utc),
                "last_activity": datetime.now(timezone.utc),
            }

            # Initialize heartbeat
            self.last_heartbeat[connection_id] = datetime.now(timezone.utc)

        logger.info(
            "WebSocket connected",
            extra={
                "connection_id": connection_id,
                "user_id": user_id,
                "session_id": session_id
            }
        )
        return connection_id

    async def disconnect(self, connection_id: str):
        """
        Remove and clean up a WebSocket connection.

        Args:
            connection_id: Connection identifier
        """
        async with self._lock:
            if connection_id not in self.active_connections:
                return

            # Get metadata before cleanup
            metadata = self.connection_metadata.get(connection_id, {})
            user_id = metadata.get("user_id")
            session_id = metadata.get("session_id")

            # Remove connection
            del self.active_connections[connection_id]

            # Clean up metadata
            if connection_id in self.connection_metadata:
                del self.connection_metadata[connection_id]

            # Clean up heartbeat
            if connection_id in self.last_heartbeat:
                del self.last_heartbeat[connection_id]

            # Update user sessions
            if user_id and session_id and user_id in self.user_sessions:
                self.user_sessions[user_id].discard(session_id)
                if not self.user_sessions[user_id]:
                    del self.user_sessions[user_id]

        logger.info(
            "WebSocket disconnected",
            extra={
                "connection_id": connection_id,
                "user_id": user_id,
                "session_id": session_id
            }
        )

    async def send_message(self, connection_id: str, message: dict[str, Any]):
        """
        Send a message to a specific connection.

        Args:
            connection_id: Target connection ID
            message: Message to send
        """
        if connection_id not in self.active_connections:
            return

        try:
            # Use send_text for FastAPI WebSocket
            await self.active_connections[connection_id].send_text(json.dumps(message))

            # Update activity timestamp
            async with self._lock:
                if connection_id in self.connection_metadata:
                    self.connection_metadata[connection_id]["last_activity"] = datetime.now(timezone.utc)
        except Exception as e:
            logger.error(
                "Error sending message to connection",
                extra={
                    "connection_id": connection_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            # Connection might be dead, schedule cleanup
            asyncio.create_task(self.disconnect(connection_id))

    async def broadcast_to_session(self, session_id: str, message: dict[str, Any]):
        """
        Broadcast message to all connections in a session.

        Args:
            session_id: Target session ID
            message: Message to broadcast
        """
        connections_to_send = []

        async with self._lock:
            for conn_id, metadata in self.connection_metadata.items():
                if metadata.get("session_id") == session_id:
                    connections_to_send.append(conn_id)

        # Send to all connections in parallel
        tasks = [self.send_message(conn_id, message) for conn_id in connections_to_send]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_user(self, user_id: int, message: dict[str, Any]):
        """
        Broadcast message to all connections for a user.

        Args:
            user_id: Target user ID
            message: Message to broadcast
        """
        connections_to_send = []

        async with self._lock:
            for conn_id, metadata in self.connection_metadata.items():
                if metadata.get("user_id") == user_id:
                    connections_to_send.append(conn_id)

        # Send to all connections in parallel
        tasks = [self.send_message(conn_id, message) for conn_id in connections_to_send]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def update_heartbeat(self, connection_id: str):
        """
        Update heartbeat timestamp for a connection.

        Args:
            connection_id: Connection ID
        """
        async with self._lock:
            if connection_id in self.last_heartbeat:
                self.last_heartbeat[connection_id] = datetime.now(timezone.utc)

    async def check_stale_connections(self, timeout_seconds: int = 60):
        """
        Check and clean up stale connections based on heartbeat.

        Args:
            timeout_seconds: Seconds before considering connection stale
        """
        now = datetime.now(timezone.utc)
        stale_connections = []

        async with self._lock:
            for conn_id, last_beat in self.last_heartbeat.items():
                if (now - last_beat).total_seconds() > timeout_seconds:
                    stale_connections.append(conn_id)

        # Disconnect stale connections
        for conn_id in stale_connections:
            logger.info(
                "Cleaning up stale connection",
                extra={"connection_id": conn_id, "reason": "stale_connection"}
            )
            await self.disconnect(conn_id)

    def get_connection_info(self, connection_id: str) -> dict[str, Any] | None:
        """
        Get metadata for a connection.

        Args:
            connection_id: Connection ID

        Returns:
            Connection metadata or None if not found
        """
        return self.connection_metadata.get(connection_id)

    def get_active_sessions(self, user_id: int) -> list[str]:
        """
        Get active session IDs for a user.

        Args:
            user_id: User ID

        Returns:
            List of active session IDs
        """
        return list(self.user_sessions.get(user_id, set()))

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.active_connections)


# Global connection manager instance
manager = ConnectionManager()


async def heartbeat_monitor(interval_seconds: int = 30):
    """
    Background task to monitor connection health.

    Args:
        interval_seconds: Check interval
    """
    while True:
        try:
            await manager.check_stale_connections()
            await asyncio.sleep(interval_seconds)
        except Exception as e:
            logger.error(
                "Error in heartbeat monitor",
                extra={"error": str(e), "error_type": type(e).__name__}
            )
            await asyncio.sleep(interval_seconds)


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager instance."""
    return manager
