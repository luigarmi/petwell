import { randomUUID } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException, ForbiddenException, ConflictException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { RabbitMqEventBus, createEventPayload } from '@petwell/shared-events';
import {
  AppointmentCreatedEvent,
  AppointmentStatus,
  AppointmentType,
  EVENT_NAMES,
  JwtUserClaims,
  PaymentSettledEvent,
  UserRole
} from '@petwell/shared-types';

import { env } from './config';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateScheduleDto,
  CreateScheduleBlockDto,
  CreateWaitlistDto,
  ListScheduleBlocksQueryDto,
  ListAppointmentsQueryDto,
  QueryAvailabilityDto,
  RescheduleAppointmentDto
} from './dto/appointment.dto';
import { PrismaService } from './prisma.service';
import { addMinutes, combineDateAndTime, getWeekday } from './time.utils';

type ClinicServiceCatalogItem = {
  appointmentType: AppointmentType;
  durationMinutes: number;
  priceCop: number;
  isTelemedAvailable: boolean;
};

@Injectable()
export class AppointmentService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly eventBus: RabbitMqEventBus
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(EVENT_NAMES.PAYMENT_SUCCEEDED, async (payload) => {
      await this.markPaid(payload as PaymentSettledEvent);
    });
    this.eventBus.subscribe(EVENT_NAMES.PAYMENT_FAILED, async (payload) => {
      await this.handlePaymentFailure(payload as PaymentSettledEvent);
    });
    await this.eventBus.connect();
  }

  async createSchedule(user: JwtUserClaims, dto: CreateScheduleDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST].includes(user.role)) {
      throw new ForbiddenException('You cannot manage schedules');
    }

    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(dto.clinicId)) {
      throw new ForbiddenException('You can only manage schedules for your clinic');
    }

    return this.prisma.scheduleTemplate.create({
      data: {
        id: randomUUID(),
        ...dto
      }
    });
  }

  async createScheduleBlock(user: JwtUserClaims, dto: CreateScheduleBlockDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST].includes(user.role)) {
      throw new ForbiddenException('You cannot manage schedule blocks');
    }

    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(dto.clinicId)) {
      throw new ForbiddenException('You can only manage schedule blocks for your clinic');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    return this.prisma.scheduleBlock.create({
      data: {
        id: randomUUID(),
        clinicId: dto.clinicId,
        veterinarianId: dto.veterinarianId,
        startsAt,
        endsAt,
        reason: dto.reason
      }
    });
  }

  async listSchedules(clinicId: string, veterinarianId?: string) {
    return this.prisma.scheduleTemplate.findMany({
      where: {
        clinicId,
        veterinarianId,
        active: true
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }]
    });
  }

  async listScheduleBlocks(user: JwtUserClaims, query: ListScheduleBlocksQueryDto) {
    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(query.clinicId)) {
      throw new ForbiddenException('You do not have access to these schedule blocks');
    }

    return this.prisma.scheduleBlock.findMany({
      where: {
        clinicId: query.clinicId,
        veterinarianId: query.veterinarianId,
        startsAt: query.to ? { lte: new Date(query.to) } : undefined,
        endsAt: query.from ? { gte: new Date(query.from) } : undefined
      },
      orderBy: [{ startsAt: 'asc' }, { endsAt: 'asc' }]
    });
  }

  async getAvailability(query: QueryAvailabilityDto) {
    const targetDate = new Date(query.date);
    const weekday = getWeekday(targetDate);
    const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));
    const scheduleTemplates = await this.prisma.scheduleTemplate.findMany({
      where: {
        clinicId: query.clinicId,
        veterinarianId: query.veterinarianId,
        weekday,
        active: true
      },
      orderBy: { startTime: 'asc' }
    });

    const scheduleBlocks = await this.prisma.scheduleBlock.findMany({
      where: {
        clinicId: query.clinicId,
        OR: [{ veterinarianId: query.veterinarianId }, { veterinarianId: null }],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart }
      },
      orderBy: { startsAt: 'asc' }
    });

    if (scheduleTemplates.length === 0) {
      return [];
    }

    const occupiedAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId: query.clinicId,
        veterinarianId: query.veterinarianId,
        startsAt: {
          gte: dayStart,
          lt: dayEnd
        },
        status: {
          not: AppointmentStatus.CANCELLED
        }
      }
    });

    const occupiedKeys = new Set(occupiedAppointments.map((appointment) => appointment.startsAt.toISOString()));
    const slots: Array<{ startsAt: string; endsAt: string; available: boolean; blockReason: string | null }> = [];

    for (const template of scheduleTemplates) {
      let cursor = combineDateAndTime(targetDate, template.startTime);
      const endBoundary = combineDateAndTime(targetDate, template.endTime);

      while (cursor < endBoundary) {
        const slotEnd = addMinutes(cursor, template.slotDurationMinutes);
        const overlappingBlock = scheduleBlocks.find((block) => cursor < block.endsAt && slotEnd > block.startsAt);
        if (slotEnd <= endBoundary) {
          slots.push({
            startsAt: cursor.toISOString(),
            endsAt: slotEnd.toISOString(),
            available: !occupiedKeys.has(cursor.toISOString()) && !overlappingBlock,
            blockReason: overlappingBlock?.reason ?? null
          });
        }
        cursor = addMinutes(cursor, template.slotDurationMinutes);
      }
    }

    return slots;
  }

  async createAppointment(user: JwtUserClaims, dto: CreateAppointmentDto) {
    const ownerId = user.role === UserRole.PET_OWNER ? user.sub : dto.ownerId;
    if (!ownerId) {
      throw new ForbiddenException('ownerId is required');
    }

    if (
      user.role !== UserRole.SUPERADMIN &&
      user.role !== UserRole.PET_OWNER &&
      !user.clinicIds.includes(dto.clinicId)
    ) {
      throw new ForbiddenException('You cannot book appointments for this clinic');
    }

    const catalogItem = await this.fetchClinicService(dto.clinicId, dto.appointmentType);
    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, catalogItem.durationMinutes);
    await this.assertNoScheduleBlock(dto.clinicId, dto.veterinarianId, startsAt, endsAt);

    const conflictingAppointment = await this.prisma.appointment.findUnique({
      where: {
        veterinarianId_startsAt: {
          veterinarianId: dto.veterinarianId,
          startsAt
        }
      }
    });

    if (conflictingAppointment && conflictingAppointment.status !== AppointmentStatus.CANCELLED) {
      throw new ConflictException('This slot is already reserved');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        id: randomUUID(),
        clinicId: dto.clinicId,
        veterinarianId: dto.veterinarianId,
        ownerId,
        petId: dto.petId,
        appointmentType: dto.appointmentType,
        startsAt,
        endsAt,
        status: AppointmentStatus.PENDING_PAYMENT,
        amountCop: catalogItem.priceCop,
        notes: dto.notes
      }
    });

    const eventPayload: AppointmentCreatedEvent = createEventPayload({
      appointmentId: appointment.id,
      ownerId,
      petId: dto.petId,
      clinicId: dto.clinicId,
      veterinarianId: dto.veterinarianId,
      appointmentType: dto.appointmentType,
      startsAt: appointment.startsAt.toISOString(),
      amountCop: appointment.amountCop,
      status: AppointmentStatus.PENDING_PAYMENT
    });

    await this.eventBus.publish(EVENT_NAMES.APPOINTMENT_CREATED, eventPayload);
    return appointment;
  }

  async listAppointments(user: JwtUserClaims, query: ListAppointmentsQueryDto) {
    return this.prisma.appointment.findMany({
      where: {
        clinicId:
          user.role === UserRole.PET_OWNER
            ? query.clinicId
            : user.role === UserRole.SUPERADMIN
              ? query.clinicId
              : query.clinicId ?? { in: user.clinicIds },
        ownerId: user.role === UserRole.PET_OWNER ? user.sub : query.ownerId,
        veterinarianId: query.veterinarianId,
        status: query.status
      },
      orderBy: { startsAt: 'desc' }
    });
  }

  async getAppointment(user: JwtUserClaims, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (user.role === UserRole.PET_OWNER && appointment.ownerId !== user.sub) {
      throw new ForbiddenException('You cannot access this appointment');
    }

    if (
      [UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role) &&
      !user.clinicIds.includes(appointment.clinicId)
    ) {
      throw new ForbiddenException('You cannot access this appointment');
    }

    return appointment;
  }

  async getAppointmentInternal(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async getUpcomingAppointments(from: string, to: string) {
    return this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        startsAt: {
          gte: new Date(from),
          lte: new Date(to)
        }
      },
      orderBy: { startsAt: 'asc' }
    });
  }

  async cancelAppointment(user: JwtUserClaims, appointmentId: string, dto: CancelAppointmentDto) {
    const appointment = await this.getAppointment(user, appointmentId);

    if (user.role === UserRole.PET_OWNER && appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      throw new ForbiddenException('Owners can cancel only up to 24 hours before the appointment');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason ?? 'cancelled_by_user'
      }
    });

    await this.eventBus.publish(
      EVENT_NAMES.APPOINTMENT_CANCELLED,
      createEventPayload({
        appointmentId: updated.id,
        clinicId: updated.clinicId,
        ownerId: updated.ownerId,
        petId: updated.petId,
        status: AppointmentStatus.CANCELLED,
        reason: dto.reason
      })
    );

    return updated;
  }

  async rescheduleAppointment(user: JwtUserClaims, appointmentId: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.getAppointment(user, appointmentId);

    if (user.role === UserRole.PET_OWNER && appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      throw new ForbiddenException('Owners can reschedule only up to 24 hours before the appointment');
    }

    const conflictingAppointment = await this.prisma.appointment.findUnique({
      where: {
        veterinarianId_startsAt: {
          veterinarianId: appointment.veterinarianId,
          startsAt: new Date(dto.startsAt)
        }
      }
    });

    if (conflictingAppointment && conflictingAppointment.id !== appointment.id && conflictingAppointment.status !== AppointmentStatus.CANCELLED) {
      throw new ConflictException('The new slot is already reserved');
    }

    const durationMinutes = Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60000);
    const nextStartsAt = new Date(dto.startsAt);
    const nextEndsAt = addMinutes(nextStartsAt, durationMinutes);
    await this.assertNoScheduleBlock(appointment.clinicId, appointment.veterinarianId, nextStartsAt, nextEndsAt);

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startsAt: nextStartsAt,
        endsAt: nextEndsAt
      }
    });
  }

  async createWaitlist(user: JwtUserClaims, dto: CreateWaitlistDto) {
    const ownerId = user.role === UserRole.PET_OWNER ? user.sub : dto.ownerId;
    if (!ownerId) {
      throw new ForbiddenException('ownerId is required');
    }

    return this.prisma.waitlistEntry.create({
      data: {
        id: randomUUID(),
        clinicId: dto.clinicId,
        veterinarianId: dto.veterinarianId,
        ownerId,
        petId: dto.petId,
        appointmentType: dto.appointmentType,
        desiredDate: new Date(dto.desiredDate)
      }
    });
  }

  async markCompleted(user: JwtUserClaims, appointmentId: string) {
    const appointment = await this.getAppointment(user, appointmentId);
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.COMPLETED }
    });

    await this.eventBus.publish(
      EVENT_NAMES.APPOINTMENT_COMPLETED,
      createEventPayload({
        appointmentId: updated.id,
        clinicId: updated.clinicId,
        ownerId: updated.ownerId,
        petId: updated.petId,
        status: AppointmentStatus.COMPLETED
      })
    );

    return updated;
  }

  async summary(user: JwtUserClaims) {
    const where = user.role === UserRole.SUPERADMIN ? undefined : { clinicId: { in: user.clinicIds } };

    const [totalAppointments, byClinic, byStatus, byType] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({
        by: ['clinicId'],
        where,
        orderBy: { clinicId: 'asc' },
        _count: true
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: true
      }),
      this.prisma.appointment.groupBy({
        by: ['appointmentType'],
        where,
        orderBy: { appointmentType: 'asc' },
        _count: true
      })
    ]);

    return { totalAppointments, byClinic, byStatus, byType };
  }

  private async fetchClinicService(clinicId: string, appointmentType: AppointmentType) {
    const response = await firstValueFrom(
      this.httpService.get<ClinicServiceCatalogItem[]>(`${env.USER_SERVICE_URL}/clinics/${clinicId}/services`)
    );

    const service = response.data.find((item) => item.appointmentType === appointmentType);
    if (!service) {
      throw new NotFoundException('Clinic service catalog item not found');
    }

    return service;
  }

  private async markPaid(payload: PaymentSettledEvent) {
    await this.prisma.appointment.updateMany({
      where: {
        id: payload.appointmentId,
        status: AppointmentStatus.PENDING_PAYMENT
      },
      data: {
        status: AppointmentStatus.CONFIRMED
      }
    });
  }

  private async handlePaymentFailure(payload: PaymentSettledEvent) {
    await this.prisma.appointment.updateMany({
      where: {
        id: payload.appointmentId,
        status: AppointmentStatus.PENDING_PAYMENT
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: `payment_${payload.status}`
      }
    });
  }

  private async assertNoScheduleBlock(clinicId: string, veterinarianId: string, startsAt: Date, endsAt: Date) {
    const overlappingBlock = await this.prisma.scheduleBlock.findFirst({
      where: {
        clinicId,
        OR: [{ veterinarianId }, { veterinarianId: null }],
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt }
      }
    });

    if (overlappingBlock) {
      throw new ConflictException(overlappingBlock.reason ?? 'This slot is blocked by clinic operations');
    }
  }
}
