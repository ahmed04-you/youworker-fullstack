"""
Unit tests for retry patterns with exponential backoff (P1-4).

Tests the async_retry decorator to ensure proper retry behavior
with exponential backoff and configurable settings.
"""
from __future__ import annotations

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock

from packages.common.retry import async_retry
from packages.common.exceptions import ExternalServiceError


class TestRetryDecorator:
    """Test retry decorator with exponential backoff."""

    @pytest.mark.asyncio
    async def test_successful_call_no_retry(self):
        """Test that successful calls don't trigger retries."""
        mock_func = AsyncMock(return_value="success")

        @async_retry(max_attempts=3, base_delay=0.1)
        async def test_func():
            return await mock_func()

        result = await test_func()

        assert result == "success"
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_on_failure_then_success(self):
        """Test retry behavior when function fails then succeeds."""
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("First failure"),
                ExternalServiceError("Second failure"),
                "success"
            ]
        )

        @async_retry(max_attempts=3, base_delay=0.01)
        async def test_func():
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        result = await test_func()

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_max_attempts_exceeded(self):
        """Test that max attempts are respected and exception is raised."""
        mock_func = AsyncMock(
            side_effect=ExternalServiceError("Persistent failure")
        )

        @async_retry(max_attempts=3, base_delay=0.01)
        async def test_func():
            return await mock_func()

        with pytest.raises(ExternalServiceError, match="Persistent failure"):
            await test_func()

        # Should have tried 3 times
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(self):
        """Test that exponential backoff delays increase correctly."""
        call_times = []
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure 1"),
                ExternalServiceError("Failure 2"),
                "success"
            ]
        )

        @async_retry(max_attempts=3, base_delay=0.1, backoff_multiplier=2.0)
        async def test_func():
            import time
            call_times.append(time.time())
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        await test_func()

        # Verify we made 3 calls
        assert len(call_times) == 3

        # Check that delays increased (with some tolerance for timing variance)
        # First retry delay: ~0.1s
        # Second retry delay: ~0.2s (0.1 * 2.0)
        delay_1 = call_times[1] - call_times[0]
        delay_2 = call_times[2] - call_times[1]

        assert 0.08 < delay_1 < 0.15  # Allow 20% variance
        assert 0.15 < delay_2 < 0.25  # Allow 20% variance
        assert delay_2 > delay_1  # Second delay should be longer

    @pytest.mark.asyncio
    async def test_no_retry_on_non_retryable_exception(self):
        """Test that non-retryable exceptions are raised immediately."""
        mock_func = AsyncMock(side_effect=ValueError("Not retryable"))

        @async_retry(
            max_attempts=3,
            base_delay=0.01,
            retryable_exceptions=(ExternalServiceError,)
        )
        async def test_func():
            return await mock_func()

        with pytest.raises(ValueError, match="Not retryable"):
            await test_func()

        # Should only have been called once (no retries)
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_with_jitter(self):
        """Test that jitter adds randomness to delays."""
        call_times = []
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure 1"),
                ExternalServiceError("Failure 2"),
                ExternalServiceError("Failure 3"),
                ExternalServiceError("Failure 4"),
                "success"
            ]
        )

        @async_retry(max_attempts=5, base_delay=0.05, jitter=True)
        async def test_func():
            import time
            call_times.append(time.time())
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        await test_func()

        # Verify delays exist and have some variance (jitter effect)
        delays = [call_times[i] - call_times[i - 1] for i in range(1, len(call_times))]

        # All delays should be positive
        assert all(d > 0 for d in delays)

        # With jitter, delays should not be exactly the same
        # (very unlikely to have all delays identical with random jitter)
        assert len(set(round(d, 3) for d in delays)) > 1

    @pytest.mark.asyncio
    async def test_retry_with_custom_backoff_multiplier(self):
        """Test custom backoff multiplier."""
        call_times = []
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure 1"),
                ExternalServiceError("Failure 2"),
                "success"
            ]
        )

        @async_retry(max_attempts=3, base_delay=0.1, backoff_multiplier=3.0)
        async def test_func():
            import time
            call_times.append(time.time())
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        await test_func()

        # First delay: 0.1s
        # Second delay: 0.3s (0.1 * 3.0)
        delay_1 = call_times[1] - call_times[0]
        delay_2 = call_times[2] - call_times[1]

        # Second delay should be roughly 3x first delay
        assert 2.5 < (delay_2 / delay_1) < 3.5

    @pytest.mark.asyncio
    async def test_retry_logs_attempts(self):
        """Test that retry attempts are logged."""
        from unittest.mock import patch
        import logging

        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure"),
                "success"
            ]
        )

        with patch("packages.common.retry.logger") as mock_logger:
            @async_retry(max_attempts=3, base_delay=0.01)
            async def test_func():
                result = await mock_func()
                if isinstance(result, Exception):
                    raise result
                return result

            await test_func()

            # Verify warning was logged for retry
            assert mock_logger.warning.called

    @pytest.mark.asyncio
    async def test_retry_preserves_exception_details(self):
        """Test that exception details are preserved through retries."""
        original_error = ExternalServiceError(
            "Service unavailable",
            details={"status_code": 503, "service": "ollama"}
        )

        mock_func = AsyncMock(side_effect=original_error)

        @async_retry(max_attempts=2, base_delay=0.01)
        async def test_func():
            return await mock_func()

        with pytest.raises(ExternalServiceError) as exc_info:
            await test_func()

        # Exception details should be preserved
        assert exc_info.value.message == "Service unavailable"
        assert exc_info.value.details == {"status_code": 503, "service": "ollama"}

    @pytest.mark.asyncio
    async def test_zero_delay_retries(self):
        """Test retry with zero delay (immediate retry)."""
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure"),
                "success"
            ]
        )

        @async_retry(max_attempts=2, base_delay=0.0)
        async def test_func():
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        import time
        start = time.time()
        result = await test_func()
        elapsed = time.time() - start

        assert result == "success"
        assert mock_func.call_count == 2
        # Should complete quickly with no delay
        assert elapsed < 0.1

    @pytest.mark.asyncio
    async def test_retry_with_max_delay_cap(self):
        """Test that delays don't exceed a reasonable maximum."""
        call_times = []
        mock_func = AsyncMock(
            side_effect=[
                ExternalServiceError("Failure") for _ in range(10)
            ] + ["success"]
        )

        @async_retry(max_attempts=11, base_delay=0.01, backoff_multiplier=2.0)
        async def test_func():
            import time
            call_times.append(time.time())
            result = await mock_func()
            if isinstance(result, Exception):
                raise result
            return result

        await test_func()

        # Check that delays don't grow unreasonably large
        delays = [call_times[i] - call_times[i - 1] for i in range(1, len(call_times))]

        # Even with many retries, delays should be reasonable
        # With base_delay=0.01 and multiplier=2.0, 10th retry would be 0.01 * 2^9 = 5.12s
        # This is fine for testing, but in production you might want a max cap
        assert all(d < 10.0 for d in delays)
