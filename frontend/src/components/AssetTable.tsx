import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { deleteAsset, updateAsset } from "../api/assets";
import type { Asset } from "../api/assets";

type AssetTableProps = {
  assets: Asset[];
  onChanged: () => void;
};

export function AssetTable({ assets, onChanged }: AssetTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Asset>>({});

  function startEditing(asset: Asset) {
    setEditingId(asset.id);
    setDrafts((current) => ({ ...current, [asset.id]: asset }));
  }

  function updateDraft(assetId: string, patch: Partial<Asset>) {
    const asset = assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      return;
    }
    setDrafts((current) => ({
      ...current,
      [assetId]: { ...(current[assetId] ?? asset), ...patch },
    }));
  }

  async function saveAsset(assetId: string) {
    await updateAsset(drafts[assetId]);
    setEditingId(null);
    onChanged();
  }

  async function removeAsset(assetId: string) {
    await deleteAsset(assetId);
    onChanged();
  }

  return (
    <section className="panel asset-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Entidades AD</p>
          <h2>Equipos detectados</h2>
        </div>
        <span className="count">{assets.length}</span>
      </div>

      <div className="asset-list">
        {assets.length === 0 && <p className="empty-text">Aun no hay equipos importados.</p>}
        {assets.map((asset) => {
          const isEditing = editingId === asset.id;
          const draft = drafts[asset.id] ?? asset;
          return (
            <article className="asset-row editable" key={asset.id}>
              {isEditing ? (
                <>
                  <input
                    value={draft.hostname ?? ""}
                    placeholder="hostname"
                    onChange={(event) => updateDraft(asset.id, { hostname: event.target.value })}
                  />
                  <input
                    value={draft.ip_address}
                    placeholder="IP"
                    onChange={(event) => updateDraft(asset.id, { ip_address: event.target.value })}
                  />
                  <input
                    value={draft.domain ?? ""}
                    placeholder="dominio"
                    onChange={(event) => updateDraft(asset.id, { domain: event.target.value })}
                  />
                  <input
                    value={draft.services.join(", ")}
                    placeholder="servicios"
                    onChange={(event) =>
                      updateDraft(asset.id, {
                        services: event.target.value
                          .split(",")
                          .map((service) => service.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <input
                    value={draft.open_ports.join(", ")}
                    placeholder="puertos"
                    onChange={(event) =>
                      updateDraft(asset.id, {
                        open_ports: event.target.value
                          .split(",")
                          .map((port) => Number(port.trim()))
                          .filter((port) => Number.isInteger(port)),
                      })
                    }
                  />
                  <div className="row-actions">
                    <button
                      aria-label="Guardar entidad"
                      className="icon-button"
                      type="button"
                      onClick={() => saveAsset(asset.id)}
                    >
                      <Check size={15} />
                    </button>
                    <button
                      aria-label="Cancelar edicion"
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
                  <strong>{asset.hostname || asset.ip_address}</strong>
                  <span>{asset.ip_address}</span>
                  <span>{asset.domain || "sin dominio"}</span>
                  <div className="service-summary">
                    {asset.port_details.length > 0 ? (
                      asset.port_details.map((detail) => (
                        <span className="service-chip" key={`${detail.port}-${detail.protocol}`}>
                          <strong>{detail.port}/{detail.protocol ?? "tcp"}</strong>
                          {detail.service && <> {detail.service}</>}
                          {detail.version && <> · {detail.version}</>}
                          {detail.scripts && detail.scripts.length > 0 && (
                            <small>{detail.scripts.slice(0, 2).join(" · ")}</small>
                          )}
                        </span>
                      ))
                    ) : (
                      <span>{asset.services.join(", ") || "sin servicios"}</span>
                    )}
                  </div>
                  <div className="row-actions">
                    <button
                      aria-label="Editar entidad"
                      className="icon-button secondary"
                      type="button"
                      onClick={() => startEditing(asset)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Eliminar entidad"
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeAsset(asset.id)}
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
  );
}
