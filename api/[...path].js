import { buffer } from "node:stream/consumers";
import {
  canUseIntegratedApi,
  handleIntegratedApiRequest,
  isHttpError
} from "./_lib/petwell-monolith.js";

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

function shouldProxyToGateway() {
  return (process.env.PETWELL_API_MODE ?? "").trim().toLowerCase() === "proxy";
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

function requestBaseUrl(req) {
  const protocolHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader?.split(",")[0] || "https";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || "petwell.local";
  return `${protocol}://${host}`;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function proxyToGateway(req, res, incomingUrl, rawBody) {
  const gatewayBaseUrl = getGatewayBaseUrl();

  if (!gatewayBaseUrl) {
    json(res, 500, {
      error: "Missing PETWELL_GATEWAY_URL. Configure the public gateway URL in the Vercel project."
    });
    return;
  }

  const upstreamPath = incomingUrl.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = new URL(`${gatewayBaseUrl}${upstreamPath}${incomingUrl.search}`);
  const headers = copyRequestHeaders(req);

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: rawBody?.length ? rawBody : undefined
    });
  } catch {
    json(res, 502, {
      error: "Gateway unavailable. Verify PETWELL_GATEWAY_URL and the backend deployment."
    });
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
    json(res, 502, {
      error: "Gateway route not found. Verify PETWELL_GATEWAY_URL and the backend deployment."
    });
    return;
  }

  setResponseHeaders(res, upstream);
  res.statusCode = upstream.status;
  res.end(payload);
}

export default async function handler(req, res) {
  const incomingUrl = new URL(req.url ?? "/api", "https://petwell.local");
  const rawBody =
    req.method && !["GET", "HEAD"].includes(req.method.toUpperCase()) ? await buffer(req) : null;

  const preferIntegrated = canUseIntegratedApi() && !shouldProxyToGateway();
  if (preferIntegrated) {
    try {
      const result = await handleIntegratedApiRequest({
        path: incomingUrl.pathname.replace(/^\/api/, "") || "/",
        method: req.method ?? "GET",
        token: req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : undefined,
        bodyText: rawBody?.length ? rawBody.toString("utf8") : "",
        baseUrl: requestBaseUrl(req)
      });

      json(res, result.status, result.payload);
      return;
    } catch (error) {
      if (isHttpError(error)) {
        json(res, error.status, { error: error.message });
        return;
      }

      json(res, 500, {
        error: error instanceof Error ? error.message : "Integrated API unavailable."
      });
      return;
    }
  }

  if (getGatewayBaseUrl()) {
    await proxyToGateway(req, res, incomingUrl, rawBody);
    return;
  }

  json(res, 500, {
    error:
      "Missing PETWELL_APP_DB_URL or PETWELL_GATEWAY_URL. Configure integrated database access or an external gateway."
  });
}
