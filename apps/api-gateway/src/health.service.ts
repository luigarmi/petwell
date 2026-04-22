import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { createHttpHealthCheck, createLivenessReport, createReadinessReport } from '@petwell/shared-utils';

import { env } from './config';

@Injectable()
export class AppHealthService implements OnModuleDestroy {
  private readonly redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });

  liveness() {
    return createLivenessReport(env.SERVICE_NAME);
  }

  async readiness() {
    return createReadinessReport(env.SERVICE_NAME, [
      {
        name: 'redis',
        type: 'cache',
        check: async () => {
          const response = await this.redis.ping();

          if (response !== 'PONG') {
            throw new Error(`Unexpected Redis response: ${response}`);
          }

          return {
            response
          };
        }
      },
      createHttpHealthCheck('user-service', env.USER_SERVICE_URL),
      createHttpHealthCheck('pet-service', env.PET_SERVICE_URL),
      createHttpHealthCheck('ehr-service', env.EHR_SERVICE_URL),
      createHttpHealthCheck('appointment-service', env.APPOINTMENT_SERVICE_URL),
      createHttpHealthCheck('telemed-service', env.TELEMED_SERVICE_URL),
      createHttpHealthCheck('notification-service', env.NOTIFICATION_SERVICE_URL),
      createHttpHealthCheck('billing-service', env.BILLING_SERVICE_URL),
      createHttpHealthCheck('analytics-service', env.ANALYTICS_SERVICE_URL)
    ]);
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
