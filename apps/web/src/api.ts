export const API_BASE = __PETWELL_API_BASE__;

function resolveNetworkErrorMessage() {
  if (typeof window !== "undefined") {
    try {
      const apiUrl = new URL(API_BASE);
      const appUrl = new URL(window.location.href);

      if (
        appUrl.hostname !== "localhost" &&
        appUrl.hostname !== "127.0.0.1" &&
        (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1")
      ) {
        return "El frontend esta publicado, pero sigue apuntando a localhost. Configura PETWELL_API_BASE con la URL publica del gateway.";
      }
    } catch {
    }
  }

  return "No fue posible conectar con el servidor. Verifica que el backend este publicado y que CORS permita este dominio.";
}

function normalizeErrorMessage(message: string) {
  const cleaned = message.trim();
  const lower = cleaned.toLowerCase();

  if (lower.includes("failed to fetch")) {
    return resolveNetworkErrorMessage();
  }

  if (lower.includes("missing petwell_gateway_url")) {
    return "El despliegue no tiene configurada la URL publica del gateway. Define PETWELL_GATEWAY_URL en Vercel.";
  }

  if (lower.includes("gateway unavailable")) {
    return "No fue posible conectar con el gateway publico. Verifica el despliegue del backend.";
  }

  if (lower.includes("gateway route not found") || lower.includes("page could not be found") || lower.includes("not_found")) {
    return "La URL publica del gateway no responde con la API esperada. Revisa PETWELL_GATEWAY_URL y el despliegue del backend.";
  }

  if (lower.includes("invalid input syntax for type uuid")) {
    return "Uno de los datos enviados no tiene un identificador valido. Recarga el portal e intenta de nuevo.";
  }

  if (lower.includes("clinic access denied")) {
    return "No tienes acceso a la clinica seleccionada.";
  }

  if (lower.includes("insufficient permissions")) {
    return "Tu rol no tiene permisos para ejecutar esta accion.";
  }

  if (lower.includes("record access denied") || lower.includes("vaccination access denied")) {
    return "No tienes permiso para consultar la historia clinica de esta mascota.";
  }

  if (lower.includes("active ehr consent required")) {
    return "Esta accion requiere un consentimiento EHR activo.";
  }

  if (lower.includes("selected time slot is no longer available")) {
    return "Ese horario ya no esta disponible. Elige otra franja.";
  }

  if (lower.includes("requested slot is outside the registered availability")) {
    return "La cita esta fuera de la disponibilidad configurada.";
  }

  if (lower.includes("pet ownership required")) {
    return "Solo el propietario de la mascota puede realizar esta accion.";
  }

  return cleaned || "No fue posible completar la solicitud.";
}

async function readApiError(response: Response) {
  const text = (await response.text()).trim();

  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return normalizeErrorMessage(parsed.error ?? parsed.message ?? text);
  } catch {
    return normalizeErrorMessage(text);
  }
}

export async function api<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch";
    throw new Error(normalizeErrorMessage(message));
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
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
