import assert from 'node:assert/strict';
import test from 'node:test';

import { Permission, ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

test('clinic admin can read billing but cannot write notifications', () => {
  assert.equal(ROLE_PERMISSIONS[UserRole.CLINIC_ADMIN].includes(Permission.BILLING_READ), true);
  assert.equal(ROLE_PERMISSIONS[UserRole.CLINIC_ADMIN].includes(Permission.NOTIFICATIONS_WRITE), false);
});
