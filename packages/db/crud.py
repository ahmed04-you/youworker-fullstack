from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Iterable
import secrets

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    DatabaseError,
)

from .models import (
    User,
    MCPServer,
    Tool,
    ChatSession,
    ChatMessage,
    ToolRun,
    IngestionRun,
    Document,
    DocumentCollection,
    UserCollectionAccess,
    UserDocumentAccess,
    Group,
    UserGroupMembership,
)

logger = logging.getLogger(__name__)


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def ensure_root_user(session: AsyncSession, *, username: str, api_key: str) -> User:
    """Ensure root user exists with given credentials."""
    q = select(User).where(User.username == username)
    result = await session.execute(q)
    user = result.scalar_one_or_none()
    if user:
        # Update api key hash if changed
        h = _hash_api_key(api_key)
        if user.api_key_hash != h:
            user.api_key_hash = h
            await session.flush()
        return user
    user = User(username=username, is_root=True, api_key_hash=_hash_api_key(api_key))
    session.add(user)
    await session.flush()
    return user


async def get_user_by_api_key(session: AsyncSession, api_key: str) -> User:
    """Return the user matching the provided API key hash."""
    if not api_key:
        raise ValidationError("API key is required", code="MISSING_API_KEY")

    try:
        hashed = _hash_api_key(api_key)
        result = await session.execute(select(User).where(User.api_key_hash == hashed))
        user = result.scalar_one_or_none()

        if not user:
            raise ResourceNotFoundError(
                "Invalid API key",
                code="INVALID_API_KEY"
            )

        return user
    except (ResourceNotFoundError, ValidationError):
        raise  # Re-raise business errors
    except Exception as e:
        logger.error(
            "Database error in get_user_by_api_key",
            extra={"error": str(e), "error_type": type(e).__name__, "operation": "get_user_by_api_key"},
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to fetch user: {str(e)}",
            details={"operation": "get_user_by_api_key"}
        ) from e


async def regenerate_user_api_key(session: AsyncSession, user_id: int) -> str:
    """Generate and persist a new API key for the given user."""
    user = await session.get(User, user_id)
    if not user:
        raise ResourceNotFoundError(
            f"User not found: {user_id}",
            code="USER_NOT_FOUND",
            details={"user_id": user_id}
        )
    new_key = secrets.token_urlsafe(32)
    user.api_key_hash = _hash_api_key(new_key)
    await session.flush()
    return new_key


async def clear_user_history(session: AsyncSession, user_id: int) -> dict[str, int]:
    """
    Delete all chat sessions (and cascaded messages) for a user.

    Returns a summary containing counts for deleted sessions and messages.
    """
    session_ids_result = await session.execute(
        select(ChatSession.id).where(ChatSession.user_id == user_id)
    )
    session_ids = session_ids_result.scalars().all()

    if not session_ids:
        return {"sessions_deleted": 0, "messages_deleted": 0}

    message_count_result = await session.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.session_id.in_(session_ids))
    )
    messages_deleted = message_count_result.scalar_one() or 0

    delete_result = await session.execute(
        delete(ChatSession).where(ChatSession.id.in_(session_ids))
    )
    sessions_deleted = delete_result.rowcount or 0
    await session.flush()

    return {
        "sessions_deleted": sessions_deleted,
        "messages_deleted": int(messages_deleted),
    }


async def delete_user_account(session: AsyncSession, user_id: int) -> bool:
    """Permanently delete a user and cascade to all related entities."""
    delete_result = await session.execute(delete(User).where(User.id == user_id))
    await session.flush()
    return bool(delete_result.rowcount)


async def export_user_snapshot(session: AsyncSession, user_id: int) -> dict:
    """Collect a snapshot of the user's data for export."""
    user = await session.get(User, user_id)
    if not user:
        raise ResourceNotFoundError(
            f"User not found: {user_id}",
            code="USER_NOT_FOUND",
            details={"user_id": user_id}
        )

    sessions_result = await session.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.asc())
    )
    sessions = sessions_result.scalars().unique().all()

    documents = await get_user_documents(session, user_id=user_id, limit=10_000, offset=0)
    ingestion_runs = await get_user_ingestion_runs(session, user_id=user_id, limit=10_000)
    tool_runs = await get_user_tool_runs(session, user_id=user_id, limit=10_000)

    sessions_payload = []
    for chat_session in sessions:
        messages = sorted(
            chat_session.messages,
            key=lambda message: message.created_at or datetime.now(timezone.utc),
        )
        sessions_payload.append(
            {
                "id": chat_session.id,
                "external_id": chat_session.external_id,
                "title": chat_session.title,
                "model": chat_session.model,
                "enable_tools": chat_session.enable_tools,
                "created_at": chat_session.created_at,
                "updated_at": chat_session.updated_at,
                "message_count": len(messages),
                "messages": [
                    {
                        "id": message.id,
                        "role": message.role,
                        "content": message.content,
                        "tool_call_id": message.tool_call_id,
                        "tool_call_name": message.tool_call_name,
                        "created_at": message.created_at,
                        "tokens_in": message.tokens_in,
                        "tokens_out": message.tokens_out,
                    }
                    for message in messages
                ],
            }
        )

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "created_at": user.created_at,
            "is_root": user.is_root,
        },
        "exported_at": datetime.now(timezone.utc),
        "sessions": sessions_payload,
        "documents": [
            {
                "id": document.id,
                "uri": document.uri,
                "path": document.path,
                "mime": document.mime,
                "bytes_size": document.bytes_size,
                "source": document.source,
                "tags": document.tags,
                "collection": document.collection,
                "path_hash": document.path_hash,
                "created_at": document.created_at,
                "last_ingested_at": document.last_ingested_at,
            }
            for document in documents
        ],
        "ingestion_runs": [
            {
                "id": run.id,
                "target": run.target,
                "from_web": run.from_web,
                "recursive": run.recursive,
                "tags": run.tags,
                "collection": run.collection,
                "totals_files": run.totals_files,
                "totals_chunks": run.totals_chunks,
                "errors": run.errors,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "status": run.status,
            }
            for run in ingestion_runs
        ],
        "tool_runs": [
            {
                "id": tool_run.id,
                "tool_name": tool_run.tool_name,
                "status": tool_run.status,
                "start_ts": tool_run.start_ts,
                "end_ts": tool_run.end_ts,
                "latency_ms": tool_run.latency_ms,
                "args": tool_run.args,
                "error_message": tool_run.error_message,
                "result_preview": tool_run.result_preview,
            }
            for tool_run in tool_runs
        ],
    }


async def upsert_mcp_servers(
    session: AsyncSession, servers: Iterable[tuple[str, str, bool]]
) -> dict[str, MCPServer]:
    """Upsert MCP servers by server_id.

    Args:
        servers: iterable of (server_id, url, healthy)
    Returns: mapping server_id -> MCPServer
    """
    q = select(MCPServer)
    result = await session.execute(q)
    existing = result.scalars().all()
    by_id = {s.server_id: s for s in existing}
    result: dict[str, MCPServer] = {}
    now = datetime.now(timezone.utc)
    for server_id, url, healthy in servers:
        s = by_id.get(server_id)
        if s:
            s.url = url
            s.healthy = healthy
            s.last_seen = now
            result[server_id] = s
        else:
            s = MCPServer(server_id=server_id, url=url, healthy=healthy, last_seen=now)
            session.add(s)
            await session.flush()
            result[server_id] = s
    return result


async def upsert_tools(
    session: AsyncSession,
    server_map: dict[str, MCPServer],
    tools: Iterable[tuple[str, str, str, dict | None]],
) -> None:
    """Upsert tools by (server_id, qualified_name).

    Args:
        server_map: mapping server_id -> MCPServer rows
        tools: iterable of (server_id, qualified_name, description, input_schema)
    """
    # We could optimize by querying by server, but simplicity is fine
    q = select(Tool)
    result = await session.execute(q)
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
            session.add(
                Tool(
                    mcp_server_id=server.id,
                    name=name,
                    description=description,
                    input_schema=schema,
                    last_discovered_at=now,
                )
            )
    await session.flush()


async def get_or_create_session(
    session: AsyncSession,
    *,
    user_id: int,
    external_id: str | None,
    model: str | None,
    enable_tools: bool,
) -> ChatSession:
    if external_id:
        q = select(ChatSession).where(
            ChatSession.user_id == user_id, ChatSession.external_id == external_id
        )
        result = await session.execute(q)
        cs = result.scalar_one_or_none()
        if cs:
            cs.updated_at = datetime.now(timezone.utc)
            cs.model = model or cs.model
            cs.enable_tools = enable_tools
            await session.flush()
            return cs
    cs = ChatSession(
        user_id=user_id, external_id=external_id, model=model, enable_tools=enable_tools
    )
    session.add(cs)
    await session.flush()
    return cs


async def add_message(
    session: AsyncSession,
    *,
    session_id: int,
    role: str,
    content: str,
    tool_call_name: str | None = None,
    tool_call_id: str | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        tool_call_name=tool_call_name,
        tool_call_id=tool_call_id,
    )
    session.add(msg)
    await session.flush()
    return msg


async def start_tool_run(
    session: AsyncSession,
    *,
    user_id: int,
    session_id: int | None,
    message_id: int | None,
    tool_name: str,
    args: dict | None,
    start_ts: datetime,
) -> ToolRun:
    # Try resolve tool_id
    tool_id = None
    try:
        q = select(Tool).where(Tool.name == tool_name)
        result = await session.execute(q)
        t = result.scalar_one_or_none()
        if t:
            tool_id = t.id
    except Exception:
        pass
    tr = ToolRun(
        user_id=user_id,
        session_id=session_id,
        message_id=message_id,
        tool_name=tool_name,
        tool_id=tool_id,
        status="start",
        args=args,
        start_ts=start_ts,
    )
    session.add(tr)
    await session.flush()
    return tr


async def finish_tool_run(
    session: AsyncSession,
    *,
    run_id: int,
    status: str,
    end_ts: datetime,
    latency_ms: int | None,
    result_preview: str | None = None,
    error_message: str | None = None,
    tool_name: str | None = None,
) -> None:
    q = select(ToolRun).where(ToolRun.id == run_id)
    result = await session.execute(q)
    tr = result.scalar_one_or_none()
    if not tr:
        return
    tr.status = status
    tr.end_ts = end_ts
    tr.latency_ms = latency_ms
    tr.result_preview = result_preview
    tr.error_message = error_message
    if tr.tool_id is None and tool_name:
        try:
            q2 = select(Tool).where(Tool.name == tool_name)
            result2 = await session.execute(q2)
            t = result2.scalar_one_or_none()
            if t:
                tr.tool_id = t.id
        except Exception:
            pass
    await session.flush()


async def record_ingestion_run(
    session: AsyncSession,
    *,
    user_id: int,
    target: str,
    from_web: bool,
    recursive: bool,
    tags: list[str] | None,
    collection: str | None,
    totals_files: int,
    totals_chunks: int,
    errors: list[str] | None,
    started_at: datetime,
    finished_at: datetime,
    status: str = "success",
) -> IngestionRun:
    run = IngestionRun(
        user_id=user_id,
        target=target,
        from_web=from_web,
        recursive=recursive,
        tags={"tags": tags or []},
        collection=collection,
        totals_files=totals_files,
        totals_chunks=totals_chunks,
        errors={"errors": errors or []} if errors else None,
        started_at=started_at,
        finished_at=finished_at,
        status=status,
    )
    session.add(run)
    await session.flush()
    return run


async def upsert_document(
    session: AsyncSession,
    *,
    user_id: int,
    path_hash: str,
    uri: str | None,
    path: str | None,
    mime: str | None,
    bytes_size: int | None,
    source: str | None,
    tags: list[str] | None,
    collection: str | None,
) -> Document:
    # Document is unique per user and path_hash
    q = select(Document).where(
        Document.user_id == user_id,
        Document.path_hash == path_hash
    )
    result = await session.execute(q)
    doc = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if doc:
        doc.uri = uri or doc.uri
        doc.path = path or doc.path
        doc.mime = mime or doc.mime
        doc.bytes_size = bytes_size or doc.bytes_size
        doc.source = source or doc.source
        doc.tags = {"tags": tags or []}
        doc.collection = collection or doc.collection
        doc.last_ingested_at = now
        await session.flush()
        return doc
    doc = Document(
        user_id=user_id,
        uri=uri,
        path=path,
        mime=mime,
        bytes_size=bytes_size,
        source=source,
        tags={"tags": tags or []},
        collection=collection,
        path_hash=path_hash,
        last_ingested_at=now,
    )
    session.add(doc)
    await session.flush()
    return doc


async def ensure_collection(session: AsyncSession, name: str) -> DocumentCollection:
    q = select(DocumentCollection).where(DocumentCollection.name == name)
    result = await session.execute(q)
    col = result.scalar_one_or_none()
    if col:
        return col
    col = DocumentCollection(name=name)
    session.add(col)
    await session.flush()
    return col


async def grant_user_collection_access(
    session: AsyncSession, user_id: int, collection_name: str
) -> None:
    col = await ensure_collection(session, collection_name)
    q = select(UserCollectionAccess).where(
        UserCollectionAccess.user_id == user_id, UserCollectionAccess.collection_id == col.id
    )
    result = await session.execute(q)
    uca = result.scalar_one_or_none()
    if not uca:
        session.add(UserCollectionAccess(user_id=user_id, collection_id=col.id))
        await session.flush()


# ==================== READ OPERATIONS ====================


async def get_user_sessions(
    session: AsyncSession, user_id: int, limit: int = 50
) -> list[ChatSession]:
    """Get user's chat sessions ordered by most recent."""
    q = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_session_with_messages(
    session: AsyncSession, session_id: int, user_id: int
) -> ChatSession | None:
    """Get a chat session with all its messages (ordered by created_at via relationship)."""
    from sqlalchemy.orm import joinedload

    q = (
        select(ChatSession)
        .options(joinedload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    result = await session.execute(q)
    # unique() is required for joined eager loads against collections in SQLAlchemy 2.0
    chat_session = result.unique().scalar_one_or_none()
    if not chat_session:
        return None

    return chat_session


async def get_session_tool_runs(
    session: AsyncSession, session_id: int, user_id: int
) -> list[ToolRun]:
    """Get all tool runs for a specific session."""
    q = (
        select(ToolRun)
        .where(ToolRun.session_id == session_id, ToolRun.user_id == user_id)
        .order_by(ToolRun.start_ts)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_user_documents(
    session: AsyncSession,
    user_id: int,
    collection: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Document]:
    """Get user's documents, optionally filtered by collection."""
    query = select(Document).where(Document.user_id == user_id)

    if collection:
        query = query.where(Document.collection == collection)

    query = query.order_by(Document.last_ingested_at.desc()).limit(limit).offset(offset)

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_user_ingestion_runs(
    session: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[IngestionRun]:
    """Get user's ingestion runs ordered by most recent."""
    q = (
        select(IngestionRun)
        .where(IngestionRun.user_id == user_id)
        .order_by(IngestionRun.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_user_tool_runs(
    session: AsyncSession,
    user_id: int,
    limit: int = 100,
    offset: int = 0,
) -> list[ToolRun]:
    """Get user's tool execution logs ordered by most recent."""
    q = (
        select(ToolRun)
        .where(ToolRun.user_id == user_id)
        .order_by(ToolRun.start_ts.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


# ==================== DELETE OPERATIONS ====================


async def delete_session(session: AsyncSession, session_id: int, user_id: int) -> bool:
    """Delete a chat session and all its messages (cascade)."""
    q = select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    result = await session.execute(q)
    chat_session = result.scalar_one_or_none()
    if not chat_session:
        return False

    await session.delete(chat_session)
    await session.flush()
    return True


async def delete_document(session: AsyncSession, document_id: int, user_id: int) -> bool:
    """Delete a document owned by the user."""
    q = select(Document).where(Document.id == document_id, Document.user_id == user_id)
    result = await session.execute(q)
    doc = result.scalar_one_or_none()
    if not doc:
        return False

    await session.delete(doc)
    await session.flush()
    return True


async def delete_document_by_path_hash(session: AsyncSession, path_hash: str) -> bool:
    """Delete a document by its path hash."""
    q = select(Document).where(Document.path_hash == path_hash)
    result = await session.execute(q)
    doc = result.scalar_one_or_none()
    if not doc:
        return False

    await session.delete(doc)
    await session.flush()
    return True


async def delete_ingestion_run(session: AsyncSession, run_id: int, user_id: int) -> bool:
    """Delete an ingestion run record."""
    q = select(IngestionRun).where(IngestionRun.id == run_id, IngestionRun.user_id == user_id)
    result = await session.execute(q)
    run = result.scalar_one_or_none()
    if not run:
        return False

    await session.delete(run)
    await session.flush()
    return True


# ==================== UPDATE OPERATIONS ====================


async def update_session_title(
    session: AsyncSession, session_id: int, user_id: int, title: str
) -> bool:
    """Update a chat session's title."""
    q = select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    result = await session.execute(q)
    chat_session = result.scalar_one_or_none()
    if not chat_session:
        return False

    chat_session.title = title
    chat_session.updated_at = datetime.now(timezone.utc)
    await session.flush()
    return True


# ==================== GROUP OPERATIONS ====================


async def create_group(
    session: AsyncSession, name: str, description: str | None, creator_user_id: int
) -> Group:
    """Create a new group and add the creator as an admin."""
    # Check if group with this name already exists
    existing_group_result = await session.execute(select(Group).where(Group.name == name))
    existing_group = existing_group_result.scalar_one_or_none()

    if existing_group:
        raise ValidationError(
            f"Group with name '{name}' already exists",
            code="GROUP_NAME_EXISTS",
            details={"name": name}
        )

    try:
        # Create the group
        group = Group(
            name=name,
            description=description,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(group)
        await session.flush()

        # Add creator as admin
        membership = UserGroupMembership(
            user_id=creator_user_id,
            group_id=group.id,
            role="admin",
            joined_at=datetime.now(timezone.utc)
        )
        session.add(membership)
        await session.flush()

        logger.info(
            "Group created successfully",
            extra={
                "group_id": group.id,
                "group_name": name,
                "creator_user_id": creator_user_id,
                "operation": "create_group"
            }
        )

        return group
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(
            "Failed to create group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_name": name,
                "creator_user_id": creator_user_id,
                "operation": "create_group"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to create group: {str(e)}",
            details={"operation": "create_group", "name": name}
        ) from e


async def get_group_by_id(session: AsyncSession, group_id: int) -> Group | None:
    """Get a group by its ID."""
    try:
        result = await session.execute(
            select(Group)
            .options(selectinload(Group.members))
            .where(Group.id == group_id)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.error(
            "Failed to fetch group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "operation": "get_group_by_id"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to fetch group: {str(e)}",
            details={"operation": "get_group_by_id", "group_id": group_id}
        ) from e


async def update_group(
    session: AsyncSession, group_id: int, name: str | None, description: str | None
) -> Group:
    """Update a group's name and/or description."""
    group = await session.get(Group, group_id)
    if not group:
        raise ResourceNotFoundError(
            f"Group not found: {group_id}",
            code="GROUP_NOT_FOUND",
            details={"group_id": group_id}
        )

    try:
        if name is not None:
            # Check if another group with this name exists
            existing_group_result = await session.execute(
                select(Group).where(Group.name == name, Group.id != group_id)
            )
            existing_group = existing_group_result.scalar_one_or_none()
            if existing_group:
                raise ValidationError(
                    f"Group with name '{name}' already exists",
                    code="GROUP_NAME_EXISTS",
                    details={"name": name}
                )
            group.name = name

        if description is not None:
            group.description = description

        group.updated_at = datetime.now(timezone.utc)
        await session.flush()

        logger.info(
            "Group updated successfully",
            extra={
                "group_id": group_id,
                "operation": "update_group"
            }
        )

        return group
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(
            "Failed to update group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "operation": "update_group"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to update group: {str(e)}",
            details={"operation": "update_group", "group_id": group_id}
        ) from e


async def delete_group(session: AsyncSession, group_id: int) -> bool:
    """Delete a group."""
    try:
        delete_result = await session.execute(delete(Group).where(Group.id == group_id))
        await session.flush()

        if delete_result.rowcount:
            logger.info(
                "Group deleted successfully",
                extra={"group_id": group_id, "operation": "delete_group"}
            )

        return bool(delete_result.rowcount)
    except Exception as e:
        logger.error(
            "Failed to delete group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "operation": "delete_group"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to delete group: {str(e)}",
            details={"operation": "delete_group", "group_id": group_id}
        ) from e


async def add_user_to_group(
    session: AsyncSession, user_id: int, group_id: int, role: str = "member"
) -> UserGroupMembership:
    """Add a user to a group with a specified role."""
    # Validate role
    if role not in ("member", "admin"):
        raise ValidationError(
            f"Invalid role: {role}. Must be 'member' or 'admin'",
            code="INVALID_ROLE",
            details={"role": role}
        )

    # Check if membership already exists
    existing_membership_result = await session.execute(
        select(UserGroupMembership).where(
            UserGroupMembership.user_id == user_id,
            UserGroupMembership.group_id == group_id
        )
    )
    existing_membership = existing_membership_result.scalar_one_or_none()

    if existing_membership:
        raise ValidationError(
            f"User {user_id} is already a member of group {group_id}",
            code="MEMBERSHIP_EXISTS",
            details={"user_id": user_id, "group_id": group_id}
        )

    try:
        membership = UserGroupMembership(
            user_id=user_id,
            group_id=group_id,
            role=role,
            joined_at=datetime.now(timezone.utc)
        )
        session.add(membership)
        await session.flush()

        logger.info(
            "User added to group",
            extra={
                "user_id": user_id,
                "group_id": group_id,
                "role": role,
                "operation": "add_user_to_group"
            }
        )

        return membership
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(
            "Failed to add user to group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "group_id": group_id,
                "operation": "add_user_to_group"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to add user to group: {str(e)}",
            details={"operation": "add_user_to_group", "user_id": user_id, "group_id": group_id}
        ) from e


async def remove_user_from_group(session: AsyncSession, user_id: int, group_id: int) -> bool:
    """Remove a user from a group."""
    try:
        delete_result = await session.execute(
            delete(UserGroupMembership).where(
                UserGroupMembership.user_id == user_id,
                UserGroupMembership.group_id == group_id
            )
        )
        await session.flush()

        if delete_result.rowcount:
            logger.info(
                "User removed from group",
                extra={
                    "user_id": user_id,
                    "group_id": group_id,
                    "operation": "remove_user_from_group"
                }
            )

        return bool(delete_result.rowcount)
    except Exception as e:
        logger.error(
            "Failed to remove user from group",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "group_id": group_id,
                "operation": "remove_user_from_group"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to remove user from group: {str(e)}",
            details={"operation": "remove_user_from_group", "user_id": user_id, "group_id": group_id}
        ) from e


async def get_user_groups(session: AsyncSession, user_id: int) -> list[Group]:
    """Get all groups a user belongs to."""
    try:
        result = await session.execute(
            select(Group)
            .join(UserGroupMembership)
            .where(UserGroupMembership.user_id == user_id)
            .order_by(Group.created_at.desc())
        )
        return list(result.scalars().all())
    except Exception as e:
        logger.error(
            "Failed to fetch user groups",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "operation": "get_user_groups"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to fetch user groups: {str(e)}",
            details={"operation": "get_user_groups", "user_id": user_id}
        ) from e


async def get_group_members(session: AsyncSession, group_id: int) -> list[UserGroupMembership]:
    """Get all members of a group."""
    try:
        result = await session.execute(
            select(UserGroupMembership)
            .options(selectinload(UserGroupMembership.user))
            .where(UserGroupMembership.group_id == group_id)
            .order_by(UserGroupMembership.joined_at.asc())
        )
        return list(result.scalars().all())
    except Exception as e:
        logger.error(
            "Failed to fetch group members",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "group_id": group_id,
                "operation": "get_group_members"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to fetch group members: {str(e)}",
            details={"operation": "get_group_members", "group_id": group_id}
        ) from e


async def is_group_admin(session: AsyncSession, user_id: int, group_id: int) -> bool:
    """Check if a user is an admin of a group."""
    try:
        result = await session.execute(
            select(UserGroupMembership).where(
                UserGroupMembership.user_id == user_id,
                UserGroupMembership.group_id == group_id,
                UserGroupMembership.role == "admin"
            )
        )
        return result.scalar_one_or_none() is not None
    except Exception as e:
        logger.error(
            "Failed to check group admin status",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "group_id": group_id,
                "operation": "is_group_admin"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to check admin status: {str(e)}",
            details={"operation": "is_group_admin", "user_id": user_id, "group_id": group_id}
        ) from e


async def update_member_role(
    session: AsyncSession, user_id: int, group_id: int, role: str
) -> UserGroupMembership:
    """Update a member's role in a group."""
    # Validate role
    if role not in ("member", "admin"):
        raise ValidationError(
            f"Invalid role: {role}. Must be 'member' or 'admin'",
            code="INVALID_ROLE",
            details={"role": role}
        )

    try:
        result = await session.execute(
            select(UserGroupMembership).where(
                UserGroupMembership.user_id == user_id,
                UserGroupMembership.group_id == group_id
            )
        )
        membership = result.scalar_one_or_none()

        if not membership:
            raise ResourceNotFoundError(
                f"Membership not found for user {user_id} in group {group_id}",
                code="MEMBERSHIP_NOT_FOUND",
                details={"user_id": user_id, "group_id": group_id}
            )

        membership.role = role
        await session.flush()

        logger.info(
            "Member role updated",
            extra={
                "user_id": user_id,
                "group_id": group_id,
                "role": role,
                "operation": "update_member_role"
            }
        )

        return membership
    except (ValidationError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(
            "Failed to update member role",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "group_id": group_id,
                "operation": "update_member_role"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to update member role: {str(e)}",
            details={"operation": "update_member_role", "user_id": user_id, "group_id": group_id}
        ) from e


async def get_user_group_ids(session: AsyncSession, user_id: int) -> list[int]:
    """Get all group IDs a user belongs to (for efficient filtering)."""
    try:
        result = await session.execute(
            select(UserGroupMembership.group_id).where(UserGroupMembership.user_id == user_id)
        )
        return list(result.scalars().all())
    except Exception as e:
        logger.error(
            "Failed to fetch user group IDs",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "operation": "get_user_group_ids"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to fetch user group IDs: {str(e)}",
            details={"operation": "get_user_group_ids", "user_id": user_id}
        ) from e


async def can_user_access_document(session: AsyncSession, user_id: int, document_id: int) -> bool:
    """Check if a user can access a document based on ownership or group membership."""
    try:
        # Get the document
        result = await session.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            return False

        # User owns the document
        if document.user_id == user_id:
            return True

        # Document is private - only owner can access
        if document.is_private:
            return False

        # Document belongs to a group - check if user is a member
        if document.group_id:
            membership_result = await session.execute(
                select(UserGroupMembership).where(
                    UserGroupMembership.user_id == user_id,
                    UserGroupMembership.group_id == document.group_id
                )
            )
            return membership_result.scalar_one_or_none() is not None

        # Document has no group and is not private - not accessible
        return False
    except Exception as e:
        logger.error(
            "Failed to check document access",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "document_id": document_id,
                "operation": "can_user_access_document"
            },
            exc_info=True
        )
        raise DatabaseError(
            f"Failed to check document access: {str(e)}",
            details={"operation": "can_user_access_document", "user_id": user_id, "document_id": document_id}
        ) from e
