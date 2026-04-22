import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateScheduleDto,
  CreateScheduleBlockDto,
  CreateWaitlistDto,
  ListScheduleBlocksQueryDto,
  ListAppointmentsQueryDto,
  QueryAvailabilityDto,
  RescheduleAppointmentDto
} from './dto/appointment.dto';
import { AppointmentService } from './appointment.service';

@Controller()
export class AppointmentController {
  constructor(@Inject(AppointmentService) private readonly appointmentService: AppointmentService) {}

  @Post('schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  createSchedule(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateScheduleDto) {
    return this.appointmentService.createSchedule(user, dto);
  }

  @Post('schedule-blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  createScheduleBlock(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateScheduleBlockDto) {
    return this.appointmentService.createScheduleBlock(user, dto);
  }

  @Get('schedules')
  listSchedules(@Query('clinicId') clinicId: string, @Query('veterinarianId') veterinarianId?: string) {
    return this.appointmentService.listSchedules(clinicId, veterinarianId);
  }

  @Get('schedule-blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.VETERINARIAN)
  listScheduleBlocks(@CurrentUser() user: JwtUserClaims, @Query() query: ListScheduleBlocksQueryDto) {
    return this.appointmentService.listScheduleBlocks(user, query);
  }

  @Get('availability')
  getAvailability(@Query() query: QueryAvailabilityDto) {
    return this.appointmentService.getAvailability(query);
  }

  @Post('appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  createAppointment(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.createAppointment(user, dto);
  }

  @Get('appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  listAppointments(@CurrentUser() user: JwtUserClaims, @Query() query: ListAppointmentsQueryDto) {
    return this.appointmentService.listAppointments(user, query);
  }

  @Get('appointments/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getSummary(@CurrentUser() user: JwtUserClaims) {
    return this.appointmentService.summary(user);
  }

  @Get('appointments/internal/upcoming')
  getUpcomingAppointments(@Query('from') from: string, @Query('to') to: string) {
    return this.appointmentService.getUpcomingAppointments(from, to);
  }

  @Get('appointments/internal/:id')
  getInternalAppointment(@Param('id') appointmentId: string) {
    return this.appointmentService.getAppointmentInternal(appointmentId);
  }

  @Get('appointments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getAppointment(@CurrentUser() user: JwtUserClaims, @Param('id') appointmentId: string) {
    return this.appointmentService.getAppointment(user, appointmentId);
  }

  @Patch('appointments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  cancelAppointment(@CurrentUser() user: JwtUserClaims, @Param('id') appointmentId: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentService.cancelAppointment(user, appointmentId, dto);
  }

  @Patch('appointments/:id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  rescheduleAppointment(
    @CurrentUser() user: JwtUserClaims,
    @Param('id') appointmentId: string,
    @Body() dto: RescheduleAppointmentDto
  ) {
    return this.appointmentService.rescheduleAppointment(user, appointmentId, dto);
  }

  @Patch('appointments/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN)
  markCompleted(@CurrentUser() user: JwtUserClaims, @Param('id') appointmentId: string) {
    return this.appointmentService.markCompleted(user, appointmentId);
  }

  @Post('waitlist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  createWaitlist(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateWaitlistDto) {
    return this.appointmentService.createWaitlist(user, dto);
  }
}
