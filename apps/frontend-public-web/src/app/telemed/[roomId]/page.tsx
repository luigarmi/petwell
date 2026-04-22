'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

export default function TelemedRoomPage() {
  const params = useParams<{ roomId: string }>();
  const { session } = useAuth();

  const roomQuery = useQuery({
    queryKey: ['telemed-room', params.roomId, session?.accessToken],
    queryFn: () => apiFetch<Record<string, string>>(`/telemed/rooms/${params.roomId}`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  return (
    <section className="mx-auto max-w-2xl rounded-[2rem] bg-white/80 p-8 shadow-sm">
      <h1 className="font-[var(--font-heading)] text-4xl font-bold text-leaf">Telemedicina</h1>
      {roomQuery.isLoading ? <p className="mt-6 text-sm text-black/60">Cargando acceso a la sala...</p> : null}
      {roomQuery.error ? (
        <p className="mt-6 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
          No fue posible cargar la sala de teleconsulta.
        </p>
      ) : null}
      {roomQuery.data ? (
        <div className="mt-6 space-y-4">
          <p>Proveedor: {roomQuery.data.provider}</p>
          <p>Inicio: {new Date(roomQuery.data.startsAt).toLocaleString('es-CO')}</p>
          <p>Expira: {new Date(roomQuery.data.expiresAt).toLocaleString('es-CO')}</p>
          <a href={roomQuery.data.roomUrl} target="_blank" className="inline-block rounded-2xl bg-leaf px-4 py-3 text-white">
            Abrir sala
          </a>
        </div>
      ) : null}
    </section>
  );
}
