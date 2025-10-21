from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('is_root', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('api_key_hash', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('external_id', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('enable_tools', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_chat_sessions_external_id', 'chat_sessions', ['external_id'])

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tool_call_name', sa.String(length=256), nullable=True),
        sa.Column('tool_call_id', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
    )
    op.create_index('ix_chat_messages_session_id', 'chat_messages', ['session_id'])
    op.create_index('ix_chat_messages_created_at', 'chat_messages', ['created_at'])

    op.create_table(
        'mcp_servers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('server_id', sa.String(length=64), nullable=False),
        sa.Column('url', sa.String(length=512), nullable=False),
        sa.Column('healthy', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_mcp_servers_server_id', 'mcp_servers', ['server_id'], unique=True)

    op.create_table(
        'tools',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('mcp_server_id', sa.Integer(), sa.ForeignKey('mcp_servers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_discovered_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_tools_name', 'tools', ['name'])
    op.create_unique_constraint('uq_tool_server_name', 'tools', ['mcp_server_id', 'name'])

    op.create_table(
        'tool_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tool_id', sa.Integer(), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tool_name', sa.String(length=256), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('start_ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_ts', sa.DateTime(timezone=True), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('args', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('result_preview', sa.Text(), nullable=True),
    )
    op.create_index('ix_tool_runs_user_id', 'tool_runs', ['user_id'])
    op.create_index('ix_tool_runs_session_id', 'tool_runs', ['session_id'])
    op.create_index('ix_tool_runs_start_ts', 'tool_runs', ['start_ts'])

    op.create_table(
        'ingestion_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target', sa.Text(), nullable=False),
        sa.Column('from_web', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('recursive', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('collection', sa.String(length=128), nullable=True),
        sa.Column('totals_files', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('totals_chunks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('errors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='success'),
    )
    op.create_index('ix_ingestion_runs_started_at', 'ingestion_runs', ['started_at'])

    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('uri', sa.Text(), nullable=True),
        sa.Column('path', sa.Text(), nullable=True),
        sa.Column('mime', sa.String(length=128), nullable=True),
        sa.Column('bytes_size', sa.BigInteger(), nullable=True),
        sa.Column('source', sa.String(length=32), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('collection', sa.String(length=128), nullable=True),
        sa.Column('path_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_ingested_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_documents_path_hash', 'documents', ['path_hash'], unique=True)

    op.create_table(
        'user_tool_access',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tool_id', sa.Integer(), sa.ForeignKey('tools.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_tool', 'user_tool_access', ['user_id', 'tool_id'])

    op.create_table(
        'user_document_access',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_document', 'user_document_access', ['user_id', 'document_id'])


def downgrade() -> None:
    op.drop_table('user_document_access')
    op.drop_table('user_tool_access')
    op.drop_index('ix_documents_path_hash', table_name='documents')
    op.drop_table('documents')
    op.drop_index('ix_ingestion_runs_started_at', table_name='ingestion_runs')
    op.drop_table('ingestion_runs')
    op.drop_index('ix_tool_runs_start_ts', table_name='tool_runs')
    op.drop_index('ix_tool_runs_session_id', table_name='tool_runs')
    op.drop_index('ix_tool_runs_user_id', table_name='tool_runs')
    op.drop_table('tool_runs')
    op.drop_constraint('uq_tool_server_name', 'tools', type_='unique')
    op.drop_index('ix_tools_name', table_name='tools')
    op.drop_table('tools')
    op.drop_index('ix_mcp_servers_server_id', table_name='mcp_servers')
    op.drop_table('mcp_servers')
    op.drop_index('ix_chat_messages_created_at', table_name='chat_messages')
    op.drop_index('ix_chat_messages_session_id', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_sessions_external_id', table_name='chat_sessions')
    op.drop_table('chat_sessions')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')

