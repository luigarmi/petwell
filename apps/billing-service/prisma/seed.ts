import { PaymentProvider, PaymentStatus, Prisma, PrismaClient } from '@petwell/prisma-billing-service-client';

import { AppointmentType, DEMO_IDS } from '@petwell/shared-types';

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addHours(date: Date, hours: number) {
  return addMinutes(date, hours * 60);
}

function addDays(date: Date, days: number, hour: number, minute: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

async function main() {
  await prisma.webhookEvent.deleteMany();
  await prisma.paymentHistory.deleteMany();
  await prisma.paymentAttempt.deleteMany();

  const now = new Date();

  const payments = [
    {
      id: DEMO_IDS.payments.northApproved,
      appointmentId: DEMO_IDS.appointments.inPersonNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 90000,
      externalReference: 'PW-DEMO-NORTH-APPROVED',
      idempotencyKey: 'idempotency-north-approved',
      providerTransactionId: 'tx-north-approved',
      createdAt: addHours(now, -20),
      approvedAt: addHours(now, -19.5),
      appointmentMetadata: {
        appointmentType: AppointmentType.IN_PERSON,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        startsAt: addDays(now, 3, 14, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_north_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.northPending,
      appointmentId: DEMO_IDS.appointments.telemedNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.created,
      currency: 'COP',
      amountCop: 85000,
      externalReference: 'PW-DEMO-NORTH-PENDING',
      idempotencyKey: 'idempotency-north-pending',
      checkoutUrl: 'http://localhost/payments/payment_north_pending',
      checkoutPayload: { provider: 'mock', mode: 'mock' },
      createdAt: addHours(now, -2),
      expiresAt: addDays(now, 1, 23, 0),
      appointmentMetadata: {
        appointmentType: AppointmentType.TELEMED,
        veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
        startsAt: addDays(now, 4, 16, 0).toISOString()
      }
    },
    {
      id: DEMO_IDS.payments.southApproved,
      appointmentId: DEMO_IDS.appointments.vaccineSouth,
      ownerId: DEMO_IDS.users.ownerCarla,
      clinicId: DEMO_IDS.clinics.south,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 70000,
      externalReference: 'PW-DEMO-SOUTH-APPROVED',
      idempotencyKey: 'idempotency-south-approved',
      providerTransactionId: 'tx-south-approved',
      createdAt: addHours(now, -30),
      approvedAt: addHours(now, -29.5),
      appointmentMetadata: {
        appointmentType: AppointmentType.VACCINATION,
        veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
        startsAt: addDays(now, 5, 15, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_south_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.southFailed,
      appointmentId: DEMO_IDS.appointments.checkupSouth,
      ownerId: DEMO_IDS.users.ownerElena,
      clinicId: DEMO_IDS.clinics.south,
      provider: PaymentProvider.mock,
      status: PaymentStatus.failed,
      currency: 'COP',
      amountCop: 88000,
      externalReference: 'PW-DEMO-SOUTH-FAILED',
      idempotencyKey: 'idempotency-south-failed',
      createdAt: addHours(now, -18),
      appointmentMetadata: {
        appointmentType: AppointmentType.CHECKUP,
        veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
        startsAt: addDays(now, 6, 16, 0).toISOString()
      }
    },
    {
      id: DEMO_IDS.payments.reminder24hApproved,
      appointmentId: DEMO_IDS.appointments.reminder24hNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 90000,
      externalReference: 'PW-DEMO-24H-APPROVED',
      idempotencyKey: 'idempotency-reminder-24h-approved',
      providerTransactionId: 'tx-reminder-24h',
      createdAt: addHours(now, -4),
      approvedAt: addHours(now, -3.5),
      appointmentMetadata: {
        appointmentType: AppointmentType.IN_PERSON,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        startsAt: addHours(now, 23).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_reminder_24h_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.reminder2hApproved,
      appointmentId: DEMO_IDS.appointments.reminder2hNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 85000,
      externalReference: 'PW-DEMO-2H-APPROVED',
      idempotencyKey: 'idempotency-reminder-2h-approved',
      providerTransactionId: 'tx-reminder-2h',
      createdAt: addHours(now, -1),
      approvedAt: addMinutes(now, -45),
      appointmentMetadata: {
        appointmentType: AppointmentType.TELEMED,
        veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
        startsAt: addMinutes(now, 90).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_reminder_2h_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.northCompletedApproved,
      appointmentId: DEMO_IDS.appointments.completedNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 90000,
      externalReference: 'PW-DEMO-NORTH-COMPLETED',
      idempotencyKey: 'idempotency-north-completed-approved',
      providerTransactionId: 'tx-north-completed',
      createdAt: addDays(now, -16, 12, 0),
      approvedAt: addDays(now, -16, 12, 20),
      appointmentMetadata: {
        appointmentType: AppointmentType.IN_PERSON,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        startsAt: addDays(now, -14, 10, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_north_completed_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.northTelemedApproved,
      appointmentId: DEMO_IDS.appointments.telemedCompletedNorth,
      ownerId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 85000,
      externalReference: 'PW-DEMO-NORTH-TELEMED-COMPLETED',
      idempotencyKey: 'idempotency-north-telemed-approved',
      providerTransactionId: 'tx-north-telemed-completed',
      createdAt: addDays(now, -8, 15, 0),
      approvedAt: addDays(now, -8, 15, 10),
      appointmentMetadata: {
        appointmentType: AppointmentType.TELEMED,
        veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
        startsAt: addDays(now, -7, 16, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_north_telemed_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.northNoShowApproved,
      appointmentId: DEMO_IDS.appointments.noShowNorth,
      ownerId: DEMO_IDS.users.ownerBruno,
      clinicId: DEMO_IDS.clinics.north,
      provider: PaymentProvider.mock,
      status: PaymentStatus.approved,
      currency: 'COP',
      amountCop: 70000,
      externalReference: 'PW-DEMO-NORTH-NOSHOW',
      idempotencyKey: 'idempotency-north-no-show-approved',
      providerTransactionId: 'tx-north-no-show',
      createdAt: addDays(now, -3, 10, 0),
      approvedAt: addDays(now, -3, 10, 10),
      appointmentMetadata: {
        appointmentType: AppointmentType.VACCINATION,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        startsAt: addDays(now, -2, 11, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_north_no_show_approved.pdf'
    },
    {
      id: DEMO_IDS.payments.southRefunded,
      appointmentId: DEMO_IDS.appointments.emergencySouthCompleted,
      ownerId: DEMO_IDS.users.ownerCarla,
      clinicId: DEMO_IDS.clinics.south,
      provider: PaymentProvider.mock,
      status: PaymentStatus.partially_refunded,
      currency: 'COP',
      amountCop: 140000,
      externalReference: 'PW-DEMO-SOUTH-REFUNDED',
      idempotencyKey: 'idempotency-south-refunded',
      providerTransactionId: 'tx-south-refunded',
      createdAt: addDays(now, -2, 18, 0),
      approvedAt: addDays(now, -2, 18, 10),
      refundedAt: addDays(now, -1, 12, 0),
      appointmentMetadata: {
        appointmentType: AppointmentType.EMERGENCY,
        veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
        startsAt: addDays(now, -1, 18, 0).toISOString()
      },
      receiptUrl: 'http://localhost/minio/petwell-assets/receipts/payment_south_refunded.pdf'
    }
  ] as const;

  const histories: Array<{
    id: string;
    paymentId: string;
    status: PaymentStatus;
    source: string;
    createdAt: Date;
    payload?: Prisma.InputJsonValue;
  }> = [
    {
      id: `${DEMO_IDS.payments.northApproved}_created`,
      paymentId: DEMO_IDS.payments.northApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -20),
      payload: { provider: 'mock' }
    },
    {
      id: `${DEMO_IDS.payments.northApproved}_approved`,
      paymentId: DEMO_IDS.payments.northApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addHours(now, -19.5)
    },
    {
      id: `${DEMO_IDS.payments.northPending}_created`,
      paymentId: DEMO_IDS.payments.northPending,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -2)
    },
    {
      id: `${DEMO_IDS.payments.southApproved}_created`,
      paymentId: DEMO_IDS.payments.southApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -30)
    },
    {
      id: `${DEMO_IDS.payments.southApproved}_approved`,
      paymentId: DEMO_IDS.payments.southApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addHours(now, -29.5)
    },
    {
      id: `${DEMO_IDS.payments.southFailed}_created`,
      paymentId: DEMO_IDS.payments.southFailed,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -18)
    },
    {
      id: `${DEMO_IDS.payments.southFailed}_failed`,
      paymentId: DEMO_IDS.payments.southFailed,
      status: PaymentStatus.failed,
      source: 'seed.failure',
      createdAt: addHours(now, -17.5),
      payload: { reason: 'insufficient_funds' }
    },
    {
      id: `${DEMO_IDS.payments.reminder24hApproved}_created`,
      paymentId: DEMO_IDS.payments.reminder24hApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -4)
    },
    {
      id: `${DEMO_IDS.payments.reminder24hApproved}_approved`,
      paymentId: DEMO_IDS.payments.reminder24hApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addHours(now, -3.5)
    },
    {
      id: `${DEMO_IDS.payments.reminder2hApproved}_created`,
      paymentId: DEMO_IDS.payments.reminder2hApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addHours(now, -1)
    },
    {
      id: `${DEMO_IDS.payments.reminder2hApproved}_approved`,
      paymentId: DEMO_IDS.payments.reminder2hApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addMinutes(now, -45)
    },
    {
      id: `${DEMO_IDS.payments.northCompletedApproved}_created`,
      paymentId: DEMO_IDS.payments.northCompletedApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addDays(now, -16, 12, 0)
    },
    {
      id: `${DEMO_IDS.payments.northCompletedApproved}_approved`,
      paymentId: DEMO_IDS.payments.northCompletedApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addDays(now, -16, 12, 20)
    },
    {
      id: `${DEMO_IDS.payments.northTelemedApproved}_created`,
      paymentId: DEMO_IDS.payments.northTelemedApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addDays(now, -8, 15, 0)
    },
    {
      id: `${DEMO_IDS.payments.northTelemedApproved}_approved`,
      paymentId: DEMO_IDS.payments.northTelemedApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addDays(now, -8, 15, 10)
    },
    {
      id: `${DEMO_IDS.payments.northNoShowApproved}_created`,
      paymentId: DEMO_IDS.payments.northNoShowApproved,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addDays(now, -3, 10, 0)
    },
    {
      id: `${DEMO_IDS.payments.northNoShowApproved}_approved`,
      paymentId: DEMO_IDS.payments.northNoShowApproved,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addDays(now, -3, 10, 10)
    },
    {
      id: `${DEMO_IDS.payments.southRefunded}_created`,
      paymentId: DEMO_IDS.payments.southRefunded,
      status: PaymentStatus.created,
      source: 'seed.create',
      createdAt: addDays(now, -2, 18, 0)
    },
    {
      id: `${DEMO_IDS.payments.southRefunded}_approved`,
      paymentId: DEMO_IDS.payments.southRefunded,
      status: PaymentStatus.approved,
      source: 'seed.approve',
      createdAt: addDays(now, -2, 18, 10)
    },
    {
      id: `${DEMO_IDS.payments.southRefunded}_refunded`,
      paymentId: DEMO_IDS.payments.southRefunded,
      status: PaymentStatus.partially_refunded,
      source: 'seed.refund',
      createdAt: addDays(now, -1, 12, 0),
      payload: { amountCop: 50000, reason: 'gesture_comercial' }
    }
  ];

  const webhookEvents: Array<{
    id: string;
    provider: PaymentProvider;
    externalEventId: string;
    paymentId: string;
    signatureValid: boolean;
    payload: Prisma.InputJsonValue;
    processedAt: Date;
  }> = [
    {
      id: 'webhook_demo_north_approved',
      provider: PaymentProvider.mock,
      externalEventId: 'mock-approved-north',
      paymentId: DEMO_IDS.payments.northApproved,
      signatureValid: true,
      payload: { paymentId: DEMO_IDS.payments.northApproved, status: 'approved' },
      processedAt: addHours(now, -19.4)
    },
    {
      id: 'webhook_demo_south_failed',
      provider: PaymentProvider.mock,
      externalEventId: 'mock-failed-south',
      paymentId: DEMO_IDS.payments.southFailed,
      signatureValid: true,
      payload: { paymentId: DEMO_IDS.payments.southFailed, status: 'failed' },
      processedAt: addHours(now, -17.4)
    }
  ] as const;

  for (const payment of payments) {
    await prisma.paymentAttempt.create({ data: payment });
  }

  for (const history of histories) {
    await prisma.paymentHistory.create({
      data: history
    });
  }

  for (const webhookEvent of webhookEvents) {
    await prisma.webhookEvent.create({
      data: webhookEvent
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
