import { Activity, Database, FileWarning, ShieldAlert, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listAssets, type Asset } from "../api/assets";
import { listToolRuns, type ToolRun } from "../api/agent";
import { listFindings, type Finding } from "../api/findings";
import { AgentPlanPanel } from "../components/AgentPlanPanel";
import { AssetTable } from "../components/AssetTable";
import { FindingTable } from "../components/FindingTable";
import { MetricCard } from "../components/MetricCard";
import { ToolRunsPanel } from "../components/ToolRunsPanel";

export function App() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshWorkspace() {
    const [nextFindings, nextAssets, nextRuns] = await Promise.all([
      listFindings(),
      listAssets(),
      listToolRuns(),
    ]);
    setFindings(nextFindings);
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

  const highRiskCount = useMemo(
    () => findings.filter((finding) => ["critical", "high"].includes(finding.severity)).length,
    [findings],
  );

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
          <a className="active" href="#dashboard">
            <Activity size={18} /> Dashboard
          </a>
          <a href="#findings">
            <FileWarning size={18} /> Hallazgos
          </a>
          <a href="#runs">
            <TerminalSquare size={18} /> Tool runs
          </a>
          <a href="#data">
            <Database size={18} /> Entidades
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Engagement activo</p>
            <h1>Auditando Active Directory</h1>
          </div>
          <button type="button">Nuevo hallazgo</button>
        </header>

        <section className="metrics-grid" aria-label="Metricas">
          <MetricCard
            icon={<FileWarning size={20} />}
            label="Hallazgos"
            value={findings.length}
            detail="registrados en el workspace"
          />
          <MetricCard
            icon={<ShieldAlert size={20} />}
            label="Riesgo alto"
            value={highRiskCount}
            detail="requieren validacion"
          />
          <MetricCard
            icon={<TerminalSquare size={20} />}
            label="Equipos AD"
            value={assets.length}
            detail="detectados por importadores"
          />
        </section>

        {isLoading && <div className="state-panel">Cargando hallazgos...</div>}
        {error && <div className="state-panel error">{error}</div>}
        {!isLoading && !error && (
          <div className="workspace-grid">
            <AgentPlanPanel
              onRunStarted={() =>
                refreshWorkspace().catch((requestError: Error) => setError(requestError.message))
              }
            />
            <ToolRunsPanel
              runs={runs}
              onRefresh={() =>
                refreshWorkspace().catch((requestError: Error) => setError(requestError.message))
              }
            />
            <AssetTable assets={assets} />
            <FindingTable findings={findings} />
          </div>
        )}
      </section>
    </main>
  );
}
