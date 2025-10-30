"""Initial migration with current schema

Revision ID: 0001_init
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
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
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('is_root', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('api_key_hash', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_is_root', 'users', ['is_root'])

    # Chat sessions table
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('external_id', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('enable_tools', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_chat_sessions_external_id', 'chat_sessions', ['external_id'])
    op.create_index('ix_chat_sessions_user_created', 'chat_sessions', ['user_id', 'created_at'])

    # Chat messages table (content stored as encrypted binary)
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('content', sa.LargeBinary(), nullable=True),  # Encrypted with Fernet
        sa.Column('tool_call_name', sa.String(length=256), nullable=True),
        sa.Column('tool_call_id', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
    )
    op.create_index('ix_chat_messages_session_created', 'chat_messages', ['session_id', 'created_at'])
    op.create_index('ix_chat_messages_tokens', 'chat_messages', ['session_id', 'tokens_in', 'tokens_out'],
                   postgresql_where=sa.text('tokens_in IS NOT NULL'))
    op.create_index('ix_chat_messages_encrypted', 'chat_messages', ['session_id', 'created_at'],
                   postgresql_where=sa.text('content IS NOT NULL'))

    # MCP servers table
    op.create_table(
        'mcp_servers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('server_id', sa.String(length=64), nullable=False),
        sa.Column('url', sa.String(length=512), nullable=False),
        sa.Column('healthy', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_mcp_servers_server_id', 'mcp_servers', ['server_id'], unique=True)
    op.create_index('ix_mcp_servers_healthy', 'mcp_servers', ['healthy'])

    # Tools table
    op.create_table(
        'tools',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('mcp_server_id', sa.Integer(), sa.ForeignKey('mcp_servers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_discovered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_tools_name', 'tools', ['name'])
    op.create_index('ix_tools_enabled', 'tools', ['enabled'])
    op.create_unique_constraint('uq_tool_server_name', 'tools', ['mcp_server_id', 'name'])

    # Tool runs table
    op.create_table(
        'tool_runs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tool_id', sa.Integer(), sa.ForeignKey('tools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('chat_messages.id', ondelete='CASCADE'), nullable=True),
        sa.Column('tool_name', sa.String(length=256), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('start_ts', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('end_ts', sa.DateTime(timezone=True), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('args', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('result_preview', sa.Text(), nullable=True),
    )
    op.create_index('ix_tool_runs_user_start', 'tool_runs', ['user_id', 'start_ts'])
    op.create_index('ix_tool_runs_tool_start', 'tool_runs', ['tool_name', 'start_ts'])
    op.create_index('ix_tool_runs_analytics', 'tool_runs', ['user_id', 'tool_name', 'status', 'start_ts'])
    op.create_index('ix_tool_runs_message', 'tool_runs', ['message_id', 'start_ts'])

    # Ingestion runs table
    op.create_table(
        'ingestion_runs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target', sa.Text(), nullable=False),
        sa.Column('from_web', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('recursive', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('collection', sa.String(length=128), nullable=True),
        sa.Column('totals_files', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('totals_chunks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('errors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='success'),
    )
    op.create_index('ix_ingestion_runs_user_started', 'ingestion_runs', ['user_id', 'started_at'])

    # Groups table
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_groups_name', 'groups', ['name'], unique=True)
    op.create_index('ix_groups_created_at', 'groups', ['created_at'])

    # User group memberships table
    op.create_table(
        'user_group_memberships',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('idx_user_group_memberships_user_id', 'user_group_memberships', ['user_id'])
    op.create_index('idx_user_group_memberships_group_id', 'user_group_memberships', ['group_id'])
    op.create_index('idx_user_group_memberships_user_group', 'user_group_memberships', ['user_id', 'group_id'])
    op.create_unique_constraint('uq_user_group_membership', 'user_group_memberships', ['user_id', 'group_id'])

    # Audit logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=128), nullable=False),
        sa.Column('resource_type', sa.String(length=64), nullable=True),
        sa.Column('resource_id', sa.String(length=128), nullable=True),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('correlation_id', sa.String(length=36), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_resource_id', 'audit_logs', ['resource_id'])
    op.create_index('ix_audit_logs_correlation_id', 'audit_logs', ['correlation_id'])
    op.create_index('ix_audit_logs_success', 'audit_logs', ['success'])
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('idx_audit_logs_user_timestamp', 'audit_logs', ['user_id', 'timestamp'])
    op.create_index('idx_audit_logs_action_timestamp', 'audit_logs', ['action', 'timestamp'])
    op.create_index('idx_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'])

    # Documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('uri', sa.Text(), nullable=True),
        sa.Column('path', sa.Text(), nullable=True),
        sa.Column('mime', sa.String(length=128), nullable=True),
        sa.Column('bytes_size', sa.BigInteger(), nullable=True),
        sa.Column('source', sa.String(length=32), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('collection', sa.String(length=128), nullable=True),
        sa.Column('path_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
        sa.Column('last_ingested_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_documents_collection_created', 'documents', ['collection', 'created_at'])
    op.create_index('ix_documents_user_created', 'documents', ['user_id', 'created_at'])
    op.create_index('ix_documents_path_hash', 'documents', ['path_hash'])
    op.create_index('idx_documents_group_id', 'documents', ['group_id'])
    op.create_index('idx_documents_is_private', 'documents', ['is_private'])
    op.create_index('idx_documents_group_private', 'documents', ['group_id', 'is_private'])
    op.create_unique_constraint('uq_user_document_path', 'documents', ['user_id', 'path_hash'])

    # User tool access table
    op.create_table(
        'user_tool_access',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tool_id', sa.Integer(), sa.ForeignKey('tools.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_tool', 'user_tool_access', ['user_id', 'tool_id'])

    # Document collections table
    op.create_table(
        'document_collections',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text("timezone('utc', now())")),
    )
    op.create_index('ix_document_collections_name', 'document_collections', ['name'], unique=True)

    # User collection access table
    op.create_table(
        'user_collection_access',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('collection_id', sa.Integer(), sa.ForeignKey('document_collections.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_collection', 'user_collection_access', ['user_id', 'collection_id'])

    # User document access table
    op.create_table(
        'user_document_access',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_unique_constraint('uq_user_document', 'user_document_access', ['user_id', 'document_id'])


def downgrade() -> None:
    op.drop_table('user_document_access')
    op.drop_table('user_collection_access')
    op.drop_table('document_collections')
    op.drop_table('user_tool_access')

    # Drop documents table with new indexes
    op.drop_constraint('uq_user_document_path', 'documents', type_='unique')
    op.drop_index('idx_documents_group_private', table_name='documents')
    op.drop_index('idx_documents_is_private', table_name='documents')
    op.drop_index('idx_documents_group_id', table_name='documents')
    op.drop_index('ix_documents_path_hash', table_name='documents')
    op.drop_index('ix_documents_user_created', table_name='documents')
    op.drop_index('ix_documents_collection_created', table_name='documents')
    op.drop_table('documents')

    # Drop audit logs
    op.drop_index('idx_audit_logs_resource', table_name='audit_logs')
    op.drop_index('idx_audit_logs_action_timestamp', table_name='audit_logs')
    op.drop_index('idx_audit_logs_user_timestamp', table_name='audit_logs')
    op.drop_index('ix_audit_logs_timestamp', table_name='audit_logs')
    op.drop_index('ix_audit_logs_success', table_name='audit_logs')
    op.drop_index('ix_audit_logs_correlation_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_resource_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_resource_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_table('audit_logs')

    # Drop user_group_memberships
    op.drop_constraint('uq_user_group_membership', 'user_group_memberships', type_='unique')
    op.drop_index('idx_user_group_memberships_user_group', table_name='user_group_memberships')
    op.drop_index('idx_user_group_memberships_group_id', table_name='user_group_memberships')
    op.drop_index('idx_user_group_memberships_user_id', table_name='user_group_memberships')
    op.drop_table('user_group_memberships')

    # Drop groups
    op.drop_index('ix_groups_created_at', table_name='groups')
    op.drop_index('ix_groups_name', table_name='groups')
    op.drop_table('groups')
    op.drop_index('ix_ingestion_runs_user_started', table_name='ingestion_runs')
    op.drop_table('ingestion_runs')
    op.drop_index('ix_tool_runs_message', table_name='tool_runs')
    op.drop_index('ix_tool_runs_analytics', table_name='tool_runs')
    op.drop_index('ix_tool_runs_tool_start', table_name='tool_runs')
    op.drop_index('ix_tool_runs_user_start', table_name='tool_runs')
    op.drop_table('tool_runs')
    op.drop_constraint('uq_tool_server_name', 'tools', type_='unique')
    op.drop_index('ix_tools_enabled', table_name='tools')
    op.drop_index('ix_tools_name', table_name='tools')
    op.drop_table('tools')
    op.drop_index('ix_mcp_servers_healthy', table_name='mcp_servers')
    op.drop_index('ix_mcp_servers_server_id', table_name='mcp_servers')
    op.drop_table('mcp_servers')
    op.drop_index('ix_chat_messages_encrypted', table_name='chat_messages')
    op.drop_index('ix_chat_messages_tokens', table_name='chat_messages')
    op.drop_index('ix_chat_messages_session_created', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_sessions_user_created', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_external_id', table_name='chat_sessions')
    op.drop_table('chat_sessions')
    op.drop_index('ix_users_is_root', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')