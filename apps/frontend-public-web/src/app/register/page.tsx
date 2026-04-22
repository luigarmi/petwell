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
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8)
});

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
      <article className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
          <PublicIcon name="spark" className="h-4 w-4" />
          Nuevo acceso
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Crea tu cuenta</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-black/62">
          Deja lista tu cuenta para reservar, administrar mascotas, revisar pagos y entrar a teleconsulta sin pantallas confusas.
        </p>
        {registerError ? (
          <div className="mt-6 rounded-2xl border border-clay/15 bg-clay/10 px-4 py-3 text-sm text-clay">{registerError}</div>
        ) : null}
        <form
          className="mt-8 grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            setRegisterError(null);
            try {
              const session = await apiFetch<AuthSession>('/auth/register', {
                method: 'POST',
                body: JSON.stringify(values)
              });
              setSession(session);
              router.push('/dashboard');
            } catch (error) {
              setRegisterError(error instanceof Error ? error.message : 'No fue posible crear la cuenta.');
            }
          })}
        >
          <input placeholder="Nombre" {...form.register('firstName')} />
          <input placeholder="Apellido" {...form.register('lastName')} />
          <input placeholder="Correo" {...form.register('email')} />
          <input placeholder="Telefono" {...form.register('phone')} />
          <input type="password" className="md:col-span-2" placeholder="Contrasena" {...form.register('password')} />
          <button className="md:col-span-2 bg-clay text-white shadow-[0_16px_32px_rgba(217,135,82,0.18)]">Crear cuenta</button>
        </form>
      </article>

      <article className="rounded-[2rem] border border-white/70 bg-leaf p-8 text-white shadow-[0_24px_70px_rgba(49,83,58,0.2)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
          <PublicIcon name="heart" className="h-5 w-5" />
        </div>
        <h2 className="mt-6 font-[var(--font-heading)] text-4xl font-bold">Todo empieza con un perfil claro</h2>
        <div className="mt-8 space-y-4">
          {[
            'Tus mascotas quedan organizadas por separado.',
            'Tus citas y pagos usan textos mas faciles de seguir.',
            'El acceso a teleconsulta aparece solo cuando realmente aplica.'
          ].map((item) => (
            <div key={item} className="rounded-2xl bg-white/10 px-4 py-4 text-sm text-white/80">
              {item}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
