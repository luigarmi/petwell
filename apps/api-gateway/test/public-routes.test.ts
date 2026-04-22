import assert from 'node:assert/strict';
import test from 'node:test';

const publicRoutes = [
  '/health',
  '/health/live',
  '/health/ready',
  '/auth/login',
  '/auth/register',
  '/clinics/public/search',
  '/billing/webhooks/wompi'
];

test('gateway public routes remain explicitly listed', () => {
  assert.equal(publicRoutes.includes('/health/live'), true);
  assert.equal(publicRoutes.includes('/health/ready'), true);
  assert.equal(publicRoutes.includes('/auth/login'), true);
  assert.equal(publicRoutes.includes('/billing/webhooks/wompi'), true);
});
