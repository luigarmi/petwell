import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { UserRole } from '@petwell/shared-types';

import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getKpis() {
    return this.analyticsService.getKpis();
  }

  @Get('revenue')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getRevenue() {
    return this.analyticsService.revenue();
  }

  @Get('activity')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getActivity() {
    return this.analyticsService.systemActivity();
  }
}
