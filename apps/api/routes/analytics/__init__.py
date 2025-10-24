"""
Analytics API routes split into focused modules.
"""

from fastapi import APIRouter

from .overview import router as overview_router
from .tokens import router as tokens_router
from .tools import router as tools_router
from .ingestion import router as ingestion_router
from .sessions import router as sessions_router

# Main analytics router that combines all sub-routers
router = APIRouter(prefix="/v1/analytics")

# Include all sub-routers
router.include_router(overview_router, tags=["analytics"])
router.include_router(tokens_router, tags=["analytics"])
router.include_router(tools_router, tags=["analytics"])
router.include_router(ingestion_router, tags=["analytics"])
router.include_router(sessions_router, tags=["analytics"])

__all__ = ["router"]
