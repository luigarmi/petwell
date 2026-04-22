'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../lib/auth';
import { formatRole, roleBadgeClassName } from '../lib/presentation';
import { AdminIcon } from './admin-icons';

const links = [
  { href: '/dashboard', icon: 'dashboard' as const, label: 'Resumen' },
  { href: '/users', icon: 'users' as const, label: 'Equipo' },
  { href: '/pets', icon: 'paw' as const, label: 'Mascotas' },
  { href: '/appointments', icon: 'calendar' as const, label: 'Agenda' },
  { href: '/ehr', icon: 'ehr' as const, label: 'Historia clinica' },
  { href: '/billing', icon: 'billing' as const, label: 'Pagos' },
  { href: '/analytics', icon: 'analytics' as const, label: 'Operacion' }
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession } = useAuth();

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-black/5 bg-white/76 px-5 py-6 backdrop-blur-xl">
      <div className="rounded-[2rem] bg-navy px-5 py-6 text-white shadow-[0_20px_60px_rgba(23,63,95,0.22)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <AdminIcon name="shield" className="h-5 w-5" />
        </div>
        <p className="mt-5 text-xs uppercase tracking-[0.24em] text-white/58">PetWell Admin</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-semibold">{session?.user.firstName ?? 'Panel'}</h1>
        <p className="mt-2 text-sm text-white/72">Vista operativa enfocada en lo que la sede debe atender.</p>
        <span className={`mt-5 ${roleBadgeClassName(session?.user.role)}`}>{formatRole(session?.user.role)}</span>
      </div>

      <nav className="mt-8 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-[1.3rem] px-4 py-3 text-sm font-semibold ${
                isActive ? 'bg-navy text-white shadow-[0_16px_32px_rgba(23,63,95,0.16)]' : 'text-navy hover:bg-white'
              }`}
            >
              <AdminIcon name={link.icon} className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          className="w-full bg-ember text-white shadow-[0_16px_30px_rgba(209,73,91,0.18)]"
          onClick={() => {
            setSession(null);
            router.push('/login');
          }}
        >
          <AdminIcon name="logout" className="h-4 w-4" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
