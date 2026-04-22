import { Injectable } from '@nestjs/common';

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
    return createReadinessReport(env.SERVICE_NAME, [createPrismaHealthCheck('postgres', this.prisma)]);
  }
}
