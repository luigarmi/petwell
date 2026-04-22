'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { AuthSession } from './api';

type AuthContextValue = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem('petwell_public_session');
    if (raw) {
      setSessionState(JSON.parse(raw));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      setSession(nextSession) {
        setSessionState(nextSession);
        if (nextSession) {
          window.localStorage.setItem('petwell_public_session', JSON.stringify(nextSession));
        } else {
          window.localStorage.removeItem('petwell_public_session');
        }
      }
    }),
    [session]
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
