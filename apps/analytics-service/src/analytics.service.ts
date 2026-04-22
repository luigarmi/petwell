import { randomUUID } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@petwell/prisma-analytics-service-client';
import { firstValueFrom } from 'rxjs';

import { RabbitMqEventBus } from '@petwell/shared-events';
import { EVENT_NAMES } from '@petwell/shared-types';

import { env } from './config';
import { PrismaService } from './prisma.service';

@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: RabbitMqEventBus,
    private readonly httpService: HttpService
  ) {}

  async onModuleInit() {
    for (const eventName of Object.values(EVENT_NAMES)) {
      this.eventBus.subscribe(eventName, async (payload, envelope) => {
        await this.recordEvent(eventName, envelope.occurredAt, payload as Prisma.InputJsonValue);
      });
    }
    await this.eventBus.connect();
  }

  async getKpis() {
    const [billingSummary, appointmentSummary, petSummary, activity] = await Promise.all([
      this.fetchJson(`${env.BILLING_SERVICE_URL}/billing/payments/summary`),
      this.fetchJson(`${env.APPOINTMENT_SERVICE_URL}/appointments/summary`),
      this.fetchJson(`${env.PET_SERVICE_URL}/pets/summary`),
      this.systemActivity()
    ]);

    return {
      ingresos: billingSummary,
      citas: appointmentSummary,
      mascotas: petSummary,
      actividad: activity
    };
  }

  async revenue() {
    return this.fetchJson(`${env.BILLING_SERVICE_URL}/billing/payments/summary`);
  }

  async systemActivity() {
    const [totalEvents, byEvent] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.count(),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        orderBy: { eventName: 'asc' },
        _count: true
      })
    ]);

    return { totalEvents, byEvent };
  }

  private async recordEvent(eventName: string, occurredAt: string, payload: Prisma.InputJsonValue) {
    const payloadObject = payload as { clinicId?: string } | undefined;
    await this.prisma.analyticsEvent.create({
      data: {
        id: randomUUID(),
        eventName,
        clinicId: payloadObject?.clinicId,
        payload,
        occurredAt: new Date(occurredAt)
      }
    });
  }

  private async fetchJson(url: string) {
    const response = await firstValueFrom(this.httpService.get(url));
    return response.data;
  }
}
