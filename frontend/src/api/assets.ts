export type AssetKind = "domain_controller" | "server" | "workstation" | "unknown";

export type Asset = {
  id: string;
  ip_address: string;
  hostname?: string | null;
  domain?: string | null;
  kind: AssetKind;
  open_ports: number[];
  services: string[];
  port_details?: Array<{
    port: number;
    protocol?: string;
    service?: string;
    version?: string;
    scripts?: string[];
  }>;
  shares?: Array<{
    name: string;
    permissions?: string;
    remark?: string;
    account?: string;
    source_tool?: string;
  }>;
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

export async function updateAsset(asset: Asset): Promise<Asset> {
  const response = await fetch(`${apiBaseUrl}/api/assets/${asset.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ip_address: asset.ip_address,
      hostname: asset.hostname || null,
      domain: asset.domain || null,
      kind: asset.kind,
      open_ports: asset.open_ports,
      services: asset.services,
      port_details: asset.port_details ?? [],
      shares: asset.shares ?? [],
      source_tool: asset.source_tool || null,
      notes: asset.notes || null,
    }),
  });
  if (!response.ok) {
    throw new Error("No se pudo modificar la entidad");
  }
  return response.json();
}

export async function deleteAsset(assetId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/assets/${assetId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("No se pudo eliminar la entidad");
  }
}
