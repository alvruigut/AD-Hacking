export type AgentCommand = {
  phase: string;
  tool: string;
  command: string;
  purpose: string;
  expected_output: string;
};

export type AgentPlan = {
  scope_cidr: string;
  target_mode: "cidr" | "ip";
  target: string;
  commands: AgentCommand[];
  safety_notes: string[];
};

export type ToolRunStatus = "planned" | "running" | "completed" | "failed";

export type ToolRun = {
  id: string;
  tool: string;
  command: string;
  phase?: string | null;
  status: ToolRunStatus;
  raw_output?: string | null;
  exit_code?: number | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function buildAgentPlan(
  scopeCidr: string,
  domain?: string,
  targetMode: "cidr" | "ip" = "cidr",
  targetIp?: string,
): Promise<AgentPlan> {
  const response = await fetch(`${apiBaseUrl}/api/agent/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope_cidr: scopeCidr,
      target_mode: targetMode,
      target_ip: targetIp || null,
      domain: domain || null,
      rate_profile: "balanced",
    }),
  });
  if (!response.ok) {
    throw new Error("No se pudo generar el plan del agente");
  }
  return response.json();
}

export async function executeAgentCommand(
  command: string,
  scopeCidr: string,
  phase?: string,
): Promise<ToolRun> {
  const response = await fetch(`${apiBaseUrl}/api/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      command,
      scope_cidr: scopeCidr,
      phase: phase || null,
      timeout_seconds: 900,
      auto_ingest: true,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo ejecutar el comando");
  }
  return response.json();
}

export async function listToolRuns(): Promise<ToolRun[]> {
  const response = await fetch(`${apiBaseUrl}/api/agent/tool-runs`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar las ejecuciones");
  }
  return response.json();
}

export async function cancelToolRun(runId: string): Promise<ToolRun> {
  const response = await fetch(`${apiBaseUrl}/api/agent/tool-runs/${runId}/cancel`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("No se pudo cancelar la ejecucion");
  }
  return response.json();
}

export async function deleteToolRun(runId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/agent/tool-runs/${runId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("No se pudo eliminar la ejecucion");
  }
}
