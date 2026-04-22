import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPrismaHealthCheck, createReadinessReport } from './health';

test('createReadinessReport marks non critical failures as degraded but ready', async () => {
  const report = await createReadinessReport('test-service', [
    {
      name: 'primary-db',
      type: 'database',
      check: async () => {
        return { query: 'SELECT 1' };
      }
    },
    {
      name: 'optional-provider',
      type: 'provider',
      critical: false,
      check: async () => {
        throw new Error('provider not configured');
      }
    }
  ]);

  assert.equal(report.status, 'degraded');
  assert.equal(report.ready, true);
  assert.equal(report.summary.down, 1);
  assert.equal(report.summary.criticalDown, 0);
});

test('createReadinessReport marks critical failures as error and not ready', async () => {
  const report = await createReadinessReport('test-service', [
    {
      name: 'primary-db',
      type: 'database',
      check: async () => {
        throw new Error('database offline');
      }
    }
  ]);

  assert.equal(report.status, 'error');
  assert.equal(report.ready, false);
  assert.equal(report.summary.down, 1);
  assert.equal(report.summary.criticalDown, 1);
  assert.equal(report.checks[0]?.error, 'database offline');
});

test('createPrismaHealthCheck uses SELECT 1', async () => {
  let lastQuery = '';
  const check = createPrismaHealthCheck('postgres', {
    $queryRawUnsafe: async (query: string) => {
      lastQuery = query;
      return 1;
    }
  });

  await check.check();

  assert.equal(lastQuery, 'SELECT 1');
});
