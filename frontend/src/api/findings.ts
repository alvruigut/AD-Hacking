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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function listFindings(): Promise<Finding[]> {
  const response = await fetch(`${apiBaseUrl}/api/findings`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar los hallazgos");
  }
  return response.json();
}
