from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class Severity(StrEnum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class FindingStatus(StrEnum):
    new = "new"
    confirmed = "confirmed"
    false_positive = "false_positive"
    accepted_risk = "accepted_risk"
    fixed = "fixed"


class FindingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=3)
    severity: Severity = Severity.medium
    affected_entities: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    source_tool: str | None = None
    recommendation: str | None = None


class FindingRead(FindingCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: FindingStatus = FindingStatus.new
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
