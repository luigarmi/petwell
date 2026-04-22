import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { configureNestApp } from '@petwell/shared-utils';

import { AppModule } from './app.module';
import { env } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  await configureNestApp(app, {
    serviceName: env.SERVICE_NAME,
    serviceDescription: 'Telemedicine rooms service',
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    logFilePath: env.LOG_FILE_PATH
  });

  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
