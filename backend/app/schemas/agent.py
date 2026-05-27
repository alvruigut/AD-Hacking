from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class ToolRunStatus(StrEnum):
    planned = "planned"
    running = "running"
    completed = "completed"
    failed = "failed"


class AgentPlanRequest(BaseModel):
    scope_cidr: str = Field(description="Authorized network scope, for example 10.10.10.0/24")
    target_mode: str = Field(default="cidr", pattern="^(cidr|ip)$")
    target_ip: str | None = None
    domain: str | None = None
    dns_server: str | None = None
    rate_profile: str = Field(default="balanced", pattern="^(slow|balanced|fast)$")

    @model_validator(mode="after")
    def validate_target(self) -> "AgentPlanRequest":
        if self.target_mode == "ip" and not self.target_ip:
            raise ValueError("target_ip is required when target_mode is ip")
        return self


class AgentCommand(BaseModel):
    phase: str
    tool: str
    command: str
    purpose: str
    expected_output: str


class AgentPlan(BaseModel):
    scope_cidr: str
    target_mode: str = "cidr"
    target: str
    commands: list[AgentCommand]
    safety_notes: list[str]


class ToolRunCreate(BaseModel):
    tool: str
    command: str
    phase: str | None = None
    status: ToolRunStatus = ToolRunStatus.planned
    raw_output: str | None = None
    exit_code: int | None = None
    error: str | None = None


class ToolExecuteRequest(BaseModel):
    command: str
    scope_cidr: str
    phase: str | None = None
    timeout_seconds: int = Field(default=900, ge=5, le=7200)
    auto_ingest: bool = True


class ToolOutput(BaseModel):
    raw_output: str


class ToolRunRead(ToolRunCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HostsEntry(BaseModel):
    ip_address: str
    names: list[str]
