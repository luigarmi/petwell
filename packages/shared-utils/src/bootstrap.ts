import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { createMetricsRegistry } from './metrics';
import { JsonLogger } from './logger';

export interface BootstrapOptions {
  serviceName: string;
  serviceDescription: string;
  serviceVersion?: string;
  port: number;
  corsOrigin?: string;
  logFilePath?: string;
}

export async function configureNestApp(app: INestApplication, options: BootstrapOptions) {
  let logger: JsonLogger | undefined;

  try {
    const resolvedLogger = await app.resolve(JsonLogger, undefined, { strict: false });
    resolvedLogger.setContext(options.serviceName, options.logFilePath);
    logger = resolvedLogger;
  } catch {
    logger = undefined;
  }

  app.useLogger(logger ?? false);
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: options.corsOrigin === '*' ? true : options.corsOrigin?.split(',') ?? true,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  const config = new DocumentBuilder()
    .setTitle(`${options.serviceName} API`)
    .setDescription(options.serviceDescription)
    .setVersion(options.serviceVersion ?? '1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const { registry, httpRequests, httpLatency } = createMetricsRegistry(options.serviceName);
  const instance = app.getHttpAdapter().getInstance();

  instance.use((req: { method: string; route?: { path?: string }; path: string }, res: { statusCode: number; on: (event: string, callback: () => void) => void }, next: () => void) => {
    const startedAt = performance.now();

    res.on('finish', () => {
      const route = req.route?.path ?? req.path;
      const statusCode = String(res.statusCode);
      httpRequests.inc({ service: options.serviceName, method: req.method, route, status_code: statusCode });
      httpLatency.observe(
        { service: options.serviceName, method: req.method, route, status_code: statusCode },
        (performance.now() - startedAt) / 1000
      );
    });

    next();
  });

  instance.get('/metrics', async (_req: unknown, res: { setHeader: (name: string, value: string) => void; send: (body: string) => void }) => {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });
}
