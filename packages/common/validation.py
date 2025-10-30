"""Runtime validation decorators for service boundaries."""

import functools
import inspect
from typing import Any, Callable, TypeVar, get_type_hints

from pydantic import ValidationError, validate_call

F = TypeVar("F", bound=Callable[..., Any])


def validate_service_input(func: F) -> F:
    """
    Decorator to validate service method inputs using type hints and Pydantic.

    Validates all arguments against their type annotations at runtime.
    Raises ValidationError if arguments don't match expected types.

    Example:
        @validate_service_input
        async def create_user(self, username: str, age: int) -> User:
            ...
    """
    return validate_call(func)  # type: ignore


def validate_not_empty(*param_names: str) -> Callable[[F], F]:
    """
    Decorator to validate that string parameters are not empty.

    Args:
        *param_names: Names of parameters to validate

    Raises:
        ValueError: If any specified parameter is empty or whitespace-only

    Example:
        @validate_not_empty("username", "email")
        async def create_user(self, username: str, email: str) -> User:
            ...
    """
    def decorator(func: F) -> F:
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            for param_name in param_names:
                if param_name not in bound.arguments:
                    raise ValueError(f"Parameter '{param_name}' not found in function signature")

                value = bound.arguments[param_name]
                if isinstance(value, str) and not value.strip():
                    raise ValueError(f"Parameter '{param_name}' cannot be empty")

            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            for param_name in param_names:
                if param_name not in bound.arguments:
                    raise ValueError(f"Parameter '{param_name}' not found in function signature")

                value = bound.arguments[param_name]
                if isinstance(value, str) and not value.strip():
                    raise ValueError(f"Parameter '{param_name}' cannot be empty")

            return func(*args, **kwargs)

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper  # type: ignore

    return decorator


def validate_positive(*param_names: str) -> Callable[[F], F]:
    """
    Decorator to validate that numeric parameters are positive (> 0).

    Args:
        *param_names: Names of parameters to validate

    Raises:
        ValueError: If any specified parameter is not positive

    Example:
        @validate_positive("user_id", "amount")
        async def transfer(self, user_id: int, amount: float) -> bool:
            ...
    """
    def decorator(func: F) -> F:
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            for param_name in param_names:
                if param_name not in bound.arguments:
                    raise ValueError(f"Parameter '{param_name}' not found in function signature")

                value = bound.arguments[param_name]
                if value is not None and not isinstance(value, bool) and value <= 0:
                    raise ValueError(f"Parameter '{param_name}' must be positive, got: {value}")

            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            for param_name in param_names:
                if param_name not in bound.arguments:
                    raise ValueError(f"Parameter '{param_name}' not found in function signature")

                value = bound.arguments[param_name]
                if value is not None and not isinstance(value, bool) and value <= 0:
                    raise ValueError(f"Parameter '{param_name}' must be positive, got: {value}")

            return func(*args, **kwargs)

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper  # type: ignore

    return decorator


def validate_range(
    param_name: str,
    min_value: float | None = None,
    max_value: float | None = None
) -> Callable[[F], F]:
    """
    Decorator to validate that a numeric parameter is within a specified range.

    Args:
        param_name: Name of parameter to validate
        min_value: Minimum allowed value (inclusive), None for no minimum
        max_value: Maximum allowed value (inclusive), None for no maximum

    Raises:
        ValueError: If parameter is outside specified range

    Example:
        @validate_range("age", min_value=0, max_value=150)
        async def create_user(self, age: int) -> User:
            ...
    """
    def decorator(func: F) -> F:
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            if param_name not in bound.arguments:
                raise ValueError(f"Parameter '{param_name}' not found in function signature")

            value = bound.arguments[param_name]
            if value is not None:
                if min_value is not None and value < min_value:
                    raise ValueError(
                        f"Parameter '{param_name}' must be >= {min_value}, got: {value}"
                    )
                if max_value is not None and value > max_value:
                    raise ValueError(
                        f"Parameter '{param_name}' must be <= {max_value}, got: {value}"
                    )

            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            if param_name not in bound.arguments:
                raise ValueError(f"Parameter '{param_name}' not found in function signature")

            value = bound.arguments[param_name]
            if value is not None:
                if min_value is not None and value < min_value:
                    raise ValueError(
                        f"Parameter '{param_name}' must be >= {min_value}, got: {value}"
                    )
                if max_value is not None and value > max_value:
                    raise ValueError(
                        f"Parameter '{param_name}' must be <= {max_value}, got: {value}"
                    )

            return func(*args, **kwargs)

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper  # type: ignore

    return decorator


def validate_enum(param_name: str, allowed_values: set[Any]) -> Callable[[F], F]:
    """
    Decorator to validate that a parameter is one of allowed values.

    Args:
        param_name: Name of parameter to validate
        allowed_values: Set of allowed values

    Raises:
        ValueError: If parameter is not in allowed values

    Example:
        @validate_enum("status", {"active", "inactive", "pending"})
        async def update_status(self, status: str) -> None:
            ...
    """
    def decorator(func: F) -> F:
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            if param_name not in bound.arguments:
                raise ValueError(f"Parameter '{param_name}' not found in function signature")

            value = bound.arguments[param_name]
            if value not in allowed_values:
                raise ValueError(
                    f"Parameter '{param_name}' must be one of {allowed_values}, got: {value}"
                )

            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            if param_name not in bound.arguments:
                raise ValueError(f"Parameter '{param_name}' not found in function signature")

            value = bound.arguments[param_name]
            if value not in allowed_values:
                raise ValueError(
                    f"Parameter '{param_name}' must be one of {allowed_values}, got: {value}"
                )

            return func(*args, **kwargs)

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper  # type: ignore

    return decorator
