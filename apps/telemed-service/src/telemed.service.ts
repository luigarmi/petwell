import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import { RabbitMqEventBus, createEventPayload } from '@petwell/shared-events';
import {
  EVENT_NAMES,
  JwtUserClaims,
  PaymentSettledEvent,
  TelemedProviderName,
  UserRole
} from '@petwell/shared-types';

import { canAccessRoom } from './access.utils';
import { env } from './config';
import { CreateRoomDto } from './dto/telemed.dto';
import { PrismaService } from './prisma.service';
import { DailyTelemedProvider } from './providers/daily-telemed.provider';
import { MockTelemedProvider } from './providers/mock-telemed.provider';
import { TelemedProvider } from './providers/telemed-provider.interface';
import { TwilioTelemedProvider } from './providers/twilio-telemed.provider';

@Injectable()
export class TelemedService implements OnModuleInit {
  private providerRegistry: Record<TelemedProviderName, TelemedProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: RabbitMqEventBus,
    private readonly mockProvider: MockTelemedProvider,
    private readonly twilioProvider: TwilioTelemedProvider,
    private readonly dailyProvider: DailyTelemedProvider
  ) {
    this.providerRegistry = {
      [TelemedProviderName.MOCK]: this.mockProvider,
      [TelemedProviderName.TWILIO]: this.twilioProvider,
      [TelemedProviderName.DAILY]: this.dailyProvider
    };
  }

  async onModuleInit() {
    this.eventBus.subscribe(EVENT_NAMES.PAYMENT_SUCCEEDED, async (payload) => {
      const payment = payload as PaymentSettledEvent;
      if (payment.appointmentType === 'telemed') {
        await this.createRoomFromPayment(payment);
      }
    });
    await this.eventBus.connect();
  }

  async createRoom(user: JwtUserClaims, dto: CreateRoomDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST].includes(user.role)) {
      throw new ForbiddenException('You cannot create telemedicine rooms');
    }

    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(dto.clinicId)) {
      throw new ForbiddenException('You cannot create rooms for this clinic');
    }

    return this.persistRoom({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId,
      ownerId: dto.ownerId,
      veterinarianId: dto.veterinarianId,
      startsAt: dto.startsAt,
      durationMinutes: dto.durationMinutes ?? 30
    });
  }

  async getRoomByAppointment(user: JwtUserClaims, appointmentId: string) {
    const room = await this.prisma.telemedRoom.findUnique({
      where: { appointmentId }
    });

    if (!room) {
      throw new NotFoundException('Telemedicine room not found');
    }

    if (!canAccessRoom(user, room)) {
      throw new ForbiddenException('You do not have access to this room');
    }

    return room;
  }

  async getRoomById(user: JwtUserClaims, roomId: string) {
    const room = await this.prisma.telemedRoom.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      throw new NotFoundException('Telemedicine room not found');
    }

    if (!canAccessRoom(user, room)) {
      throw new ForbiddenException('You do not have access to this room');
    }

    return room;
  }

  private async createRoomFromPayment(payment: PaymentSettledEvent) {
    const existingRoom = await this.prisma.telemedRoom.findUnique({
      where: { appointmentId: payment.appointmentId }
    });

    if (existingRoom) {
      return existingRoom;
    }

    return this.persistRoom({
      appointmentId: payment.appointmentId,
      clinicId: payment.clinicId,
      ownerId: payment.ownerId,
      veterinarianId: payment.veterinarianId ?? '',
      startsAt: payment.startsAt ?? new Date().toISOString(),
      durationMinutes: 30
    });
  }

  private async persistRoom(input: {
    appointmentId: string;
    clinicId: string;
    ownerId: string;
    veterinarianId: string;
    startsAt: string;
    durationMinutes: number;
  }) {
    const provider = this.providerRegistry[env.TELEMED_PROVIDER as TelemedProviderName];
    const roomId = randomUUID();
    const roomDetails = await provider.createRoom({
      roomId,
      appointmentId: input.appointmentId,
      ownerId: input.ownerId,
      veterinarianId: input.veterinarianId,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes
    });

    const room = await this.prisma.telemedRoom.create({
      data: {
        id: roomId,
        appointmentId: input.appointmentId,
        clinicId: input.clinicId,
        ownerId: input.ownerId,
        veterinarianId: input.veterinarianId,
        provider: roomDetails.provider,
        roomUrl: roomDetails.roomUrl,
        joinToken: roomDetails.joinToken,
        startsAt: new Date(input.startsAt),
        expiresAt: roomDetails.expiresAt,
        durationMinutes: input.durationMinutes
      }
    });

    await this.eventBus.publish(
      EVENT_NAMES.TELEMED_ROOM_CREATED,
      createEventPayload({
        roomId: room.id,
        appointmentId: room.appointmentId,
        clinicId: room.clinicId,
        ownerId: room.ownerId,
        veterinarianId: room.veterinarianId,
        roomUrl: room.roomUrl,
        expiresAt: room.expiresAt.toISOString()
      })
    );

    return room;
  }
}
