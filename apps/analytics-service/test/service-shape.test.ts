import assert from 'node:assert/strict';
import test from 'node:test';

import { EVENT_NAMES } from '@petwell/shared-types';

test('analytics event catalog includes payment and appointment signals', () => {
  assert.equal(Object.values(EVENT_NAMES).includes('payment.succeeded'), true);
  assert.equal(Object.values(EVENT_NAMES).includes('appointment.created'), true);
});
