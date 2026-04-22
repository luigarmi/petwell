'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch, type AdminSession } from '../../lib/api';
import { hasAdminAccess } from '../../lib/admin-access';
import { useAuth } from '../../lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  return (
    <section className="w-full max-w-lg">
      <article className="rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <AdminIcon name="dashboard" className="h-4 w-4" />
          Acceso administrativo
        </span>
        <h2 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">Ingresar al panel</h2>
        {loginError ? (
          <div className="mt-6 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">{loginError}</div>
        ) : null}
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            setLoginError(null);

            try {
              const session = await apiFetch<AdminSession>('/auth/login', {
                method: 'POST',
                body: JSON.stringify(values)
              });

              if (!hasAdminAccess(session.user.role)) {
                setSession(null);
                setLoginError('Este usuario no tiene acceso al panel administrativo.');
                return;
              }

              setSession(session);
              router.replace('/dashboard');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'No fue posible iniciar sesion.';
              setLoginError(
                message.includes('Failed to fetch')
                  ? 'No fue posible conectar con el servicio de acceso. Intenta de nuevo en unos segundos.'
                  : message
              );
            }
          })}
        >
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-navy">Correo</span>
            <input autoComplete="username" placeholder="tu@petwell.local" {...form.register('email')} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-navy">Contrasena</span>
            <input type="password" autoComplete="current-password" placeholder="Escribe tu contrasena" {...form.register('password')} />
          </label>
          <button
            disabled={form.formState.isSubmitting}
            className="w-full bg-navy text-white shadow-[0_16px_32px_rgba(23,63,95,0.18)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {form.formState.isSubmitting ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </article>
    </section>
  );
}
