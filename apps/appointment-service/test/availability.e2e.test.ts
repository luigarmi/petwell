import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';

function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3004';
  process.env.SERVICE_NAME = 'appointment-service';
  process.env.CORS_ORIGIN = 'http://localhost';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/petwell_appointment_test';
  process.env.USER_SERVICE_URL = 'http://localhost:3001';
}

test('GET /availability returns public availability data', async () => {
  applyTestEnv();

  const [{ AppointmentController }, { AppointmentService }] = await Promise.all([
    import('../src/appointment.controller'),
    import('../src/appointment.service')
  ]);

  let lastQuery: Record<string, unknown> | undefined;
  const appointmentService = {
    getAvailability: (query: Record<string, unknown>) => {
      lastQuery = query;
      return [
        {
          startsAt: '2026-04-21T10:00:00.000Z',
          available: true
        }
      ];
    }
  };

  @Module({
    controllers: [AppointmentController],
    providers: [
      {
        provide: AppointmentService,
        useValue: appointmentService
      }
    ]
  })
  class TestModule {}

  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  try {
    const response = await request(app.getHttpServer())
      .get('/availability')
      .query({
        clinicId: 'clinic-1',
        veterinarianId: 'vet-1',
        date: '2026-04-21'
      })
      .expect(200);

    assert.deepEqual(response.body, [{ startsAt: '2026-04-21T10:00:00.000Z', available: true }]);
    assert.deepEqual({ ...lastQuery }, {
      clinicId: 'clinic-1',
      veterinarianId: 'vet-1',
      date: '2026-04-21'
    });
  } finally {
    await app.close();
  }
});
