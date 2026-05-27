from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.assets import router as assets_router
from app.api.v1.files import router as files_router
from app.api.v1.findings import router as findings_router
from app.api.v1.health import router as health_router
from app.api.v1.terminal import router as terminal_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(findings_router, prefix="/findings", tags=["findings"])
api_router.include_router(assets_router, prefix="/assets", tags=["assets"])
api_router.include_router(files_router, prefix="/files", tags=["files"])
api_router.include_router(agent_router, prefix="/agent", tags=["agent"])
api_router.include_router(terminal_router, prefix="/terminal", tags=["terminal"])
