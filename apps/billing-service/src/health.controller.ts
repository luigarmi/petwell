import { Controller, Get, Inject, Res } from '@nestjs/common';

import { AppHealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(AppHealthService) private readonly healthService: AppHealthService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) response: { status: (statusCode: number) => unknown }) {
    return this.respondWithReadiness(response);
  }

  @Get('live')
  live() {
    return this.healthService.liveness();
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: { status: (statusCode: number) => unknown }) {
    return this.respondWithReadiness(response);
  }

  private async respondWithReadiness(response: { status: (statusCode: number) => unknown }) {
    const report = await this.healthService.readiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }
}
