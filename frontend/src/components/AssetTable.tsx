import type { Asset } from "../api/assets";

type AssetTableProps = {
  assets: Asset[];
};

export function AssetTable({ assets }: AssetTableProps) {
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
        {assets.map((asset) => (
          <article className="asset-row" key={asset.id}>
            <strong>{asset.hostname || asset.ip_address}</strong>
            <span>{asset.ip_address}</span>
            <span>{asset.domain || "sin dominio"}</span>
            <span>{asset.services.join(", ") || "sin servicios"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
