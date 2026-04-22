import { Controller, Get, Inject, Res } from '@nestjs/common';

import { env } from './config';
import { AppHealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(@Inject(AppHealthService) private readonly healthService: AppHealthService) {}

  @Get()
  info() {
    return {
      service: env.SERVICE_NAME,
      routes: {
        auth: '/auth',
        users: '/users',
        clinics: '/clinics',
        pets: '/pets',
        ehr: '/ehr',
        appointments: '/appointments',
        telemed: '/telemed',
        notifications: '/notifications',
        billing: '/billing',
        analytics: '/analytics'
      }
    };
  }

  @Get('health')
  async health(@Res({ passthrough: true }) response: { status: (statusCode: number) => unknown }) {
    return this.respondWithReadiness(response);
  }

  @Get('health/live')
  live() {
    return this.healthService.liveness();
  }

  @Get('health/ready')
  async ready(@Res({ passthrough: true }) response: { status: (statusCode: number) => unknown }) {
    return this.respondWithReadiness(response);
  }

  private async respondWithReadiness(response: { status: (statusCode: number) => unknown }) {
    const report = await this.healthService.readiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }
}
