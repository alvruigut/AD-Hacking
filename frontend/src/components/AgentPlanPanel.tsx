import { Copy, Play, RefreshCw, Route } from "lucide-react";
import { useEffect, useState } from "react";

import { buildAgentPlan, executeAgentCommand, type AgentPlan } from "../api/agent";
import type { Asset } from "../api/assets";

type AgentPlanPanelProps = {
  assets: Asset[];
  onRunStarted: () => void;
};

export function AgentPlanPanel({ assets, onRunStarted }: AgentPlanPanelProps) {
  const [scope, setScope] = useState("10.10.10.0/24");
  const [domain, setDomain] = useState("corp.local");
  const [targetMode, setTargetMode] = useState<"cidr" | "ip">("cidr");
  const [targetIp, setTargetIp] = useState("");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [commands, setCommands] = useState<Record<string, string>>({});
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedExecutionTarget = targetMode === "ip" ? targetIp : scope;
  const assetOptions = assets
    .map((asset) => ({
      label: [asset.ip_address, asset.hostname, asset.domain].filter(Boolean).join(" · "),
      value: asset.ip_address,
    }))
    .sort((left, right) => left.value.localeCompare(right.value));

  useEffect(() => {
    if (targetMode === "ip" && !targetIp && assetOptions.length > 0) {
      setTargetIp(assetOptions[0].value);
    }
  }, [assetOptions, targetIp, targetMode]);

  function handleCopy(command: string) {
    navigator.clipboard?.writeText(command);
  }

  async function handleBuildPlan() {
    setError(null);
    if (targetMode === "ip" && !targetIp) {
      setError("Ejecuta primero el mapeado del CIDR y selecciona una IP detectada");
      return;
    }
    try {
      const nextPlan = await buildAgentPlan(scope, domain, targetMode, targetIp);
      setPlan(nextPlan);
      setCommands(
        Object.fromEntries(
          nextPlan.commands.map((command) => [
            `${command.phase}-${command.tool}`,
            command.command,
          ]),
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error generando plan");
    }
  }

  async function handleExecute(key: string, phase: string) {
    setError(null);
    if (!selectedExecutionTarget) {
      setError("No hay target seleccionado para validar la ejecucion");
      return;
    }
    setRunningKey(key);
    try {
      await executeAgentCommand(commands[key], selectedExecutionTarget, phase);
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error ejecutando comando");
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <section className="panel agent-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agente Kali</p>
          <h2>Plan de auditoria</h2>
        </div>
        <Route size={22} />
      </div>

      <div className="agent-form">
        <label>
          Scope CIDR
          <input value={scope} onChange={(event) => setScope(event.target.value)} />
        </label>
        <label>
          Modo
          <select
            value={targetMode}
            onChange={(event) => setTargetMode(event.target.value as "cidr" | "ip")}
          >
            <option value="cidr">CIDR completo</option>
            <option value="ip">Una IP</option>
          </select>
        </label>
        {targetMode === "ip" && (
          <label>
            Target IP
            <select
              value={targetIp}
              disabled={assetOptions.length === 0}
              onChange={(event) => setTargetIp(event.target.value)}
            >
              <option value="">
                {assetOptions.length === 0 ? "Sin IPs detectadas" : "Seleccionar IP detectada"}
              </option>
              {assetOptions.map((asset) => (
                <option key={asset.value} value={asset.value}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Dominio
          <input value={domain} onChange={(event) => setDomain(event.target.value)} />
        </label>
        <button type="button" onClick={handleBuildPlan}>
          Generar plan
        </button>
      </div>

      {error && <div className="state-panel error">{error}</div>}

      {plan && (
        <div className="command-list">
          <div className="target-summary">
            Plan generado para <strong>{plan.target}</strong>
          </div>
          {plan.commands.map((command) => (
            <article className="command-row" key={`${command.phase}-${command.tool}`}>
              <div>
                <span>{command.phase}</span>
                <strong>{command.tool}</strong>
              </div>
              <textarea
                aria-label={`Comando ${command.tool}`}
                value={commands[`${command.phase}-${command.tool}`] ?? command.command}
                onChange={(event) =>
                  setCommands((current) => ({
                    ...current,
                    [`${command.phase}-${command.tool}`]: event.target.value,
                  }))
                }
              />
              <p>{command.purpose}</p>
              <div className="command-actions">
                <button
                  aria-label="Copiar comando"
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    handleCopy(commands[`${command.phase}-${command.tool}`] ?? command.command)
                  }
                >
                  <Copy size={16} />
                </button>
                <button
                  className="run-button"
                  disabled={runningKey === `${command.phase}-${command.tool}`}
                  type="button"
                  onClick={() => handleExecute(`${command.phase}-${command.tool}`, command.phase)}
                >
                  {runningKey === `${command.phase}-${command.tool}` ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  Ejecutar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
