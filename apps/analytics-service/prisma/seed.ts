import { PrismaClient } from '@petwell/prisma-analytics-service-client';

import { DEMO_IDS, EVENT_NAMES } from '@petwell/shared-types';

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
  await prisma.analyticsEvent.deleteMany();

  const now = new Date();

  await prisma.analyticsEvent.createMany({
    data: [
      {
        id: 'analytics_appointment_created_completed_north',
        eventName: EVENT_NAMES.APPOINTMENT_CREATED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { appointmentId: DEMO_IDS.appointments.completedNorth },
        occurredAt: addDays(now, -16, 12, 0)
      },
      {
        id: 'analytics_payment_created_completed_north',
        eventName: EVENT_NAMES.PAYMENT_CREATED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { paymentId: DEMO_IDS.payments.northCompletedApproved },
        occurredAt: addDays(now, -16, 12, 1)
      },
      {
        id: 'analytics_payment_succeeded_completed_north',
        eventName: EVENT_NAMES.PAYMENT_SUCCEEDED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { paymentId: DEMO_IDS.payments.northCompletedApproved },
        occurredAt: addDays(now, -16, 12, 20)
      },
      {
        id: 'analytics_appointment_completed_north',
        eventName: EVENT_NAMES.APPOINTMENT_COMPLETED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { appointmentId: DEMO_IDS.appointments.completedNorth },
        occurredAt: addDays(now, -14, 10, 30)
      },
      {
        id: 'analytics_telemed_room_created',
        eventName: EVENT_NAMES.TELEMED_ROOM_CREATED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { appointmentId: DEMO_IDS.appointments.reminder2hNorth },
        occurredAt: addMinutes(now, -44)
      },
      {
        id: 'analytics_notification_requested',
        eventName: EVENT_NAMES.NOTIFICATION_REQUESTED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { template: 'reminder-24h', userId: DEMO_IDS.users.ownerAna },
        occurredAt: addHours(now, -1)
      },
      {
        id: 'analytics_payment_failed',
        eventName: EVENT_NAMES.PAYMENT_FAILED,
        clinicId: DEMO_IDS.clinics.south,
        payload: { paymentId: DEMO_IDS.payments.southFailed },
        occurredAt: addHours(now, -17.5)
      },
      {
        id: 'analytics_appointment_cancelled',
        eventName: EVENT_NAMES.APPOINTMENT_CANCELLED,
        clinicId: DEMO_IDS.clinics.south,
        payload: { appointmentId: DEMO_IDS.appointments.checkupSouth },
        occurredAt: addHours(now, -12)
      },
      {
        id: 'analytics_ehr_accessed_luna',
        eventName: EVENT_NAMES.EHR_RECORD_ACCESSED,
        clinicId: DEMO_IDS.clinics.south,
        payload: { recordId: DEMO_IDS.ehr.lunaFollowUp, petId: DEMO_IDS.pets.luna },
        occurredAt: addDays(now, -3, 9, 10)
      },
      {
        id: 'analytics_payment_succeeded_reminder_2h',
        eventName: EVENT_NAMES.PAYMENT_SUCCEEDED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { paymentId: DEMO_IDS.payments.reminder2hApproved },
        occurredAt: addMinutes(now, -45)
      },
      {
        id: 'analytics_appointment_created_pending',
        eventName: EVENT_NAMES.APPOINTMENT_CREATED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { appointmentId: DEMO_IDS.appointments.telemedNorth },
        occurredAt: addHours(now, -2)
      },
      {
        id: 'analytics_payment_created_pending',
        eventName: EVENT_NAMES.PAYMENT_CREATED,
        clinicId: DEMO_IDS.clinics.north,
        payload: { paymentId: DEMO_IDS.payments.northPending },
        occurredAt: addHours(now, -2)
      }
    ]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
