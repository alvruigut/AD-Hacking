from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class AssetKind(StrEnum):
    domain_controller = "domain_controller"
    server = "server"
    workstation = "workstation"
    unknown = "unknown"


class AssetCreate(BaseModel):
    ip_address: str
    hostname: str | None = None
    domain: str | None = None
    kind: AssetKind = AssetKind.unknown
    open_ports: list[int] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)
    port_details: list[dict[str, str | int | list[str]]] = Field(default_factory=list)
    source_tool: str | None = None
    notes: str | None = None


class AssetRead(AssetCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
