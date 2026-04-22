import assert from 'node:assert/strict';
import test from 'node:test';

import { Permission, ROLE_PERMISSIONS, UserRole } from './index';

test('superadmin owns every permission', () => {
  assert.equal(ROLE_PERMISSIONS[UserRole.SUPERADMIN].length, Object.values(Permission).length);
});

test('pet owner cannot write EHR', () => {
  assert.equal(ROLE_PERMISSIONS[UserRole.PET_OWNER].includes(Permission.EHR_WRITE), false);
});
