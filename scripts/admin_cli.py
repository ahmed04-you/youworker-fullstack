#!/usr/bin/env python3
"""
Administrative CLI tool for YouWorker platform.

Provides commands for user management, database operations, and system administration.

Usage:
    python scripts/admin_cli.py --help
    python scripts/admin_cli.py user list
    python scripts/admin_cli.py user create --username admin --is-root
    python scripts/admin_cli.py user reset-api-key --user-id 1
    python scripts/admin_cli.py db health
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import typer
from rich.console import Console
from rich.table import Table

from packages.common import get_settings
from packages.db.crud import (
    create_user,
    get_all_users,
    get_user_by_id,
    regenerate_user_api_key,
)
from packages.db.session import init_db, get_async_session

app = typer.Typer(
    name="admin",
    help="YouWorker Administration CLI",
    add_completion=False,
)
user_app = typer.Typer(help="User management commands")
db_app = typer.Typer(help="Database management commands")
app.add_typer(user_app, name="user")
app.add_typer(db_app, name="db")

console = Console()


def run_async(coro):
    """Helper to run async functions in sync context."""
    return asyncio.run(coro)


@user_app.command("list")
def list_users():
    """List all users in the system."""

    async def _list_users():
        settings = get_settings()
        await init_db(settings)

        async with get_async_session() as db:
            users = await get_all_users(db)

        table = Table(title="Users")
        table.add_column("ID", style="cyan")
        table.add_column("Username", style="green")
        table.add_column("Is Root", style="yellow")
        table.add_column("Created At", style="blue")

        for user in users:
            table.add_row(
                str(user.id),
                user.username,
                "Yes" if user.is_root else "No",
                user.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            )

        console.print(table)
        console.print(f"\n[bold]Total users:[/bold] {len(users)}")

    run_async(_list_users())


@user_app.command("create")
def create_user_cmd(
    username: str = typer.Option(..., "--username", "-u", help="Username for the new user"),
    is_root: bool = typer.Option(False, "--is-root", help="Create user with root privileges"),
):
    """Create a new user."""

    async def _create_user():
        settings = get_settings()
        await init_db(settings)

        async with get_async_session() as db:
            # Generate API key
            import secrets
            api_key = secrets.token_urlsafe(32)

            user = await create_user(
                db,
                username=username,
                api_key=api_key,
                is_root=is_root,
            )

        console.print(f"\n[green]✓[/green] User created successfully!")
        console.print(f"  [bold]ID:[/bold] {user.id}")
        console.print(f"  [bold]Username:[/bold] {user.username}")
        console.print(f"  [bold]Is Root:[/bold] {user.is_root}")
        console.print(f"  [bold]API Key:[/bold] {api_key}")
        console.print(
            "\n[yellow]⚠[/yellow]  [bold]Save the API key![/bold] It cannot be retrieved later."
        )

    run_async(_create_user())


@user_app.command("info")
def user_info(
    user_id: int = typer.Argument(..., help="User ID to retrieve information for"),
):
    """Get detailed information about a user."""

    async def _user_info():
        settings = get_settings()
        await init_db(settings)

        async with get_async_session() as db:
            user = await get_user_by_id(db, user_id=user_id)

        if not user:
            console.print(f"[red]✗[/red] User with ID {user_id} not found")
            raise typer.Exit(1)

        console.print("\n[bold]User Information[/bold]")
        console.print(f"  [bold]ID:[/bold] {user.id}")
        console.print(f"  [bold]Username:[/bold] {user.username}")
        console.print(f"  [bold]Is Root:[/bold] {user.is_root}")
        console.print(f"  [bold]Created At:[/bold] {user.created_at}")
        console.print(f"  [bold]Updated At:[/bold] {user.updated_at}")

    run_async(_user_info())


@user_app.command("reset-api-key")
def reset_api_key(
    user_id: int = typer.Argument(..., help="User ID to reset API key for"),
):
    """Reset a user's API key."""

    async def _reset_api_key():
        settings = get_settings()
        await init_db(settings)

        async with get_async_session() as db:
            user = await get_user_by_id(db, user_id=user_id)
            if not user:
                console.print(f"[red]✗[/red] User with ID {user_id} not found")
                raise typer.Exit(1)

            new_key = await regenerate_user_api_key(db, user_id=user_id)

        console.print(f"\n[green]✓[/green] API key reset successfully!")
        console.print(f"  [bold]User:[/bold] {user.username}")
        console.print(f"  [bold]New API Key:[/bold] {new_key}")
        console.print(
            "\n[yellow]⚠[/yellow]  [bold]Save the API key![/bold] It cannot be retrieved later."
        )

    run_async(_reset_api_key())


@db_app.command("health")
def db_health():
    """Check database health and connection status."""

    async def _db_health():
        from packages.common.health import check_postgres_health, check_qdrant_health

        settings = get_settings()
        await init_db(settings)

        console.print("\n[bold]Database Health Check[/bold]\n")

        # Check PostgreSQL
        pg_result = await check_postgres_health()
        status_color = (
            "green"
            if pg_result.status.value == "healthy"
            else "yellow" if pg_result.status.value == "degraded" else "red"
        )
        console.print(
            f"  PostgreSQL: [{status_color}]{pg_result.status.value.upper()}[/{status_color}]"
        )
        console.print(f"    Message: {pg_result.message}")
        if pg_result.latency_ms:
            console.print(f"    Latency: {pg_result.latency_ms}ms")

        # Check Qdrant
        qdrant_result = await check_qdrant_health()
        status_color = (
            "green"
            if qdrant_result.status.value == "healthy"
            else "yellow" if qdrant_result.status.value == "degraded" else "red"
        )
        console.print(
            f"\n  Qdrant: [{status_color}]{qdrant_result.status.value.upper()}[/{status_color}]"
        )
        console.print(f"    Message: {qdrant_result.message}")
        if qdrant_result.latency_ms:
            console.print(f"    Latency: {qdrant_result.latency_ms}ms")
        if qdrant_result.details:
            console.print(f"    Details: {qdrant_result.details}")

    run_async(_db_health())


@db_app.command("info")
def db_info():
    """Display database connection information."""
    settings = get_settings()

    console.print("\n[bold]Database Configuration[/bold]")
    console.print(f"  [bold]URL:[/bold] {settings.database_url}")
    console.print(f"  [bold]Echo SQL:[/bold] {settings.db_echo}")
    console.print(f"  [bold]Pool Size:[/bold] {settings.db_pool_size}")
    console.print(f"  [bold]Max Overflow:[/bold] {settings.db_max_overflow}")
    console.print(f"  [bold]Pool Timeout:[/bold] {settings.db_pool_timeout}s")
    console.print(f"  [bold]Pool Recycle:[/bold] {settings.db_pool_recycle}s")
    console.print(f"  [bold]Pre-ping:[/bold] {settings.db_pool_pre_ping}")


@app.command("version")
def version():
    """Show version information."""
    console.print("\n[bold]YouWorker Administration CLI[/bold]")
    console.print("Version: 1.0.0")
    console.print("Environment: development")


if __name__ == "__main__":
    app()
