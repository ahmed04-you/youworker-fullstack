from .session import init_db, get_async_session
from .models import (
    Base,
    User,
    Group,
    ChatSession,
    ChatMessage,
    MCPServer,
    Tool,
    ToolRun,
    IngestionRun,
    Document,
    Tag,
    DocumentTag,
    IngestionRunTag,
    UserToolAccess,
    DocumentCollection,
    UserCollectionAccess,
    UserDocumentAccess,
    AuditLog,
)

# New repository pattern - recommended for new code
from .repositories import (
    BaseRepository,
    UserRepository,
    GroupRepository,
    ChatRepository,
    DocumentRepository,
    ToolRepository,
)

# Backward compatibility - CRUD functions
from .crud import (
    ensure_root_user,
    get_user_by_api_key,
    regenerate_user_api_key,
    clear_user_history,
    delete_user_account,
    export_user_snapshot,
)

__all__ = [
    "init_db",
    "get_async_session",
    "Base",
    "User",
    "Group",
    "ChatSession",
    "ChatMessage",
    "MCPServer",
    "Tool",
    "ToolRun",
    "IngestionRun",
    "Document",
    "Tag",
    "DocumentTag",
    "IngestionRunTag",
    "UserToolAccess",
    "DocumentCollection",
    "UserCollectionAccess",
    "UserDocumentAccess",
    "AuditLog",
    # Repositories (NEW - use these for new code)
    "BaseRepository",
    "UserRepository",
    "GroupRepository",
    "ChatRepository",
    "DocumentRepository",
    "ToolRepository",
    # CRUD functions (backward compatibility)
    "ensure_root_user",
    "get_user_by_api_key",
    "regenerate_user_api_key",
    "clear_user_history",
    "delete_user_account",
    "export_user_snapshot",
]
