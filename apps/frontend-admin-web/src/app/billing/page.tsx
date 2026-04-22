'use client';

import { useQuery } from '@tanstack/react-query';

import { AdminIcon } from '../../components/admin-icons';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatCurrency, formatStatus, statusBadgeClassName } from '../../lib/presentation';

type BillingSummary = {
  revenueApprovedCop: number;
  byStatus: Array<{ status: string; _count: number }>;
};

export default function BillingPage() {
  const { session } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ['billing-summary', session?.accessToken],
    queryFn: () => apiFetch<BillingSummary>('/billing/payments/summary', {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  const summary = summaryQuery.data;
  const totalPayments = summary?.byStatus.reduce((acc, item) => acc + item._count, 0) ?? 0;

  return (
    <section className="space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_24px_70px_rgba(23,63,95,0.1)] backdrop-blur">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <AdminIcon name="billing" className="h-4 w-4" />
          Pagos claros
        </span>
        <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-navy">Pagos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
          Reemplazamos el JSON crudo por indicadores legibles, utiles para control diario y seguimiento financiero.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.7rem] bg-navy p-6 text-white shadow-[0_18px_44px_rgba(23,63,95,0.18)]">
          <p className="text-xs uppercase tracking-[0.18em] text-white/58">Ingresos aprobados</p>
          <h2 className="mt-4 text-3xl font-semibold">{formatCurrency(summary?.revenueApprovedCop)}</h2>
        </article>
        <article className="rounded-[1.7rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Intentos visibles</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{totalPayments}</h2>
        </article>
        <article className="rounded-[1.7rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Estados activos</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{summary?.byStatus.length ?? 0}</h2>
        </article>
      </div>

      <article className="rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_18px_46px_rgba(23,63,95,0.06)] backdrop-blur">
        <h2 className="font-[var(--font-heading)] text-3xl font-bold text-navy">Distribucion por estado</h2>
        <div className="mt-6 space-y-4">
          {summary?.byStatus.map((item) => {
            const width = totalPayments > 0 ? `${Math.max(12, Math.round((item._count / totalPayments) * 100))}%` : '0%';
            return (
              <div key={item.status} className="rounded-[1.5rem] bg-paper px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={statusBadgeClassName(item.status)}>{formatStatus(item.status)}</span>
                  <span className="text-sm font-semibold text-navy">{item._count}</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-navy" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
