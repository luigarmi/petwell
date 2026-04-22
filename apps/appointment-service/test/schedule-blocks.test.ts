import assert from 'node:assert/strict';
import test from 'node:test';

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

test('getAvailability marks blocked slots as unavailable with reason', async () => {
  applyTestEnv();
  const { AppointmentService } = await import('../src/appointment.service');

  const service = new AppointmentService(
    {
      scheduleTemplate: {
        findMany: async () => [
          {
            id: 'schedule-1',
            clinicId: 'clinic-1',
            veterinarianId: 'vet-1',
            weekday: 1,
            startTime: '09:00',
            endTime: '11:00',
            slotDurationMinutes: 30,
            active: true
          }
        ]
      },
      scheduleBlock: {
        findMany: async () => [
          {
            id: 'block-1',
            clinicId: 'clinic-1',
            veterinarianId: 'vet-1',
            startsAt: new Date('2026-04-20T10:00:00.000Z'),
            endsAt: new Date('2026-04-20T10:30:00.000Z'),
            reason: 'Bloqueo operativo'
          }
        ]
      },
      appointment: {
        findMany: async () => []
      }
    } as never,
    {} as never,
    {} as never
  );

  const slots = await service.getAvailability({
    clinicId: 'clinic-1',
    veterinarianId: 'vet-1',
    date: '2026-04-20'
  });

  assert.equal(slots.length, 4);
  assert.equal(slots[2]?.startsAt, '2026-04-20T10:00:00.000Z');
  assert.equal(slots[2]?.available, false);
  assert.equal(slots[2]?.blockReason, 'Bloqueo operativo');
  assert.equal(slots[1]?.available, true);
});
