from fastapi import APIRouter

from app.schemas.asset import AssetCreate, AssetRead
from app.services.asset_service import asset_service

router = APIRouter()


@router.get("", response_model=list[AssetRead])
def list_assets() -> list[AssetRead]:
    return asset_service.list()


@router.post("", response_model=AssetRead)
def upsert_asset(payload: AssetCreate) -> AssetRead:
    return asset_service.upsert(payload)
