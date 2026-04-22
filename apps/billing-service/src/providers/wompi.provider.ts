import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PaymentProviderName, PaymentStatus } from '@petwell/shared-types';

import { env } from '../config';
import { PaymentProvider, ProviderCreatePaymentInput, ProviderCreatePaymentResult, ProviderWebhookInput, ProviderWebhookResult } from './payment-provider.interface';

@Injectable()
export class WompiProvider implements PaymentProvider {
  readonly name = PaymentProviderName.WOMPI;

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    const publicKey = env.WOMPI_SANDBOX_PUBLIC_KEY ?? env.WOMPI_PRODUCTION_PUBLIC_KEY;
    const integritySecret =
      env.WOMPI_SANDBOX_INTEGRITY_SECRET ??
      env.WOMPI_PRODUCTION_INTEGRITY_SECRET ??
      env.WOMPI_SANDBOX_EVENTS_SECRET ??
      env.WOMPI_PRODUCTION_EVENTS_SECRET;

    if (!publicKey || !integritySecret) {
      throw new Error('Wompi credentials are missing: public key and integrity secret are required');
    }

    const amountInCents = input.amountCop * 100;
    const expirationTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const checksum = createHash('sha256')
      .update(`${input.externalReference}${amountInCents}${input.currency}${expirationTime}${integritySecret}`)
      .digest('hex');

    return {
      status: PaymentStatus.CREATED,
      checkoutUrl: 'https://checkout.wompi.co/p/',
      checkoutPayload: {
        provider: this.name,
        publicKey,
        currency: input.currency,
        amountInCents,
        reference: input.externalReference,
        signatureIntegrity: checksum,
        redirectUrl: `${env.PUBLIC_APP_URL}/payments/${input.paymentId}?provider=wompi`,
        expirationTime
      },
      expiresAt: new Date(expirationTime)
    };
  }

  async resolveWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult> {
    const payload = input.body;
    const eventSecret = env.WOMPI_SANDBOX_EVENTS_SECRET ?? env.WOMPI_PRODUCTION_EVENTS_SECRET;
    const signature = payload.signature as { checksum?: string; properties?: string[] } | undefined;
    const data = (payload.data as { transaction?: Record<string, unknown> } | undefined)?.transaction ?? {};
    const timestamp = String(payload.timestamp ?? '');
    const properties = signature?.properties ?? [];
    const concatenated = properties.map((property) => this.resolveProperty(data, property.replace('transaction.', ''))).join('');
    const expectedChecksum = eventSecret
      ? createHash('sha256').update(`${concatenated}${timestamp}${eventSecret}`).digest('hex')
      : '';
    const status = this.mapStatus(String(data.status ?? 'PENDING'));

    return {
      externalEventId: `${String(payload.event ?? 'transaction.updated')}:${String(data.id ?? 'unknown')}:${timestamp}`,
      paymentStatus: status,
      providerTransactionId: String(data.id ?? ''),
      externalReference: String(data.reference ?? ''),
      signatureValid: signature?.checksum ? signature.checksum.toLowerCase() === expectedChecksum.toLowerCase() : false,
      payload
    };
  }

  private resolveProperty(data: Record<string, unknown>, property: string) {
    return String(data[property] ?? '');
  }

  private mapStatus(status: string) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return PaymentStatus.APPROVED;
      case 'DECLINED':
        return PaymentStatus.DECLINED;
      case 'VOIDED':
        return PaymentStatus.EXPIRED;
      case 'ERROR':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
