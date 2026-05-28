import { Check, ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { deleteAsset, updateAsset } from "../api/assets";
import type { Asset } from "../api/assets";

type PortDetail = NonNullable<Asset["port_details"]>[number];

type AssetTableProps = {
  assets: Asset[];
  onChanged: () => void;
};

type DomainNotebook = {
  objectives: string;
  users: string;
  groups: string;
  credentials: string;
  attackPaths: string;
  notes: string;
};

type MachineNotebook = {
  localUsers: string;
  sessions: string;
  credentials: string;
  privilege: string;
  evidence: string;
  nextSteps: string;
  notes: string;
};

type EntityNotebook = {
  domains: Record<string, DomainNotebook>;
  machines: Record<string, MachineNotebook>;
};

const notebookStorageKey = "ad-redteam-entity-notebook";
const emptyDomainNotebook: DomainNotebook = {
  objectives: "",
  users: "",
  groups: "",
  credentials: "",
  attackPaths: "",
  notes: "",
};
const emptyMachineNotebook: MachineNotebook = {
  localUsers: "",
  sessions: "",
  credentials: "",
  privilege: "",
  evidence: "",
  nextSteps: "",
  notes: "",
};

const domainNoteFields: Array<{
  key: keyof DomainNotebook;
  label: string;
  placeholder: string;
}> = [
  {
    key: "objectives",
    label: "Objetivos y alcance",
    placeholder: "DCs, OUs interesantes, crown jewels, exclusiones, ventanas permitidas",
  },
  {
    key: "users",
    label: "Usuarios de dominio",
    placeholder: "usuarios validos, candidatos, formato, origen de enumeracion",
  },
  {
    key: "groups",
    label: "Grupos y privilegios",
    placeholder: "Domain Admins, admins locales, operadores, grupos anidados, owners",
  },
  {
    key: "credentials",
    label: "Credenciales de dominio",
    placeholder: "usuario:dominio, password/hash, origen, alcance, ultimo uso validado",
  },
  {
    key: "attackPaths",
    label: "Paths de ataque",
    placeholder: "BloodHound, ACLs, Kerberoast, AS-REP, ADCS, delegaciones, GPOs",
  },
  {
    key: "notes",
    label: "Notas del dominio",
    placeholder: "trusts, politicas, DNS, shares clave, decisiones y pendientes",
  },
];

const machineNoteFields: Array<{
  key: keyof MachineNotebook;
  label: string;
  placeholder: string;
}> = [
  {
    key: "localUsers",
    label: "Usuarios locales",
    placeholder: "usuarios locales, grupos, admins, cuentas de servicio",
  },
  {
    key: "sessions",
    label: "Sesiones y contexto",
    placeholder: "usuarios logados, shares montados, procesos interesantes, quien usa esta maquina",
  },
  {
    key: "credentials",
    label: "Credenciales",
    placeholder: "passwords, hashes, tickets, reuse, donde aparecieron y con que alcance",
  },
  {
    key: "privilege",
    label: "Privilegios y control",
    placeholder: "admin local, RDP/WinRM/SMB, SeImpersonate, servicios modificables, rutas writable",
  },
  {
    key: "evidence",
    label: "Evidencia",
    placeholder: "comandos, capturas, ficheros, timestamps, salida relevante reproducible",
  },
  {
    key: "nextSteps",
    label: "Proximos pasos",
    placeholder: "validar creds, pivotar, dumpear, revisar GPO, escalar, limpiar pendiente",
  },
  {
    key: "notes",
    label: "Notas libres",
    placeholder: "observaciones, hipotesis, riesgos, decisiones",
  },
];

function loadEntityNotebook(): EntityNotebook {
  try {
    const rawNotebook = window.localStorage.getItem(notebookStorageKey);
    if (!rawNotebook) {
      return { domains: {}, machines: {} };
    }
    const parsedNotebook = JSON.parse(rawNotebook) as Partial<EntityNotebook>;
    return {
      domains: parsedNotebook.domains ?? {},
      machines: parsedNotebook.machines ?? {},
    };
  } catch {
    return { domains: {}, machines: {} };
  }
}

export function AssetTable({ assets, onChanged }: AssetTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedDomainIds, setExpandedDomainIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [entityNotebook, setEntityNotebook] = useState<EntityNotebook>(loadEntityNotebook);
  const [drafts, setDrafts] = useState<Record<string, Asset>>({});

  const domainGroups = useMemo(() => {
    const groups = new Map<string, Asset[]>();
    for (const asset of assets) {
      const domainKey = asset.domain?.trim() || "Sin dominio";
      groups.set(domainKey, [...(groups.get(domainKey) ?? []), asset]);
    }
    return Array.from(groups.entries())
      .map(([domain, domainAssets]) => ({
        domain,
        assets: domainAssets.sort((left, right) =>
          (left.hostname || left.ip_address).localeCompare(right.hostname || right.ip_address),
        ),
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain));
  }, [assets]);

  useEffect(() => {
    window.localStorage.setItem(notebookStorageKey, JSON.stringify(entityNotebook));
  }, [entityNotebook]);

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

  function toggleDomain(domain: string) {
    setExpandedDomainIds((current) => {
      const next = new Set(current);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }

  function toggleSection(sectionId: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function updateDomainNotebook(domain: string, patch: Partial<DomainNotebook>) {
    setEntityNotebook((current) => ({
      ...current,
      domains: {
        ...current.domains,
        [domain]: { ...emptyDomainNotebook, ...(current.domains[domain] ?? {}), ...patch },
      },
    }));
  }

  function updateMachineNotebook(assetId: string, patch: Partial<MachineNotebook>) {
    setEntityNotebook((current) => ({
      ...current,
      machines: {
        ...current.machines,
        [assetId]: { ...emptyMachineNotebook, ...(current.machines[assetId] ?? {}), ...patch },
      },
    }));
  }

  function filledFieldCount(record: Record<string, string>) {
    return Object.values(record).filter((value) => value.trim().length > 0).length;
  }

  function adSurfaceLabels(asset: Asset) {
    const ports = new Set(displayedPortDetails(asset).map((detail) => detail.port));
    const labels: string[] = [];
    if (asset.kind === "domain_controller" || ports.has(88) || ports.has(389) || ports.has(636)) {
      labels.push("AD core");
    }
    if (ports.has(445) || ports.has(139)) {
      labels.push("SMB");
    }
    if (ports.has(5985) || ports.has(5986)) {
      labels.push("WinRM");
    }
    if (ports.has(3389)) {
      labels.push("RDP");
    }
    if (ports.has(53)) {
      labels.push("DNS");
    }
    return labels;
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
          <p className="eyebrow">Informe AD</p>
          <h2>Writeup del entorno</h2>
        </div>
        <span className="count">{assets.length}</span>
      </div>

      <div className="asset-list">
        {assets.length === 0 && <p className="empty-text">Aun no hay equipos importados.</p>}
        {domainGroups.map((group) => {
          const domainNotebook = { ...emptyDomainNotebook, ...(entityNotebook.domains[group.domain] ?? {}) };
          const isDomainExpanded = expandedDomainIds.has(group.domain);
          const uniqueHosts = new Set(group.assets.map((asset) => asset.hostname || asset.ip_address)).size;
          const domainControllers = group.assets.filter((asset) => asset.kind === "domain_controller").length;
          const totalPorts = group.assets.reduce((count, asset) => count + displayedPortDetails(asset).length, 0);
          const exposedServices = new Set(
            group.assets.flatMap((asset) =>
              displayedPortDetails(asset)
                .map((detail) => detail.service?.trim())
                .filter((service): service is string => Boolean(service)),
            ),
          ).size;
          const domainNoteProgress = filledFieldCount(domainNotebook);
          return (
            <article className="domain-card" key={group.domain}>
              <button className="domain-row" type="button" onClick={() => toggleDomain(group.domain)}>
                {isDomainExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <strong>{group.domain}</strong>
                <span>{uniqueHosts} hosts</span>
                <span>{domainControllers} DC</span>
                <span>{domainNoteProgress}/{domainNoteFields.length} notas</span>
              </button>
              {isDomainExpanded && (
                <div className="domain-details">
                  <div className="domain-kpi-grid">
                    <span>
                      <strong>Hosts</strong>
                      {uniqueHosts}
                    </span>
                    <span>
                      <strong>DC</strong>
                      {domainControllers}
                    </span>
                    <span>
                      <strong>Puertos</strong>
                      {totalPorts}
                    </span>
                    <span>
                      <strong>Servicios</strong>
                      {exposedServices}
                    </span>
                  </div>
                  <div className="domain-host-grid">
                    {group.assets.map((asset) => (
                      <div className="domain-host-row" key={asset.id}>
                        <strong>{asset.hostname || "sin hostname"}</strong>
                        <span>{asset.ip_address}</span>
                        <span>{asset.domain || "sin dominio"}</span>
                        <span>{adSurfaceLabels(asset).join(", ") || "sin rol claro"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="note-grid">
                    {domainNoteFields.map((field) => (
                      <label key={field.key}>
                        {field.label}
                        <textarea
                          value={domainNotebook[field.key]}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            updateDomainNotebook(group.domain, { [field.key]: event.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {assets.map((asset) => {
          const isEditing = editingId === asset.id;
          const isExpanded = expandedIds.has(asset.id) || isEditing;
          const draft = drafts[asset.id] ?? asset;
          const machineNotebook = { ...emptyMachineNotebook, ...(entityNotebook.machines[asset.id] ?? {}) };
          const portsSectionId = `${asset.id}:ports`;
          const sharesSectionId = `${asset.id}:shares`;
          const localUsersSectionId = `${asset.id}:local-users`;
          const credentialsSectionId = `${asset.id}:credentials`;
          const sectionIsExpanded = (sectionId: string) => isEditing || expandedSections.has(sectionId);
          const surfaceLabels = adSurfaceLabels(asset);
          const noteProgress = filledFieldCount(machineNotebook);
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
                    <span>{displayedPortDetails(asset).length} puertos</span>
                    <span>{noteProgress}/{machineNoteFields.length} notas</span>
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
                    <div className="asset-details entity-sections">
                      <div className="entity-summary-grid">
                        <span>
                          <strong>DC</strong>
                          {asset.kind === "domain_controller" ? "si" : "no"}
                        </span>
                        <span>
                          <strong>IP</strong>
                          {asset.ip_address}
                        </span>
                        <span>
                          <strong>Dominio</strong>
                          {asset.domain || "sin dominio"}
                        </span>
                        <span>
                          <strong>Puertos</strong>
                          {displayedPortDetails(asset).length}
                        </span>
                        <span>
                          <strong>Notas</strong>
                          {noteProgress}/{machineNoteFields.length}
                        </span>
                      </div>

                      <div className="surface-chip-list">
                        {surfaceLabels.length > 0 ? (
                          surfaceLabels.map((label) => <span key={label}>{label}</span>)
                        ) : (
                          <span>Sin rol AD claro</span>
                        )}
                      </div>

                      <section className="entity-section">
                        <button type="button" onClick={() => toggleSection(portsSectionId)}>
                          {sectionIsExpanded(portsSectionId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Puertos, servicios y versiones
                        </button>
                        {sectionIsExpanded(portsSectionId) && (
                          <div className="service-summary">
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
                          </div>
                        )}
                      </section>

                      <section className="entity-section">
                        <button type="button" onClick={() => toggleSection(sharesSectionId)}>
                          {sectionIsExpanded(sharesSectionId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Shares SMB
                        </button>
                        {sectionIsExpanded(sharesSectionId) && (
                          <div className="domain-host-grid compact-grid">
                            {asset.shares && asset.shares.length > 0 ? (
                              asset.shares.map((share) => (
                                <div className="domain-host-row" key={`${share.name}-${share.account ?? ""}`}>
                                  <strong>{share.name}</strong>
                                  <span>{share.permissions || "sin permisos"}</span>
                                  <span>{share.remark || share.account || "sin detalle"}</span>
                                </div>
                              ))
                            ) : (
                              <span className="empty-text">Sin shares registrados.</span>
                            )}
                          </div>
                        )}
                      </section>

                      <section className="entity-section">
                        <button type="button" onClick={() => toggleSection(localUsersSectionId)}>
                          {sectionIsExpanded(localUsersSectionId) ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          Identidad, sesiones y privilegios
                        </button>
                        {sectionIsExpanded(localUsersSectionId) && (
                          <div className="machine-note-grid">
                            {machineNoteFields.slice(0, 4).map((field) => (
                              <label key={field.key}>
                                {field.label}
                                <textarea
                                  value={machineNotebook[field.key]}
                                  placeholder={field.placeholder}
                                  onChange={(event) =>
                                    updateMachineNotebook(asset.id, { [field.key]: event.target.value })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="entity-section">
                        <button type="button" onClick={() => toggleSection(credentialsSectionId)}>
                          {sectionIsExpanded(credentialsSectionId) ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          Evidencia y siguientes pasos
                        </button>
                        {sectionIsExpanded(credentialsSectionId) && (
                          <div className="machine-note-grid">
                            {machineNoteFields.slice(4).map((field) => (
                              <label key={field.key}>
                                {field.label}
                                <textarea
                                  value={machineNotebook[field.key]}
                                  placeholder={
                                    field.key === "notes" && asset.notes ? asset.notes : field.placeholder
                                  }
                                  onChange={(event) =>
                                    updateMachineNotebook(asset.id, { [field.key]: event.target.value })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </section>
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
