import assert from 'node:assert/strict';
import test from 'node:test';

import { commonEnvSchema, loadEnv } from './index';

test('loadEnv parses expected primitives', () => {
  const parsed = loadEnv(commonEnvSchema, {
    PORT: '3000',
    SERVICE_NAME: 'test-service',
    JWT_ACCESS_SECRET: '1234567890123456',
    JWT_REFRESH_SECRET: 'abcdefabcdefabcd',
    RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
    REDIS_URL: 'redis://localhost:6379'
  });

  assert.equal(parsed.PORT, 3000);
  assert.equal(parsed.SERVICE_NAME, 'test-service');
});
