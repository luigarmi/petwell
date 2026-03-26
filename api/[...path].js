import { buffer } from "node:stream/consumers";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function getGatewayBaseUrl() {
  const configured =
    process.env.PETWELL_GATEWAY_URL?.trim() || process.env.PETWELL_API_BASE?.trim();

  if (!configured) {
    return null;
  }

  return configured.replace(/\/+$/, "");
}

function copyRequestHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || hopByHopHeaders.has(key.toLowerCase())) {
      continue;
    }

    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  return headers;
}

function setResponseHeaders(res, upstream) {
  upstream.headers.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      return;
    }

    res.setHeader(key, value);
  });
}

export default async function handler(req, res) {
  const gatewayBaseUrl = getGatewayBaseUrl();

  if (!gatewayBaseUrl) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Missing PETWELL_GATEWAY_URL. Configure the public gateway URL in the Vercel project."
      })
    );
    return;
  }

  const incomingUrl = new URL(req.url ?? "/api", "https://petwell.local");
  const upstreamPath = incomingUrl.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = new URL(`${gatewayBaseUrl}${upstreamPath}${incomingUrl.search}`);

  const headers = copyRequestHeaders(req);
  let body;

  if (req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
    const rawBody = await buffer(req);
    if (rawBody.length) {
      body = rawBody;
    }
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });
  } catch {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "Gateway unavailable. Verify PETWELL_GATEWAY_URL and the backend deployment."
      })
    );
    return;
  }

  const payload = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get("content-type") ?? "";
  const payloadText = contentType.includes("text") || contentType.includes("json") ? payload.toString("utf8") : "";

  if (
    !upstream.ok &&
    contentType.includes("text/html") &&
    (payloadText.includes("NOT_FOUND") || payloadText.toLowerCase().includes("page could not be found"))
  ) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "Gateway route not found. Verify PETWELL_GATEWAY_URL and the backend deployment."
      })
    );
    return;
  }

  setResponseHeaders(res, upstream);
  res.statusCode = upstream.status;
  res.end(payload);
}
