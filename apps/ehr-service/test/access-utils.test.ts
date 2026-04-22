import assert from 'node:assert/strict';
import test from 'node:test';

import { ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

import { canAccessClinicalRecord } from '../src/access.utils';

test('same clinic staff can access the clinical record', () => {
  const allowed = canAccessClinicalRecord(
    {
      sub: 'vet-1',
      email: 'vet@example.com',
      role: UserRole.VETERINARIAN,
      clinicIds: ['clinic-1'],
      permissions: ROLE_PERMISSIONS[UserRole.VETERINARIAN]
    },
    { clinicId: 'clinic-1' },
    []
  );

  assert.equal(allowed, true);
});

test('different clinic staff requires active consent', () => {
  const allowed = canAccessClinicalRecord(
    {
      sub: 'vet-2',
      email: 'vet2@example.com',
      role: UserRole.VETERINARIAN,
      clinicIds: ['clinic-2'],
      permissions: ROLE_PERMISSIONS[UserRole.VETERINARIAN]
    },
    { clinicId: 'clinic-1' },
    [{ targetClinicId: 'clinic-2', revokedAt: null, expiresAt: null }]
  );

  assert.equal(allowed, true);
});
