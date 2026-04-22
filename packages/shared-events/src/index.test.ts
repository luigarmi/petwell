import assert from 'node:assert/strict';
import test from 'node:test';

import { createEventPayload } from './index';

test('createEventPayload appends a generated eventId', () => {
  const payload = createEventPayload({ appointmentId: '123' });

  assert.equal(payload.appointmentId, '123');
  assert.equal(typeof payload.eventId, 'string');
});
