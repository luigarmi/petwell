import { PrismaClient, UserRole } from '@petwell/prisma-user-service-client';

import { AppointmentType, DEMO_IDS } from '@petwell/shared-types';
import { hashPassword } from '@petwell/shared-utils';

const prisma = new PrismaClient();

const defaultPassword = 'Petwell123!';

async function main() {
  const passwordHash = await hashPassword(defaultPassword);

  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.clinicServiceCatalog.deleteMany();
  await prisma.clinicStaff.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.user.deleteMany();

  const users = [
    {
      id: DEMO_IDS.users.superadmin,
      email: 'superadmin@petwell.local',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '3001000001',
      role: UserRole.superadmin,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.clinicAdminNorth,
      email: 'admin.north@petwell.local',
      firstName: 'Lucia',
      lastName: 'Ramirez',
      phone: '3001000002',
      role: UserRole.clinic_admin,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.clinicAdminSouth,
      email: 'admin.south@petwell.local',
      firstName: 'Mario',
      lastName: 'Gomez',
      phone: '3001000003',
      role: UserRole.clinic_admin,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.veterinarianNorthPrimary,
      email: 'vet1@petwell.local',
      firstName: 'Paula',
      lastName: 'Lopez',
      phone: '3001000004',
      role: UserRole.veterinarian,
      professionalLicense: 'VET-1001',
      isDemo: true
    },
    {
      id: DEMO_IDS.users.veterinarianNorthSecondary,
      email: 'vet2@petwell.local',
      firstName: 'Andres',
      lastName: 'Duarte',
      phone: '3001000005',
      role: UserRole.veterinarian,
      professionalLicense: 'VET-1002',
      isDemo: true
    },
    {
      id: DEMO_IDS.users.veterinarianSouthPrimary,
      email: 'vet3@petwell.local',
      firstName: 'Sofia',
      lastName: 'Mendez',
      phone: '3001000006',
      role: UserRole.veterinarian,
      professionalLicense: 'VET-1003',
      isDemo: true
    },
    {
      id: DEMO_IDS.users.receptionistNorth,
      email: 'recep1@petwell.local',
      firstName: 'Laura',
      lastName: 'Diaz',
      phone: '3001000007',
      role: UserRole.receptionist,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.receptionistSouth,
      email: 'recep2@petwell.local',
      firstName: 'Julian',
      lastName: 'Perez',
      phone: '3001000008',
      role: UserRole.receptionist,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.ownerAna,
      email: 'ana@petwell.local',
      firstName: 'Ana',
      lastName: 'Torres',
      phone: '3002000001',
      role: UserRole.pet_owner,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.ownerBruno,
      email: 'bruno@petwell.local',
      firstName: 'Bruno',
      lastName: 'Castro',
      phone: '3002000002',
      role: UserRole.pet_owner,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.ownerCarla,
      email: 'carla@petwell.local',
      firstName: 'Carla',
      lastName: 'Moreno',
      phone: '3002000003',
      role: UserRole.pet_owner,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.ownerDiego,
      email: 'diego@petwell.local',
      firstName: 'Diego',
      lastName: 'Garcia',
      phone: '3002000004',
      role: UserRole.pet_owner,
      isDemo: true
    },
    {
      id: DEMO_IDS.users.ownerElena,
      email: 'elena@petwell.local',
      firstName: 'Elena',
      lastName: 'Santos',
      phone: '3002000005',
      role: UserRole.pet_owner,
      isDemo: true
    }
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        ...user,
        passwordHash
      }
    });
  }

  const clinics = [
    {
      id: DEMO_IDS.clinics.north,
      name: 'PetWell Norte',
      email: 'norte@petwell.local',
      phone: '6015550001',
      address: 'Calle 100 #19-20',
      city: 'Bogota',
      country: 'Colombia',
      billingEmail: 'facturacion.norte@petwell.local',
      specialties: ['medicina general', 'cirugia', 'dermatologia']
    },
    {
      id: DEMO_IDS.clinics.south,
      name: 'PetWell Sur',
      email: 'sur@petwell.local',
      phone: '6045550002',
      address: 'Carrera 43A #1-50',
      city: 'Medellin',
      country: 'Colombia',
      billingEmail: 'facturacion.sur@petwell.local',
      specialties: ['medicina general', 'odontologia', 'urgencias']
    }
  ];

  for (const clinic of clinics) {
    await prisma.clinic.create({ data: clinic });
  }

  const staffAssignments = [
    [DEMO_IDS.clinics.north, DEMO_IDS.users.clinicAdminNorth, UserRole.clinic_admin],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.clinicAdminSouth, UserRole.clinic_admin],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthPrimary, UserRole.veterinarian],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.veterinarianNorthSecondary, UserRole.veterinarian],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.veterinarianSouthPrimary, UserRole.veterinarian],
    [DEMO_IDS.clinics.north, DEMO_IDS.users.receptionistNorth, UserRole.receptionist],
    [DEMO_IDS.clinics.south, DEMO_IDS.users.receptionistSouth, UserRole.receptionist]
  ] as const;

  for (const [clinicId, userId, role] of staffAssignments) {
    await prisma.clinicStaff.create({
      data: {
        id: `${clinicId}_${userId}`,
        clinicId,
        userId,
        role,
        specialties: role === UserRole.veterinarian ? ['medicina general'] : []
      }
    });
  }

  const clinicServices = [
    [DEMO_IDS.clinics.north, AppointmentType.IN_PERSON, 'Consulta presencial', 30, 90000, false],
    [DEMO_IDS.clinics.north, AppointmentType.TELEMED, 'Teleconsulta', 30, 85000, true],
    [DEMO_IDS.clinics.north, AppointmentType.VACCINATION, 'Vacunacion', 20, 70000, false],
    [DEMO_IDS.clinics.south, AppointmentType.IN_PERSON, 'Consulta presencial', 30, 95000, false],
    [DEMO_IDS.clinics.south, AppointmentType.VACCINATION, 'Vacunacion', 20, 70000, false],
    [DEMO_IDS.clinics.south, AppointmentType.CHECKUP, 'Control general', 30, 88000, false],
    [DEMO_IDS.clinics.south, AppointmentType.EMERGENCY, 'Atencion prioritaria', 45, 140000, false]
  ] as const;

  for (const [clinicId, appointmentType, name, durationMinutes, priceCop, isTelemedAvailable] of clinicServices) {
    await prisma.clinicServiceCatalog.create({
      data: {
        id: `${clinicId}_${appointmentType}`,
        clinicId,
        appointmentType,
        name,
        durationMinutes,
        priceCop,
        isTelemedAvailable
      }
    });
  }

  console.log(`Seed completed. Demo password: ${defaultPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
