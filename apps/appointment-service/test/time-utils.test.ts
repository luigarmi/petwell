import assert from 'node:assert/strict';
import test from 'node:test';

import { addMinutes, combineDateAndTime } from '../src/time.utils';

test('combineDateAndTime builds a deterministic UTC slot', () => {
  const base = new Date('2026-04-20T00:00:00.000Z');
  const slot = combineDateAndTime(base, '08:30');

  assert.equal(slot.toISOString(), '2026-04-20T08:30:00.000Z');
  assert.equal(addMinutes(slot, 30).toISOString(), '2026-04-20T09:00:00.000Z');
});
