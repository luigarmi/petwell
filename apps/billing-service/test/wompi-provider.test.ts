import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentStatus } from '@petwell/shared-types';

test('Wompi webhook maps APPROVED status', async () => {
  process.env.PORT = '3005';
  process.env.SERVICE_NAME = 'billing-service';
  process.env.JWT_ACCESS_SECRET = '1234567890123456';
  process.env.JWT_REFRESH_SECRET = 'abcdefabcdefabcd';
  process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/petwell_billing';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.PAYMENT_CURRENCY = 'COP';
  process.env.PUBLIC_APP_URL = 'http://localhost';
  process.env.API_PUBLIC_URL = 'http://localhost/api';
  process.env.MINIO_ENDPOINT = 'localhost';
  process.env.MINIO_PORT = '9000';
  process.env.MINIO_ACCESS_KEY = 'minioadmin';
  process.env.MINIO_SECRET_KEY = 'minioadmin';
  process.env.MINIO_BUCKET = 'petwell-assets';

  const { WompiProvider } = await import('../src/providers/wompi.provider');
  const provider = new WompiProvider();
  const result = await provider.resolveWebhook({
    body: {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'txn_1',
          reference: 'ref_1',
          status: 'APPROVED',
          amount_in_cents: 1000
        }
      },
      timestamp: 123,
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
        checksum: ''
      }
    },
    headers: {},
    query: {}
  });

  assert.equal(result.paymentStatus, PaymentStatus.APPROVED);
});
