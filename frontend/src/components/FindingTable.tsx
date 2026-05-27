import type { Finding, Severity } from "../api/findings";

const severityLabels: Record<Severity, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info",
};

type FindingTableProps = {
  findings: Finding[];
};

export function FindingTable({ findings }: FindingTableProps) {
  return (
    <section className="panel findings-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Hallazgos</p>
          <h2>Cola centralizada</h2>
        </div>
        <span className="count">{findings.length}</span>
      </div>

      <div className="finding-list">
        {findings.length === 0 && <p className="empty-text">Aun no hay hallazgos registrados.</p>}
        {findings.map((finding) => (
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
              <div className="finding-meta">
                <span>{finding.status.replace("_", " ")}</span>
                <span>{finding.source_tool ?? "manual"}</span>
                <span>{finding.affected_entities.join(", ") || "sin entidad"}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
