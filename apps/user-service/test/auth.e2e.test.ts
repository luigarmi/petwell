import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.SERVICE_NAME = 'user-service';
  process.env.CORS_ORIGIN = 'http://localhost';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/petwell_user_test';
  process.env.PUBLIC_APP_URL = 'http://localhost';
  process.env.MAIL_FROM = 'hello@petwell.local';
}

async function createApp() {
  applyTestEnv();

  const [{ AuthController }, { AuthService }] = await Promise.all([
    import('../src/auth.controller'),
    import('../src/auth.service')
  ]);

  const authService = {
    getDemoUsers: () => [{ email: 'demo@petwell.local', role: 'pet_owner' }],
    registerOwner: (dto: Record<string, unknown>) => ({
      id: 'owner-1',
      ...dto
    })
  };

  @Module({
    controllers: [AuthController],
    providers: [
      {
        provide: AuthService,
        useValue: authService
      }
    ]
  })
  class TestModule {}

  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, authService };
}

test('GET /auth/demo-users returns configured demo accounts', async () => {
  const { app } = await createApp();

  try {
    const response = await request(app.getHttpServer()).get('/auth/demo-users').expect(200);
    assert.deepEqual(response.body, [{ email: 'demo@petwell.local', role: 'pet_owner' }]);
  } finally {
    await app.close();
  }
});

test('POST /auth/register creates an owner through the public route', async () => {
  const { app } = await createApp();

  try {
    const successResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'Torres',
        email: 'ana@petwell.local',
        phone: '3001001001',
        password: 'Petwell123!'
      })
      .expect(201);

    assert.equal(successResponse.body.id, 'owner-1');
    assert.equal(successResponse.body.email, 'ana@petwell.local');
  } finally {
    await app.close();
  }
});
