import { Injectable } from '@nestjs/common';

import { checkRabbitMqConnection } from '@petwell/shared-events';
import {
  createHttpHealthCheck,
  createLivenessReport,
  createPrismaHealthCheck,
  createReadinessReport
} from '@petwell/shared-utils';

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
      createHttpHealthCheck('user-service', env.USER_SERVICE_URL)
    ]);
  }
}
