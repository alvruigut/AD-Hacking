import { Copy, Play, RefreshCw, Route } from "lucide-react";
import { useState } from "react";

import { buildAgentPlan, executeAgentCommand, type AgentPlan } from "../api/agent";

type AgentPlanPanelProps = {
  onRunStarted: () => void;
};

export function AgentPlanPanel({ onRunStarted }: AgentPlanPanelProps) {
  const [scope, setScope] = useState("10.10.10.0/24");
  const [domain, setDomain] = useState("corp.local");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [commands, setCommands] = useState<Record<string, string>>({});
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCopy(command: string) {
    navigator.clipboard?.writeText(command);
  }

  async function handleBuildPlan() {
    setError(null);
    try {
      const nextPlan = await buildAgentPlan(scope, domain);
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
    setRunningKey(key);
    try {
      await executeAgentCommand(commands[key], scope, phase);
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
