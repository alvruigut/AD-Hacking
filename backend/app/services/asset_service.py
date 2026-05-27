from datetime import datetime, timezone

from app.schemas.asset import AssetCreate, AssetRead


class AssetService:
    def __init__(self) -> None:
        self._assets: dict[str, AssetRead] = {}

    def list(self) -> list[AssetRead]:
        return sorted(self._assets.values(), key=lambda asset: asset.ip_address)

    def upsert(self, payload: AssetCreate) -> AssetRead:
        existing = self._find_by_ip(payload.ip_address)
        if existing is None:
            asset = AssetRead(**payload.model_dump())
            self._assets[asset.id] = asset
            return asset

        merged_ports = sorted(set(existing.open_ports + payload.open_ports))
        merged_services = sorted(set(existing.services + payload.services))
        updated = existing.model_copy(
            update={
                **payload.model_dump(exclude_none=True),
                "open_ports": merged_ports,
                "services": merged_services,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._assets[existing.id] = updated
        return updated

    def _find_by_ip(self, ip_address: str) -> AssetRead | None:
        for asset in self._assets.values():
            if asset.ip_address == ip_address:
                return asset
        return None


asset_service = AssetService()
