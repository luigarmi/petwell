import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3002';
  process.env.SERVICE_NAME = 'pet-service';
  process.env.CORS_ORIGIN = 'http://localhost';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/petwell_pet_test';
}

test('GET /health returns service status', async () => {
  applyTestEnv();

  const [{ HealthController }, { AppHealthService }] = await Promise.all([
    import('../src/health.controller'),
    import('../src/health.service')
  ]);

  const healthService = {
    liveness: () => ({
      mode: 'live',
      ready: true,
      service: 'pet-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1
    }),
    readiness: async () => ({
      checks: [
        {
          critical: true,
          latencyMs: 1,
          name: 'postgres',
          status: 'up',
          type: 'database'
        }
      ],
      mode: 'ready',
      ready: true,
      service: 'pet-service',
      status: 'ok',
      summary: {
        criticalDown: 0,
        down: 0,
        total: 1,
        up: 1
      },
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1
    })
  };

  @Module({
    controllers: [HealthController],
    providers: [
      {
        provide: AppHealthService,
        useValue: healthService
      }
    ]
  })
  class TestModule {}

  const app = await NestFactory.create(TestModule, { logger: false });
  await app.init();

  try {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.service, 'pet-service');
    assert.equal(typeof response.body.timestamp, 'string');

    const liveResponse = await request(app.getHttpServer()).get('/health/live').expect(200);
    assert.equal(liveResponse.body.mode, 'live');
    assert.equal(liveResponse.body.service, 'pet-service');
  } finally {
    await app.close();
  }
});
