import { ChevronDown, ChevronRight, Copy, Play, RefreshCw, Route, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { buildAgentPlan, executeAgentCommand, type AgentPlan, type AuditPhase } from "../api/agent";
import type { Asset } from "../api/assets";

type AgentPlanPanelProps = {
  assets: Asset[];
  workingDirectory: string;
  onWorkingDirectoryChange: (path: string) => void;
  onRunStarted: () => void;
};

const auditPhases: { value: AuditPhase; label: string; detail: string }[] = [
  { value: "all", label: "Plan completo", detail: "Genera todas las fases disponibles para revisar y ejecutar." },
  { value: "service_scan", label: "Servicios del target", detail: "RustScan, Nmap y puertos expuestos." },
  { value: "smb_enum", label: "Enumeracion SMB", detail: "Shares, RID brute, null/guest y descarga de share." },
  { value: "ldap_enum", label: "Enumeracion LDAP/BloodHound", detail: "LDAP, dominio, objetos y relaciones AD." },
  { value: "kerberos_enum", label: "Enumeracion Kerberos", detail: "Hora, usuarios validos, AS-REP." },
  { value: "credential_checks", label: "Credenciales", detail: "Kerberoast, ADCS, LSASS con contexto." },
  { value: "exploitation", label: "Explotacion", detail: "WinRM, psexec y acceso remoto." },
  { value: "extraction", label: "Extraccion", detail: "Registry, SAM y artefactos sensibles." },
];

export function AgentPlanPanel({
  assets,
  workingDirectory,
  onWorkingDirectoryChange,
  onRunStarted,
}: AgentPlanPanelProps) {
  const [scope, setScope] = useState("10.10.10.0/24");
  const [domain, setDomain] = useState("corp.local");
  const [discoveryCommand, setDiscoveryCommand] = useState("nxc smb 10.10.10.0/24");
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(true);
  const [isTargetOpen, setIsTargetOpen] = useState(true);
  const [targetIp, setTargetIp] = useState("");
  const [auditPhase, setAuditPhase] = useState<AuditPhase>("service_scan");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ntHash, setNtHash] = useState("");
  const [share, setShare] = useState("");
  const [usersList, setUsersList] = useState("");
  const [kaliIp, setKaliIp] = useState("");
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
  const selectedPhase = auditPhases.find((phase) => phase.value === auditPhase);
  const phaseLabels = useMemo(
    () => new Map(auditPhases.map((phase) => [phase.value, phase.label])),
    [],
  );
  const shareOptions = useMemo(() => {
    const shares = selectedAsset?.shares ?? [];
    const normalizedUser = username.trim().toLowerCase();
    return shares
      .filter((assetShare) => {
        if (!normalizedUser) {
          return true;
        }
        const account = assetShare.account?.trim().toLowerCase();
        return !account || account === "anon" || account === normalizedUser;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [selectedAsset, username]);

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

  useEffect(() => {
    if (shareOptions.length > 0 && (!share || !shareOptions.some((assetShare) => assetShare.name === share))) {
      setShare(shareOptions[0].name);
    }
  }, [share, shareOptions]);

  function handleCopy(command: string) {
    navigator.clipboard?.writeText(command);
  }

  async function handleRunDiscovery() {
    setError(null);
    setRunningKey("discovery");
    try {
      await executeAgentCommand(discoveryCommand, scope, "network_discovery", workingDirectory);
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
      const nextPlan = await buildAgentPlan(scope, domain, "ip", targetIp, auditPhase, {
        username,
        password,
        ntHash,
        share,
        usersList,
        kaliIp,
      });
      setTargetPlan(nextPlan);
      setTargetCommands(
        Object.fromEntries(
          nextPlan.commands.map((command, index) => [
            `${command.phase}-${command.tool}-${index}`,
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
      await executeAgentCommand(targetCommands[key], targetIp, phase, workingDirectory);
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
          <button
            className="step-heading collapsible-heading"
            type="button"
            onClick={() => setIsTargetOpen((current) => !current)}
          >
            {isTargetOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <div>
              <strong>
                <Route size={16} /> 2. Target detectado
              </strong>
              <span>Selecciona host, fase y contexto para generar comandos editables.</span>
            </div>
          </button>

          {isTargetOpen && (
            <>
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
                <label>
                  Fase de auditoria
                  <select value={auditPhase} onChange={(event) => setAuditPhase(event.target.value as AuditPhase)}>
                    {auditPhases.map((phase) => (
                      <option key={phase.value} value={phase.value}>
                        {phase.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="agent-form context-form">
                <label>
                  Usuario
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="<user>" />
                </label>
                <label>
                  Password
                  <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="<password>" />
                </label>
                <label>
                  NT hash
                  <input value={ntHash} onChange={(event) => setNtHash(event.target.value)} placeholder="<NT>" />
                </label>
                <label>
                  Share
                  {shareOptions.length > 0 ? (
                    <select value={share} onChange={(event) => setShare(event.target.value)}>
                      <option value="">Seleccionar share</option>
                      {shareOptions.map((assetShare) => (
                        <option
                          key={`${assetShare.name}-${assetShare.account ?? "anon"}`}
                          value={assetShare.name}
                        >
                          {[assetShare.name, assetShare.permissions, assetShare.account]
                            .filter(Boolean)
                            .join(" · ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={share} onChange={(event) => setShare(event.target.value)} placeholder="<share>" />
                  )}
                </label>
                <label>
                  Users list
                  <input value={usersList} onChange={(event) => setUsersList(event.target.value)} placeholder="<users_list>" />
                </label>
                <label>
                  Kali IP
                  <input value={kaliIp} onChange={(event) => setKaliIp(event.target.value)} placeholder="<kali_ip>" />
                </label>
                <label>
                  Carpeta de trabajo
                  <input
                    value={workingDirectory}
                    onChange={(event) => onWorkingDirectoryChange(event.target.value)}
                    placeholder="data/downloads"
                  />
                </label>
              </div>

              {selectedPhase && (
                <div className="target-summary">
                  Fase <strong>{selectedPhase.label}</strong> · {selectedPhase.detail}
                </div>
              )}

              {selectedAsset && (
                <div className="target-summary">
                  Target <strong>{selectedAsset.ip_address}</strong>
                  {selectedAsset.hostname && <> · {selectedAsset.hostname}</>}
                  {selectedAsset.domain && <> · {selectedAsset.domain}</>}
                </div>
              )}

              <div className="command-actions">
                <button type="button" onClick={handleBuildTargetPlan}>
                  Generar comandos
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {error && <div className="state-panel error">{error}</div>}

      {targetPlan && (
        <div className="command-list">
          {targetPlan.commands.map((command, index) => {
            const commandKey = `${command.phase}-${command.tool}-${index}`;
            return (
              <article className="command-row" key={commandKey}>
                <div>
                  <span>{phaseLabels.get(command.phase as AuditPhase) ?? command.phase}</span>
                  <strong>{command.tool}</strong>
                </div>
                <textarea
                  aria-label={`Comando ${command.tool}`}
                  value={targetCommands[commandKey] ?? command.command}
                  onChange={(event) =>
                    setTargetCommands((current) => ({
                      ...current,
                      [commandKey]: event.target.value,
                    }))
                  }
                />
                <p>{command.purpose}</p>
                <p className="command-expected">{command.expected_output}</p>
                <div className="command-actions">
                  <button
                    aria-label="Copiar comando"
                    className="icon-button"
                    type="button"
                    onClick={() => handleCopy(targetCommands[commandKey] ?? command.command)}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="run-button"
                    disabled={runningKey === commandKey}
                    type="button"
                    onClick={() => handleRunTargetCommand(commandKey, command.phase)}
                  >
                    {runningKey === commandKey ? <RefreshCw size={16} /> : <Play size={16} />}
                    Ejecutar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
