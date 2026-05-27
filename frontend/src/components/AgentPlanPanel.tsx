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
  { value: "reconnaissance", label: "1. Reconocimiento", detail: "IPs, dominios, DCs, DNS, SMB, Kerberos y LDAP." },
  { value: "initial_enumeration", label: "2. Enumeracion inicial", detail: "Usuarios, grupos, shares, politicas y dominio." },
  { value: "credential_access", label: "3. Obtencion de credenciales", detail: "Shares sensibles, GPP, AS-REP y spraying controlado." },
  { value: "initial_access", label: "4. Acceso inicial", detail: "Credenciales contra SMB, WinRM, RDP, MSSQL o LDAP." },
  { value: "authenticated_enumeration", label: "5. Enumeracion autenticada", detail: "BloodHound, ACLs, sesiones, SPNs, GPOs y delegaciones." },
  { value: "exploitation", label: "6. Explotacion", detail: "Kerberoasting, ADCS, ACLs, delegaciones y password reuse." },
  { value: "privilege_escalation", label: "7. Escalada de privilegios", detail: "De usuario a admin local o privilegios de dominio." },
  { value: "lateral_movement", label: "8. Movimiento lateral", detail: "SMB, WinRM, RDP, PsExec y WMI." },
  { value: "pivoting_post_exploitation", label: "9. Pivoting y post-explotacion", detail: "Subredes internas, evidencias, shares, backups, GPOs." },
  { value: "persistence", label: "10. Persistencia", detail: "Documentar o simular persistencia solo con permiso." },
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
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set(["0", "reconnaissance"]));
  const [targetIp, setTargetIp] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ntHash, setNtHash] = useState("");
  const [share, setShare] = useState("");
  const [wordlist, setWordlist] = useState("");
  const [filePath, setFilePath] = useState("");
  const [port, setPort] = useState("");
  const [usersList, setUsersList] = useState("");
  const [kaliIp, setKaliIp] = useState("");
  const [ipDc, setIpDc] = useState("");
  const [plansByPhase, setPlansByPhase] = useState<Record<string, AgentPlan>>({});
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

  function togglePanel(panelId: string) {
    setOpenPanels((current) => {
      const next = new Set(current);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }

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

  async function handleBuildPhasePlan(phase: AuditPhase) {
    setError(null);
    if (!targetIp) {
      setError("Ejecuta primero el mapeado del CIDR y selecciona una IP detectada");
      return;
    }
    try {
      const nextPlan = await buildAgentPlan(scope, domain, "ip", targetIp, phase, {
        username,
        password,
        ntHash,
        share,
        wordlist,
        file: filePath,
        port,
        usersList,
        kaliIp,
        ipDc,
      });
      setPlansByPhase((current) => ({ ...current, [phase]: nextPlan }));
      setTargetCommands((current) => ({
        ...current,
        ...Object.fromEntries(
          nextPlan.commands.map((command, index) => [
            commandKey(phase, command.phase, command.tool, index),
            command.command,
          ]),
        ),
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error generando plan");
    }
  }

  async function handleBuildAllPlans() {
    for (const phase of auditPhases) {
      await handleBuildPhasePlan(phase.value);
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
      const command = targetCommands[key];
      const authorizedScope = command.includes(targetIp) ? targetIp : ipDc || targetIp;
      await executeAgentCommand(command, authorizedScope, phase, workingDirectory);
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error ejecutando comando");
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <section className="panel agent-panel operations-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agente Kali</p>
          <h2>Panel de operaciones</h2>
        </div>
        <Route size={22} />
      </div>

      <section className="operation-params">
        <div className="panel-header compact-header">
          <div>
            <p className="eyebrow">Variables globales</p>
            <h3>Parametros del engagement</h3>
          </div>
          <button className="run-button" type="button" onClick={handleBuildAllPlans}>
            Generar todo
          </button>
        </div>

        <div className="agent-form context-form">
          <label>
            Scope CIDR
            <input value={scope} onChange={(event) => setScope(event.target.value)} />
          </label>
          <label>
            IP / Hostname
            <select
              value={targetIp}
              disabled={assetOptions.length === 0}
              onChange={(event) => setTargetIp(event.target.value)}
            >
              <option value="">{assetOptions.length === 0 ? "Sin hosts detectados" : "Seleccionar host"}</option>
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
            Usuario
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="<user>" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="<password>" />
          </label>
          <label>
            Hash NT
            <input value={ntHash} onChange={(event) => setNtHash(event.target.value)} placeholder="<hash_nt>" />
          </label>
          <label>
            Share
            {shareOptions.length > 0 ? (
              <select value={share} onChange={(event) => setShare(event.target.value)}>
                <option value="">Seleccionar share</option>
                {shareOptions.map((assetShare) => (
                  <option key={`${assetShare.name}-${assetShare.account ?? "anon"}`} value={assetShare.name}>
                    {[assetShare.name, assetShare.permissions, assetShare.account].filter(Boolean).join(" · ")}
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
            Wordlist
            <input value={wordlist} onChange={(event) => setWordlist(event.target.value)} placeholder="<wordlist>" />
          </label>
          <label>
            Fichero
            <input value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="<file>" />
          </label>
          <label>
            DC IP
            <input value={ipDc} onChange={(event) => setIpDc(event.target.value)} placeholder="<ip_dc>" />
          </label>
          <label>
            Puerto
            <input value={port} onChange={(event) => setPort(event.target.value)} placeholder="<port>" />
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
      </section>

      <div className="agent-flow">
        <section className="agent-step">
          <button className="step-heading collapsible-heading" type="button" onClick={() => togglePanel("0")}>
            {openPanels.has("0") ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <div>
              <strong>
                <Search size={16} /> 0. Mapeado CIDR
              </strong>
              <span>Ejecuta NetExec SMB contra el rango y guarda IP, hostname y dominio.</span>
            </div>
          </button>

          {openPanels.has("0") && (
            <>
              <div className="command-row inline-operation-command">
                <div>
                  <span>Mapeado</span>
                  <strong>nxc</strong>
                </div>
                <textarea
                  className="inline-command"
                  value={discoveryCommand}
                  onChange={(event) => setDiscoveryCommand(event.target.value)}
                />
                <p>Descubre equipos SMB dentro del scope configurado.</p>
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
              </div>
            </>
          )}
        </section>

        {auditPhases.map((phase) => (
          <section className="agent-step" key={phase.value}>
            <button
              className="step-heading collapsible-heading"
              type="button"
              onClick={() => togglePanel(phase.value)}
            >
              {openPanels.has(phase.value) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <div>
                <strong>
                  <Route size={16} /> {phase.label}
                </strong>
                <span>{phase.detail}</span>
              </div>
            </button>

            {openPanels.has(phase.value) && (
              <>
                <div className="command-actions phase-actions">
                  <button type="button" onClick={() => handleBuildPhasePlan(phase.value)}>
                    Generar comandos
                  </button>
                </div>
                {plansByPhase[phase.value]?.commands.length ? (
                  <div className="command-list phase-command-list">
                    {plansByPhase[phase.value].commands.map((command, index) => {
                      const key = commandKey(phase.value, command.phase, command.tool, index);
                      return (
                        <CommandCard
                          command={command}
                          commandKey={key}
                          commandValue={targetCommands[key] ?? command.command}
                          isRunning={runningKey === key}
                          phaseLabel={phaseLabels.get(command.phase as AuditPhase) ?? command.phase}
                          onChange={(value) =>
                            setTargetCommands((current) => ({
                              ...current,
                              [key]: value,
                            }))
                          }
                          onCopy={() => handleCopy(targetCommands[key] ?? command.command)}
                          onRun={() => handleRunTargetCommand(key, command.phase)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-text">Genera los comandos de esta fase para revisarlos aqui.</p>
                )}
              </>
            )}
          </section>
        ))}
      </div>

      {error && <div className="state-panel error">{error}</div>}
    </section>
  );
}

function CommandCard({
  command,
  commandKey,
  commandValue,
  isRunning,
  phaseLabel,
  onChange,
  onCopy,
  onRun,
}: {
  command: AgentPlan["commands"][number];
  commandKey: string;
  commandValue: string;
  isRunning: boolean;
  phaseLabel: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onRun: () => void;
}) {
  const variables = extractVariables(commandValue);

  return (
    <article className="command-row" key={commandKey}>
      <div>
        <span>{phaseLabel}</span>
        <strong>{command.tool}</strong>
      </div>
      <textarea
        aria-label={`Comando ${command.tool}`}
        value={commandValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <p>{command.purpose}</p>
      <p className="command-expected">{command.expected_output}</p>
      {variables.length > 0 && (
        <div className="variable-chip-list">
          {variables.map((variable) => (
            <span key={variable}>{variable}</span>
          ))}
        </div>
      )}
      <div className="command-actions">
        <button aria-label="Copiar comando" className="icon-button" type="button" onClick={onCopy}>
          <Copy size={16} />
        </button>
        <button className="run-button" disabled={isRunning} type="button" onClick={onRun}>
          {isRunning ? <RefreshCw size={16} /> : <Play size={16} />}
          Ejecutar
        </button>
      </div>
    </article>
  );
}

function commandKey(panelPhase: string, commandPhase: string, tool: string, index: number) {
  return `${panelPhase}-${commandPhase}-${tool}-${index}`;
}

function extractVariables(command: string) {
  return Array.from(new Set(command.match(/<[^>\s]+>/g) ?? []));
}
