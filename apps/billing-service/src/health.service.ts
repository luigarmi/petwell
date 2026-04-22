import { Injectable } from '@nestjs/common';

import { checkRabbitMqConnection } from '@petwell/shared-events';
import { createLivenessReport, createPrismaHealthCheck, createReadinessReport } from '@petwell/shared-utils';

import { env } from './config';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class AppHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  liveness() {
    return createLivenessReport(env.SERVICE_NAME);
  }

  async readiness() {
    return createReadinessReport(env.SERVICE_NAME, [
      createPrismaHealthCheck('postgres', this.prisma),
      {
        name: 'rabbitmq',
        type: 'broker',
        check: async () => checkRabbitMqConnection(env.RABBITMQ_URL)
      },
      {
        name: 'payment-provider',
        type: 'provider',
        check: async () => this.checkPaymentProvider()
      },
      {
        name: 'minio',
        type: 'storage',
        check: async () => this.storageService.checkHealth()
      }
    ]);
  }

  private async checkPaymentProvider() {
    switch (env.PAYMENT_PROVIDER) {
      case 'mock':
        return {
          mode: 'local',
          provider: 'mock'
        };
      case 'wompi':
        if (!(env.WOMPI_SANDBOX_PUBLIC_KEY ?? env.WOMPI_PRODUCTION_PUBLIC_KEY)) {
          throw new Error('Wompi public key is missing');
        }

        if (
          !(
            env.WOMPI_SANDBOX_INTEGRITY_SECRET ??
            env.WOMPI_PRODUCTION_INTEGRITY_SECRET ??
            env.WOMPI_SANDBOX_EVENTS_SECRET ??
            env.WOMPI_PRODUCTION_EVENTS_SECRET
          )
        ) {
          throw new Error('Wompi integrity or events secret is missing');
        }

        return {
          provider: 'wompi'
        };
      case 'mercadopago':
        if (!(env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN ?? env.MERCADOPAGO_PRODUCTION_ACCESS_TOKEN)) {
          throw new Error('Mercado Pago access token is missing');
        }

        return {
          provider: 'mercadopago'
        };
      default:
        throw new Error(`Unsupported payment provider: ${env.PAYMENT_PROVIDER}`);
    }
  }
}
