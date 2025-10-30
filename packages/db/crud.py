from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Iterable
import secrets

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
)


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def ensure_root_user(session, *, username: str, api_key: str) -> User:
    # session is already an AsyncSession from the context manager
    import logging

    logger = logging.getLogger(__name__)
    logger.warning(f"Session type: {type(session)}")
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


async def get_user_by_api_key(session: AsyncSession, api_key: str) -> User | None:
    """Return the user matching the provided API key hash, if any."""
    if not api_key:
        return None
    hashed = _hash_api_key(api_key)
    result = await session.execute(select(User).where(User.api_key_hash == hashed))
    return result.scalar_one_or_none()


async def regenerate_user_api_key(session: AsyncSession, user_id: int) -> str:
    """Generate and persist a new API key for the given user."""
    user = await session.get(User, user_id)
    if not user:
        raise ValueError("User not found")
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
        raise ValueError("User not found")

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
            key=lambda message: message.created_at or datetime.utcnow(),
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
        "exported_at": datetime.utcnow(),
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
    now = datetime.utcnow()
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
    now = datetime.utcnow()
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
            cs.updated_at = datetime.utcnow()
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
    path_hash: str,
    uri: str | None,
    path: str | None,
    mime: str | None,
    bytes_size: int | None,
    source: str | None,
    tags: list[str] | None,
    collection: str | None,
) -> Document:
    q = select(Document).where(Document.path_hash == path_hash)
    result = await session.execute(q)
    doc = result.scalar_one_or_none()
    now = datetime.utcnow()
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
    user_id: int | None = None,
    collection: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Document]:
    """Get documents, optionally filtered by collection."""
    query = select(Document).order_by(Document.last_ingested_at.desc())

    if user_id is not None:
        access_exists = await session.execute(
            select(UserDocumentAccess.id)
            .where(UserDocumentAccess.user_id == user_id)
            .limit(1)
        )
        if access_exists.scalar_one_or_none() is not None:
            query = (
                query.join(
                    UserDocumentAccess,
                    UserDocumentAccess.document_id == Document.id,
                )
                .where(UserDocumentAccess.user_id == user_id)
                .distinct()
            )

    if collection:
        query = query.where(Document.collection == collection)

    query = query.limit(limit).offset(offset)

    q = await session.execute(query)
    return list(q.unique().scalars().all())


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


async def delete_document(session: AsyncSession, document_id: int) -> bool:
    """Delete a document from the catalog."""
    q = select(Document).where(Document.id == document_id)
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
    chat_session.updated_at = datetime.utcnow()
    await session.flush()
    return True
