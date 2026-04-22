'use client';

import { useAuth } from '../../lib/auth';
import { formatRole } from '../../lib/presentation';
import { AdminIcon } from '../../components/admin-icons';

export default function DashboardPage() {
  const { session } = useAuth();

  return (
    <section className="space-y-6">
      <header className="grid gap-4 rounded-[2.2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur lg:grid-cols-[1.15fr,0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            <AdminIcon name="dashboard" className="h-4 w-4" />
            Panel operativo
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">
            {session ? `${session.user.firstName} ${session.user.lastName}` : 'Panel administrativo'}
          </h1>
        </div>
        <div className="rounded-[1.8rem] bg-navy p-6 text-white shadow-[0_18px_44px_rgba(23,63,95,0.18)]">
          <p className="text-xs uppercase tracking-[0.2em] text-white/58">Acceso activo</p>
          <p className="mt-3 text-2xl font-semibold">{formatRole(session?.user.role)}</p>
          <p className="mt-2 text-sm text-white/72">
            {session?.user.clinicIds.length ? `${session.user.clinicIds.length} sede(s) asignadas` : 'Acceso global al sistema'}
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: 'users' as const, title: 'Equipo visible', value: session?.user.role === 'superadmin' ? 'Global' : 'Por sede' },
          { icon: 'calendar' as const, title: 'Agenda priorizada', value: 'Citas y teleconsulta' },
          { icon: 'shield' as const, title: 'Proteccion', value: 'Rutas con sesion' }
        ].map((card) => (
          <article key={card.title} className="rounded-[1.7rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist text-navy">
              <AdminIcon name={card.icon} className="h-5 w-5" />
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-black/45">{card.title}</p>
            <h2 className="mt-3 text-2xl font-semibold text-navy">{card.value}</h2>
          </article>
        ))}
      </div>
    </section>
  );
}
