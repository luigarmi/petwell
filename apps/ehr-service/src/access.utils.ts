import { JwtUserClaims, UserRole } from '@petwell/shared-types';

export function canAccessClinicalRecord(
  user: JwtUserClaims,
  record: { clinicId: string },
  consents: Array<{ targetClinicId: string; revokedAt: Date | null; expiresAt: Date | null }>
) {
  if (user.role === UserRole.SUPERADMIN) {
    return true;
  }

  if (![UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role)) {
    return false;
  }

  if (user.clinicIds.includes(record.clinicId)) {
    return true;
  }

  return consents.some(
    (consent) =>
      user.clinicIds.includes(consent.targetClinicId) &&
      !consent.revokedAt &&
      (!consent.expiresAt || consent.expiresAt > new Date())
  );
}
