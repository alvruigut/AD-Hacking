from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.agent import (
    AgentPlan,
    AgentPlanRequest,
    HostsEntry,
    ToolExecuteRequest,
    ToolOutput,
    ToolRunCreate,
    ToolRunRead,
)
from app.schemas.asset import AssetRead
from app.services.agent_service import agent_service

router = APIRouter()


@router.post("/plan", response_model=AgentPlan)
def build_plan(payload: AgentPlanRequest) -> AgentPlan:
    return agent_service.build_plan(payload)


@router.get("/tool-runs", response_model=list[ToolRunRead])
def list_tool_runs() -> list[ToolRunRead]:
    return agent_service.list_tool_runs()


@router.post("/execute", response_model=ToolRunRead, status_code=status.HTTP_202_ACCEPTED)
def execute_tool(payload: ToolExecuteRequest) -> ToolRunRead:
    try:
        return agent_service.execute(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/tool-runs", response_model=ToolRunRead, status_code=status.HTTP_201_CREATED)
def create_tool_run(payload: ToolRunCreate) -> ToolRunRead:
    return agent_service.create_tool_run(payload)


@router.post("/tool-runs/{tool_run_id}/complete", response_model=ToolRunRead)
def complete_tool_run(tool_run_id: str, payload: ToolOutput) -> ToolRunRead:
    tool_run = agent_service.complete_tool_run(tool_run_id, payload.raw_output)
    if tool_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool run not found")
    return tool_run


@router.post("/ingest/netexec/smb", response_model=list[AssetRead])
def ingest_netexec_smb(payload: ToolOutput) -> list[AssetRead]:
    return agent_service.ingest_netexec_smb(payload.raw_output)


@router.get("/hosts-entries", response_model=list[HostsEntry])
def hosts_entries() -> list[HostsEntry]:
    return agent_service.build_hosts_entries()


@router.get("/hosts-file")
def hosts_file() -> Response:
    lines = [
        f"{entry.ip_address}\t{' '.join(entry.names)}"
        for entry in agent_service.build_hosts_entries()
    ]
    return Response("\n".join(lines) + ("\n" if lines else ""), media_type="text/plain")
