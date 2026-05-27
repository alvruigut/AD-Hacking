import { RefreshCw, Square, TerminalSquare, Trash2 } from "lucide-react";

import { cancelToolRun, deleteToolRun } from "../api/agent";
import type { ToolRun } from "../api/agent";

type ToolRunsPanelProps = {
  runs: ToolRun[];
  onRefresh: () => void;
};

export function ToolRunsPanel({ runs, onRefresh }: ToolRunsPanelProps) {
  async function handleCancel(runId: string) {
    await cancelToolRun(runId);
    onRefresh();
  }

  async function handleDelete(runId: string) {
    await deleteToolRun(runId);
    onRefresh();
  }

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
              <div className="row-actions">
                {run.status === "running" && (
                  <button
                    aria-label="Cancelar ejecucion"
                    className="icon-button danger"
                    type="button"
                    onClick={() => handleCancel(run.id)}
                  >
                    <Square size={15} />
                  </button>
                )}
                <button
                  aria-label="Eliminar ejecucion"
                  className="icon-button danger"
                  type="button"
                  onClick={() => handleDelete(run.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
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
