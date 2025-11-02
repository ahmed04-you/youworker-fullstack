"""Smoke tests for settings configuration."""

from packages.common.settings import Settings


def test_settings_load_env_file():
    """Settings should pick up secrets from the .env file."""
    settings = Settings()
    # The .env file contains a long deterministic root API key used for dev SSO.
    assert settings.root_api_key == (
        "9ffe785f8534d5b6478a9261d66f3784b9498db3b74bc8e5172be157c2548391"
    )
    assert settings.authentik_enabled is True
