import { JwtUserClaims, UserRole } from '@petwell/shared-types';

export function canAccessPet(
  user: JwtUserClaims,
  pet: { ownerId: string; coOwnerIds?: string[]; mainClinicId?: string | null }
) {
  if (user.role === UserRole.SUPERADMIN) {
    return true;
  }

  if (user.role === UserRole.PET_OWNER) {
    return pet.ownerId === user.sub || Boolean(pet.coOwnerIds?.includes(user.sub));
  }

  if ([UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role)) {
    return Boolean(pet.mainClinicId && user.clinicIds.includes(pet.mainClinicId));
  }

  return false;
}
