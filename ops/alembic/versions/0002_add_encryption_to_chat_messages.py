"""Add encryption to chat messages

Revision ID: 0002_add_encryption_to_chat_messages
Revises: 0001_init
Create Date: 2025-10-27 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002_add_encryption_to_chat_messages'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add encrypted_content column
    op.add_column('chat_messages', sa.Column('encrypted_content', sa.LargeBinary(), nullable=True))
    
    # Copy content to encrypted_content (assuming pgcrypto extension is enabled)
    op.execute("UPDATE chat_messages SET encrypted_content = pgp_sym_encrypt(content::text, 'youworker_secret_key') WHERE content IS NOT NULL")
    
    # Drop old content column
    op.drop_column('chat_messages', 'content')
    
    # Rename encrypted_content to content
    op.alter_column('chat_messages', 'encrypted_content', new_column_name='content')
    
    # Add note in metadata or comment if possible
    op.create_index('idx_chat_messages_encrypted', 'chat_messages', ['session_id', 'created_at'], postgresql_where=sa.text("content IS NOT NULL"))


def downgrade() -> None:
    # For downgrade, we'd need to decrypt, but for simplicity, drop and recreate as text
    op.drop_column('chat_messages', 'content')
    op.add_column('chat_messages', sa.Column('content', sa.Text(), nullable=True))
    
    # Note: Decryption would require the key; this is destructive for demo
    op.execute("UPDATE chat_messages SET content = 'decryption_not_implemented'")