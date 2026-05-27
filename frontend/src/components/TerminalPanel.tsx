import { RefreshCw, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function TerminalPanel() {
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "closed">("connecting");

  useEffect(() => {
    connectTerminal();
    return () => {
      socketRef.current?.close();
      terminalRef.current?.dispose();
    };
  }, []);

  function connectTerminal() {
    socketRef.current?.close();
    terminalRef.current?.dispose();

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      rows: 26,
      theme: {
        background: "#020617",
        foreground: "#d1fae5",
        cursor: "#5eead4",
        selectionBackground: "#134e4a",
      },
    });

    terminalRef.current = terminal;
    if (terminalElementRef.current) {
      terminal.open(terminalElementRef.current);
      terminal.focus();
    }

    const socket = new WebSocket(`${toWebSocketUrl(apiBaseUrl)}/api/terminal/pty`);
    socketRef.current = socket;
    setStatus("connecting");

    socket.addEventListener("open", () => {
      setStatus("connected");
      socket.send(JSON.stringify({ type: "resize", rows: terminal.rows, cols: terminal.cols }));
    });

    socket.addEventListener("message", (event) => {
      terminal.write(event.data);
    });

    socket.addEventListener("close", () => {
      setStatus("closed");
      terminal.write("\r\n[terminal cerrada]\r\n");
    });

    terminal.onData((data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    terminal.onResize((size: { rows: number; cols: number }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", rows: size.rows, cols: size.cols }));
      }
    });
  }

  return (
    <section className="panel terminal-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Terminal</p>
          <h2>PTY interactiva del backend</h2>
        </div>
        <div className="terminal-toolbar">
          <span className={`terminal-status ${status}`}>{status}</span>
          <button className="icon-button secondary" type="button" onClick={connectTerminal}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="terminal-real" ref={terminalElementRef}>
        <div className="terminal-muted">
          <TerminalSquare size={18} />
        </div>
      </div>
    </section>
  );
}

function toWebSocketUrl(url: string) {
  return url.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}
