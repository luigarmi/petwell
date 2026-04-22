import { PrismaClient, PetSex, PetSpecies } from '@petwell/prisma-pet-service-client';

import { DEMO_IDS } from '@petwell/shared-types';

const prisma = new PrismaClient();

async function main() {
  await prisma.pet.deleteMany();

  const pets = [
    {
      id: DEMO_IDS.pets.luna,
      ownerId: DEMO_IDS.users.ownerAna,
      coOwnerIds: [DEMO_IDS.users.ownerBruno],
      name: 'Luna',
      species: PetSpecies.dog,
      breed: 'Labrador',
      sex: PetSex.female,
      weightKg: 24,
      birthDate: '2020-03-10',
      mainClinicId: DEMO_IDS.clinics.north,
      allergies: ['pollo'],
      photoUrls: ['https://placehold.co/600x400?text=Luna'],
      microchip: 'MC-LUNA-001',
      color: 'miel',
      isSpayedNeutered: true
    },
    {
      id: DEMO_IDS.pets.max,
      ownerId: DEMO_IDS.users.ownerAna,
      coOwnerIds: [DEMO_IDS.users.ownerDiego],
      name: 'Max',
      species: PetSpecies.cat,
      breed: 'Siames',
      sex: PetSex.male,
      weightKg: 5,
      birthDate: '2021-06-01',
      mainClinicId: DEMO_IDS.clinics.north,
      allergies: ['lactosa'],
      photoUrls: ['https://placehold.co/600x400?text=Max'],
      microchip: 'MC-MAX-002',
      color: 'crema',
      isSpayedNeutered: true
    },
    {
      id: DEMO_IDS.pets.nina,
      ownerId: DEMO_IDS.users.ownerBruno,
      name: 'Nina',
      species: PetSpecies.dog,
      breed: 'Pug',
      sex: PetSex.female,
      weightKg: 8,
      birthDate: '2019-11-12',
      mainClinicId: DEMO_IDS.clinics.north,
      allergies: ['polen'],
      photoUrls: [],
      color: 'beige',
      isSpayedNeutered: true
    },
    {
      id: DEMO_IDS.pets.rocky,
      ownerId: DEMO_IDS.users.ownerCarla,
      name: 'Rocky',
      species: PetSpecies.dog,
      breed: 'Criollo',
      sex: PetSex.male,
      weightKg: 18,
      birthDate: '2018-08-20',
      mainClinicId: DEMO_IDS.clinics.south,
      allergies: [],
      photoUrls: ['https://placehold.co/600x400?text=Rocky'],
      microchip: 'MC-ROCKY-003',
      color: 'cafe',
      isSpayedNeutered: false
    },
    {
      id: DEMO_IDS.pets.coco,
      ownerId: DEMO_IDS.users.ownerDiego,
      name: 'Coco',
      species: PetSpecies.bird,
      breed: 'Canario',
      sex: PetSex.unknown,
      weightKg: 0.3,
      birthDate: '2022-01-15',
      mainClinicId: DEMO_IDS.clinics.south,
      allergies: [],
      photoUrls: [],
      color: 'amarillo',
      isSpayedNeutered: false
    },
    {
      id: DEMO_IDS.pets.mia,
      ownerId: DEMO_IDS.users.ownerElena,
      name: 'Mia',
      species: PetSpecies.cat,
      breed: 'Persa',
      sex: PetSex.female,
      weightKg: 4.2,
      birthDate: '2021-02-14',
      mainClinicId: DEMO_IDS.clinics.south,
      allergies: ['pescado'],
      photoUrls: ['https://placehold.co/600x400?text=Mia'],
      color: 'gris',
      isSpayedNeutered: true
    },
    {
      id: DEMO_IDS.pets.simba,
      ownerId: DEMO_IDS.users.ownerBruno,
      name: 'Simba',
      species: PetSpecies.dog,
      breed: 'Golden Retriever',
      sex: PetSex.male,
      weightKg: 30,
      birthDate: '2017-05-09',
      mainClinicId: DEMO_IDS.clinics.north,
      allergies: [],
      photoUrls: [],
      microchip: 'MC-SIMBA-004',
      color: 'dorado',
      isSpayedNeutered: false
    },
    {
      id: DEMO_IDS.pets.kiara,
      ownerId: DEMO_IDS.users.ownerCarla,
      coOwnerIds: [DEMO_IDS.users.ownerElena],
      name: 'Kiara',
      species: PetSpecies.rabbit,
      breed: 'Mini Lop',
      sex: PetSex.female,
      weightKg: 2.5,
      birthDate: '2023-04-11',
      mainClinicId: DEMO_IDS.clinics.south,
      allergies: ['heno premium'],
      photoUrls: ['https://placehold.co/600x400?text=Kiara'],
      color: 'blanco y cafe',
      isSpayedNeutered: false
    }
  ];

  for (const pet of pets) {
    await prisma.pet.create({
      data: {
        ...pet,
        birthDate: new Date(pet.birthDate)
      }
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
