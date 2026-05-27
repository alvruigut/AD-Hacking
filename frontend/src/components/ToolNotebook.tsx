import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

type ToolTemplate = {
  id: string;
  group: string;
  name: string;
  tool: string;
  command: string;
  authorizedTarget: string;
};

const defaultTools: ToolTemplate[] = [
  {
    id: "recon-nxc-smb-cidr",
    group: "Recon",
    name: "Mapeo SMB del CIDR",
    tool: "nxc",
    command: "nxc smb 10.10.10.0/24",
    authorizedTarget: "10.10.10.0/24",
  },
  {
    id: "recon-nxc-ldap-host",
    group: "Recon",
    name: "Probe LDAP del DC",
    tool: "nxc",
    command: "nxc ldap 10.10.10.10",
    authorizedTarget: "10.10.10.10",
  },
  {
    id: "recon-nmap-services",
    group: "Recon",
    name: "Servicios TCP",
    tool: "nmap",
    command: "nmap -sV -Pn 10.10.10.10",
    authorizedTarget: "10.10.10.10",
  },
];

const storageKey = "ad-redteam-tool-notebook";

export function ToolNotebook() {
  const [tools, setTools] = useState<ToolTemplate[]>(defaultTools);
  const [drafts, setDrafts] = useState<Record<string, ToolTemplate>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      setTools(JSON.parse(saved));
    }
  }, []);

  function persist(nextTools: ToolTemplate[]) {
    setTools(nextTools);
    window.localStorage.setItem(storageKey, JSON.stringify(nextTools));
  }

  function groupedTools() {
    return Array.from(new Set(tools.map((tool) => tool.group))).map((group) => ({
      group,
      tools: tools.filter((tool) => tool.group === group),
    }));
  }

  function startEditing(tool: ToolTemplate) {
    setEditingId(tool.id);
    setDrafts((current) => ({ ...current, [tool.id]: tool }));
  }

  function updateDraft(toolId: string, patch: Partial<ToolTemplate>) {
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (!tool) {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [toolId]: { ...(current[toolId] ?? tool), ...patch },
    }));
  }

  function saveTool(toolId: string) {
    const draft = drafts[toolId];
    if (!draft) {
      return;
    }
    persist(tools.map((tool) => (tool.id === toolId ? draft : tool)));
    setEditingId(null);
  }

  function addTool() {
    const tool: ToolTemplate = {
      id: crypto.randomUUID(),
      group: "Recon",
      name: "Nueva herramienta",
      tool: "nxc",
      command: "nxc smb 10.10.10.0/24",
      authorizedTarget: "10.10.10.0/24",
    };
    persist([tool, ...tools]);
    startEditing(tool);
  }

  function deleteTool(toolId: string) {
    persist(tools.filter((tool) => tool.id !== toolId));
  }

  return (
    <section className="panel notebook-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Notebook AD</p>
          <h2>Herramientas por funcionalidad</h2>
        </div>
        <button className="run-button" type="button" onClick={addTool}>
          <Plus size={16} />
          Agregar
        </button>
      </div>

      <div className="notebook-groups">
        {groupedTools().map((group) => (
          <section className="notebook-group" key={group.group}>
            <h3>{group.group}</h3>
            <div className="tool-template-list">
              {group.tools.map((tool) => {
                const isEditing = editingId === tool.id;
                const draft = drafts[tool.id] ?? tool;
                return (
                  <article className="tool-template" key={tool.id}>
                    {isEditing ? (
                      <>
                        <div className="tool-template-grid">
                          <input
                            value={draft.group}
                            onChange={(event) => updateDraft(tool.id, { group: event.target.value })}
                          />
                          <input
                            value={draft.name}
                            onChange={(event) => updateDraft(tool.id, { name: event.target.value })}
                          />
                          <input
                            value={draft.tool}
                            onChange={(event) => updateDraft(tool.id, { tool: event.target.value })}
                          />
                          <input
                            value={draft.authorizedTarget}
                            onChange={(event) =>
                              updateDraft(tool.id, { authorizedTarget: event.target.value })
                            }
                          />
                        </div>
                        <textarea
                          value={draft.command}
                          onChange={(event) => updateDraft(tool.id, { command: event.target.value })}
                        />
                        <div className="command-actions">
                          <button className="icon-button" type="button" onClick={() => saveTool(tool.id)}>
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
                          <strong>{tool.name}</strong>
                          <span>{tool.tool}</span>
                          <span>{tool.authorizedTarget}</span>
                        </div>
                        <code>{tool.command}</code>
                        <div className="command-actions">
                          <button
                            className="icon-button secondary"
                            type="button"
                            onClick={() => startEditing(tool)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => deleteTool(tool.id)}
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
