export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    clinicIds: string[];
  };
};

function normalizeErrorMessage(status: number, payload: unknown, fallbackText: string) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (fallbackText && !fallbackText.trim().startsWith('<!DOCTYPE')) {
    return fallbackText;
  }

  if (status === 401) {
    return 'Correo o contrasena incorrectos.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'El servicio de acceso no esta disponible en este momento.';
  }

  return `Request failed with status ${status}`;
}

function parseFileName(contentDisposition: string | null, fallbackFileName: string) {
  if (!contentDisposition) {
    return fallbackFileName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="([^"]+)"/i) ?? contentDisposition.match(/filename=([^;]+)/i);
  if (basicMatch?.[1]) {
    return basicMatch[1].trim();
  }

  return fallbackFileName;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let payload: unknown = null;

    if (contentType.includes('application/json') && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    throw new Error(normalizeErrorMessage(response.status, payload, text));
  }

  return response.json() as Promise<T>;
}

export async function downloadApiFile(path: string, accessToken?: string, fallbackFileName = 'archivo.txt') {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let payload: unknown = null;

    if (contentType.includes('application/json') && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    throw new Error(normalizeErrorMessage(response.status, payload, text));
  }

  return {
    blob: await response.blob(),
    fileName: parseFileName(response.headers.get('content-disposition'), fallbackFileName)
  };
}
