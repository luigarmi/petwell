import { randomUUID } from 'node:crypto';

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AppointmentType, UserRole } from '@petwell/shared-types';
import { hashPassword } from '@petwell/shared-utils';

import { AddStaffToClinicDto, CreateClinicDto, SearchClinicsQueryDto, UpdateClinicDto, UpsertClinicServiceDto } from './dto/clinic.dto';
import { PrismaService } from './prisma.service';
import { isStaffRole } from './role.utils';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPublicClinics(query: SearchClinicsQueryDto) {
    const searchTerm = query.q?.trim().toLowerCase();
    const specialty = query.specialty?.trim().toLowerCase();

    const clinics = await this.prisma.clinic.findMany({
      where: {
        deletedAt: null,
        city: query.city ? { contains: query.city.trim(), mode: 'insensitive' } : undefined
      },
      include: {
        services: {
          where: { active: true },
          orderBy: { appointmentType: 'asc' }
        },
        staff: {
          where: {
            active: true,
            role: UserRole.VETERINARIAN
          },
          include: {
            user: true
          }
        }
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }]
    });

    return clinics
      .map((clinic) => {
        const services = clinic.services.map((service) => ({
          id: service.id,
          name: service.name,
          appointmentType: service.appointmentType as AppointmentType,
          durationMinutes: service.durationMinutes,
          priceCop: service.priceCop,
          isTelemedAvailable: service.isTelemedAvailable
        }));

        const veterinarians = clinic.staff.map((member) => ({
          id: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          professionalLicense: member.user.professionalLicense,
          specialties: member.specialties
        }));

        return {
          id: clinic.id,
          name: clinic.name,
          phone: clinic.phone,
          address: clinic.address,
          city: clinic.city,
          country: clinic.country,
          logoUrl: clinic.logoUrl,
          website: clinic.website,
          specialties: clinic.specialties,
          services,
          veterinarians,
          staff: clinic.staff
        };
      })
      .filter((clinic) => {
        const services = clinic.services;
        const clinicSpecialties = clinic.specialties.map((item) => item.toLowerCase());
        const staffSpecialties = clinic.staff.flatMap((member) => member.specialties.map((item) => item.toLowerCase()));

        const matchesSearch =
          !searchTerm ||
          clinic.name.toLowerCase().includes(searchTerm) ||
          clinic.city.toLowerCase().includes(searchTerm) ||
          clinicSpecialties.some((item) => item.includes(searchTerm)) ||
          staffSpecialties.some((item) => item.includes(searchTerm)) ||
          services.some(
            (service) =>
              service.name.toLowerCase().includes(searchTerm) ||
              String(service.appointmentType).toLowerCase().includes(searchTerm)
          );

        const matchesSpecialty =
          !specialty ||
          clinicSpecialties.some((item) => item.includes(specialty)) ||
          staffSpecialties.some((item) => item.includes(specialty));

        const matchesAppointmentType =
          !query.appointmentType || services.some((service) => service.appointmentType === query.appointmentType);

        return matchesSearch && matchesSpecialty && matchesAppointmentType;
      })
      .map(({ staff, ...clinic }) => clinic);
  }

  async listClinics() {
    return this.prisma.clinic.findMany({
      where: { deletedAt: null },
      include: {
        services: {
          where: { active: true }
        },
        staff: {
          where: { active: true },
          include: {
            user: true
          }
        }
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }]
    });
  }

  async getClinic(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        services: {
          where: { active: true },
          orderBy: { appointmentType: 'asc' }
        },
        staff: {
          where: { active: true },
          include: {
            user: true
          }
        }
      }
    });

    if (!clinic || clinic.deletedAt) {
      throw new NotFoundException('Clinic not found');
    }

    return clinic;
  }

  async createClinic(actorRole: UserRole, dto: CreateClinicDto) {
    if (![UserRole.SUPERADMIN].includes(actorRole)) {
      throw new ForbiddenException('Only superadmin can create clinics');
    }

    return this.prisma.clinic.create({
      data: {
        id: randomUUID(),
        ...dto,
        specialties: dto.specialties ?? []
      }
    });
  }

  async updateClinic(actorRole: UserRole, actorClinicIds: string[], clinicId: string, dto: UpdateClinicDto) {
    if (actorRole !== UserRole.SUPERADMIN && !actorClinicIds.includes(clinicId)) {
      throw new ForbiddenException('You do not have access to update this clinic');
    }

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...dto,
        specialties: dto.specialties
      }
    });
  }

  async listStaff(actorRole: UserRole, actorClinicIds: string[], clinicId: string) {
    if (actorRole !== UserRole.SUPERADMIN && !actorClinicIds.includes(clinicId)) {
      throw new ForbiddenException('You do not have access to this clinic staff');
    }

    return this.prisma.clinicStaff.findMany({
      where: { clinicId, active: true },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
    });
  }

  async addStaff(actorRole: UserRole, actorClinicIds: string[], clinicId: string, dto: AddStaffToClinicDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN].includes(actorRole)) {
      throw new ForbiddenException('Only superadmin or clinic admin can add staff');
    }

    if (actorRole === UserRole.CLINIC_ADMIN && !actorClinicIds.includes(clinicId)) {
      throw new ForbiddenException('Clinic admins can only manage their own clinic');
    }

    if (!isStaffRole(dto.role)) {
      throw new BadRequestException('Role is not valid for clinic staff');
    }

    if (dto.role === UserRole.VETERINARIAN && !dto.professionalLicense) {
      throw new BadRequestException('professionalLicense is required for veterinarians');
    }

    let userId = dto.userId;
    if (!userId) {
      if (!dto.email || !dto.firstName || !dto.lastName || !dto.phone) {
        throw new BadRequestException('email, firstName, lastName and phone are required to create staff');
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() }
      });

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const createdUser = await this.prisma.user.create({
          data: {
            id: randomUUID(),
            email: dto.email.toLowerCase(),
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            role: dto.role,
            professionalLicense: dto.professionalLicense,
            passwordHash: await hashPassword(dto.password ?? 'Petwell123!')
          }
        });
        userId = createdUser.id;
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        role: dto.role,
        professionalLicense: dto.professionalLicense ?? user.professionalLicense
      }
    });

    return this.prisma.clinicStaff.upsert({
      where: {
        clinicId_userId: {
          clinicId,
          userId: user.id
        }
      },
      update: {
        role: dto.role,
        specialties: dto.specialties ?? [],
        active: true
      },
      create: {
        id: randomUUID(),
        clinicId,
        userId: user.id,
        role: dto.role,
        specialties: dto.specialties ?? [],
        active: true
      },
      include: { user: true }
    });
  }

  async listServices(clinicId: string) {
    return this.prisma.clinicServiceCatalog.findMany({
      where: { clinicId, active: true },
      orderBy: { appointmentType: 'asc' }
    });
  }

  async upsertServiceCatalog(
    actorRole: UserRole,
    actorClinicIds: string[],
    clinicId: string,
    dto: UpsertClinicServiceDto
  ) {
    if (actorRole !== UserRole.SUPERADMIN && !actorClinicIds.includes(clinicId)) {
      throw new ForbiddenException('You do not have access to this clinic');
    }

    return this.prisma.clinicServiceCatalog.upsert({
      where: {
        clinicId_appointmentType: {
          clinicId,
          appointmentType: dto.appointmentType
        }
      },
      update: {
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        priceCop: dto.priceCop,
        isTelemedAvailable: dto.isTelemedAvailable,
        active: true
      },
      create: {
        id: randomUUID(),
        clinicId,
        appointmentType: dto.appointmentType,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        priceCop: dto.priceCop,
        isTelemedAvailable: dto.isTelemedAvailable,
        active: true
      }
    });
  }
}
