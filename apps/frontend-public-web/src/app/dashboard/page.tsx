'use client';

import Link from 'next/link';

import { useAuth } from '../../lib/auth';

export default function DashboardPage() {
  const { session } = useAuth();

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-white/80 p-8 shadow-sm">
        <h1 className="font-[var(--font-heading)] text-4xl font-bold text-leaf">
          {session ? `Hola, ${session.user.firstName}` : 'Bienvenido'}
        </h1>
        <p className="mt-2 text-black/60">Desde aquí puedes gestionar mascotas, reservas, pagos y acceso a telemedicina.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: '/pets', label: 'Mis mascotas' },
          { href: '/book', label: 'Reservar cita' },
          { href: '/appointments', label: 'Historial de citas' }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="rounded-[1.5rem] bg-sand p-6 text-lg font-semibold text-leaf">
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
