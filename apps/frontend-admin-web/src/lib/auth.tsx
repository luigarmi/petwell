'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { AdminSession } from './api';
import { normalizeAdminSession, writeAdminSessionCookie } from './admin-session-cookie';

type AuthContextValue = {
  isHydrated: boolean;
  session: AdminSession | null;
  setSession: (session: AdminSession | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = 'petwell_admin_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    let nextSession: AdminSession | null = null;

    if (raw) {
      try {
        nextSession = normalizeAdminSession(JSON.parse(raw));
      } catch {
        nextSession = null;
      }
    }

    if (nextSession) {
      setSessionState(nextSession);
      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      writeAdminSessionCookie(nextSession);
    } else {
      window.localStorage.removeItem(storageKey);
      writeAdminSessionCookie(null);
    }

    setIsHydrated(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrated,
      session,
      setSession(nextSession) {
        setSessionState(nextSession);
        if (nextSession) {
          window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        } else {
          window.localStorage.removeItem(storageKey);
        }

        writeAdminSessionCookie(nextSession);
      }
    }),
    [isHydrated, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
