export type WordlistEntry = {
  id: string;
  label: string;
  category: string;
  path: string;
  source: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function listWordlists(): Promise<WordlistEntry[]> {
  const response = await fetch(`${apiBaseUrl}/api/wordlists`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar los diccionarios");
  }
  return response.json();
}
