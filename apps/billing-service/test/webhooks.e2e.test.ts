import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3005';
  process.env.SERVICE_NAME = 'billing-service';
  process.env.CORS_ORIGIN = 'http://localhost';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/petwell_billing_test';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.PAYMENT_CURRENCY = 'COP';
  process.env.PUBLIC_APP_URL = 'http://localhost';
  process.env.API_PUBLIC_URL = 'http://localhost/api';
  process.env.MINIO_ENDPOINT = 'localhost';
  process.env.MINIO_PORT = '9000';
  process.env.MINIO_ACCESS_KEY = 'minioadmin';
  process.env.MINIO_SECRET_KEY = 'minioadmin';
  process.env.MINIO_BUCKET = 'petwell-assets';
}

test('billing webhook endpoints delegate provider payloads', async () => {
  applyTestEnv();

  const [{ BillingController }, { BillingService }] = await Promise.all([
    import('../src/billing.controller'),
    import('../src/billing.service')
  ]);

  const billingService = {
    handleProviderWebhook: (
      provider: string,
      body: Record<string, unknown>,
      headers: Record<string, string | string[] | undefined>,
      query: Record<string, string | undefined>
    ) => ({
      provider,
      receivedEvent: body.event ?? null,
      signature: headers['x-signature'] ?? null,
      externalId: query.id ?? null
    })
  };

  @Module({
    controllers: [BillingController],
    providers: [
      {
        provide: BillingService,
        useValue: billingService
      }
    ]
  })
  class TestModule {}

  const app = await NestFactory.create(TestModule, { logger: false });
  await app.init();

  try {
    const wompiResponse = await request(app.getHttpServer())
      .post('/billing/webhooks/wompi?id=wompi-event-1')
      .set('x-signature', 'wompi-signature')
      .send({ event: 'transaction.updated' })
      .expect(201);

    assert.equal(wompiResponse.body.provider, 'wompi');
    assert.equal(wompiResponse.body.receivedEvent, 'transaction.updated');
    assert.equal(wompiResponse.body.externalId, 'wompi-event-1');

    const mercadoPagoResponse = await request(app.getHttpServer())
      .post('/billing/webhooks/mercadopago?id=mp-event-1')
      .set('x-signature', 'mercadopago-signature')
      .send({ event: 'payment.updated' })
      .expect(201);

    assert.equal(mercadoPagoResponse.body.provider, 'mercadopago');
    assert.equal(mercadoPagoResponse.body.receivedEvent, 'payment.updated');
    assert.equal(mercadoPagoResponse.body.externalId, 'mp-event-1');
  } finally {
    await app.close();
  }
});
