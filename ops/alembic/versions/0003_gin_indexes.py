"""Add GIN indexes on JSONB columns for better query performance.

Revision ID: 0003_gin_indexes
Revises: 0002_collection_acl
Create Date: 2025-10-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_gin_indexes'
down_revision = '0002_collection_acl'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GIN index on documents.tags JSONB for efficient tag queries
    op.execute('CREATE INDEX CONCURRENTLY idx_documents_tags ON documents USING GIN (tags)')


def downgrade() -> None:
    op.execute('DROP INDEX CONCURRENTLY IF EXISTS idx_documents_tags')