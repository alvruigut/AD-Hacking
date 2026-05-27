import { RefreshCw, TerminalSquare } from "lucide-react";

import type { ToolRun } from "../api/agent";

type ToolRunsPanelProps = {
  runs: ToolRun[];
  onRefresh: () => void;
};

export function ToolRunsPanel({ runs, onRefresh }: ToolRunsPanelProps) {
  return (
    <section className="panel runs-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ejecuciones</p>
          <h2>Output desde Kali</h2>
        </div>
        <button aria-label="Refrescar ejecuciones" className="icon-button static" onClick={onRefresh}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="run-list">
        {runs.length === 0 && <p className="empty-text">Aun no hay comandos lanzados.</p>}
        {runs.map((run) => (
          <article className="run-row" key={run.id}>
            <div className="run-title">
              <TerminalSquare size={16} />
              <strong>{run.tool}</strong>
              <span className={`status-pill ${run.status}`}>{run.status}</span>
              {run.exit_code !== null && run.exit_code !== undefined && <span>exit {run.exit_code}</span>}
            </div>
            <code>{run.command}</code>
            {run.error && <p className="run-error">{run.error}</p>}
            {run.raw_output && <pre>{run.raw_output}</pre>}
          </article>
        ))}
      </div>
    </section>
  );
}
