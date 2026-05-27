from pathlib import Path
import shlex
import subprocess

from app.schemas.terminal import TerminalCommand, TerminalResult


class TerminalService:
    def __init__(self) -> None:
        self._cwd = Path.cwd().resolve()

    def execute(self, payload: TerminalCommand) -> TerminalResult:
        previous_cwd = str(self._cwd)
        command = payload.command.strip()

        if command == "pwd":
            return TerminalResult(
                command=command,
                cwd=str(self._cwd),
                previous_cwd=previous_cwd,
                exit_code=0,
                stdout=f"{self._cwd}\n",
                stderr="",
            )

        if command.startswith("cd"):
            return self._change_directory(command, previous_cwd)

        process = subprocess.run(
            ["/bin/bash", "-lc", command],
            cwd=self._cwd,
            capture_output=True,
            text=True,
            timeout=payload.timeout_seconds,
            check=False,
        )
        return TerminalResult(
            command=command,
            cwd=str(self._cwd),
            previous_cwd=previous_cwd,
            exit_code=process.returncode,
            stdout=process.stdout,
            stderr=process.stderr,
        )

    def _change_directory(self, command: str, previous_cwd: str) -> TerminalResult:
        parts = shlex.split(command)
        target = Path.home() if len(parts) == 1 else Path(parts[1]).expanduser()
        next_cwd = target if target.is_absolute() else self._cwd / target
        next_cwd = next_cwd.resolve()

        if not next_cwd.exists() or not next_cwd.is_dir():
            return TerminalResult(
                command=command,
                cwd=str(self._cwd),
                previous_cwd=previous_cwd,
                exit_code=1,
                stdout="",
                stderr=f"cd: no such directory: {target}\n",
            )

        self._cwd = next_cwd
        return TerminalResult(
            command=command,
            cwd=str(self._cwd),
            previous_cwd=previous_cwd,
            exit_code=0,
            stdout="",
            stderr="",
        )


terminal_service = TerminalService()
