import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { createFinding, deleteFinding, updateFinding } from "../api/findings";
import type { Finding, FindingPayload, FindingStatus, Severity } from "../api/findings";

const severityLabels: Record<Severity, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info",
};

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];
const statuses: FindingStatus[] = ["new", "confirmed", "false_positive", "accepted_risk", "fixed"];

type FindingTableProps = {
  findings: Finding[];
  onChanged: () => void;
};

const emptyFinding: FindingPayload = {
  title: "",
  description: "",
  severity: "medium",
  status: "new",
  affected_entities: [],
  evidence: [],
  source_tool: "manual",
  recommendation: "",
};

export function FindingTable({ findings, onChanged }: FindingTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Finding>>({});
  const [newDraft, setNewDraft] = useState<FindingPayload>(emptyFinding);
  const [error, setError] = useState<string | null>(null);

  function startEditing(finding: Finding) {
    setEditingId(finding.id);
    setDrafts((current) => ({ ...current, [finding.id]: finding }));
  }

  function updateDraft(findingId: string, patch: Partial<Finding>) {
    const finding = findings.find((candidate) => candidate.id === findingId);
    if (!finding) {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [findingId]: { ...(current[findingId] ?? finding), ...patch },
    }));
  }

  async function saveFinding(findingId: string) {
    setError(null);
    try {
      await updateFinding(drafts[findingId]);
      setEditingId(null);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error guardando hallazgo");
    }
  }

  async function removeFinding(findingId: string) {
    setError(null);
    try {
      await deleteFinding(findingId);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error eliminando hallazgo");
    }
  }

  async function addFinding() {
    setError(null);
    try {
      await createFinding(newDraft);
      setNewDraft(emptyFinding);
      setIsCreating(false);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error creando hallazgo");
    }
  }

  return (
    <section className="panel findings-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Hallazgos</p>
          <h2>Cola centralizada</h2>
        </div>
        <div className="panel-actions">
          <span className="count">{findings.length}</span>
          <button className="run-button" type="button" onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            Nuevo
          </button>
        </div>
      </div>

      {error && <div className="state-panel error">{error}</div>}

      <div className="finding-list">
        {isCreating && (
          <FindingEditor
            draft={newDraft}
            onCancel={() => setIsCreating(false)}
            onChange={(patch) => setNewDraft((current) => ({ ...current, ...patch }))}
            onSave={addFinding}
          />
        )}

        {findings.length === 0 && !isCreating && (
          <p className="empty-text">Aun no hay hallazgos registrados.</p>
        )}

        {findings.map((finding) => {
          const isEditing = editingId === finding.id;
          const draft = drafts[finding.id] ?? finding;
          return isEditing ? (
            <FindingEditor
              draft={draft}
              key={finding.id}
              onCancel={() => setEditingId(null)}
              onChange={(patch) => updateDraft(finding.id, patch)}
              onSave={() => saveFinding(finding.id)}
            />
          ) : (
            <article className="finding-row" key={finding.id}>
              <div className={`severity-dot ${finding.severity}`} />
              <div className="finding-main">
                <div className="finding-title-line">
                  <h3>{finding.title}</h3>
                  <span className={`severity-pill ${finding.severity}`}>
                    {severityLabels[finding.severity]}
                  </span>
                </div>
                <p>{finding.description}</p>
                {finding.recommendation && <p>{finding.recommendation}</p>}
                <div className="finding-meta">
                  <span>{finding.status.replace("_", " ")}</span>
                  <span>{finding.source_tool ?? "manual"}</span>
                  <span>{finding.affected_entities.join(", ") || "sin entidad"}</span>
                  {finding.evidence.length > 0 && <span>{finding.evidence.length} evidencias</span>}
                </div>
              </div>
              <div className="row-actions">
                <button
                  aria-label="Editar hallazgo"
                  className="icon-button secondary"
                  type="button"
                  onClick={() => startEditing(finding)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label="Eliminar hallazgo"
                  className="icon-button danger"
                  type="button"
                  onClick={() => removeFinding(finding.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type FindingEditorProps = {
  draft: FindingPayload | Finding;
  onCancel: () => void;
  onChange: (patch: Partial<FindingPayload & Finding>) => void;
  onSave: () => void;
};

function FindingEditor({ draft, onCancel, onChange, onSave }: FindingEditorProps) {
  return (
    <article className="finding-editor">
      <div className="finding-editor-grid">
        <input
          placeholder="Titulo"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <select
          value={draft.severity}
          onChange={(event) => onChange({ severity: event.target.value as Severity })}
        >
          {severities.map((severity) => (
            <option key={severity} value={severity}>
              {severityLabels[severity]}
            </option>
          ))}
        </select>
        <select
          value={draft.status ?? "new"}
          onChange={(event) => onChange({ status: event.target.value as FindingStatus })}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          placeholder="Origen"
          value={draft.source_tool ?? ""}
          onChange={(event) => onChange({ source_tool: event.target.value || null })}
        />
      </div>
      <textarea
        placeholder="Descripcion"
        value={draft.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <textarea
        placeholder="Recomendacion"
        value={draft.recommendation ?? ""}
        onChange={(event) => onChange({ recommendation: event.target.value })}
      />
      <div className="finding-editor-grid">
        <input
          placeholder="Entidades afectadas separadas por coma"
          value={draft.affected_entities.join(", ")}
          onChange={(event) => onChange({ affected_entities: parseEditorList(event.target.value) })}
        />
        <input
          placeholder="Evidencias separadas por coma"
          value={draft.evidence.join(", ")}
          onChange={(event) => onChange({ evidence: parseEditorList(event.target.value) })}
        />
      </div>
      <div className="command-actions">
        <button className="icon-button" type="button" onClick={onSave}>
          <Check size={15} />
        </button>
        <button className="icon-button secondary" type="button" onClick={onCancel}>
          <X size={15} />
        </button>
      </div>
    </article>
  );
}

function parseEditorList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
