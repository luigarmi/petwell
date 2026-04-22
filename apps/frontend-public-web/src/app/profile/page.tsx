'use client';

import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthNotice } from '../../components/auth-notice';
import { PublicIcon } from '../../components/public-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(7)
});

type ProfileData = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export default function ProfilePage() {
  const { session } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', session?.accessToken],
    queryFn: () => apiFetch<ProfileData>('/users/me', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      firstName: profileQuery.data?.firstName ?? '',
      lastName: profileQuery.data?.lastName ?? '',
      phone: profileQuery.data?.phone ?? ''
    }
  });

  if (!session) {
    return (
      <AuthNotice
        title="Tu perfil esta protegido"
        description="Inicia sesion para actualizar tus datos de contacto."
      />
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
      <article className="rounded-[2rem] border border-white/70 bg-leaf p-8 text-white shadow-[0_24px_70px_rgba(49,83,58,0.2)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
          <PublicIcon name="profile" className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold">
          {profileQuery.data?.firstName ? `${profileQuery.data.firstName} ${profileQuery.data.lastName}` : 'Mi perfil'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/78">
          Mantener estos datos al dia ayuda a que la clinica te contacte a tiempo y te envie recordatorios utiles.
        </p>
        <div className="mt-8 space-y-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Correo principal</p>
            <p className="mt-1 font-semibold">{profileQuery.data?.email}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Telefono de contacto</p>
            <p className="mt-1 font-semibold">{profileQuery.data?.phone ?? 'Sin registrar'}</p>
          </div>
        </div>
      </article>

      <article className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <h2 className="font-[var(--font-heading)] text-3xl font-bold text-leaf">Actualiza tus datos</h2>
        <p className="mt-3 text-sm leading-6 text-black/62">Actualiza tu nombre y telefono de contacto.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await apiFetch(
              '/users/me',
              {
                method: 'PATCH',
                body: JSON.stringify(values)
              },
              session.accessToken
            );
            profileQuery.refetch();
          })}
        >
          <input placeholder="Nombre" {...form.register('firstName')} />
          <input placeholder="Apellido" {...form.register('lastName')} />
          <input placeholder="Telefono" {...form.register('phone')} />
          <button className="bg-leaf text-white shadow-[0_16px_32px_rgba(49,83,58,0.18)]">Guardar cambios</button>
        </form>
      </article>
    </section>
  );
}
