const adminRoles = new Set(['superadmin', 'clinic_admin', 'veterinarian', 'receptionist']);

export function hasAdminAccess(role?: string | null) {
  return Boolean(role && adminRoles.has(role));
}
