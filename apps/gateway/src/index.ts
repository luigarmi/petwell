import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  createProxyMiddleware,
  fixRequestBody,
  type RequestHandler
} from "http-proxy-middleware";
import { v4 as uuidv4 } from "uuid";
import {
  getAllowedOrigins,
  getNumberEnv,
  requireEnv,
  verifyAccessToken
} from "../../../packages/shared/src/index.js";

const app = express();
const port = getNumberEnv("GATEWAY_PORT", 8080);
const publicKey = requireEnv("JWT_PUBLIC_KEY");
const issuer = requireEnv("JWT_ISSUER");
const audience = requireEnv("JWT_AUDIENCE");

const targets = {
  "/users": requireEnv("USER_SERVICE_URL"),
  "/pets": requireEnv("PET_SERVICE_URL"),
  "/ehr": requireEnv("EHR_SERVICE_URL"),
  "/appointments": requireEnv("APPOINTMENT_SERVICE_URL"),
  "/payments": requireEnv("BILLING_SERVICE_URL"),
  "/telemed": requireEnv("TELEMED_SERVICE_URL"),
  "/notifications": requireEnv("NOTIFICATION_SERVICE_URL"),
  "/analytics": requireEnv("ANALYTICS_SERVICE_URL")
} as const;

app.disable("x-powered-by");
app.use(express.json());
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true
  })
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? uuidv4();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    service: "gateway",
    status: "ok",
    now: new Date().toISOString()
  });
});

const isPublicRoute = (method: string, path: string) =>
  (method === "POST" && path === "/users/register") ||
  (method === "POST" && path === "/users/login") ||
  (method === "GET" && path === "/health");

app.use((req, res, next) => {
  if (isPublicRoute(req.method, req.path) || req.method === "OPTIONS") {
    next();
    return;
  }

  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const user = verifyAccessToken(authHeader.slice(7), publicKey, issuer, audience);
    req.headers["x-user-id"] = user.id;
    req.headers["x-user-email"] = user.email;
    req.headers["x-user-roles"] = user.roles.join(",");
    next();
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Invalid token"
    });
  }
});

function buildProxy(target: string, routePrefix: string): RequestHandler {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => `${routePrefix}${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const correlationId =
          typeof req.headers["x-correlation-id"] === "string"
            ? req.headers["x-correlation-id"]
            : uuidv4();
        proxyReq.setHeader("x-correlation-id", correlationId);

        if (typeof req.headers["x-user-id"] === "string") {
          proxyReq.setHeader("x-user-id", req.headers["x-user-id"]);
          proxyReq.setHeader("x-user-email", String(req.headers["x-user-email"] ?? ""));
          proxyReq.setHeader("x-user-roles", String(req.headers["x-user-roles"] ?? ""));
        }

        fixRequestBody(proxyReq, req);
      }
    }
  });
}

for (const [route, target] of Object.entries(targets)) {
  app.use(route, buildProxy(target, route));
}

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(port, () => {
  console.log(`gateway listening on ${port}`);
});
