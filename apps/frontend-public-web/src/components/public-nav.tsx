'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../lib/auth';
import { PublicIcon } from './public-icons';

const publicLinks = [
  { href: '/', icon: 'home' as const, label: 'Inicio' },
  { href: '/clinics', icon: 'clinic' as const, label: 'Clinicas' },
  { href: '/book', icon: 'book' as const, label: 'Reservar' }
];

const privateLinks = [
  { href: '/appointments', icon: 'calendar' as const, label: 'Citas' },
  { href: '/pets', icon: 'paw' as const, label: 'Mascotas' },
  { href: '/profile', icon: 'profile' as const, label: 'Perfil' },
  { href: '/notifications', icon: 'bell' as const, label: 'Avisos' }
];

export function PublicNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession } = useAuth();
  const links = session ? [...publicLinks, ...privateLinks] : publicLinks;

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 text-ink">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf text-white shadow-[0_14px_32px_rgba(49,83,58,0.22)]">
                <PublicIcon name="heart" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-leaf/70">PetWell</span>
                <span className="block font-[var(--font-heading)] text-lg font-semibold text-leaf">Cuidado claro para tu mascota</span>
              </span>
            </Link>
            {session ? (
              <button
                className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink lg:hidden"
                onClick={() => {
                  setSession(null);
                  router.push('/login');
                }}
              >
                Salir
              </button>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  pathname === link.href ? 'bg-leaf text-white shadow-[0_14px_32px_rgba(49,83,58,0.2)]' : 'bg-white/70 text-ink ring-1 ring-black/5'
                }`}
              >
                <PublicIcon name={link.icon} className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {session ? (
              <>
                <div className="rounded-full bg-white/78 px-4 py-2 text-sm ring-1 ring-black/5">
                  <span className="block text-[11px] uppercase tracking-[0.2em] text-black/45">Sesion activa</span>
                  <span className="font-semibold text-leaf">{session.user.firstName}</span>
                </div>
                <button
                  className="bg-leaf text-white shadow-[0_16px_30px_rgba(49,83,58,0.22)]"
                  onClick={() => {
                    setSession(null);
                    router.push('/login');
                  }}
                >
                  <PublicIcon name="logout" className="h-4 w-4" />
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-2xl border border-black/10 px-4 py-2 font-semibold text-ink">
                  Ingresar
                </Link>
                <Link href="/register" className="inline-flex items-center gap-2 rounded-2xl bg-clay px-4 py-2 font-semibold text-white shadow-[0_16px_30px_rgba(217,135,82,0.22)]">
                  Crear cuenta
                  <PublicIcon name="arrow-right" className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
