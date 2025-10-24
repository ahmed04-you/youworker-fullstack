"""
Chat API routes split into focused modules.
"""

from fastapi import APIRouter

from .streaming import router as streaming_router
from .voice import router as voice_router
from .unified import router as unified_router

# Main chat router that combines all sub-routers
router = APIRouter(prefix="/v1")

# Include all sub-routers
router.include_router(streaming_router, tags=["chat"])
router.include_router(voice_router, tags=["voice"])
router.include_router(unified_router, tags=["chat"])

__all__ = ["router"]
