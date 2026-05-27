import { ChevronDown, ChevronRight, Copy, Play, RefreshCw, Route, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { buildAgentPlan, executeAgentCommand, type AgentPlan } from "../api/agent";
import type { Asset } from "../api/assets";

type AgentPlanPanelProps = {
  assets: Asset[];
  onRunStarted: () => void;
};

export function AgentPlanPanel({ assets, onRunStarted }: AgentPlanPanelProps) {
  const [scope, setScope] = useState("10.10.10.0/24");
  const [domain, setDomain] = useState("corp.local");
  const [discoveryCommand, setDiscoveryCommand] = useState("nxc smb 10.10.10.0/24");
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(true);
  const [targetIp, setTargetIp] = useState("");
  const [targetPlan, setTargetPlan] = useState<AgentPlan | null>(null);
  const [targetCommands, setTargetCommands] = useState<Record<string, string>>({});
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assetOptions = useMemo(
    () =>
      assets
        .map((asset) => ({
          label: [asset.ip_address, asset.hostname, asset.domain].filter(Boolean).join(" · "),
          value: asset.ip_address,
        }))
        .sort((left, right) => left.value.localeCompare(right.value)),
    [assets],
  );

  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .map((asset) => asset.domain?.trim())
            .filter((assetDomain): assetDomain is string => Boolean(assetDomain)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [assets],
  );

  const selectedAsset = assets.find((asset) => asset.ip_address === targetIp);

  useEffect(() => {
    setDiscoveryCommand(`nxc smb ${scope}`);
  }, [scope]);

  useEffect(() => {
    if (!targetIp && assetOptions.length > 0) {
      setTargetIp(assetOptions[0].value);
    }
  }, [assetOptions, targetIp]);

  useEffect(() => {
    const targetAsset = assets.find((asset) => asset.ip_address === targetIp);
    if (targetAsset?.domain) {
      setDomain(targetAsset.domain);
    } else if (domainOptions.length > 0) {
      setDomain((currentDomain) => currentDomain || domainOptions[0]);
    }
  }, [assets, domainOptions, targetIp]);

  function handleCopy(command: string) {
    navigator.clipboard?.writeText(command);
  }

  async function handleRunDiscovery() {
    setError(null);
    setRunningKey("discovery");
    try {
      await executeAgentCommand(discoveryCommand, scope, "network_discovery");
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error ejecutando mapeado");
    } finally {
      setRunningKey(null);
    }
  }

  async function handleBuildTargetPlan() {
    setError(null);
    if (!targetIp) {
      setError("Ejecuta primero el mapeado del CIDR y selecciona una IP detectada");
      return;
    }
    try {
      const nextPlan = await buildAgentPlan(scope, domain, "ip", targetIp);
      setTargetPlan(nextPlan);
      setTargetCommands(
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

  async function handleRunTargetCommand(key: string, phase: string) {
    setError(null);
    if (!targetIp) {
      setError("Selecciona una IP antes de ejecutar comandos de target");
      return;
    }
    setRunningKey(key);
    try {
      await executeAgentCommand(targetCommands[key], targetIp, phase);
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
          <h2>Auditoria guiada</h2>
        </div>
        <Route size={22} />
      </div>

      <div className="agent-flow">
        <section className="agent-step">
          <button
            className="step-heading collapsible-heading"
            type="button"
            onClick={() => setIsDiscoveryOpen((current) => !current)}
          >
            {isDiscoveryOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <div>
              <strong>
                <Search size={16} /> 1. Mapeado CIDR
              </strong>
              <span>Ejecuta solo NetExec SMB contra el rango y guarda IP, hostname y dominio.</span>
            </div>
          </button>

          {isDiscoveryOpen && (
            <>
              <div className="agent-form">
                <label>
                  Scope CIDR
                  <input value={scope} onChange={(event) => setScope(event.target.value)} />
                </label>
                <label>
                  Comando editable
                  <textarea
                    className="inline-command"
                    value={discoveryCommand}
                    onChange={(event) => setDiscoveryCommand(event.target.value)}
                  />
                </label>
              </div>

              <div className="command-actions">
                <button
                  aria-label="Copiar comando de mapeado"
                  className="icon-button"
                  type="button"
                  onClick={() => handleCopy(discoveryCommand)}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="run-button"
                  disabled={runningKey === "discovery"}
                  type="button"
                  onClick={handleRunDiscovery}
                >
                  {runningKey === "discovery" ? <RefreshCw size={16} /> : <Play size={16} />}
                  Ejecutar mapeado
                </button>
              </div>
            </>
          )}
        </section>

        <section className="agent-step">
          <div className="step-heading">
            <Route size={18} />
            <div>
              <strong>2. Target detectado</strong>
              <span>Selecciona por IP o hostname y genera comandos contra ese host.</span>
            </div>
          </div>

          <div className="agent-form">
            <label>
              IP / Hostname
              <select
                value={targetIp}
                disabled={assetOptions.length === 0}
                onChange={(event) => setTargetIp(event.target.value)}
              >
                <option value="">
                  {assetOptions.length === 0 ? "Sin hosts detectados" : "Seleccionar host"}
                </option>
                {assetOptions.map((asset) => (
                  <option key={asset.value} value={asset.value}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dominio
              {domainOptions.length > 0 ? (
                <select value={domain} onChange={(event) => setDomain(event.target.value)}>
                  <option value="">Sin dominio</option>
                  {domainOptions.map((assetDomain) => (
                    <option key={assetDomain} value={assetDomain}>
                      {assetDomain}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={domain} onChange={(event) => setDomain(event.target.value)} />
              )}
            </label>
            <button type="button" onClick={handleBuildTargetPlan}>
              Generar comandos
            </button>
          </div>

          {selectedAsset && (
            <div className="target-summary">
              Target <strong>{selectedAsset.ip_address}</strong>
              {selectedAsset.hostname && <> · {selectedAsset.hostname}</>}
              {selectedAsset.domain && <> · {selectedAsset.domain}</>}
            </div>
          )}
        </section>
      </div>

      {error && <div className="state-panel error">{error}</div>}

      {targetPlan && (
        <div className="command-list">
          {targetPlan.commands.map((command) => (
            <article className="command-row" key={`${command.phase}-${command.tool}`}>
              <div>
                <span>{command.phase}</span>
                <strong>{command.tool}</strong>
              </div>
              <textarea
                aria-label={`Comando ${command.tool}`}
                value={targetCommands[`${command.phase}-${command.tool}`] ?? command.command}
                onChange={(event) =>
                  setTargetCommands((current) => ({
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
                    handleCopy(targetCommands[`${command.phase}-${command.tool}`] ?? command.command)
                  }
                >
                  <Copy size={16} />
                </button>
                <button
                  className="run-button"
                  disabled={runningKey === `${command.phase}-${command.tool}`}
                  type="button"
                  onClick={() => handleRunTargetCommand(`${command.phase}-${command.tool}`, command.phase)}
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
