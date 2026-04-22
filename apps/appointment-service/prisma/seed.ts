import { AppointmentStatus, PrismaClient } from '@petwell/prisma-appointment-service-client';

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
  await prisma.waitlistEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.scheduleTemplate.deleteMany();

  const now = new Date();

  const schedules = [
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthPrimary, 1, '08:00', '12:00', 30],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthPrimary, 3, '08:00', '12:00', 30],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthPrimary, 5, '09:00', '13:00', 30],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthSecondary, 2, '14:00', '18:00', 30],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthSecondary, 4, '14:00', '18:00', 30],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.veterinarianSouthPrimary, 1, '09:00', '13:00', 30],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.veterinarianSouthPrimary, 3, '09:00', '13:00', 30],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.veterinarianSouthPrimary, 4, '09:00', '14:00', 30]
  ] as const;

  for (const [clinicId, veterinarianId, weekday, startTime, endTime, slotDurationMinutes] of schedules) {
    await prisma.scheduleTemplate.create({
      data: {
        id: `${clinicId}_${veterinarianId}_${weekday}`,
        clinicId,
        veterinarianId,
        weekday,
        startTime,
        endTime,
        slotDurationMinutes
      }
    });
  }

  await prisma.scheduleBlock.createMany({
    data: [
      {
        id: 'schedule_block_north_lunch',
        clinicId: DEMO_IDS.clinics.north,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        startsAt: addDays(now, 3, 10, 0),
        endsAt: addDays(now, 3, 11, 0),
        reason: 'Bloqueo operativo por junta clinica'
      },
      {
        id: 'schedule_block_south_imaging',
        clinicId: DEMO_IDS.clinics.south,
        startsAt: addDays(now, 5, 12, 0),
        endsAt: addDays(now, 5, 13, 0),
        reason: 'Bloqueo general por mantenimiento de sala'
      }
    ]
  });

  const appointments = [
    {
      id: DEMO_IDS.appointments.inPersonNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.luna,
      appointmentType: AppointmentType.IN_PERSON,
      startsAt: addDays(now, 3, 14, 0),
      endsAt: addDays(now, 3, 14, 30),
      status: AppointmentStatus.confirmed,
      amountCop: 90000,
      notes: 'Control general agendado desde portal publico.'
    },
    {
      id: DEMO_IDS.appointments.telemedNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.max,
      appointmentType: AppointmentType.TELEMED,
      startsAt: addDays(now, 4, 16, 0),
      endsAt: addDays(now, 4, 16, 30),
      status: AppointmentStatus.pending_payment,
      amountCop: 85000,
      notes: 'Pendiente de pago mock.'
    },
    {
      id: DEMO_IDS.appointments.vaccineSouth,
      clinicId: DEMO_IDS.clinics.south,
      veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
      ownerId: DEMO_IDS.users.ownerCarla,
      petId: DEMO_IDS.pets.rocky,
      appointmentType: AppointmentType.VACCINATION,
      startsAt: addDays(now, 5, 15, 0),
      endsAt: addDays(now, 5, 15, 20),
      status: AppointmentStatus.confirmed,
      amountCop: 70000,
      notes: 'Refuerzo anual programado.'
    },
    {
      id: DEMO_IDS.appointments.checkupSouth,
      clinicId: DEMO_IDS.clinics.south,
      veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
      ownerId: DEMO_IDS.users.ownerElena,
      petId: DEMO_IDS.pets.mia,
      appointmentType: AppointmentType.CHECKUP,
      startsAt: addDays(now, 6, 16, 0),
      endsAt: addDays(now, 6, 16, 30),
      status: AppointmentStatus.cancelled,
      amountCop: 88000,
      cancelledAt: addHours(now, -12),
      cancellationReason: 'payment_failed',
      notes: 'Cancelada automaticamente por fallo de pago.'
    },
    {
      id: DEMO_IDS.appointments.reminder24hNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.luna,
      appointmentType: AppointmentType.IN_PERSON,
      startsAt: addHours(now, 23),
      endsAt: addHours(now, 23.5),
      status: AppointmentStatus.confirmed,
      amountCop: 90000,
      notes: 'Cita dentro de ventana de recordatorio 24h.'
    },
    {
      id: DEMO_IDS.appointments.reminder2hNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.max,
      appointmentType: AppointmentType.TELEMED,
      startsAt: addMinutes(now, 90),
      endsAt: addMinutes(now, 120),
      status: AppointmentStatus.confirmed,
      amountCop: 85000,
      notes: 'Teleconsulta dentro de ventana de recordatorio 2h.'
    },
    {
      id: DEMO_IDS.appointments.completedNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.luna,
      appointmentType: AppointmentType.IN_PERSON,
      startsAt: addDays(now, -14, 10, 0),
      endsAt: addDays(now, -14, 10, 30),
      status: AppointmentStatus.completed,
      amountCop: 90000,
      notes: 'Control anual completado.'
    },
    {
      id: DEMO_IDS.appointments.telemedCompletedNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
      ownerId: DEMO_IDS.users.ownerAna,
      petId: DEMO_IDS.pets.max,
      appointmentType: AppointmentType.TELEMED,
      startsAt: addDays(now, -7, 16, 0),
      endsAt: addDays(now, -7, 16, 30),
      status: AppointmentStatus.completed,
      amountCop: 85000,
      notes: 'Seguimiento digestivo por telemedicina.'
    },
    {
      id: DEMO_IDS.appointments.noShowNorth,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      ownerId: DEMO_IDS.users.ownerBruno,
      petId: DEMO_IDS.pets.nina,
      appointmentType: AppointmentType.VACCINATION,
      startsAt: addDays(now, -2, 11, 0),
      endsAt: addDays(now, -2, 11, 20),
      status: AppointmentStatus.no_show,
      amountCop: 70000,
      notes: 'El paciente no asistio a la franja reservada.'
    },
    {
      id: DEMO_IDS.appointments.emergencySouthCompleted,
      clinicId: DEMO_IDS.clinics.south,
      veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
      ownerId: DEMO_IDS.users.ownerCarla,
      petId: DEMO_IDS.pets.rocky,
      appointmentType: AppointmentType.EMERGENCY,
      startsAt: addDays(now, -1, 18, 0),
      endsAt: addDays(now, -1, 18, 45),
      status: AppointmentStatus.completed,
      amountCop: 140000,
      notes: 'Atencion por dolor abdominal controlado.'
    }
  ];

  for (const appointment of appointments) {
    await prisma.appointment.create({ data: appointment });
  }

  await prisma.waitlistEntry.createMany({
    data: [
      {
        id: 'waitlist_demo_1',
        clinicId: DEMO_IDS.clinics.north,
        veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
        ownerId: DEMO_IDS.users.ownerBruno,
        petId: DEMO_IDS.pets.simba,
        appointmentType: AppointmentType.IN_PERSON,
        desiredDate: addDays(now, 7, 0, 0)
      },
      {
        id: 'waitlist_demo_2',
        clinicId: DEMO_IDS.clinics.south,
        veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
        ownerId: DEMO_IDS.users.ownerElena,
        petId: DEMO_IDS.pets.mia,
        appointmentType: AppointmentType.CHECKUP,
        desiredDate: addDays(now, 3, 0, 0),
        notifiedAt: addHours(now, -6)
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
