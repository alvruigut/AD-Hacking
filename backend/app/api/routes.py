from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.assets import router as assets_router
from app.api.v1.findings import router as findings_router
from app.api.v1.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(findings_router, prefix="/findings", tags=["findings"])
api_router.include_router(assets_router, prefix="/assets", tags=["assets"])
api_router.include_router(agent_router, prefix="/agent", tags=["agent"])
