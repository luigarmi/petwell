import { NotificationStatus, PrismaClient } from '@petwell/prisma-notification-service-client';

import { DEMO_IDS } from '@petwell/shared-types';

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
  await prisma.notification.deleteMany();

  const now = new Date();

  const notifications = [
    {
      id: 'notification_demo_payment',
      userId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      channel: 'email',
      recipient: 'ana@petwell.local',
      subject: 'Tu cita PetWell fue confirmada',
      template: 'appointment-confirmed',
      dedupeKey: 'payment_succeeded:payment_north_approved',
      status: NotificationStatus.sent,
      attempts: 1,
      sentAt: addHours(now, -19.4),
      createdAt: addHours(now, -19.5)
    },
    {
      id: 'notification_demo_telemed',
      userId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      channel: 'email',
      recipient: 'ana@petwell.local',
      subject: 'Acceso a tu teleconsulta PetWell',
      template: 'telemed-room',
      dedupeKey: 'telemed_room:appointment_reminder_2h_north',
      status: NotificationStatus.sent,
      attempts: 1,
      sentAt: addMinutes(now, -40),
      createdAt: addMinutes(now, -45),
      variables: {
        roomUrl: 'http://localhost/telemed/telemed_room_demo_upcoming?token=demo-token-upcoming'
      }
    },
    {
      id: 'notification_demo_reminder_24h',
      userId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      channel: 'email',
      recipient: 'ana@petwell.local',
      subject: 'Recordatorio 24h',
      template: 'reminder-24h',
      dedupeKey: 'reminder-24h:appointment_reminder_24h_north:24',
      status: NotificationStatus.sent,
      attempts: 1,
      sentAt: addHours(now, -1),
      createdAt: addHours(now, -1.1)
    },
    {
      id: 'notification_demo_reminder_2h',
      userId: DEMO_IDS.users.ownerAna,
      clinicId: DEMO_IDS.clinics.north,
      channel: 'email',
      recipient: 'ana@petwell.local',
      subject: 'Recordatorio 2h',
      template: 'reminder-2h',
      dedupeKey: 'reminder-2h:appointment_reminder_2h_north:2',
      status: NotificationStatus.queued,
      attempts: 0,
      createdAt: addMinutes(now, -5)
    },
    {
      id: 'notification_demo_payment_failed',
      userId: DEMO_IDS.users.ownerElena,
      clinicId: DEMO_IDS.clinics.south,
      channel: 'email',
      recipient: 'elena@petwell.local',
      subject: 'Tu pago PetWell no fue aprobado',
      template: 'payment-failed',
      dedupeKey: 'payment_failed:payment_south_failed',
      status: NotificationStatus.failed,
      attempts: 2,
      lastError: 'SMTP 421 temporary outage',
      createdAt: addHours(now, -17.4)
    },
    {
      id: 'notification_demo_refund',
      userId: DEMO_IDS.users.ownerCarla,
      clinicId: DEMO_IDS.clinics.south,
      channel: 'email',
      recipient: 'carla@petwell.local',
      subject: 'Actualizacion de tu pago PetWell',
      template: 'payment-refunded',
      dedupeKey: 'payment_refund:payment_south_refunded',
      status: NotificationStatus.sent,
      attempts: 1,
      sentAt: addDays(now, -1, 12, 10),
      createdAt: addDays(now, -1, 12, 0)
    }
  ] as const;

  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification
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
