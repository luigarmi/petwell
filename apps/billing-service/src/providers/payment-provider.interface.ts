import { PaymentProviderName, PaymentStatus } from '@petwell/shared-types';

export interface ProviderCreatePaymentInput {
  paymentId: string;
  externalReference: string;
  amountCop: number;
  currency: string;
  ownerId: string;
  appointmentId: string;
}

export interface ProviderCreatePaymentResult {
  status: PaymentStatus;
  checkoutUrl?: string;
  checkoutPayload?: Record<string, unknown>;
  providerTransactionId?: string;
  expiresAt?: Date;
}

export interface ProviderWebhookResult {
  externalEventId: string;
  paymentStatus: PaymentStatus;
  providerTransactionId?: string;
  externalReference?: string;
  signatureValid: boolean;
  payload: Record<string, unknown>;
}

export interface ProviderRefundResult {
  status: PaymentStatus;
}

export interface ProviderWebhookInput {
  body: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult>;
  resolveWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult>;
  refundPayment?(providerTransactionId: string, amountCop?: number): Promise<ProviderRefundResult>;
}
