import assert from 'node:assert/strict';
import test from 'node:test';

const originalEnv = { ...process.env };

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3006',
  SERVICE_NAME: 'telemed-service',
  JWT_ACCESS_SECRET: 'test-access-secret-12345',
  JWT_REFRESH_SECRET: 'test-refresh-secret-12345',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGIN: 'http://localhost',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/petwell_telemed',
  PUBLIC_APP_URL: 'http://localhost',
  TELEMED_PROVIDER: 'daily',
  DAILY_API_KEY: 'daily-test-key'
});

test('daily provider creates a private room URL with a meeting token', async () => {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = global.fetch;

  global.fetch = (async (url, init) => {
    fetchCalls.push({ url: String(url), init });

    if (fetchCalls.length === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://petwell.daily.co/room-123' })
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ token: 'meeting-token-123' })
    } as Response;
  }) as typeof fetch;

  try {
    const { DailyTelemedProvider } = await import('../src/providers/daily-telemed.provider');
    const provider = new DailyTelemedProvider();
    const result = await provider.createRoom({
      roomId: 'room-123',
      appointmentId: 'appointment-123',
      ownerId: 'owner-123',
      veterinarianId: 'vet-123',
      startsAt: '2026-04-20T15:00:00.000Z',
      durationMinutes: 30
    });

    assert.equal(result.provider, 'daily');
    assert.equal(result.joinToken, 'meeting-token-123');
    assert.equal(result.roomUrl, 'https://petwell.daily.co/room-123?t=meeting-token-123');
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0]?.url, 'https://api.daily.co/v1/rooms');
    assert.equal(fetchCalls[1]?.url, 'https://api.daily.co/v1/meeting-tokens');
    assert.equal((fetchCalls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer daily-test-key');
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnv;
  }
});
