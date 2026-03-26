export async function fetchJson<T>(
  input: string,
  init?: RequestInit & { correlationId?: string }
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }

  if (init?.correlationId) {
    headers.set("x-correlation-id", init.correlationId);
  }

  const response = await fetch(input, {
    ...init,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
