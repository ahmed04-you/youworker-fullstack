from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_collection_acl'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'document_collections',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_document_collections_name', 'document_collections', ['name'], unique=True)

    op.create_table(
        'user_collection_access',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('collection_id', sa.Integer(), sa.ForeignKey('document_collections.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_collection', 'user_collection_access', ['user_id', 'collection_id'])

    # Drop per-document access table
    op.drop_constraint('uq_user_document', 'user_document_access', type_='unique')
    op.drop_table('user_document_access')


def downgrade() -> None:
    # Recreate old table
    op.create_table(
        'user_document_access',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_document', 'user_document_access', ['user_id', 'document_id'])

    op.drop_constraint('uq_user_collection', 'user_collection_access', type_='unique')
    op.drop_table('user_collection_access')
    op.drop_index('ix_document_collections_name', table_name='document_collections')
    op.drop_table('document_collections')

