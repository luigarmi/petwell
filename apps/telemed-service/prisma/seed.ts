import { PrismaClient } from '@petwell/prisma-telemed-service-client';

import { DEMO_IDS } from '@petwell/shared-types';

const prisma = new PrismaClient();

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number, hour: number, minute: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

async function main() {
  await prisma.telemedRoom.deleteMany();

  const now = new Date();

  await prisma.telemedRoom.createMany({
    data: [
      {
        id: 'telemed_room_demo_upcoming',
        appointmentId: DEMO_IDS.appointments.reminder2hNorth,
        clinicId: DEMO_IDS.clinics.north,
        ownerId: DEMO_IDS.users.ownerAna,
        veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
        provider: 'mock',
        roomUrl: 'http://localhost/telemed/telemed_room_demo_upcoming?token=demo-token-upcoming',
        joinToken: 'demo-token-upcoming',
        startsAt: addMinutes(now, 90),
        expiresAt: addMinutes(now, 120),
        durationMinutes: 30
      },
      {
        id: 'telemed_room_demo_completed',
        appointmentId: DEMO_IDS.appointments.telemedCompletedNorth,
        clinicId: DEMO_IDS.clinics.north,
        ownerId: DEMO_IDS.users.ownerAna,
        veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
        provider: 'mock',
        roomUrl: 'http://localhost/telemed/telemed_room_demo_completed?token=demo-token-completed',
        joinToken: 'demo-token-completed',
        startsAt: addDays(now, -7, 16, 0),
        expiresAt: addDays(now, -7, 16, 30),
        durationMinutes: 30
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
