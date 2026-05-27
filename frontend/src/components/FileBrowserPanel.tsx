import { ArrowUp, FileText, Folder, FolderOpen, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { listFiles, readFile, type FileEntry } from "../api/files";

type FileBrowserPanelProps = {
  initialPath: string;
};

export function FileBrowserPanel({ initialPath }: FileBrowserPanelProps) {
  const [path, setPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function refresh(nextPath = path) {
    setError(null);
    try {
      const payload = await listFiles(nextPath);
      setPath(payload.path);
      setEntries(payload.entries);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo listar la carpeta");
    }
  }

  async function openEntry(entry: FileEntry) {
    if (entry.kind === "directory") {
      setPreview("");
      setPreviewPath(null);
      await refresh(entry.path);
      return;
    }

    setError(null);
    try {
      setPreview(await readFile(entry.path));
      setPreviewPath(entry.path);
    } catch (requestError) {
      setPreview("");
      setPreviewPath(entry.path);
      setError(requestError instanceof Error ? requestError.message : "No se pudo abrir el fichero");
    }
  }

  function parentPath(currentPath: string) {
    const normalized = currentPath.replace(/\\/g, "/").replace(/\/+$/, "");
    const index = normalized.lastIndexOf("/");
    if (index <= 0) {
      return normalized || "data/downloads";
    }
    return normalized.slice(0, index);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  useEffect(() => {
    setPath(initialPath);
    refresh(initialPath).catch(() => undefined);
  }, [initialPath]);

  return (
    <section className="panel file-browser-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Loot</p>
          <h2>Ficheros descargados</h2>
        </div>
        <button aria-label="Refrescar ficheros" className="icon-button static" type="button" onClick={() => refresh()}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="file-path-row">
        <input value={path} onChange={(event) => setPath(event.target.value)} />
        <button
          aria-label="Subir un directorio"
          className="icon-button secondary"
          type="button"
          onClick={() => refresh(parentPath(path))}
        >
          <ArrowUp size={16} />
        </button>
        <button type="button" onClick={() => refresh()}>
          Abrir
        </button>
      </div>

      {error && <p className="run-error">{error}</p>}

      <div className="file-browser-grid">
        <div className="file-list">
          {entries.length === 0 && <p className="empty-text">No hay ficheros en esta carpeta.</p>}
          {entries.map((entry) => (
            <button className="file-entry" key={entry.path} type="button" onClick={() => openEntry(entry)}>
              {entry.kind === "directory" ? <Folder size={16} /> : <FileText size={16} />}
              <span>{entry.name}</span>
              <small>{entry.kind === "file" ? `${entry.size} bytes` : "directorio"}</small>
            </button>
          ))}
        </div>

        <div className="file-preview">
          <div className="file-preview-title">
            <FolderOpen size={16} />
            <span>{previewPath ?? "Selecciona un fichero de texto"}</span>
          </div>
          {preview ? <pre>{preview}</pre> : <p className="empty-text">Sin preview.</p>}
        </div>
      </div>
    </section>
  );
}
