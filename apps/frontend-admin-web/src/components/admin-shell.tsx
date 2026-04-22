'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../lib/auth';
import { hasAdminAccess } from '../lib/admin-access';
import { AdminNav } from './admin-nav';

const publicRoutes = new Set(['/login']);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession, isHydrated } = useAuth();
  const isPublicRoute = publicRoutes.has(pathname);
  const canAccessAdmin = hasAdminAccess(session?.user.role);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (session && !canAccessAdmin) {
      setSession(null);
      router.replace('/login');
      return;
    }

    if (!session && !isPublicRoute) {
      router.replace('/login');
      return;
    }

    if (session && canAccessAdmin && isPublicRoute) {
      router.replace('/dashboard');
    }
  }, [canAccessAdmin, isHydrated, isPublicRoute, router, session, setSession]);

  if (isPublicRoute) {
    return <main className="flex min-h-screen items-center justify-center px-6 py-8">{children}</main>;
  }

  if (!isHydrated) {
    return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6f3ee_0%,#eef2f7_55%,#f8fafc_100%)]" />;
  }

  if (!session || !canAccessAdmin) {
    return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6f3ee_0%,#eef2f7_55%,#f8fafc_100%)]" />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px,1fr]">
      <AdminNav />
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
