import { Injectable } from '@nestjs/common';

import { checkRabbitMqConnection } from '@petwell/shared-events';
import { createHttpHealthCheck, createLivenessReport, createPrismaHealthCheck, createReadinessReport } from '@petwell/shared-utils';

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
      createHttpHealthCheck('pet-service', env.PET_SERVICE_URL),
      {
        name: 'storage',
        type: 'storage',
        check: async () => this.storageService.checkHealth()
      },
      {
        name: 'rabbitmq',
        type: 'broker',
        check: async () => checkRabbitMqConnection(env.RABBITMQ_URL)
      }
    ]);
  }
}
