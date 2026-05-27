from fastapi import APIRouter, HTTPException, status

from app.schemas.asset import AssetCreate, AssetRead
from app.services.asset_service import asset_service

router = APIRouter()


@router.get("", response_model=list[AssetRead])
def list_assets() -> list[AssetRead]:
    return asset_service.list()


@router.post("", response_model=AssetRead)
def upsert_asset(payload: AssetCreate) -> AssetRead:
    return asset_service.upsert(payload)


@router.put("/{asset_id}", response_model=AssetRead)
def update_asset(asset_id: str, payload: AssetCreate) -> AssetRead:
    asset = asset_service.update(asset_id, payload)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: str) -> None:
    deleted = asset_service.delete(asset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
