import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { ClinicsService } from './clinics.service';
import { AddStaffToClinicDto, CreateClinicDto, SearchClinicsQueryDto, UpdateClinicDto, UpsertClinicServiceDto } from './dto/clinic.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('public/search')
  searchPublic(@Query() query: SearchClinicsQueryDto) {
    return this.clinicsService.searchPublicClinics(query);
  }

  @Get(':id/services')
  listPublicServices(@Param('id') clinicId: string) {
    return this.clinicsService.listServices(clinicId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST)
  listClinics() {
    return this.clinicsService.listClinics();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST)
  getClinic(@Param('id') clinicId: string) {
    return this.clinicsService.getClinic(clinicId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  createClinic(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateClinicDto) {
    return this.clinicsService.createClinic(user.role, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  updateClinic(@CurrentUser() user: JwtUserClaims, @Param('id') clinicId: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.updateClinic(user.role, user.clinicIds, clinicId, dto);
  }

  @Get(':id/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  listStaff(@CurrentUser() user: JwtUserClaims, @Param('id') clinicId: string) {
    return this.clinicsService.listStaff(user.role, user.clinicIds, clinicId);
  }

  @Post(':id/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  addStaff(@CurrentUser() user: JwtUserClaims, @Param('id') clinicId: string, @Body() dto: AddStaffToClinicDto) {
    return this.clinicsService.addStaff(user.role, user.clinicIds, clinicId, dto);
  }

  @Post(':id/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  upsertService(@CurrentUser() user: JwtUserClaims, @Param('id') clinicId: string, @Body() dto: UpsertClinicServiceDto) {
    return this.clinicsService.upsertServiceCatalog(user.role, user.clinicIds, clinicId, dto);
  }
}
