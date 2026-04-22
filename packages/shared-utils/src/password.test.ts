import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from './password';

test('hashPassword generates a verifiable hash', async () => {
  const hashed = await hashPassword('demo-password');

  assert.equal(await verifyPassword('demo-password', hashed), true);
  assert.equal(await verifyPassword('invalid-password', hashed), false);
});
