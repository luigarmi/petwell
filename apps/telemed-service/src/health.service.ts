import { Injectable } from '@nestjs/common';

import { checkRabbitMqConnection } from '@petwell/shared-events';
import { createLivenessReport, createPrismaHealthCheck, createReadinessReport } from '@petwell/shared-utils';

import { env } from './config';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppHealthService {
  constructor(private readonly prisma: PrismaService) {}

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
        name: 'telemed-provider',
        type: 'provider',
        check: async () => this.checkProviderConfiguration()
      }
    ]);
  }

  private async checkProviderConfiguration() {
    switch (env.TELEMED_PROVIDER) {
      case 'mock':
        return {
          mode: 'local',
          provider: 'mock'
        };
      case 'twilio':
        if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
          throw new Error('Twilio credentials are missing');
        }

        return {
          provider: 'twilio'
        };
      case 'daily':
        if (!env.DAILY_API_KEY) {
          throw new Error('Daily API key is missing');
        }

        return {
          provider: 'daily'
        };
      default:
        throw new Error(`Unsupported telemed provider: ${env.TELEMED_PROVIDER}`);
    }
  }
}
