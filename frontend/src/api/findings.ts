export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "new" | "confirmed" | "false_positive" | "accepted_risk" | "fixed";

export type Finding = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: FindingStatus;
  affected_entities: string[];
  evidence: string[];
  source_tool?: string | null;
  recommendation?: string | null;
  created_at: string;
  updated_at: string;
};

export type FindingPayload = {
  title: string;
  description: string;
  severity: Severity;
  status?: FindingStatus;
  affected_entities: string[];
  evidence: string[];
  source_tool?: string | null;
  recommendation?: string | null;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function listFindings(): Promise<Finding[]> {
  const response = await fetch(`${apiBaseUrl}/api/findings`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar los hallazgos");
  }
  return response.json();
}

export async function createFinding(payload: FindingPayload): Promise<Finding> {
  const response = await fetch(`${apiBaseUrl}/api/findings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("No se pudo crear el hallazgo");
  }
  return response.json();
}

export async function updateFinding(finding: Finding): Promise<Finding> {
  const response = await fetch(`${apiBaseUrl}/api/findings/${finding.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: finding.status,
      affected_entities: finding.affected_entities,
      evidence: finding.evidence,
      source_tool: finding.source_tool || null,
      recommendation: finding.recommendation || null,
    }),
  });
  if (!response.ok) {
    throw new Error("No se pudo actualizar el hallazgo");
  }
  return response.json();
}

export async function deleteFinding(findingId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/findings/${findingId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("No se pudo eliminar el hallazgo");
  }
}
