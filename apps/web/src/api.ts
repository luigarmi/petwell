export const API_BASE = __PETWELL_API_BASE__;

export async function api<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function formatDate(value?: string) {
  if (!value) {
    return "Sin fecha";
  }
  return new Date(value).toLocaleString("es-CO");
}

export function dayName(day: number) {
  return ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][day] ?? `Dia ${day}`;
}
