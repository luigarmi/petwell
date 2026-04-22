import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PaymentProviderName, PaymentStatus } from '@petwell/shared-types';

import { env } from '../config';
import { PaymentProvider, ProviderCreatePaymentInput, ProviderCreatePaymentResult, ProviderWebhookInput, ProviderWebhookResult } from './payment-provider.interface';

type MercadoPagoPaymentDetails = {
  id: number;
  status: string;
  external_reference?: string;
  [key: string]: unknown;
};

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = PaymentProviderName.MERCADOPAGO;

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_reference: input.externalReference,
        items: [
          {
            title: 'Cita veterinaria PetWell',
            quantity: 1,
            currency_id: input.currency,
            unit_price: input.amountCop
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago preference creation failed with status ${response.status}`);
    }

    const data = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string };

    return {
      status: PaymentStatus.CREATED,
      checkoutUrl: data.sandbox_init_point ?? data.init_point,
      checkoutPayload: {
        provider: this.name,
        preferenceId: data.id
      },
      providerTransactionId: data.id
    };
  }

  async getPaymentSnapshot(paymentId: string) {
    const payment = await this.fetchPaymentDetails(paymentId);

    return {
      paymentStatus: this.mapStatus(payment.status),
      providerTransactionId: String(payment.id),
      externalReference: payment.external_reference,
      payload: payment as Record<string, unknown>
    };
  }

  async findPaymentSnapshotByExternalReference(externalReference: string) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search');
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('external_reference', externalReference);
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago payment search failed with status ${response.status}`);
    }

    const result = (await response.json()) as { results?: MercadoPagoPaymentDetails[] };
    const payment = result.results?.[0];
    if (!payment) {
      return null;
    }

    return {
      paymentStatus: this.mapStatus(payment.status),
      providerTransactionId: String(payment.id),
      externalReference: payment.external_reference,
      payload: payment as Record<string, unknown>
    };
  }

  async resolveWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult> {
    const secret = env.MERCADOPAGO_SANDBOX_WEBHOOK_SECRET ?? env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET;
    const xSignature = String(input.headers['x-signature'] ?? '');
    const requestId = String(input.headers['x-request-id'] ?? '');
    const dataId = String(input.query['data.id'] ?? (input.body.data as { id?: string } | undefined)?.id ?? '').toLowerCase();
    const ts = xSignature
      .split(',')
      .map((piece) => piece.trim())
      .find((piece) => piece.startsWith('ts='))?.split('=')[1] ?? '';
    const v1 = xSignature
      .split(',')
      .map((piece) => piece.trim())
      .find((piece) => piece.startsWith('v1='))?.split('=')[1] ?? '';

    const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expectedSignature = secret ? createHmac('sha256', secret).update(template).digest('hex') : '';

    const paymentId = String((input.body.data as { id?: string } | undefined)?.id ?? '');
    const payment = await this.getPaymentSnapshot(paymentId);

    return {
      externalEventId: `${String(input.body.type ?? 'payment')}:${String(input.body.id ?? payment.providerTransactionId)}`,
      paymentStatus: payment.paymentStatus,
      providerTransactionId: payment.providerTransactionId,
      externalReference: payment.externalReference,
      signatureValid: Boolean(secret && v1 && expectedSignature === v1),
      payload: input.body
    };
  }

  private getAccessToken() {
    const accessToken = env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN ?? env.MERCADOPAGO_PRODUCTION_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Mercado Pago access token is required');
    }

    return accessToken;
  }

  private async fetchPaymentDetails(paymentId: string) {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`
      }
    });

    if (!paymentResponse.ok) {
      throw new Error(`Mercado Pago payment lookup failed with status ${paymentResponse.status}`);
    }

    return (await paymentResponse.json()) as MercadoPagoPaymentDetails;
  }

  private mapStatus(status: string) {
    switch (status) {
      case 'approved':
        return PaymentStatus.APPROVED;
      case 'rejected':
        return PaymentStatus.DECLINED;
      case 'cancelled':
        return PaymentStatus.EXPIRED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'charged_back':
        return PaymentStatus.FAILED;
      case 'in_process':
      case 'pending':
        return PaymentStatus.PENDING;
      default:
        return PaymentStatus.FAILED;
    }
  }
}
