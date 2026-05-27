export type AssetKind = "domain_controller" | "server" | "workstation" | "unknown";

export type Asset = {
  id: string;
  ip_address: string;
  hostname?: string | null;
  domain?: string | null;
  kind: AssetKind;
  open_ports: number[];
  services: string[];
  source_tool?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function listAssets(): Promise<Asset[]> {
  const response = await fetch(`${apiBaseUrl}/api/assets`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar los activos");
  }
  return response.json();
}
