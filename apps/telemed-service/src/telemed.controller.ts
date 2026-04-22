import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { CreateRoomDto } from './dto/telemed.dto';
import { TelemedService } from './telemed.service';

@Controller('telemed')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TelemedController {
  constructor(private readonly telemedService: TelemedService) {}

  @Post('rooms')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST)
  createRoom(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateRoomDto) {
    return this.telemedService.createRoom(user, dto);
  }

  @Get('rooms/appointment/:appointmentId')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getRoomByAppointment(@CurrentUser() user: JwtUserClaims, @Param('appointmentId') appointmentId: string) {
    return this.telemedService.getRoomByAppointment(user, appointmentId);
  }

  @Get('rooms/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getRoomById(@CurrentUser() user: JwtUserClaims, @Param('id') roomId: string) {
    return this.telemedService.getRoomById(user, roomId);
  }
}
