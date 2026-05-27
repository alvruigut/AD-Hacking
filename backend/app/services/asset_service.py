from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.asset import AssetCreate, AssetRead
from app.services.json_store import json_store


class AssetService:
    def __init__(self) -> None:
        self._assets: dict[str, AssetRead] = {
            asset.id: asset
            for asset in [
                AssetRead.model_validate(item)
                for item in json_store.read().get("assets", [])
            ]
        }

    def list(self) -> list[AssetRead]:
        return sorted(self._assets.values(), key=lambda asset: asset.ip_address)

    def upsert(self, payload: AssetCreate) -> AssetRead:
        existing = self._find_by_ip(payload.ip_address)
        if existing is None:
            asset = AssetRead(**payload.model_dump())
            self._assets[asset.id] = asset
            self._save()
            return asset

        merged_ports = sorted(set(existing.open_ports + payload.open_ports))
        merged_services = sorted(set(existing.services + payload.services))
        merged_port_details = self._merge_port_details(existing.port_details, payload.port_details)
        merged_shares = self._merge_shares(existing.shares, payload.shares)
        updated = existing.model_copy(
            update={
                **payload.model_dump(exclude_none=True),
                "open_ports": merged_ports,
                "services": merged_services,
                "port_details": merged_port_details,
                "shares": merged_shares,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._assets[existing.id] = updated
        self._save()
        return updated

    def update(self, asset_id: str, payload: AssetCreate) -> AssetRead | None:
        asset = self._assets.get(asset_id)
        if asset is None:
            return None
        updated = asset.model_copy(
            update={
                **payload.model_dump(),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._assets[asset_id] = updated
        self._save()
        return updated

    def delete(self, asset_id: str) -> bool:
        deleted = self._assets.pop(asset_id, None) is not None
        if deleted:
            self._save()
        return deleted

    def _find_by_ip(self, ip_address: str) -> AssetRead | None:
        for asset in self._assets.values():
            if asset.ip_address == ip_address:
                return asset
        return None

    def _merge_port_details(
        self,
        current_details: list[dict[str, str | int | list[str]]],
        next_details: list[dict[str, str | int | list[str]]],
    ) -> list[dict[str, str | int | list[str]]]:
        merged: dict[str, dict[str, str | int | list[str]]] = {}
        for detail in current_details + next_details:
            port = detail.get("port")
            protocol = detail.get("protocol", "tcp")
            if port is None:
                continue
            merged[f"{port}/{protocol}"] = detail
        return sorted(merged.values(), key=lambda item: int(item.get("port", 0)))

    def _merge_shares(
        self,
        current_shares: list[dict[str, str]],
        next_shares: list[dict[str, str]],
    ) -> list[dict[str, str]]:
        merged: dict[str, dict[str, str]] = {}
        for share in current_shares + next_shares:
            name = share.get("name", "").strip()
            if not name:
                continue
            account = share.get("account", "").strip()
            key = f"{name.lower()}::{account.lower()}"
            merged[key] = {**merged.get(key, {}), **share, "name": name}
        return sorted(merged.values(), key=lambda item: (item.get("name", ""), item.get("account", "")))

    def _save(self) -> None:
        json_store.write_section(
            "assets",
            [asset.model_dump(mode="json") for asset in self._assets.values()],
        )


asset_service = AssetService()
