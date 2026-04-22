'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AppointmentType } from '@petwell/shared-types';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatAppointmentType, formatCurrency, formatDateTime, formatStatus, statusBadgeClassName } from '../../lib/presentation';

function toCsv(rows: AppointmentItem[]) {
  const headers = ['Tipo', 'Estado', 'Inicio', 'Valor'];
  const body = rows.map((row) =>
    [formatAppointmentType(row.appointmentType), formatStatus(row.status), formatDateTime(row.startsAt), formatCurrency(row.amountCop)]
      .map((value) => JSON.stringify(value))
      .join(',')
  );

  return [headers.join(','), ...body].join('\n');
}

type AppointmentItem = {
  id: string;
  startsAt: string;
  status: string;
  appointmentType: string;
  amountCop: number;
  notes?: string | null;
};

function canOpenTelemed(appointment: AppointmentItem) {
  return appointment.appointmentType === AppointmentType.TELEMED && ['confirmed', 'completed'].includes(appointment.status);
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const clinicId = session?.user.clinicIds[0];
  const [telemedError, setTelemedError] = useState<string | null>(null);
  const [openingTelemedId, setOpeningTelemedId] = useState<string | null>(null);
  const appointmentsQuery = useQuery({
    queryKey: ['admin-appointments', clinicId, session?.accessToken],
    queryFn: () => apiFetch<AppointmentItem[]>(`/appointments?clinicId=${clinicId}`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken && clinicId)
  });

  const appointments = appointmentsQuery.data ?? [];

  return (
    <section className="space-y-6">
      <header className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur lg:grid-cols-[1.1fr,0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
            <AdminIcon name="calendar" className="h-4 w-4" />
            Agenda operativa
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">Agenda</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
            La agenda ahora resume tipo de servicio, estado y siguiente accion sin exponer datos internos que no aportan a la operacion.
          </p>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-[1.7rem] bg-navy p-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/58">Citas visibles</p>
            <p className="mt-3 text-3xl font-semibold">{appointments.length}</p>
          </div>
          <button
            className="bg-white/10 text-white"
            onClick={() => {
              const blob = new Blob([toCsv(appointments)], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'agenda-resumen.csv';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar resumen
          </button>
        </div>
      </header>

      {telemedError ? (
        <div className="rounded-[1.5rem] border border-ember/20 bg-ember/10 px-5 py-4 text-sm text-ember">{telemedError}</div>
      ) : null}

      <div className="space-y-4">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="rounded-[1.8rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-navy">{formatAppointmentType(appointment.appointmentType)}</h2>
                  <span className={statusBadgeClassName(appointment.status)}>{formatStatus(appointment.status)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-black/62">
                  <span className="inline-flex items-center gap-2">
                    <AdminIcon name="calendar" className="h-4 w-4 text-navy" />
                    {formatDateTime(appointment.startsAt)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <AdminIcon name="billing" className="h-4 w-4 text-navy" />
                    {formatCurrency(appointment.amountCop)}
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-black/58">
                  {appointment.notes ?? 'Sin notas adicionales para esta cita.'}
                </p>
              </div>
              {appointment.appointmentType === AppointmentType.TELEMED ? (
                <button
                  className="rounded-2xl border border-navy/15 px-4 py-2 text-sm text-navy disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/40"
                  disabled={!canOpenTelemed(appointment) || openingTelemedId === appointment.id}
                  onClick={async () => {
                    setTelemedError(null);
                    setOpeningTelemedId(appointment.id);
                    try {
                      const room = await apiFetch<{ id: string }>(
                        `/telemed/rooms/appointment/${appointment.id}`,
                        {},
                        session?.accessToken
                      );
                      router.push(`/telemed/${room.id}`);
                    } catch (error) {
                      const message =
                        error instanceof Error && error.message.includes('404')
                          ? 'La sala de esta teleconsulta todavia no esta disponible.'
                          : 'No fue posible abrir la teleconsulta en este momento.';
                      setTelemedError(message);
                    } finally {
                      setOpeningTelemedId(null);
                    }
                  }}
                >
                  <AdminIcon name="video" className="h-4 w-4" />
                  {canOpenTelemed(appointment)
                    ? openingTelemedId === appointment.id
                      ? 'Abriendo sala'
                      : 'Ingresar a teleconsulta'
                    : 'Sala pendiente'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
