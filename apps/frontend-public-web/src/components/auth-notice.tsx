'use client';

import Link from 'next/link';

import { PublicIcon } from './public-icons';

export function AuthNotice({
  title,
  description,
  actionLabel = 'Ingresar',
  actionHref = '/login'
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_20px_60px_rgba(49,83,58,0.08)] backdrop-blur">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf text-white">
        <PublicIcon name="shield" className="h-6 w-6" />
      </div>
      <h1 className="mt-6 font-[var(--font-heading)] text-3xl font-bold text-leaf">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-black/65">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={actionHref} className="inline-flex items-center gap-2 rounded-2xl bg-leaf px-5 py-3 text-sm font-semibold text-white">
          {actionLabel}
          <PublicIcon name="arrow-right" className="h-4 w-4" />
        </Link>
        <Link href="/register" className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-ink">
          Crear cuenta
        </Link>
      </div>
    </section>
  );
}
