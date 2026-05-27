from subprocess import TimeoutExpired

from fastapi import APIRouter, HTTPException, status

from app.schemas.terminal import TerminalCommand, TerminalResult
from app.services.terminal_service import terminal_service

router = APIRouter()


@router.post("/execute", response_model=TerminalResult)
def execute_terminal_command(payload: TerminalCommand) -> TerminalResult:
    try:
        return terminal_service.execute(payload)
    except TimeoutExpired as exc:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=f"Command timed out after {payload.timeout_seconds} seconds",
        ) from exc
