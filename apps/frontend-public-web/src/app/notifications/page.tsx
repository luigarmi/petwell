'use client';

import { useQuery } from '@tanstack/react-query';

import { AuthNotice } from '../../components/auth-notice';
import { PublicIcon } from '../../components/public-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime, formatNotificationChannel, formatNotificationLabel, formatStatus, statusBadgeClassName } from '../../lib/presentation';

type NotificationItem = {
  id: string;
  channel: string;
  subject?: string | null;
  template?: string | null;
  status: string;
  sentAt?: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const { session } = useAuth();
  const notificationsQuery = useQuery({
    queryKey: ['notifications', session?.accessToken],
    queryFn: () => apiFetch<NotificationItem[]>('/notifications/me', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  if (!session) {
    return (
      <AuthNotice
        title="Tus avisos estan protegidos"
        description="Ingresa para revisar recordatorios, confirmaciones y accesos a teleconsulta."
      />
    );
  }

  const notifications = notificationsQuery.data ?? [];

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
          <PublicIcon name="bell" className="h-4 w-4" />
          Mensajes utiles
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Notificaciones</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">Consulta el estado y la fecha de cada notificacion.</p>
      </header>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <article key={notification.id} className="rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-leaf">
                    {formatNotificationLabel(notification.subject, notification.template)}
                  </h2>
                  <span className={statusBadgeClassName(notification.status)}>{formatStatus(notification.status)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-black/60">
                  <span className="inline-flex items-center gap-2">
                    <PublicIcon name="bell" className="h-4 w-4 text-leaf" />
                    {formatNotificationChannel(notification.channel)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <PublicIcon name="calendar" className="h-4 w-4 text-leaf" />
                    {formatDateTime(notification.sentAt ?? notification.createdAt)}
                  </span>
                </div>
              </div>
              <div className="max-w-sm rounded-[1.4rem] bg-canvas px-4 py-3 text-sm leading-6 text-black/58">
                {notification.status === 'queued'
                  ? 'Tu aviso esta pendiente de envio y aparecera aqui cuando quede listo.'
                  : 'Este mensaje ya fue procesado y queda disponible para que sigas tu proceso sin perder contexto.'}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
