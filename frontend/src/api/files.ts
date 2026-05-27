export type FileEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number;
  updated_at: number;
};

export type FileList = {
  path: string;
  entries: FileEntry[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function listFiles(path: string): Promise<FileList> {
  const response = await fetch(`${apiBaseUrl}/api/files/list?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error("No se pudo listar el directorio");
  }
  return response.json();
}

export async function readFile(path: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/files/read?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "No se pudo previsualizar el fichero");
  }
  const payload = await response.json();
  return payload.content;
}
