import 'reflect-metadata';

import { createHash } from 'node:crypto';
import type { Socket } from 'node:net';

import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Redis from 'ioredis';

import { configureNestApp, CorrelationIdMiddleware, JsonLogger } from '@petwell/shared-utils';

import { AppModule } from './app.module';
import { env } from './config';

const publicRoutePatterns = [
  /^\/$/,
  /^\/health$/,
  /^\/health\/live$/,
  /^\/health\/ready$/,
  /^\/docs/,
  /^\/auth\/login$/,
  /^\/auth\/register$/,
  /^\/auth\/refresh$/,
  /^\/auth\/forgot-password$/,
  /^\/auth\/reset-password$/,
  /^\/auth\/demo-users$/,
  /^\/clinics\/public\/search$/,
  /^\/clinics\/[^/]+\/services$/,
  /^\/availability$/,
  /^\/billing\/webhooks\/wompi$/,
  /^\/billing\/webhooks\/mercadopago$/
];

function isPublicRoute(path: string) {
  return publicRoutePatterns.some((pattern) => pattern.test(path));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = await app.resolve(JsonLogger);
  const jwtService = new JwtService({ secret: env.JWT_ACCESS_SECRET });
  const redis = new Redis(env.REDIS_URL);
  logger.setContext(env.SERVICE_NAME, env.LOG_FILE_PATH);

  await configureNestApp(app, {
    serviceName: env.SERVICE_NAME,
    serviceDescription: 'PetWell API gateway',
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    logFilePath: env.LOG_FILE_PATH
  });

  const instance = app.getHttpAdapter().getInstance();
  const correlationMiddleware = new CorrelationIdMiddleware();

  instance.use((req: Request, res: Response, next: NextFunction) => correlationMiddleware.use(req, res, next));

  instance.use(async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicRoute(req.path)) {
      return next();
    }

    const fingerprint = createHash('sha1')
      .update(`${req.ip}:${req.path}:${new Date().toISOString().slice(0, 16)}`)
      .digest('hex');

    const key = `gateway:rate:${fingerprint}`;
    const hits = await redis.incr(key);
    if (hits === 1) {
      await redis.expire(key, 60);
    }

    if (hits > 120) {
      return res.status(429).json({
        message: 'Rate limit exceeded',
        correlationId: req.headers['x-correlation-id']
      });
    }

    return next();
  });

  instance.use(async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicRoute(req.path)) {
      return next();
    }

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Missing bearer token',
        correlationId: req.headers['x-correlation-id']
      });
    }

    try {
      const payload = await jwtService.verifyAsync<Record<string, unknown>>(authorization.slice('Bearer '.length), {
        secret: env.JWT_ACCESS_SECRET
      });

      req.headers['x-user-id'] = String(payload.sub ?? '');
      req.headers['x-user-role'] = String(payload.role ?? '');
      req.headers['x-user-clinic-ids'] = JSON.stringify(payload.clinicIds ?? []);

      return next();
    } catch {
      return res.status(401).json({
        message: 'Invalid access token',
        correlationId: req.headers['x-correlation-id']
      });
    }
  });

  const proxies = [
    { path: '/auth', target: env.USER_SERVICE_URL },
    { path: '/users', target: env.USER_SERVICE_URL },
    { path: '/clinics', target: env.USER_SERVICE_URL },
    { path: '/pets', target: env.PET_SERVICE_URL },
    { path: '/ehr', target: env.EHR_SERVICE_URL },
    { path: '/appointments', target: env.APPOINTMENT_SERVICE_URL },
    { path: '/availability', target: env.APPOINTMENT_SERVICE_URL },
    { path: '/schedules', target: env.APPOINTMENT_SERVICE_URL },
    { path: '/waitlist', target: env.APPOINTMENT_SERVICE_URL },
    { path: '/telemed', target: env.TELEMED_SERVICE_URL },
    { path: '/notifications', target: env.NOTIFICATION_SERVICE_URL },
    { path: '/billing', target: env.BILLING_SERVICE_URL },
    { path: '/analytics', target: env.ANALYTICS_SERVICE_URL }
  ];

  for (const proxy of proxies) {
    instance.use(
      proxy.path,
      createProxyMiddleware({
        target: proxy.target,
        changeOrigin: true,
        pathRewrite: (path) => {
          if (path === '/' || path === '') {
            return proxy.path;
          }

          return `${proxy.path}${path.startsWith('/') ? path : `/${path}`}`;
        },
        on: {
          error(error: Error, req: Request, res: Response | Socket) {
            logger.error({ message: 'Gateway proxy error', error: error.message, path: req.url }, 'GatewayProxy');
            if ('status' in res) {
              res.status(502).json({
                message: 'Upstream service unavailable',
                service: proxy.target,
                correlationId: req.headers['x-correlation-id']
              });
            }
          }
        }
      })
    );
  }

  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
