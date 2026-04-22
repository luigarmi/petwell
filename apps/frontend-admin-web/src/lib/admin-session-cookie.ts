import type { AdminSession } from './api';
import { hasAdminAccess } from './admin-access';

export const ADMIN_SESSION_COOKIE = 'petwell_admin_session';

const cookieMaxAgeSeconds = 60 * 60 * 12;

export function normalizeAdminSession(value: unknown): AdminSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const session = value as AdminSession;

  if (
    !session.accessToken ||
    !session.refreshToken ||
    !session.user?.id ||
    !session.user.email ||
    !hasAdminAccess(session.user.role)
  ) {
    return null;
  }

  return session;
}

export function parseAdminSessionCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  const role = decodeURIComponent(value);
  return hasAdminAccess(role) ? role : null;
}

export function readAdminSessionFromDocumentCookie() {
  return null;
}

export function writeAdminSessionCookie(session: AdminSession | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedSession = normalizeAdminSession(session);

  if (!normalizedSession) {
    document.cookie = `${ADMIN_SESSION_COOKIE}=; Path=/admin; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(normalizedSession.user.role)}; Path=/admin; Max-Age=${cookieMaxAgeSeconds}; SameSite=Lax`;
}
