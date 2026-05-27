from pydantic import BaseModel, Field


class TerminalCommand(BaseModel):
    command: str = Field(min_length=1)
    timeout_seconds: int = Field(default=120, ge=1, le=1800)


class TerminalResult(BaseModel):
    command: str
    cwd: str
    previous_cwd: str
    exit_code: int
    stdout: str
    stderr: str
