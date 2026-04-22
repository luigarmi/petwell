import { randomUUID } from 'node:crypto';

import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, PaymentProvider as PrismaPaymentProvider, PaymentStatus as PrismaPaymentStatus } from '@petwell/prisma-billing-service-client';

import { RabbitMqEventBus, createEventPayload } from '@petwell/shared-events';
import {
  AppointmentCreatedEvent,
  EVENT_NAMES,
  JwtUserClaims,
  PaymentCreatedEvent,
  PaymentProviderName,
  PaymentSettledEvent,
  PaymentStatus,
  UserRole
} from '@petwell/shared-types';

import { env } from './config';
import { RefundPaymentDto, SyncMercadoPagoPaymentDto } from './dto/payment.dto';
import { PrismaService } from './prisma.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaymentProvider } from './providers/payment-provider.interface';
import { WompiProvider } from './providers/wompi.provider';
import { StorageService } from './storage.service';

@Injectable()
export class BillingService implements OnModuleInit {
  private providerRegistry: Record<PaymentProviderName, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: RabbitMqEventBus,
    private readonly mockProvider: MockPaymentProvider,
    private readonly wompiProvider: WompiProvider,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly storageService: StorageService
  ) {
    this.providerRegistry = {
      [PaymentProviderName.MOCK]: this.mockProvider,
      [PaymentProviderName.WOMPI]: this.wompiProvider,
      [PaymentProviderName.MERCADOPAGO]: this.mercadoPagoProvider
    };
  }

  async onModuleInit() {
    this.eventBus.subscribe(EVENT_NAMES.APPOINTMENT_CREATED, async (payload) => {
      await this.createPaymentFromAppointment(payload as AppointmentCreatedEvent);
    });
    await this.eventBus.connect();
  }

  async createPaymentFromAppointment(payload: AppointmentCreatedEvent) {
    const existing = await this.prisma.paymentAttempt.findFirst({
      where: {
        appointmentId: payload.appointmentId,
        status: {
          in: [PrismaPaymentStatus.created, PrismaPaymentStatus.pending, PrismaPaymentStatus.approved]
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existing) {
      return existing;
    }

    const providerName = env.PAYMENT_PROVIDER as PaymentProviderName;
    const provider = this.providerRegistry[providerName];
    const externalReference = `PW-${payload.appointmentId}-${Date.now()}`;
    const payment = await this.prisma.paymentAttempt.create({
      data: {
        id: randomUUID(),
        appointmentId: payload.appointmentId,
        ownerId: payload.ownerId,
        clinicId: payload.clinicId,
        provider: providerName as unknown as PrismaPaymentProvider,
        status: PrismaPaymentStatus.created,
        currency: env.PAYMENT_CURRENCY,
        amountCop: payload.amountCop,
        externalReference,
        idempotencyKey: randomUUID(),
        appointmentMetadata: {
          appointmentType: payload.appointmentType,
          veterinarianId: payload.veterinarianId,
          startsAt: payload.startsAt
        }
      }
    });

    await this.appendHistory(payment.id, PaymentStatus.CREATED, 'appointment.created', payload as unknown as Record<string, unknown>);

    try {
      const providerResult = await provider.createPayment({
        paymentId: payment.id,
        externalReference,
        amountCop: payment.amountCop,
        currency: payment.currency,
        ownerId: payment.ownerId,
        appointmentId: payment.appointmentId
      });

      const updated = await this.prisma.paymentAttempt.update({
        where: { id: payment.id },
        data: {
          status: providerResult.status as unknown as PrismaPaymentStatus,
          checkoutUrl: providerResult.checkoutUrl,
          checkoutPayload: providerResult.checkoutPayload as Prisma.InputJsonValue | undefined,
          providerTransactionId: providerResult.providerTransactionId,
          expiresAt: providerResult.expiresAt
        }
      });

      await this.appendHistory(updated.id, providerResult.status, `provider.${provider.name}.create`, providerResult.checkoutPayload);
      await this.publishPaymentCreated(updated.id);
      return updated;
    } catch (error) {
      const failed = await this.prisma.paymentAttempt.update({
        where: { id: payment.id },
        data: {
          status: PrismaPaymentStatus.failed
        }
      });

      await this.appendHistory(failed.id, PaymentStatus.FAILED, `provider.${provider.name}.create.error`, {
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.publishSettlementEvent(failed.id, PaymentStatus.FAILED);
      return failed;
    }
  }

  async getLatestPaymentForAppointment(user: JwtUserClaims, appointmentId: string) {
    const payment = await this.prisma.paymentAttempt.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: 'desc' }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);
    return payment;
  }

  async getPaymentById(user: JwtUserClaims, paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentId },
      include: {
        histories: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);
    return payment;
  }

  async retryPayment(user: JwtUserClaims, paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);

    if (
      payment.status !== PrismaPaymentStatus.declined &&
      payment.status !== PrismaPaymentStatus.failed &&
      payment.status !== PrismaPaymentStatus.expired
    ) {
      throw new ForbiddenException('Only declined, failed or expired payments can be retried');
    }

    return this.createPaymentFromAppointment({
      eventId: randomUUID(),
      appointmentId: payment.appointmentId,
      ownerId: payment.ownerId,
      petId: '',
      clinicId: payment.clinicId,
      veterinarianId: String((payment.appointmentMetadata as { veterinarianId?: string } | null)?.veterinarianId ?? ''),
      appointmentType: ((payment.appointmentMetadata as { appointmentType?: string } | null)?.appointmentType ?? 'in_person') as any,
      startsAt: String((payment.appointmentMetadata as { startsAt?: string } | null)?.startsAt ?? new Date().toISOString()),
      amountCop: payment.amountCop,
      status: 'pending_payment' as any
    });
  }

  async syncMercadoPagoPayment(user: JwtUserClaims, paymentId: string, dto: SyncMercadoPagoPaymentDto) {
    const payment = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);

    if (payment.provider !== PrismaPaymentProvider.mercadopago) {
      throw new ForbiddenException('This payment is not managed by Mercado Pago');
    }

    const providerPaymentId = dto.paymentId ?? dto.collectionId;
    const paymentSnapshot = providerPaymentId
      ? await this.mercadoPagoProvider.getPaymentSnapshot(providerPaymentId)
      : await this.mercadoPagoProvider.findPaymentSnapshotByExternalReference(payment.externalReference);

    if (!paymentSnapshot) {
      throw new BadRequestException('Mercado Pago has not registered a payment for this reference yet');
    }

    if (paymentSnapshot.externalReference && paymentSnapshot.externalReference !== payment.externalReference) {
      throw new ForbiddenException('Mercado Pago payment does not match this payment');
    }

    return this.applySettlement(payment.id, paymentSnapshot.paymentStatus, paymentSnapshot.providerTransactionId, paymentSnapshot.payload);
  }

  async approveMockPayment(user: JwtUserClaims, paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);
    return this.applySettlement(payment.id, PaymentStatus.APPROVED, `mock-approval-${Date.now()}`, { action: 'mock_approve' });
  }

  async declineMockPayment(user: JwtUserClaims, paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);
    return this.applySettlement(payment.id, PaymentStatus.DECLINED, `mock-decline-${Date.now()}`, { action: 'mock_decline' });
  }

  async refundPayment(user: JwtUserClaims, paymentId: string, dto: RefundPaymentDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN].includes(user.role)) {
      throw new ForbiddenException('Only admins can refund payments');
    }

    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!user.clinicIds.includes(payment.clinicId) && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('You cannot refund this payment');
    }

    if (payment.status !== PrismaPaymentStatus.approved) {
      throw new ForbiddenException('Only approved payments can be refunded');
    }

    const provider = this.providerRegistry[payment.provider as unknown as PaymentProviderName];
    const refundResult = provider.refundPayment
      ? await provider.refundPayment(payment.providerTransactionId ?? payment.id, dto.amountCop)
      : {
          status: dto.amountCop ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED
        };

    const updated = await this.prisma.paymentAttempt.update({
      where: { id: payment.id },
      data: {
        status: refundResult.status as unknown as PrismaPaymentStatus,
        refundedAt: new Date()
      }
    });

    await this.appendHistory(updated.id, refundResult.status, 'refund', dto as unknown as Record<string, unknown>);
    return updated;
  }

  async handleProviderWebhook(
    providerName: PaymentProviderName,
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | undefined>
  ) {
    const provider = this.providerRegistry[providerName];
    const result = await provider.resolveWebhook({ body, headers, query });

    const existingWebhook = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: providerName as unknown as PrismaPaymentProvider,
          externalEventId: result.externalEventId
        }
      }
    });

    if (existingWebhook) {
      return { success: true, duplicated: true };
    }

    const paymentLookupFilters = [
      result.providerTransactionId ? { providerTransactionId: result.providerTransactionId } : null,
      result.externalReference ? { externalReference: result.externalReference } : null
    ].filter(Boolean) as Prisma.PaymentAttemptWhereInput[];

    const payment = await this.prisma.paymentAttempt.findFirst({
      where: paymentLookupFilters.length > 0 ? { OR: paymentLookupFilters } : undefined
    });

    await this.prisma.webhookEvent.create({
      data: {
        id: randomUUID(),
        provider: providerName as unknown as PrismaPaymentProvider,
        externalEventId: result.externalEventId,
        paymentId: payment?.id,
        signatureValid: result.signatureValid,
        payload: result.payload as Prisma.InputJsonValue
      }
    });

    if (!payment || !result.signatureValid) {
      return { success: true, paymentMatched: Boolean(payment), signatureValid: result.signatureValid };
    }

    await this.applySettlement(payment.id, result.paymentStatus, result.providerTransactionId, result.payload);
    return { success: true };
  }

  async getReceipt(user: JwtUserClaims, paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    this.assertPaymentAccess(user, payment.ownerId, payment.clinicId);
    return { receiptUrl: payment.receiptUrl };
  }

  async summary(user: JwtUserClaims) {
    const where = user.role === UserRole.SUPERADMIN ? undefined : { clinicId: { in: user.clinicIds } };

    const [revenueApproved, byStatus] = await this.prisma.$transaction([
      this.prisma.paymentAttempt.aggregate({
        _sum: { amountCop: true },
        where: { ...where, status: PrismaPaymentStatus.approved }
      }),
      this.prisma.paymentAttempt.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: true
      })
    ]);

    return {
      revenueApprovedCop: revenueApproved._sum.amountCop ?? 0,
      byStatus
    };
  }

  private async applySettlement(
    paymentId: string,
    paymentStatus: PaymentStatus,
    providerTransactionId?: string,
    payload?: Record<string, unknown>
  ) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const nextStatus = paymentStatus as unknown as PrismaPaymentStatus;
    const isSameStatus = payment.status === nextStatus;

    const updated = await this.prisma.paymentAttempt.update({
      where: { id: paymentId },
      data: {
        status: nextStatus,
        providerTransactionId: providerTransactionId ?? payment.providerTransactionId,
        approvedAt: !isSameStatus && paymentStatus === PaymentStatus.APPROVED ? new Date() : payment.approvedAt,
        declinedAt: !isSameStatus && paymentStatus === PaymentStatus.DECLINED ? new Date() : payment.declinedAt,
        expiredAt: !isSameStatus && paymentStatus === PaymentStatus.EXPIRED ? new Date() : payment.expiredAt
      }
    });

    if (!isSameStatus) {
      await this.appendHistory(updated.id, paymentStatus, 'settlement', payload);
    }

    if (paymentStatus === PaymentStatus.APPROVED && !updated.receiptUrl) {
      const receiptUrl = await this.storageService.uploadReceipt({
        id: updated.id,
        appointmentId: updated.appointmentId,
        amountCop: updated.amountCop,
        currency: updated.currency,
        approvedAt: updated.approvedAt,
        createdAt: updated.createdAt,
        provider: updated.provider,
        status: updated.status,
        appointmentType: String((updated.appointmentMetadata as { appointmentType?: string } | null)?.appointmentType ?? ''),
        startsAt: String((updated.appointmentMetadata as { startsAt?: string } | null)?.startsAt ?? '')
      });
      await this.prisma.paymentAttempt.update({
        where: { id: updated.id },
        data: { receiptUrl }
      });
    }

    if (!isSameStatus && [PaymentStatus.APPROVED, PaymentStatus.DECLINED, PaymentStatus.FAILED, PaymentStatus.EXPIRED].includes(paymentStatus)) {
      await this.publishSettlementEvent(updated.id, paymentStatus);
    }

    return this.prisma.paymentAttempt.findUnique({
      where: { id: updated.id },
      include: { histories: { orderBy: { createdAt: 'asc' } } }
    });
  }

  private async publishPaymentCreated(paymentId: string) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return;
    }

    const metadata = (payment.appointmentMetadata as { appointmentType?: string; veterinarianId?: string; startsAt?: string } | null) ?? {};
    const payload: PaymentCreatedEvent = createEventPayload({
      paymentId: payment.id,
      appointmentId: payment.appointmentId,
      ownerId: payment.ownerId,
      clinicId: payment.clinicId,
      provider: payment.provider as unknown as PaymentProviderName,
      amountCop: payment.amountCop,
      appointmentType: metadata.appointmentType as any,
      veterinarianId: metadata.veterinarianId,
      startsAt: metadata.startsAt,
      status: payment.status as unknown as PaymentStatus
    });

    await this.eventBus.publish(EVENT_NAMES.PAYMENT_CREATED, payload);
  }

  private async publishSettlementEvent(paymentId: string, settlementStatus: PaymentStatus) {
    const payment = await this.prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return;
    }

    const metadata = (payment.appointmentMetadata as { appointmentType?: string; veterinarianId?: string; startsAt?: string } | null) ?? {};
    const payload: PaymentSettledEvent = createEventPayload({
      paymentId: payment.id,
      appointmentId: payment.appointmentId,
      ownerId: payment.ownerId,
      clinicId: payment.clinicId,
      provider: payment.provider as unknown as PaymentProviderName,
      amountCop: payment.amountCop,
      appointmentType: metadata.appointmentType as any,
      veterinarianId: metadata.veterinarianId,
      startsAt: metadata.startsAt,
      status: settlementStatus,
      externalReference: payment.externalReference
    });

    await this.eventBus.publish(
      settlementStatus === PaymentStatus.APPROVED ? EVENT_NAMES.PAYMENT_SUCCEEDED : EVENT_NAMES.PAYMENT_FAILED,
      payload
    );
  }

  private assertPaymentAccess(user: JwtUserClaims, ownerId: string, clinicId: string) {
    if (user.role === UserRole.SUPERADMIN) {
      return;
    }

    if (user.role === UserRole.PET_OWNER && user.sub === ownerId) {
      return;
    }

    if ([UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role) && user.clinicIds.includes(clinicId)) {
      return;
    }

    throw new ForbiddenException('You do not have access to this payment');
  }

  private async appendHistory(
    paymentId: string,
    status: PaymentStatus,
    source: string,
    payload?: Record<string, unknown> | null
  ) {
    await this.prisma.paymentHistory.create({
      data: {
        id: randomUUID(),
        paymentId,
        status: status as unknown as PrismaPaymentStatus,
        source,
        payload: (payload as Prisma.InputJsonValue | undefined) ?? undefined
      }
    });
  }
}
