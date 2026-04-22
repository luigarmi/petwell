import { UserRole } from '@petwell/shared-types';

export function isStaffRole(role: UserRole) {
  return [UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(role);
}
