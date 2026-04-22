import assert from 'node:assert/strict';
import test from 'node:test';

import { JwtUserClaims, ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

import { canAccessPet } from '../src/ownership.utils';

const ownerClaims: JwtUserClaims = {
  sub: 'owner-1',
  email: 'owner@example.com',
  role: UserRole.PET_OWNER,
  clinicIds: [],
  permissions: ROLE_PERMISSIONS[UserRole.PET_OWNER]
};

test('pet owner can access only own pet', () => {
  assert.equal(canAccessPet(ownerClaims, { ownerId: 'owner-1', coOwnerIds: [], mainClinicId: 'clinic-1' }), true);
  assert.equal(canAccessPet(ownerClaims, { ownerId: 'owner-2', coOwnerIds: ['owner-1'], mainClinicId: 'clinic-1' }), true);
  assert.equal(canAccessPet(ownerClaims, { ownerId: 'owner-2', coOwnerIds: [], mainClinicId: 'clinic-1' }), false);
});
