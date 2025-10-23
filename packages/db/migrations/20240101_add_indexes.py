"""Add indexes for improved database performance."""
from alembic import op
from sqlalchemy import Index


def upgrade():
    """Add indexes for improved query performance."""
    # Index on chat_sessions for user_id and external_id
    op.create_index(
        'ix_chat_sessions_user_id',
        'chat_sessions',
        ['user_id']
    )
    
    op.create_index(
        'ix_chat_sessions_external_id',
        'chat_sessions',
        ['external_id']
    )
    
    # Index on chat_messages for session_id and created_at
    op.create_index(
        'ix_chat_messages_session_id',
        'chat_messages',
        ['session_id']
    )
    
    op.create_index(
        'ix_chat_messages_created_at',
        'chat_messages',
        ['created_at']
    )
    
    # Index on tool_runs for user_id and start_ts
    op.create_index(
        'ix_tool_runs_user_id',
        'tool_runs',
        ['user_id']
    )
    
    op.create_index(
        'ix_tool_runs_start_ts',
        'tool_runs',
        ['start_ts']
    )
    
    # Index on documents for path_hash and last_ingested_at
    op.create_index(
        'ix_documents_path_hash',
        'documents',
        ['path_hash']
    )
    
    op.create_index(
        'ix_documents_last_ingested_at',
        'documents',
        ['last_ingested_at']
    )
    
    # Index on ingestion_runs for user_id and started_at
    op.create_index(
        'ix_ingestion_runs_user_id',
        'ingestion_runs',
        ['user_id']
    )
    
    op.create_index(
        'ix_ingestion_runs_started_at',
        'ingestion_runs',
        ['started_at']
    )


def downgrade():
    """Remove indexes."""
    # Drop indexes
    op.drop_index('ix_chat_sessions_user_id', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_external_id', table_name='chat_sessions')
    op.drop_index('ix_chat_messages_session_id', table_name='chat_messages')
    op.drop_index('ix_chat_messages_created_at', table_name='chat_messages')
    op.drop_index('ix_tool_runs_user_id', table_name='tool_runs')
    op.drop_index('ix_tool_runs_start_ts', table_name='tool_runs')
    op.drop_index('ix_documents_path_hash', table_name='documents')
    op.drop_index('ix_documents_last_ingested_at', table_name='documents')
    op.drop_index('ix_ingestion_runs_user_id', table_name='ingestion_runs')
    op.drop_index('ix_ingestion_runs_started_at', table_name='ingestion_runs')