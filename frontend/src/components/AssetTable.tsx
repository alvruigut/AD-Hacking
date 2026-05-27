import { Check, ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { deleteAsset, updateAsset } from "../api/assets";
import type { Asset } from "../api/assets";

type PortDetail = NonNullable<Asset["port_details"]>[number];

type AssetTableProps = {
  assets: Asset[];
  onChanged: () => void;
};

export function AssetTable({ assets, onChanged }: AssetTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
    const draft = drafts[assetId];
    const portDetails = draft.port_details ?? [];
    await updateAsset({
      ...draft,
      open_ports: portDetails.map((detail) => detail.port).filter((port) => Number.isInteger(port)),
      services: Array.from(
        new Set(
          portDetails
            .map((detail) => detail.service?.trim())
            .filter((service): service is string => Boolean(service)),
        ),
      ),
    });
    setEditingId(null);
    onChanged();
  }

  async function removeAsset(assetId: string) {
    await deleteAsset(assetId);
    onChanged();
  }

  function toggleExpanded(assetId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function displayedPortDetails(asset: Asset): PortDetail[] {
    if (asset.port_details && asset.port_details.length > 0) {
      return asset.port_details;
    }
    return asset.open_ports.map((port, index) => ({
      port,
      protocol: "tcp",
      service: asset.services[index] ?? "?",
      version: "",
      scripts: [],
    }));
  }

  function updatePortDetail(assetId: string, index: number, patch: Partial<PortDetail>) {
    const asset = drafts[assetId] ?? assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      return;
    }
    const portDetails = [...displayedPortDetails(asset)];
    portDetails[index] = { ...portDetails[index], ...patch };
    updateDraft(assetId, { port_details: portDetails });
  }

  function addPortDetail(assetId: string) {
    const asset = drafts[assetId] ?? assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      return;
    }
    updateDraft(assetId, {
      port_details: [
        ...displayedPortDetails(asset),
        { port: 0, protocol: "tcp", service: "?", version: "", scripts: [] },
      ],
    });
  }

  function removePortDetail(assetId: string, index: number) {
    const asset = drafts[assetId] ?? assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      return;
    }
    updateDraft(assetId, {
      port_details: displayedPortDetails(asset).filter((_, detailIndex) => detailIndex !== index),
    });
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
          const isExpanded = expandedIds.has(asset.id) || isEditing;
          const draft = drafts[asset.id] ?? asset;
          return (
            <article className="asset-card" key={asset.id}>
              {isEditing ? (
                <>
                  <div className="asset-edit-row">
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
                  </div>
                  <div className="asset-details service-editor">
                    {displayedPortDetails(draft).map((detail, index) => (
                      <div className="service-chip editable-chip" key={`${detail.port}-${index}`}>
                        <div className="chip-fields">
                          <input
                            value={detail.port}
                            aria-label="Puerto"
                            type="number"
                            onChange={(event) =>
                              updatePortDetail(asset.id, index, { port: Number(event.target.value) })
                            }
                          />
                          <input
                            value={detail.protocol ?? "tcp"}
                            aria-label="Protocolo"
                            onChange={(event) =>
                              updatePortDetail(asset.id, index, { protocol: event.target.value })
                            }
                          />
                          <input
                            value={detail.service ?? "?"}
                            aria-label="Servicio"
                            onChange={(event) =>
                              updatePortDetail(asset.id, index, { service: event.target.value || "?" })
                            }
                          />
                        </div>
                        <input
                          value={detail.version ?? ""}
                          aria-label="Version"
                          placeholder="version"
                          onChange={(event) =>
                            updatePortDetail(asset.id, index, { version: event.target.value })
                          }
                        />
                        <button
                          className="chip-delete"
                          type="button"
                          onClick={() => removePortDetail(asset.id, index)}
                        >
                          quitar
                        </button>
                      </div>
                    ))}
                    <button className="chip-add" type="button" onClick={() => addPortDetail(asset.id)}>
                      Añadir puerto
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="asset-row asset-row-main">
                    <button
                      aria-label="Desplegar puertos"
                      className="icon-button secondary"
                      type="button"
                      onClick={() => toggleExpanded(asset.id)}
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <strong>{asset.hostname || asset.ip_address}</strong>
                    <span>{asset.ip_address}</span>
                    <span>{asset.domain || "sin dominio"}</span>
                    <span>
                      {displayedPortDetails(asset).length} puertos · {asset.shares?.length ?? 0} shares
                    </span>
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
                  </div>
                  {isExpanded && (
                    <div className="asset-details service-summary">
                      {displayedPortDetails(asset).length > 0 ? (
                        displayedPortDetails(asset).map((detail) => (
                          <span className="service-chip" key={`${detail.port}-${detail.protocol}`}>
                            <span className="port-line">
                              <strong>{detail.port}/{detail.protocol ?? "tcp"}</strong>
                              <b>{detail.service || "?"}</b>
                            </span>
                            {detail.version && <span>{detail.version}</span>}
                            {detail.scripts && detail.scripts.length > 0 && (
                              <small>{detail.scripts.slice(0, 2).join(" · ")}</small>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="empty-text">Sin puertos registrados.</span>
                      )}
                      {(asset.shares ?? []).map((share) => (
                        <span className="service-chip" key={`${share.name}-${share.account ?? "anon"}`}>
                          <span className="port-line">
                            <strong>{share.name}</strong>
                            <b>{share.permissions || "share"}</b>
                          </span>
                          {share.remark && <span>{share.remark}</span>}
                          <small>{[share.account, share.source_tool].filter(Boolean).join(" · ")}</small>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
