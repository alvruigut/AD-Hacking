export type TerminalResult = {
  command: string;
  cwd: string;
  previous_cwd: string;
  exit_code: number;
  stdout: string;
  stderr: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function executeTerminalCommand(command: string): Promise<TerminalResult> {
  const response = await fetch(`${apiBaseUrl}/api/terminal/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, timeout_seconds: 120 }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo ejecutar el comando");
  }
  return response.json();
}
