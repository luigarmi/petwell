import assert from 'node:assert/strict';
import test from 'node:test';

import { UserRole } from '@petwell/shared-types';

import { isStaffRole } from '../src/role.utils';

test('isStaffRole accepts clinic staff roles only', () => {
  assert.equal(isStaffRole(UserRole.CLINIC_ADMIN), true);
  assert.equal(isStaffRole(UserRole.VETERINARIAN), true);
  assert.equal(isStaffRole(UserRole.RECEPTIONIST), true);
  assert.equal(isStaffRole(UserRole.PET_OWNER), false);
});
