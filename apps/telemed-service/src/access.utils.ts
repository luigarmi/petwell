import { JwtUserClaims, UserRole } from '@petwell/shared-types';

export function canAccessRoom(user: JwtUserClaims, room: { ownerId: string; clinicId: string }) {
  if (user.role === UserRole.SUPERADMIN) {
    return true;
  }

  if (user.role === UserRole.PET_OWNER) {
    return room.ownerId === user.sub;
  }

  return user.clinicIds.includes(room.clinicId);
}
