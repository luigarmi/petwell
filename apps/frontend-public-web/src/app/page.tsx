import Link from 'next/link';

import { PublicIcon } from '../components/public-icons';

const highlights = [
  {
    icon: 'calendar' as const,
    eyebrow: 'Citas claras',
    title: 'Agenda sin llamadas largas',
    description: 'Reserva consulta presencial o teleconsulta con horarios visibles y confirmacion inmediata.'
  },
  {
    icon: 'card' as const,
    eyebrow: 'Pagos listos',
    title: 'Recibos y estados en un solo lugar',
    description: 'Consulta lo que pagaste, descarga tu soporte y revisa el estado de cada pago.'
  },
  {
    icon: 'video' as const,
    eyebrow: 'Seguimiento',
    title: 'Teleconsulta cuando la necesites',
    description: 'Ingresa a tu sala virtual desde el historial y mantente al dia con recordatorios utiles.'
  }
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/78 p-8 shadow-[0_24px_80px_rgba(49,83,58,0.1)] backdrop-blur md:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,rgba(49,83,58,0.16),transparent_55%)] lg:block" />
        <div className="relative grid gap-10 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-leaf">
              <PublicIcon name="shield" className="h-4 w-4" />
              Portal para tutores
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-[var(--font-heading)] text-5xl font-bold leading-tight text-leaf md:text-6xl">
                Cuida a tu mascota con una experiencia mas clara, tranquila y ordenada.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-black/68">
                Agenda citas, confirma pagos, revisa avisos y entra a teleconsulta desde un mismo lugar.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-2xl bg-leaf px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(49,83,58,0.22)]">
                Crear cuenta
                <PublicIcon name="arrow-right" className="h-4 w-4" />
              </Link>
              <Link href="/book" className="rounded-2xl border border-black/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink">
                Reservar una cita
              </Link>
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              {[
                { label: 'Recordatorios utiles', value: '24h y 2h' },
                { label: 'Accesos protegidos', value: 'Portal y teleconsulta' },
                { label: 'Soportes visibles', value: 'Pagos y recibos' }
              ].map((item) => (
                <article key={item.label} className="rounded-[1.5rem] border border-black/5 bg-white/68 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-black/45">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-leaf">{item.value}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-[1.8rem] border border-black/5 bg-white/85 p-6 shadow-[0_18px_44px_rgba(31,42,32,0.06)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf text-white">
                  <PublicIcon name={item.icon} className="h-5 w-5" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-black/45">{item.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-leaf">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-black/65">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: 'clinic' as const,
            title: 'Encuentra tu sede',
            text: 'Consulta clinicas, servicios y profesionales disponibles antes de reservar.'
          },
          {
            icon: 'paw' as const,
            title: 'Organiza a tus mascotas',
            text: 'Mantiene el perfil de cada mascota separado para no mezclar citas, notas ni pagos.'
          },
          {
            icon: 'spark' as const,
            title: 'Sigue tu proceso',
            text: 'Consulta recordatorios, pagos y accesos a teleconsulta desde tu cuenta.'
          }
        ].map((item) => (
          <article key={item.title} className="rounded-[1.8rem] border border-white/70 bg-white/72 p-6 shadow-[0_20px_50px_rgba(49,83,58,0.08)] backdrop-blur">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay/12 text-clay">
              <PublicIcon name={item.icon} className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-leaf">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-black/65">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
