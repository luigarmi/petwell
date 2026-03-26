import express, { type NextFunction, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { AuthContext, Role } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user: AuthContext | null;
    }
  }
}

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createBaseApp(serviceName: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((req, res, next) => {
    req.correlationId = req.header("x-correlation-id") ?? uuidv4();
    req.user = readUserFromHeaders(req);
    res.setHeader("x-correlation-id", req.correlationId);
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      service: serviceName,
      status: "ok",
      now: new Date().toISOString()
    });
  });

  return app;
}

export function readUserFromHeaders(req: Request): AuthContext | null {
  const id = req.header("x-user-id");
  const email = req.header("x-user-email");
  const rawRoles = req.header("x-user-roles");

  if (!id || !email || !rawRoles) {
    return null;
  }

  return {
    id,
    email,
    roles: rawRoles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean) as Role[]
  };
}

export function requireAuth(req: Request): AuthContext {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }
  return req.user;
}

export function requireRoles(user: AuthContext, allowed: Role[]): void {
  if (!allowed.some((role) => user.roles.includes(role))) {
    throw new HttpError(403, "Insufficient permissions");
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function attachErrorHandler(app: express.Express): void {
  app.use(
    (
      error: unknown,
      req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : "Unexpected error";

      console.error(`[${req.correlationId}]`, error);

      res.status(statusCode).json({
        error: message,
        correlationId: req.correlationId
      });
    }
  );
}
