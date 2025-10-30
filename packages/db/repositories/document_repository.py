"""Repository for document-related database operations."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Document, DocumentCollection, UserCollectionAccess
from .base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    """Repository for document-related database operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize document repository.

        Args:
            session: Database session
        """
        super().__init__(session, Document)

    async def get_user_documents(
        self,
        user_id: int,
        collection: str | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[Document]:
        """
        Get documents for a user, optionally filtered by collection.

        Args:
            user_id: User ID
            collection: Optional collection filter
            limit: Maximum number of documents
            offset: Number of documents to skip

        Returns:
            List of documents
        """
        query = select(Document).where(Document.user_id == user_id)

        if collection:
            query = query.where(Document.collection == collection)

        result = await self.session.execute(
            query
            .order_by(Document.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def upsert_document(
        self,
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
        """
        Upsert a document by user_id and path_hash.

        Args:
            user_id: User ID
            path_hash: Unique path hash
            uri: Document URI
            path: Document path
            mime: MIME type
            bytes_size: Document size in bytes
            source: Document source
            tags: Document tags
            collection: Collection name

        Returns:
            Upserted document
        """
        q = select(Document).where(
            Document.user_id == user_id,
            Document.path_hash == path_hash
        )
        result = await self.session.execute(q)
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
            await self.session.flush()
            return doc
        else:
            doc = Document(
                user_id=user_id,
                path_hash=path_hash,
                uri=uri,
                path=path,
                mime=mime,
                bytes_size=bytes_size,
                source=source,
                tags={"tags": tags or []},
                collection=collection,
                last_ingested_at=now,
            )
            self.session.add(doc)
            await self.session.flush()
            return doc

    async def delete_document(
        self,
        document_id: int,
        user_id: int | None = None
    ) -> bool:
        """
        Delete a document.

        Args:
            document_id: Document ID
            user_id: Optional user ID for authorization

        Returns:
            True if deleted, False if not found
        """
        query = delete(Document).where(Document.id == document_id)

        if user_id is not None:
            query = query.where(Document.user_id == user_id)

        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount > 0

    async def delete_document_by_path_hash(self, path_hash: str) -> bool:
        """
        Delete a document by its path hash.

        Args:
            path_hash: Document path hash

        Returns:
            True if deleted, False if not found
        """
        q = select(Document).where(Document.path_hash == path_hash)
        result = await self.session.execute(q)
        doc = result.scalar_one_or_none()
        if not doc:
            return False

        await self.session.delete(doc)
        await self.session.flush()
        return True

    async def ensure_collection(self, name: str) -> DocumentCollection:
        """
        Ensure a collection exists, creating it if necessary.

        Args:
            name: Collection name

        Returns:
            Document collection
        """
        q = select(DocumentCollection).where(DocumentCollection.name == name)
        result = await self.session.execute(q)
        col = result.scalar_one_or_none()
        if col:
            return col

        col = DocumentCollection(name=name)
        self.session.add(col)
        await self.session.flush()
        return col

    async def grant_user_collection_access(
        self,
        user_id: int,
        collection_name: str
    ) -> None:
        """
        Grant a user access to a collection.

        Args:
            user_id: User ID
            collection_name: Collection name
        """
        col = await self.ensure_collection(collection_name)
        q = select(UserCollectionAccess).where(
            UserCollectionAccess.user_id == user_id,
            UserCollectionAccess.collection_id == col.id
        )
        result = await self.session.execute(q)
        uca = result.scalar_one_or_none()
        if not uca:
            self.session.add(
                UserCollectionAccess(user_id=user_id, collection_id=col.id)
            )
            await self.session.flush()
