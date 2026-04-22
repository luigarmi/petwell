import assert from 'node:assert/strict';
import test from 'node:test';

import { ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

import { canAccessRoom } from '../src/access.utils';

test('pet owner can access own telemed room', () => {
  const allowed = canAccessRoom(
    {
      sub: 'owner-1',
      email: 'owner@example.com',
      role: UserRole.PET_OWNER,
      clinicIds: [],
      permissions: ROLE_PERMISSIONS[UserRole.PET_OWNER]
    },
    { ownerId: 'owner-1', clinicId: 'clinic-1' }
  );

  assert.equal(allowed, true);
});
