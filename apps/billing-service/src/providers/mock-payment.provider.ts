import { Injectable } from '@nestjs/common';

import { PaymentProviderName, PaymentStatus } from '@petwell/shared-types';

import { env } from '../config';
import { PaymentProvider, ProviderCreatePaymentInput, ProviderCreatePaymentResult, ProviderRefundResult, ProviderWebhookInput, ProviderWebhookResult } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = PaymentProviderName.MOCK;

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    return {
      status: PaymentStatus.CREATED,
      checkoutUrl: `${env.PUBLIC_APP_URL}/payments/${input.paymentId}`,
      checkoutPayload: {
        provider: this.name,
        mode: 'mock',
        paymentId: input.paymentId,
        amountCop: input.amountCop
      }
    };
  }

  async resolveWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult> {
    return {
      externalEventId: String(input.body.eventId ?? `mock-${Date.now()}`),
      paymentStatus: PaymentStatus.PENDING,
      signatureValid: true,
      payload: input.body
    };
  }

  async refundPayment(_providerTransactionId: string, amountCop?: number): Promise<ProviderRefundResult> {
    return {
      status: amountCop ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED
    };
  }
}
