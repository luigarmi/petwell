import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationStatus, Prisma } from '@petwell/prisma-notification-service-client';
import { createTransport } from 'nodemailer';
import { firstValueFrom } from 'rxjs';

import { RabbitMqEventBus } from '@petwell/shared-events';
import {
  EVENT_NAMES,
  JwtUserClaims,
  NotificationChannel,
  NotificationRequestedEvent,
  PaymentSettledEvent,
  TelemedRoomCreatedEvent,
  UserRole
} from '@petwell/shared-types';

import { env } from './config';
import { PrismaService } from './prisma.service';
import { TemplateService } from './template.service';

type UserContact = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type UpcomingBirthday = {
  id: string;
  name: string;
  birthDate: string;
  nextBirthday: string;
  ownerIds: string[];
};

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly transporter = createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: false,
    auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASS } : undefined
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: RabbitMqEventBus,
    private readonly templateService: TemplateService,
    private readonly httpService: HttpService
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(EVENT_NAMES.NOTIFICATION_REQUESTED, async (payload) => {
      await this.queueNotification(payload as NotificationRequestedEvent);
    });
    this.eventBus.subscribe(EVENT_NAMES.PAYMENT_SUCCEEDED, async (payload) => {
      await this.handlePaymentSucceeded(payload as PaymentSettledEvent);
    });
    this.eventBus.subscribe(EVENT_NAMES.PAYMENT_FAILED, async (payload) => {
      await this.handlePaymentFailed(payload as PaymentSettledEvent);
    });
    this.eventBus.subscribe(EVENT_NAMES.APPOINTMENT_CANCELLED, async (payload) => {
      const event = payload as { ownerId: string; reason?: string; appointmentId: string; clinicId: string };
      const contact = await this.fetchUserContact(event.ownerId);
      await this.queueNotification({
        eventId: `appointment-cancelled-${event.appointmentId}`,
        channel: NotificationChannel.EMAIL,
        userId: contact.id,
        clinicId: event.clinicId,
        recipient: contact.email,
        subject: 'Tu cita PetWell fue cancelada',
        template: 'appointment-cancelled',
        variables: {
          firstName: contact.firstName,
          reason: event.reason ?? 'sin detalle'
        }
      }, `appointment_cancelled:${event.appointmentId}`);
    });
    this.eventBus.subscribe(EVENT_NAMES.TELEMED_ROOM_CREATED, async (payload) => {
      await this.handleTelemedRoomCreated(payload as TelemedRoomCreatedEvent);
    });
    await this.eventBus.connect();
  }

  async listMyNotifications(user: JwtUserClaims) {
    return this.prisma.notification.findMany({
      where:
        user.role === UserRole.PET_OWNER
          ? { userId: user.sub }
          : user.role === UserRole.SUPERADMIN
            ? undefined
            : { clinicId: { in: user.clinicIds } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async summary() {
    const byStatus = await this.prisma.notification.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      _count: true
    });

    return { byStatus };
  }

  async checkMailTransport() {
    await this.transporter.verify();
    return {
      host: env.MAIL_HOST,
      port: env.MAIL_PORT
    };
  }

  @Cron('*/15 * * * *')
  async sendScheduledReminders() {
    const now = new Date();
    await this.sendReminderWindow('reminder-24h', now, new Date(now.getTime() + 24 * 60 * 60 * 1000), 24);
    await this.sendReminderWindow('reminder-2h', now, new Date(now.getTime() + 2 * 60 * 60 * 1000), 2);
    await this.sendUpcomingBirthdayReminders(now, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  }

  private async queueNotification(event: NotificationRequestedEvent, dedupeKey?: string) {
    const notification = await this.prisma.notification.upsert({
      where: {
        dedupeKey: dedupeKey ?? event.eventId
      },
      update: {},
      create: {
        id: event.eventId,
        userId: event.userId,
        clinicId: event.clinicId,
        channel: event.channel,
        recipient: event.recipient,
        subject: event.subject,
        template: event.template,
        variables: event.variables as Prisma.InputJsonValue,
        dedupeKey: dedupeKey ?? event.eventId,
        status: NotificationStatus.queued
      }
    });

    if (notification.status === NotificationStatus.sent) {
      return notification;
    }

    return this.processNotification(notification.id);
  }

  private async processNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return null;
    }

    const variables = (notification.variables as Record<string, string | number> | null) ?? {};
    const template = this.templateService.render(notification.template, variables);

    try {
      const info = await this.transporter.sendMail({
        from: env.MAIL_FROM,
        to: notification.recipient,
        subject: template.subject,
        text: template.body
      });

      return this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.sent,
          attempts: { increment: 1 },
          sentAt: new Date(),
          providerMessageId: info.messageId,
          lastError: null
        }
      });
    } catch (error) {
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.failed,
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : 'Unknown email error'
        }
      });
    }
  }

  private async handlePaymentSucceeded(event: PaymentSettledEvent) {
    const contact = await this.fetchUserContact(event.ownerId);
    await this.queueNotification({
      eventId: `payment-succeeded-${event.paymentId}`,
      channel: NotificationChannel.EMAIL,
      userId: contact.id,
      clinicId: event.clinicId,
      recipient: contact.email,
      subject: 'Tu cita PetWell fue confirmada',
      template: 'appointment-confirmed',
      variables: {
        firstName: contact.firstName,
        startsAt: event.startsAt ?? 'proximamente'
      }
    });
  }

  private async handlePaymentFailed(event: PaymentSettledEvent) {
    const contact = await this.fetchUserContact(event.ownerId);
    await this.queueNotification({
      eventId: `payment-failed-${event.paymentId}`,
      channel: NotificationChannel.EMAIL,
      userId: contact.id,
      clinicId: event.clinicId,
      recipient: contact.email,
      subject: 'Tu pago PetWell no fue aprobado',
      template: 'payment-failed',
      variables: {
        firstName: contact.firstName
      }
    });
  }

  private async handleTelemedRoomCreated(event: TelemedRoomCreatedEvent) {
    const contact = await this.fetchUserContact(event.ownerId);
    await this.queueNotification({
      eventId: `telemed-room-${event.roomId}`,
      channel: NotificationChannel.EMAIL,
      userId: contact.id,
      clinicId: event.clinicId,
      recipient: contact.email,
      subject: 'Acceso a tu teleconsulta PetWell',
      template: 'telemed-room',
      variables: {
        firstName: contact.firstName,
        roomUrl: event.roomUrl
      }
    });
  }

  private async sendReminderWindow(template: 'reminder-24h' | 'reminder-2h', from: Date, to: Date, hours: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get<Array<{ id: string; ownerId: string; clinicId: string; startsAt: string }>>(
          `${env.APPOINTMENT_SERVICE_URL}/appointments/internal/upcoming`,
          {
            params: {
              from: from.toISOString(),
              to: to.toISOString()
            }
          }
        )
      );

      for (const appointment of response.data) {
        const contact = await this.fetchUserContact(appointment.ownerId);
        await this.queueNotification(
          {
            eventId: `${template}-${appointment.id}`,
            channel: NotificationChannel.EMAIL,
            userId: contact.id,
            clinicId: appointment.clinicId,
            recipient: contact.email,
            subject: template,
            template,
            variables: {
              firstName: contact.firstName,
              startsAt: appointment.startsAt
            }
          },
          `${template}:${appointment.id}:${hours}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Skipping ${template} reminders because appointment-service is unavailable: ${this.describeError(error)}`
      );
      return;
    }
  }

  private async sendUpcomingBirthdayReminders(from: Date, to: Date) {
    try {
      const response = await firstValueFrom(
        this.httpService.get<UpcomingBirthday[]>(`${env.PET_SERVICE_URL}/pets/internal/upcoming-birthdays`, {
          params: {
            from: from.toISOString(),
            to: to.toISOString()
          }
        })
      );

      for (const pet of response.data) {
        for (const ownerId of pet.ownerIds) {
          const contact = await this.fetchUserContact(ownerId);
          await this.queueNotification(
            {
              eventId: `pet-birthday-${pet.id}-${ownerId}-${pet.nextBirthday}`,
              channel: NotificationChannel.EMAIL,
              userId: contact.id,
              recipient: contact.email,
              subject: 'pet-birthday',
              template: 'pet-birthday',
              variables: {
                firstName: contact.firstName,
                petName: pet.name,
                birthdayDate: pet.nextBirthday
              }
            },
            `pet_birthday:${pet.id}:${ownerId}:${pet.nextBirthday.slice(0, 10)}`
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Skipping pet-birthday reminders because pet-service is unavailable: ${this.describeError(error)}`
      );
    }
  }

  private async fetchUserContact(userId: string) {
    const response = await firstValueFrom(
      this.httpService.get<UserContact>(`${env.USER_SERVICE_URL}/users/internal/${userId}/contact`)
    );

    return response.data;
  }

  private describeError(error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      if (response?.status) {
        return `status ${response.status}`;
      }
    }

    return error instanceof Error ? error.message : 'unknown error';
  }
}
