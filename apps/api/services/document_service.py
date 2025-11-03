"""Document management service."""

from __future__ import annotations

import logging

from packages.common.exceptions import ResourceNotFoundError
from packages.db.repositories import DocumentRepository

logger = logging.getLogger(__name__)


class DocumentService:
    """Business logic for document management."""

    def __init__(self, document_repo: DocumentRepository):
        """
        Initialize document service.

        Args:
            document_repo: Document repository
        """
        self.document_repo = document_repo

    async def list_documents(
        self,
        user_id: int,
        collection: str | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> dict:
        """
        List ingested documents for a user.

        Args:
            user_id: User ID
            collection: Optional collection filter
            limit: Maximum number of documents
            offset: Number of documents to skip

        Returns:
            Documents list with metadata
        """
        documents = await self.document_repo.get_user_documents(
            user_id=user_id,
            collection=collection,
            limit=limit,
            offset=offset
        )

        def serialize_tags(doc) -> list[str]:
            tags = []
            for tag in getattr(doc, "tags", []) or []:
                name = getattr(tag, "name", None)
                if isinstance(name, str) and name:
                    tags.append(name)
            return tags

        documents_payload = []
        for d in documents:
            documents_payload.append(
                {
                    "id": d.id,
                    "uri": d.uri,
                    "path": d.path,
                    "mime": d.mime,
                    "bytes_size": d.bytes_size,
                    "source": d.source,
                    "tags": serialize_tags(d),
                    "collection": d.collection,
                    "path_hash": d.path_hash,
                    "created_at": d.created_at.isoformat(),
                    "last_ingested_at": (
                        d.last_ingested_at.isoformat()
                        if d.last_ingested_at
                        else None
                    ),
                }
            )

        return {
            "documents": documents_payload,
            "total": len(documents_payload),
        }

    async def delete_document(
        self,
        document_id: int,
        user_id: int | None = None
    ) -> bool:
        """
        Delete a document from the catalog.

        Note: This only removes the metadata. Vector data in Qdrant
        must be deleted separately.

        Args:
            document_id: Document ID
            user_id: Optional user ID for authorization

        Returns:
            True if deleted

        Raises:
            ResourceNotFoundError: If document not found
        """
        deleted = await self.document_repo.delete_document(
            document_id=document_id,
            user_id=user_id
        )

        if not deleted:
            raise ResourceNotFoundError(
                f"Document not found: {document_id}",
                code="DOCUMENT_NOT_FOUND"
            )

        await self.document_repo.commit()

        logger.info(
            "Document deleted",
            extra={
                "document_id": document_id,
                "user_id": user_id
            }
        )

        return True
