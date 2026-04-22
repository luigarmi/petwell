import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { ListPetsQueryDto, CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { canAccessPet } from './ownership.utils';
import { PrismaService } from './prisma.service';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPet(user: JwtUserClaims, dto: CreatePetDto) {
    const ownerId = user.role === UserRole.PET_OWNER ? user.sub : dto.ownerId;

    if (!ownerId) {
      throw new ForbiddenException('ownerId is required for staff-created pets');
    }

    return this.prisma.pet.create({
      data: {
        id: randomUUID(),
        ownerId,
        coOwnerIds: this.normalizeCoOwnerIds(ownerId, dto.coOwnerIds),
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        sex: dto.sex,
        weightKg: dto.weightKg,
        birthDate: new Date(dto.birthDate),
        microchip: dto.microchip,
        allergies: dto.allergies ?? [],
        photoUrls: dto.photoUrls ?? [],
        color: dto.color,
        isSpayedNeutered: dto.isSpayedNeutered ?? false,
        mainClinicId: dto.mainClinicId
      }
    });
  }

  async listPets(user: JwtUserClaims, query: ListPetsQueryDto) {
    const relatedOwnerId = user.role === UserRole.PET_OWNER ? user.sub : query.ownerId;

    return this.prisma.pet.findMany({
      where: {
        deletedAt: null,
        AND: [
          relatedOwnerId ? { OR: [{ ownerId: relatedOwnerId }, { coOwnerIds: { has: relatedOwnerId } }] } : {},
          query.q
            ? {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' } },
                  { breed: { contains: query.q, mode: 'insensitive' } }
                ]
              }
            : {}
        ],
        mainClinicId:
          user.role === UserRole.SUPERADMIN
            ? query.clinicId
            : [UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role)
              ? query.clinicId ?? { in: user.clinicIds }
              : undefined,
        species: query.species
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async getPet(user: JwtUserClaims, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId }
    });

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    if (!canAccessPet(user, pet)) {
      throw new ForbiddenException('You do not have access to this pet');
    }

    return pet;
  }

  async getPetAccessProfile(petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId }
    });

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    return {
      id: pet.id,
      ownerId: pet.ownerId,
      ownerIds: [pet.ownerId, ...pet.coOwnerIds],
      coOwnerIds: pet.coOwnerIds,
      mainClinicId: pet.mainClinicId
    };
  }

  async getUpcomingBirthdays(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const pets = await this.prisma.pet.findMany({
      where: {
        deletedAt: null
      },
      orderBy: [{ birthDate: 'asc' }, { name: 'asc' }]
    });

    return pets
      .map((pet) => {
        const nextBirthday = this.resolveNextBirthday(pet.birthDate, fromDate);

        return {
          id: pet.id,
          name: pet.name,
          birthDate: pet.birthDate,
          nextBirthday,
          ownerIds: [pet.ownerId, ...pet.coOwnerIds]
        };
      })
      .filter((pet) => pet.nextBirthday >= fromDate && pet.nextBirthday <= toDate)
      .sort((left, right) => left.nextBirthday.getTime() - right.nextBirthday.getTime());
  }

  async updatePet(user: JwtUserClaims, petId: string, dto: UpdatePetDto) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId }
    });

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    if (!canAccessPet(user, pet)) {
      throw new ForbiddenException('You do not have access to update this pet');
    }

    return this.prisma.pet.update({
      where: { id: petId },
      data: {
        ownerId: dto.ownerId,
        coOwnerIds: dto.coOwnerIds ? this.normalizeCoOwnerIds(dto.ownerId ?? pet.ownerId, dto.coOwnerIds) : undefined,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        sex: dto.sex,
        weightKg: dto.weightKg,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        microchip: dto.microchip,
        allergies: dto.allergies,
        photoUrls: dto.photoUrls,
        color: dto.color,
        isSpayedNeutered: dto.isSpayedNeutered,
        mainClinicId: dto.mainClinicId
      }
    });
  }

  async deletePet(user: JwtUserClaims, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId }
    });

    if (!pet || pet.deletedAt) {
      throw new NotFoundException('Pet not found');
    }

    if (!canAccessPet(user, pet)) {
      throw new ForbiddenException('You do not have access to delete this pet');
    }

    await this.prisma.pet.update({
      where: { id: petId },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  }

  async summary(user: JwtUserClaims) {
    const where = user.role === UserRole.SUPERADMIN ? { deletedAt: null } : { deletedAt: null, mainClinicId: { in: user.clinicIds } };

    const [totalPets, byClinic] = await this.prisma.$transaction([
      this.prisma.pet.count({ where }),
      this.prisma.pet.groupBy({
        by: ['mainClinicId'],
        where,
        orderBy: { mainClinicId: 'asc' },
        _count: true
      })
    ]);

    return {
      totalPets,
      byClinic
    };
  }

  private normalizeCoOwnerIds(ownerId: string, coOwnerIds?: string[]) {
    if (!coOwnerIds?.length) {
      return [];
    }

    return [...new Set(coOwnerIds.map((value) => value.trim()).filter((value) => value && value !== ownerId))];
  }

  private resolveNextBirthday(birthDate: Date, fromDate: Date) {
    const nextBirthday = new Date(fromDate);
    nextBirthday.setUTCHours(0, 0, 0, 0);
    nextBirthday.setUTCMonth(birthDate.getUTCMonth(), birthDate.getUTCDate());

    if (nextBirthday < fromDate) {
      nextBirthday.setUTCFullYear(nextBirthday.getUTCFullYear() + 1);
    }

    return nextBirthday;
  }
}
