'use client';

import { useQuery } from '@tanstack/react-query';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatClinic, formatEvent } from '../../lib/presentation';

type AppointmentSummary = {
  totalAppointments: number;
  byClinic: Array<{ clinicId: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
};

type PetSummary = {
  totalPets: number;
  byClinic: Array<{ mainClinicId: string; _count: number }>;
};

type ActivitySummary = {
  totalEvents: number;
  byEvent: Array<{ eventName: string; _count: number }>;
};

export default function AnalyticsPage() {
  const { session } = useAuth();

  const analyticsQuery = useQuery({
    queryKey: ['analytics-dashboard', session?.accessToken],
    queryFn: async () => {
      const [appointments, pets, activity] = await Promise.all([
        apiFetch<AppointmentSummary>('/appointments/summary', {}, session?.accessToken),
        apiFetch<PetSummary>('/pets/summary', {}, session?.accessToken),
        apiFetch<ActivitySummary>('/analytics/activity', {}, session?.accessToken)
      ]);

      return { appointments, pets, activity };
    },
    enabled: Boolean(session?.accessToken)
  });

  const data = analyticsQuery.data;

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <AdminIcon name="analytics" className="h-4 w-4" />
          Operacion y actividad
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">Analitica</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
          En lugar de mostrar estructuras crudas, esta vista resume volumen operativo, pacientes y actividad relevante del sistema.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.7rem] bg-navy p-6 text-white shadow-[0_18px_44px_rgba(23,63,95,0.18)]">
          <p className="text-xs uppercase tracking-[0.18em] text-white/58">Citas</p>
          <h2 className="mt-4 text-3xl font-semibold">{data?.appointments.totalAppointments ?? 0}</h2>
        </article>
        <article className="rounded-[1.7rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Mascotas</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{data?.pets.totalPets ?? 0}</h2>
        </article>
        <article className="rounded-[1.7rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Eventos</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{data?.activity.totalEvents ?? 0}</h2>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <article className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <h2 className="font-[var(--font-heading)] text-3xl font-bold text-navy">Volumen por sede</h2>
          <div className="mt-6 space-y-4">
            {data?.appointments.byClinic.map((item) => (
              <div key={item.clinicId} className="rounded-[1.5rem] bg-paper px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">{formatClinic(item.clinicId)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-black/45">Citas visibles</p>
                  </div>
                  <span className="text-2xl font-semibold text-navy">{item._count}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <h2 className="font-[var(--font-heading)] text-3xl font-bold text-navy">Actividad reciente</h2>
          <div className="mt-6 space-y-4">
            {data?.activity.byEvent.map((item) => (
              <div key={item.eventName} className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-paper px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mist text-navy">
                    <AdminIcon name="analytics" className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{formatEvent(item.eventName)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-black/45">Eventos registrados</p>
                  </div>
                </div>
                <span className="text-xl font-semibold text-navy">{item._count}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
