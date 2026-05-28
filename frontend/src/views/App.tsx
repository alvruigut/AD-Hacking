import { Activity, Database, FileArchive, ShieldAlert, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { listAssets, type Asset } from "../api/assets";
import { listToolRuns, type ToolRun } from "../api/agent";
import { AgentPlanPanel } from "../components/AgentPlanPanel";
import { AssetTable } from "../components/AssetTable";
import { FileBrowserPanel } from "../components/FileBrowserPanel";
import { TerminalPanel } from "../components/TerminalPanel";
import { ToolNotebook } from "../components/ToolNotebook";

type ActiveView = "dashboard" | "files" | "tools" | "report" | "terminal";

const viewTitles: Record<ActiveView, string> = {
  dashboard: "Panel de operaciones",
  files: "Ficheros",
  tools: "Tools",
  report: "Informe",
  terminal: "Terminal",
};

export function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [workingDirectory, setWorkingDirectory] = useState("data/downloads");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshWorkspace() {
    const [nextAssets, nextRuns] = await Promise.all([
      listAssets(),
      listToolRuns(),
    ]);
    setAssets(nextAssets);
    setRuns(nextRuns);
  }

  useEffect(() => {
    refreshWorkspace()
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const hasRunningCommand = runs.some((run) => run.status === "running");
    if (!hasRunningCommand) {
      return;
    }
    const intervalId = window.setInterval(() => {
      refreshWorkspace().catch((requestError: Error) => setError(requestError.message));
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [runs]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldAlert size={26} />
          <div>
            <strong>AD Red Team</strong>
            <span>Notes</span>
          </div>
        </div>

        <nav>
          <button
            className={activeView === "dashboard" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("dashboard")}
          >
            <Activity size={18} /> Panel de operaciones
          </button>
          <button
            className={activeView === "files" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("files")}
          >
            <FileArchive size={18} /> Ficheros
          </button>
          <button
            className={activeView === "tools" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("tools")}
          >
            <TerminalSquare size={18} /> Tools
          </button>
          <button
            className={activeView === "report" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("report")}
          >
            <Database size={18} /> Informe
          </button>
          <button
            className={activeView === "terminal" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("terminal")}
          >
            <TerminalSquare size={18} /> Terminal
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{viewTitles[activeView]}</h1>
          </div>
        </header>

        {isLoading && <div className="state-panel">Cargando workspace...</div>}
        {error && <div className="state-panel error">{error}</div>}
        {!isLoading && !error && (
          <div className="workspace-grid">
            {activeView === "dashboard" && (
              <>
                <AgentPlanPanel
                  assets={assets}
                  runs={runs}
                  workingDirectory={workingDirectory}
                  onWorkingDirectoryChange={setWorkingDirectory}
                  onRefreshRuns={() =>
                    refreshWorkspace().catch((requestError: Error) => setError(requestError.message))
                  }
                  onRunStarted={() =>
                    refreshWorkspace().catch((requestError: Error) => setError(requestError.message))
                  }
                />
              </>
            )}
            {activeView === "files" && <FileBrowserPanel initialPath={workingDirectory} />}
            {activeView === "tools" && <ToolNotebook />}
            {activeView === "report" && (
              <AssetTable
                assets={assets}
                onChanged={() =>
                  refreshWorkspace().catch((requestError: Error) => setError(requestError.message))
                }
              />
            )}
            {activeView === "terminal" && <TerminalPanel />}
          </div>
        )}
      </section>
    </main>
  );
}
