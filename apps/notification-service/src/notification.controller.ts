import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('me')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getMyNotifications(@CurrentUser() user: JwtUserClaims) {
    return this.notificationService.listMyNotifications(user);
  }

  @Get('summary')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getSummary() {
    return this.notificationService.summary();
  }
}
