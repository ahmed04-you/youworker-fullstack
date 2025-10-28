"""
Unit tests for security utilities.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock

from apps.api.auth.security import (
    create_access_token,
    verify_api_key,
    sanitize_input,
    validate_file_path,
)


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = Mock()
    settings.root_api_key = "test-api-key"
    settings.ingest_upload_root = "/data/uploads"
    return settings


def test_create_access_token():
    """Test JWT token creation."""
    with patch('apps.api.auth.security.settings') as mock_settings:
        mock_settings.root_api_key = "test-secret"
        mock_settings.jwt_secret = "test-jwt"
        
        data = {"sub": "test_user"}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)


@pytest.mark.asyncio
async def test_verify_api_key_success(mock_settings):
    """Test successful API key verification when user hash matches."""
    session = AsyncMock()
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=None)
    session.execute = AsyncMock(return_value=execute_result)

    context_manager = AsyncMock()
    context_manager.__aenter__.return_value = session
    context_manager.__aexit__.return_value = False

    mock_user = object()
    mock_get_user = AsyncMock(return_value=mock_user)

    with patch('apps.api.auth.security.settings', mock_settings), \
         patch('apps.api.auth.security.get_async_session', return_value=context_manager), \
         patch('apps.api.auth.security.get_user_by_api_key', mock_get_user):
        assert await verify_api_key("test-api-key") is True
        mock_get_user.assert_awaited_once_with(session, "test-api-key")


@pytest.mark.asyncio
async def test_verify_api_key_failure(mock_settings):
    """Test failed API key verification when hash exists but does not match."""
    session = AsyncMock()
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value="stored-hash")
    session.execute = AsyncMock(return_value=execute_result)

    context_manager = AsyncMock()
    context_manager.__aenter__.return_value = session
    context_manager.__aexit__.return_value = False

    mock_get_user = AsyncMock(return_value=None)

    with patch('apps.api.auth.security.settings', mock_settings), \
         patch('apps.api.auth.security.get_async_session', return_value=context_manager), \
         patch('apps.api.auth.security.get_user_by_api_key', mock_get_user):
        assert await verify_api_key("wrong-key") is False
        mock_get_user.assert_awaited_once_with(session, "wrong-key")


@pytest.mark.asyncio
async def test_verify_api_key_fallback_to_root(mock_settings):
    """Test fallback to root API key when no stored hash exists yet."""
    session = AsyncMock()
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=None)
    session.execute = AsyncMock(return_value=execute_result)

    context_manager = AsyncMock()
    context_manager.__aenter__.return_value = session
    context_manager.__aexit__.return_value = False

    mock_get_user = AsyncMock(return_value=None)

    with patch('apps.api.auth.security.settings', mock_settings), \
         patch('apps.api.auth.security.get_async_session', return_value=context_manager), \
         patch('apps.api.auth.security.get_user_by_api_key', mock_get_user):
        assert await verify_api_key("test-api-key") is True
        mock_get_user.assert_awaited_once_with(session, "test-api-key")


@pytest.mark.asyncio
async def test_verify_api_key_empty(mock_settings):
    """Ensure empty or missing API keys return False."""
    session = AsyncMock()
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=None)
    session.execute = AsyncMock(return_value=execute_result)

    context_manager = AsyncMock()
    context_manager.__aenter__.return_value = session
    context_manager.__aexit__.return_value = False

    mock_get_user = AsyncMock(return_value=None)

    with patch('apps.api.auth.security.settings', mock_settings), \
         patch('apps.api.auth.security.get_async_session', return_value=context_manager), \
         patch('apps.api.auth.security.get_user_by_api_key', mock_get_user):
        assert await verify_api_key("") is False
        assert await verify_api_key(None) is False  # type: ignore[arg-type]
        mock_get_user.assert_not_awaited()


def test_sanitize_input():
    """Test input sanitization."""
    # Test normal input
    assert sanitize_input("Hello world") == "Hello world"
    
    # Test with dangerous characters
    assert sanitize_input("Hello <script>alert('xss')</script>") == "Hello"
    
    # Test with max length
    long_input = "a" * 100
    assert sanitize_input(long_input, max_length=50) == "a" * 50
    
    # Test empty input
    assert sanitize_input("") == ""
    assert sanitize_input(None) == ""  # type: ignore


def test_validate_file_path_success(mock_settings):
    """Test successful file path validation."""
    with patch('apps.api.auth.security.settings', mock_settings):
        # Test valid paths within allowed directories
        assert validate_file_path("/data/uploads/test.txt") is True
        assert validate_file_path("/data/uploads/subdir/file.txt") is True


def test_validate_file_path_failure(mock_settings):
    """Test failed file path validation."""
    with patch('apps.api.auth.security.settings', mock_settings):
        # Test directory traversal attempts
        assert validate_file_path("/data/uploads/../../../etc/passwd") is False
        assert validate_file_path("/data/uploads/../etc/passwd") is False
        
        # Test paths outside allowed directories
        assert validate_file_path("/data/examples/doc.pdf") is False
        assert validate_file_path("/tmp/test.txt") is False
        assert validate_file_path("/etc/config") is False
        
        # Test empty paths
        assert validate_file_path("") is False
        assert validate_file_path(None) is False  # type: ignore
