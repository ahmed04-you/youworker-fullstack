"""
Unit tests for security utilities.
"""
import pytest
from unittest.mock import Mock, patch

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


def test_verify_api_key_success(mock_settings):
    """Test successful API key verification."""
    with patch('apps.api.auth.security.settings', mock_settings):
        assert verify_api_key("test-api-key") is True


def test_verify_api_key_failure(mock_settings):
    """Test failed API key verification."""
    with patch('apps.api.auth.security.settings', mock_settings):
        assert verify_api_key("wrong-key") is False
        assert verify_api_key("") is False
        assert verify_api_key(None) is False  # type: ignore


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
