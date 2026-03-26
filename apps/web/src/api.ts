import { handleDemoApiRequest } from "./demo-backend.js";

export const API_BASE = __PETWELL_API_BASE__;

type RuntimeMode = "remote" | "demo";

let runtimeMode: RuntimeMode = "remote";

function setRuntimeMode(mode: RuntimeMode) {
  if (runtimeMode === mode) {
    return;
  }

  runtimeMode = mode;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("petwell-runtime-mode", { detail: mode }));
  }
}

export function isUsingDemoBackend() {
  return runtimeMode === "demo";
}

function shouldUseDemoFallback(message: string) {
  const lower = message.trim().toLowerCase();

  return (
    lower.includes("failed to fetch") ||
    lower.includes("missing petwell_app_db_url") ||
    lower.includes("missing petwell_gateway_url") ||
    lower.includes("integrated api unavailable") ||
    lower.includes("gateway unavailable") ||
    lower.includes("gateway route not found") ||
    lower.includes("page could not be found") ||
    lower.includes("not_found")
  );
}

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
        return "Estamos terminando de conectar tus datos. Mientras tanto puedes seguir explorando la plataforma.";
      }
    } catch {
    }
  }

  return "En este momento no pudimos conectar tu informacion. Intenta de nuevo en unos minutos.";
}

function normalizeErrorMessage(message: string) {
  const cleaned = message.trim();
  const lower = cleaned.toLowerCase();

  if (lower.includes("failed to fetch")) {
    return resolveNetworkErrorMessage();
  }

  if (lower.includes("missing petwell_app_db_url")) {
    return "Estamos terminando de conectar tu espacio. Puedes seguir recorriendo la plataforma mientras completamos la configuracion.";
  }

  if (lower.includes("missing petwell_gateway_url")) {
    return "Estamos terminando de preparar tu espacio. Puedes seguir navegando mientras completamos la conexion.";
  }

  if (lower.includes("integrated api unavailable")) {
    return "En este momento no pudimos abrir tu espacio completo. Intenta de nuevo en unos minutos.";
  }

  if (lower.includes("gateway unavailable")) {
    return "En este momento no pudimos cargar toda la informacion. Vuelve a intentarlo mas tarde.";
  }

  if (lower.includes("gateway route not found") || lower.includes("page could not be found") || lower.includes("not_found")) {
    return "Tu informacion aun se esta preparando. Puedes seguir usando la plataforma mientras completamos la conexion.";
  }

  if (lower.includes("invalid email or password") || lower.includes("invalid credentials")) {
    return "El correo o la contrasena no coinciden. Revisa tus datos e intenta de nuevo.";
  }

  if (lower.includes("missing required registration fields")) {
    return "Completa los datos principales para crear tu cuenta.";
  }

  if (lower.includes("email already registered")) {
    return "Ese correo ya tiene una cuenta. Intenta entrar o usa otro correo.";
  }

  if (lower.includes("invalid input syntax for type uuid")) {
    return "Uno de los datos no se pudo guardar. Revisa la informacion e intenta otra vez.";
  }

  if (lower.includes("clinic access denied")) {
    return "No puedes ver la informacion de esa clinica.";
  }

  if (lower.includes("insufficient permissions")) {
    return "Esta opcion no esta disponible para tu perfil.";
  }

  if (lower.includes("record access denied") || lower.includes("vaccination access denied")) {
    return "No puedes ver la historia clinica de esta mascota.";
  }

  if (lower.includes("active ehr consent required")) {
    return "Primero necesitas una autorizacion activa para continuar.";
  }

  if (lower.includes("selected time slot is no longer available")) {
    return "Ese horario ya no esta disponible. Elige otro.";
  }

  if (lower.includes("requested slot is outside the registered availability")) {
    return "La hora elegida no esta disponible.";
  }

  if (lower.includes("pet ownership required")) {
    return "Solo la persona responsable de la mascota puede hacer este cambio.";
  }

  return cleaned || "No fue posible completar la solicitud.";
}

async function readApiError(response: Response) {
  const text = (await response.text()).trim();

  if (!text) {
    return {
      raw: `HTTP ${response.status}`,
      normalized: `HTTP ${response.status}`
    };
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    const raw = parsed.error ?? parsed.message ?? text;
    return {
      raw,
      normalized: normalizeErrorMessage(raw)
    };
  } catch {
    return {
      raw: text,
      normalized: normalizeErrorMessage(text)
    };
  }
}

export async function api<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  if (runtimeMode === "demo") {
    return handleDemoApiRequest<T>(path, token, init);
  }

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
    if (shouldUseDemoFallback(message)) {
      setRuntimeMode("demo");
      return handleDemoApiRequest<T>(path, token, init);
    }
    throw new Error(normalizeErrorMessage(message));
  }

  if (!response.ok) {
    const errorInfo = await readApiError(response);

    if (shouldUseDemoFallback(errorInfo.raw) || shouldUseDemoFallback(errorInfo.normalized)) {
      setRuntimeMode("demo");
      return handleDemoApiRequest<T>(path, token, init);
    }

    throw new Error(errorInfo.normalized);
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
  return ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"][day] ?? `Dia ${day}`;
}
