'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiFetch, type AuthSession } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PublicIcon } from '../../components/public-icons';

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
    <section className="mx-auto w-full max-w-lg">
      <article className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
          <PublicIcon name="profile" className="h-4 w-4" />
          Acceso protegido
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Ingresa a tu cuenta</h1>
        {loginError ? (
          <div className="mt-6 rounded-2xl border border-clay/15 bg-clay/10 px-4 py-3 text-sm text-clay">{loginError}</div>
        ) : null}
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            setLoginError(null);
            try {
              const session = await apiFetch<AuthSession>('/auth/login', {
                method: 'POST',
                body: JSON.stringify(values)
              });
              setSession(session);
              router.push('/dashboard');
            } catch (error) {
              setLoginError(error instanceof Error ? error.message : 'No fue posible iniciar sesion.');
            }
          })}
        >
          <input placeholder="Correo electronico" {...form.register('email')} />
          <input type="password" placeholder="Contrasena" {...form.register('password')} />
          <button className="w-full bg-leaf text-white shadow-[0_16px_32px_rgba(49,83,58,0.18)]">Entrar</button>
        </form>
      </article>
    </section>
  );
}
