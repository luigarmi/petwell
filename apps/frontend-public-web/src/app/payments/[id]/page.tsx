'use client';

import { useEffect, useRef, useState } from 'react';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { AuthNotice } from '../../../components/auth-notice';
import { PublicIcon } from '../../../components/public-icons';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import {
  formatAppointmentType,
  formatCurrency,
  formatDateTime,
  formatPaymentProvider,
  formatShortReference,
  formatStatus,
  statusBadgeClassName
} from '../../../lib/presentation';

type PaymentHistoryItem = {
  id: string;
  status: string;
  createdAt: string;
};

type PaymentDetails = {
  id: string;
  provider: string;
  status: string;
  currency: string;
  amountCop: number;
  approvedAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  receiptUrl?: string | null;
  checkoutUrl?: string | null;
  checkoutPayload?: { provider?: string } | null;
  appointmentMetadata?: {
    appointmentType?: string;
    startsAt?: string;
  } | null;
  histories?: PaymentHistoryItem[];
};

function isMercadoPagoSandboxCheckout(url?: string | null) {
  return Boolean(url && /sandbox\.mercadopago\./i.test(url));
}

function getMercadoPagoSyncMessage(message: string, isSandboxCheckout: boolean) {
  if (message !== 'Mercado Pago has not registered a payment for this reference yet') {
    return message;
  }

  if (!isSandboxCheckout) {
    return 'Mercado Pago todavia no registro un pago para esta referencia. Intenta actualizar de nuevo en unos segundos.';
  }

  return [
    'Mercado Pago todavia no registro un pago para esta referencia.',
    'Si viste la pantalla "Una de las partes con la que intentas hacer el pago es de prueba", abre el checkout en una ventana incognita',
    'y entra con el comprador de prueba de la misma aplicacion, no con una cuenta real.'
  ].join(' ');
}

export default function PaymentPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const syncAttemptedRef = useRef(false);
  const backgroundSyncInFlightRef = useRef(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const mercadoPagoPaymentId = searchParams.get('payment_id') ?? searchParams.get('collection_id');
  const shouldSyncMercadoPago = searchParams.get('provider') === 'mercadopago' && Boolean(mercadoPagoPaymentId);

  const paymentQuery = useQuery({
    queryKey: ['payment', params.id, session?.accessToken],
    queryFn: () => apiFetch<PaymentDetails>(`/billing/payments/${params.id}`, {}, session?.accessToken),
    enabled: Boolean(session?.accessToken)
  });

  async function syncMercadoPago(providerPaymentId?: string, options?: { silent?: boolean }) {
    if (!session?.accessToken) {
      return false;
    }

    const silent = options?.silent ?? false;
    const sandboxCheckout = isMercadoPagoSandboxCheckout(paymentQuery.data?.checkoutUrl);

    if (!silent) {
      setSyncMessage('Actualizando el estado del pago...');
    }

    try {
      await apiFetch(
        `/billing/payments/${params.id}/mercadopago/sync`,
        {
          method: 'POST',
          body: JSON.stringify(providerPaymentId ? { paymentId: providerPaymentId } : {})
        },
        session.accessToken
      );
      await paymentQuery.refetch();
      if (!silent) {
        setSyncMessage(null);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible actualizar el estado del pago.';
      if (!silent) {
        setSyncMessage(getMercadoPagoSyncMessage(message, sandboxCheckout));
      }
      return false;
    }
  }

  useEffect(() => {
    if (!session?.accessToken || !params.id || !shouldSyncMercadoPago || !mercadoPagoPaymentId || syncAttemptedRef.current) {
      return;
    }

    syncAttemptedRef.current = true;

    let cancelled = false;

    void (async () => {
      const synced = await syncMercadoPago(mercadoPagoPaymentId);
      if (!synced || cancelled) {
        return;
      }

      const url = new URL(window.location.href);
      [
        'provider',
        'payment_id',
        'collection_id',
        'collection_status',
        'status',
        'external_reference',
        'payment_type',
        'merchant_order_id',
        'preference_id',
        'site_id',
        'processing_mode',
        'merchant_account_id'
      ].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.toString());
    })();

    return () => {
      cancelled = true;
    };
  }, [mercadoPagoPaymentId, params.id, session?.accessToken, shouldSyncMercadoPago]);

  useEffect(() => {
    if (
      !session?.accessToken ||
      !params.id ||
      paymentQuery.data?.provider !== 'mercadopago' ||
      !['created', 'pending'].includes(paymentQuery.data.status)
    ) {
      return;
    }

    let cancelled = false;

    const triggerBackgroundSync = async () => {
      if (cancelled || backgroundSyncInFlightRef.current) {
        return;
      }

      backgroundSyncInFlightRef.current = true;

      try {
        await syncMercadoPago(undefined, { silent: true });
      } finally {
        backgroundSyncInFlightRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void triggerBackgroundSync();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void triggerBackgroundSync();
      }
    }, 15000);

    void triggerBackgroundSync();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [params.id, paymentQuery.data?.provider, paymentQuery.data?.status, session?.accessToken]);

  if (!session) {
    return (
      <AuthNotice
        title="El detalle del pago requiere sesion"
        description="Ingresa para revisar el estado del pago, descargar el recibo o continuar tu flujo de reserva."
      />
    );
  }

  const payment = paymentQuery.data;
  const isMercadoPagoSandbox = payment?.provider === 'mercadopago' && isMercadoPagoSandboxCheckout(payment.checkoutUrl);
  const isMercadoPagoAwaitingReceipt =
    payment?.provider === 'mercadopago' && !payment.receiptUrl && ['created', 'pending'].includes(payment.status);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_24px_70px_rgba(49,83,58,0.1)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
              <PublicIcon name="card" className="h-4 w-4" />
              Pago y recibo
            </span>
            <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-bold text-leaf">Detalle del pago</h1>
          </div>
          {payment ? <span className={statusBadgeClassName(payment.status)}>{formatStatus(payment.status)}</span> : null}
        </div>
      </header>

      {syncMessage ? (
        <div className="rounded-[1.5rem] border border-black/8 bg-white/82 px-5 py-4 text-sm text-ink shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
          {syncMessage}
        </div>
      ) : null}

      {isMercadoPagoAwaitingReceipt ? (
        <div className="rounded-[1.5rem] border border-sand/70 bg-sand/35 px-5 py-4 text-sm text-ink shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
          El recibo se genera automaticamente cuando Mercado Pago confirma el pago. Despues de pagar, vuelve a esta
          pestana y espera unos segundos: esta pantalla intentara actualizar el estado sola. Si no cambia, usa
          <span className="font-semibold"> Actualizar estado</span>.
        </div>
      ) : null}

      {isMercadoPagoSandbox ? (
        <div className="rounded-[1.5rem] border border-amber-300/60 bg-amber-50/90 px-5 py-4 text-sm text-amber-950 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
          Estas usando Mercado Pago en modo de prueba. Abre <span className="font-semibold">Continuar al pago</span> en una ventana
          incognita y entra con el comprador de prueba de la misma aplicacion. Si usas una cuenta real de Mercado Pago, el sandbox
          mostrara el error de que una de las partes es de prueba y no se registrara ningun pago.
        </div>
      ) : null}

      {payment ? (
        <>
          <article className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/84 p-8 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur md:grid-cols-2">
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Monto</p>
                <h2 className="mt-2 text-4xl font-semibold text-leaf">{formatCurrency(payment.amountCop, payment.currency)}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] bg-canvas px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Servicio</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatAppointmentType(payment.appointmentMetadata?.appointmentType)}
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-canvas px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Medio</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatPaymentProvider(payment.provider)}</p>
                </div>
                <div className="rounded-[1.4rem] bg-canvas px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Cita</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(payment.appointmentMetadata?.startsAt)}</p>
                </div>
                <div className="rounded-[1.4rem] bg-canvas px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">Referencia</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatShortReference(payment.id)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.5rem] border border-black/5 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Seguimiento</p>
                <div className="mt-4 space-y-3 text-sm text-black/62">
                  <p>Creado: {formatDateTime(payment.createdAt)}</p>
                  {payment.approvedAt ? <p>Aprobado: {formatDateTime(payment.approvedAt)}</p> : null}
                  {payment.expiresAt ? <p>Vence: {formatDateTime(payment.expiresAt)}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {payment.checkoutPayload?.provider === 'mock' ? (
                  <>
                    <button
                      className="bg-leaf text-white"
                      onClick={async () => {
                        await apiFetch(`/billing/payments/${params.id}/mock/approve`, { method: 'POST' }, session.accessToken);
                        paymentQuery.refetch();
                      }}
                    >
                      Confirmar pago de prueba
                    </button>
                    <button
                      className="bg-clay text-white"
                      onClick={async () => {
                        await apiFetch(`/billing/payments/${params.id}/mock/decline`, { method: 'POST' }, session.accessToken);
                        paymentQuery.refetch();
                      }}
                    >
                      Simular rechazo
                    </button>
                  </>
                ) : (
                  <>
                    {payment.checkoutUrl ? (
                      <a
                        href={payment.checkoutUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-2xl bg-leaf px-4 py-3 text-white"
                        rel="noreferrer"
                      >
                        <PublicIcon name="arrow-right" className="h-4 w-4" />
                        {isMercadoPagoSandbox ? 'Continuar al pago de prueba' : 'Continuar al pago'}
                      </a>
                    ) : null}
                    {payment.provider === 'mercadopago' ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-4 py-3"
                        onClick={() => {
                          void syncMercadoPago();
                        }}
                      >
                        <PublicIcon name="spark" className="h-4 w-4" />
                        Actualizar estado
                      </button>
                    ) : null}
                  </>
                )}
                {payment.receiptUrl ? (
                  <a
                    href={payment.receiptUrl}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-4 py-3"
                  >
                    <PublicIcon name="book" className="h-4 w-4" />
                    Abrir recibo
                  </a>
                ) : null}
              </div>
            </div>
          </article>

          {payment.histories?.length ? (
            <article className="rounded-[2rem] border border-white/70 bg-white/82 p-8 shadow-[0_18px_46px_rgba(31,42,32,0.06)] backdrop-blur">
              <h2 className="font-[var(--font-heading)] text-3xl font-bold text-leaf">Linea de tiempo</h2>
              <div className="mt-6 space-y-4">
                {payment.histories.map((history) => (
                  <div key={history.id} className="flex items-start gap-4 rounded-[1.4rem] bg-canvas px-4 py-4">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-white">
                      <PublicIcon name="spark" className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{formatStatus(history.status)}</p>
                      <p className="mt-1 text-sm text-black/55">{formatDateTime(history.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
