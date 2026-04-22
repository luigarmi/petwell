'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AppointmentType } from '@petwell/shared-types';

import { AuthNotice } from '../../components/auth-notice';
import { PublicIcon } from '../../components/public-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatAppointmentType, formatCurrency, formatDateTime, formatStatus, statusBadgeClassName } from '../../lib/presentation';

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

function needsTelemedPayment(appointment: AppointmentItem) {
  return appointment.appointmentType === AppointmentType.TELEMED && appointment.status === 'pending_payment';
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [telemedError, setTelemedError] = useState<string | null>(null);
  const [openingTelemedId, setOpeningTelemedId] = useState<string | null>(null);
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', session?.accessToken],
    queryFn: () => apiFetch<AppointmentItem[]>('/appointments', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  if (!session) {
    return (
      <AuthNotice
        title="Tus citas se muestran solo con sesion"
        description="Ingresa para revisar reservas, abrir teleconsultas y consultar pagos."
      />
    );
  }

  const appointments = appointmentsQuery.data ?? [];
  const upcomingCount = appointments.filter((appointment) => ['pending_payment', 'confirmed'].includes(appointment.status)).length;
  const telemedCount = appointments.filter((appointment) => appointment.appointmentType === AppointmentType.TELEMED).length;

  return (
    <section className="space-y-6">
      <header className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur md:grid-cols-[1.1fr,0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
            <PublicIcon name="calendar" className="h-4 w-4" />
            Historial organizado
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Mis citas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">Consulta fecha, estado y pago de cada cita.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-[1.5rem] bg-leaf p-5 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Por atender</p>
            <p className="mt-3 text-3xl font-semibold">{upcomingCount}</p>
          </article>
          <article className="rounded-[1.5rem] bg-white p-5 shadow-[0_16px_38px_rgba(31,42,32,0.05)]">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Teleconsultas</p>
            <p className="mt-3 text-3xl font-semibold text-leaf">{telemedCount}</p>
          </article>
        </div>
      </header>

      {telemedError ? (
        <div className="rounded-[1.5rem] border border-clay/20 bg-clay/10 px-5 py-4 text-sm text-clay">{telemedError}</div>
      ) : null}

      <div className="space-y-4">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-leaf">{formatAppointmentType(appointment.appointmentType)}</h2>
                  <span className={statusBadgeClassName(appointment.status)}>{formatStatus(appointment.status)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-black/62">
                  <span className="inline-flex items-center gap-2">
                    <PublicIcon name="calendar" className="h-4 w-4 text-leaf" />
                    {formatDateTime(appointment.startsAt)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <PublicIcon name="card" className="h-4 w-4 text-leaf" />
                    {formatCurrency(appointment.amountCop)}
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-black/58">
                  {appointment.notes ?? 'Tu cita ya esta registrada. Usa las acciones de la derecha para continuar.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {appointment.appointmentType === AppointmentType.TELEMED ? (
                  <button
                    className="rounded-2xl border border-leaf/20 px-4 py-2 text-leaf disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/40"
                    disabled={(!canOpenTelemed(appointment) && !needsTelemedPayment(appointment)) || openingTelemedId === appointment.id}
                    onClick={async () => {
                      setTelemedError(null);
                      setOpeningTelemedId(appointment.id);
                      try {
                        if (needsTelemedPayment(appointment)) {
                          const payment = await apiFetch<{ id: string }>(
                            `/billing/payments/appointment/${appointment.id}/latest`,
                            {},
                            session.accessToken
                          );
                          router.push(`/payments/${payment.id}`);
                          return;
                        }

                        const room = await apiFetch<{ id: string }>(
                          `/telemed/rooms/appointment/${appointment.id}`,
                          {},
                          session.accessToken
                        );
                        router.push(`/telemed/${room.id}`);
                      } catch (error) {
                        const message = needsTelemedPayment(appointment)
                          ? 'No fue posible abrir el pago de esta teleconsulta.'
                          : error instanceof Error && error.message.includes('404')
                            ? 'La sala de esta teleconsulta se esta preparando. Intenta de nuevo en unos segundos.'
                            : 'No fue posible abrir la teleconsulta en este momento.';
                        setTelemedError(message);
                      } finally {
                        setOpeningTelemedId(null);
                      }
                    }}
                  >
                    <PublicIcon name="video" className="h-4 w-4" />
                    {openingTelemedId === appointment.id
                      ? canOpenTelemed(appointment)
                        ? 'Abriendo sala'
                        : 'Abriendo pago'
                      : canOpenTelemed(appointment)
                        ? 'Ingresar a teleconsulta'
                        : needsTelemedPayment(appointment)
                          ? 'Pagar para habilitar sala'
                          : 'Sala no disponible'}
                  </button>
                ) : null}
                <button
                  className="rounded-2xl border border-black/10 px-4 py-2"
                  onClick={async () => {
                    const payment = await apiFetch<{ id: string }>(
                      `/billing/payments/appointment/${appointment.id}/latest`,
                      {},
                      session.accessToken
                    );
                    router.push(`/payments/${payment.id}`);
                  }}
                >
                  <PublicIcon name="card" className="h-4 w-4" />
                  Ver pago
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
