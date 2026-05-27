from subprocess import TimeoutExpired
import asyncio
import os
import pty
import select
import signal
import subprocess
import termios
import struct
import fcntl

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

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


@router.websocket("/pty")
async def terminal_pty(websocket: WebSocket) -> None:
    await websocket.accept()

    master_fd, slave_fd = pty.openpty()
    shell = os.environ.get("SHELL", "/bin/zsh")
    if not os.path.exists(shell):
        shell = "/bin/bash"

    process = subprocess.Popen(
        [shell, "-i"],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        preexec_fn=os.setsid,
        close_fds=True,
        cwd=os.getcwd(),
        env={**os.environ, "TERM": "xterm-256color"},
    )
    os.close(slave_fd)

    async def read_pty() -> None:
        try:
            while process.poll() is None:
                ready, _, _ = await asyncio.to_thread(select.select, [master_fd], [], [], 0.1)
                if not ready:
                    continue
                try:
                    data = os.read(master_fd, 8192)
                except OSError:
                    break
                if not data:
                    break
                await websocket.send_text(data.decode(errors="ignore"))
        except WebSocketDisconnect:
            return

    async def write_pty() -> None:
        try:
            while process.poll() is None:
                message = await websocket.receive_json()
                message_type = message.get("type")
                if message_type == "input":
                    os.write(master_fd, message.get("data", "").encode())
                elif message_type == "resize":
                    resize_pty(
                        master_fd,
                        int(message.get("rows", 24)),
                        int(message.get("cols", 80)),
                    )
        except WebSocketDisconnect:
            return

    try:
        await asyncio.gather(read_pty(), write_pty())
    finally:
        if process.poll() is None:
            os.killpg(os.getpgid(process.pid), signal.SIGHUP)
        try:
            os.close(master_fd)
        except OSError:
            pass


def resize_pty(master_fd: int, rows: int, cols: int) -> None:
    size = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, size)
