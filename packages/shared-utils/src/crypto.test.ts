import assert from 'node:assert/strict';
import test from 'node:test';

import { decryptString, encryptString } from './crypto';

test('encryptString and decryptString are symmetric', () => {
  const secret = 'field-encryption-secret';
  const cipherText = encryptString('PetWell', secret);

  assert.notEqual(cipherText, 'PetWell');
  assert.equal(decryptString(cipherText, secret), 'PetWell');
});
