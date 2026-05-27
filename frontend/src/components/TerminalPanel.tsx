import { Play, TerminalSquare, Trash2 } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { executeTerminalCommand, type TerminalResult } from "../api/terminal";

type HistoryItem =
  | { type: "result"; result: TerminalResult }
  | { type: "error"; command: string; cwd: string; message: string };

export function TerminalPanel() {
  const [cwd, setCwd] = useState("backend");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    executeTerminalCommand("pwd")
      .then((result) => setCwd(result.cwd))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [history]);

  async function runCommand() {
    const nextCommand = command.trim();
    if (!nextCommand || isRunning) {
      return;
    }
    setCommand("");
    setIsRunning(true);
    try {
      const result = await executeTerminalCommand(nextCommand);
      setCwd(result.cwd);
      setHistory((current) => [...current, { type: "result", result }]);
    } catch (requestError) {
      setHistory((current) => [
        ...current,
        {
          type: "error",
          command: nextCommand,
          cwd,
          message: requestError instanceof Error ? requestError.message : "Error ejecutando comando",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
    }
  }

  return (
    <section className="panel terminal-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Terminal</p>
          <h2>Consola local del backend</h2>
        </div>
        <button className="icon-button danger" type="button" onClick={() => setHistory([])}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {history.length === 0 && (
          <div className="terminal-muted">
            <TerminalSquare size={18} />
            <span>Ejecuta comandos en Kali desde aqui. El directorio se conserva entre comandos.</span>
          </div>
        )}

        {history.map((item, index) =>
          item.type === "result" ? (
            <article className="terminal-entry" key={`${item.result.command}-${index}`}>
              <div className="terminal-prompt">
                <span>root@kali</span>
                <strong>{shortenPath(item.result.previous_cwd)}</strong>
                <b>#</b>
                <code>{item.result.command}</code>
              </div>
              {item.result.stdout && <pre>{item.result.stdout}</pre>}
              {item.result.stderr && <pre className="terminal-stderr">{item.result.stderr}</pre>}
              {item.result.exit_code !== 0 && <small>exit {item.result.exit_code}</small>}
            </article>
          ) : (
            <article className="terminal-entry" key={`${item.command}-${index}`}>
              <div className="terminal-prompt">
                <span>root@kali</span>
                <strong>{shortenPath(item.cwd)}</strong>
                <b>#</b>
                <code>{item.command}</code>
              </div>
              <pre className="terminal-stderr">{item.message}</pre>
            </article>
          ),
        )}
      </div>

      <div className="terminal-input-row">
        <div className="terminal-current-prompt">
          <span>root@kali</span>
          <strong>{shortenPath(cwd)}</strong>
          <b>#</b>
        </div>
        <input
          autoComplete="off"
          disabled={isRunning}
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="icon-button" disabled={isRunning} type="button" onClick={runCommand}>
          <Play size={15} />
        </button>
      </div>
    </section>
  );
}

function shortenPath(path: string) {
  return path.replace(/^\/home\/[^/]+/, "~");
}
