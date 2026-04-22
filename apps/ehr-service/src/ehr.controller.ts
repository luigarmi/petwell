import { Body, Controller, Delete, Get, Param, Post, Query, Res, StreamableFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { AccessReasonQueryDto, CreateConsentDto, CreateEhrRecordDto } from './dto/ehr.dto';
import { EhrService } from './ehr.service';

@Controller('ehr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EhrController {
  constructor(private readonly ehrService: EhrService) {}

  @Post('records')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN)
  createRecord(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateEhrRecordDto) {
    return this.ehrService.createRecord(user, dto);
  }

  @Get('records/pet/:petId')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  listRecords(@CurrentUser() user: JwtUserClaims, @Param('petId') petId: string, @Query() query: AccessReasonQueryDto) {
    return this.ehrService.listRecordsByPet(user, petId, query.reason);
  }

  @Get('records/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getRecord(@CurrentUser() user: JwtUserClaims, @Param('id') recordId: string, @Query() query: AccessReasonQueryDto) {
    return this.ehrService.getRecordById(user, recordId, query.reason);
  }

  @Get('records/:id/download')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  async downloadRecord(
    @CurrentUser() user: JwtUserClaims,
    @Param('id') recordId: string,
    @Query() query: AccessReasonQueryDto,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => unknown }
  ) {
    const download = await this.ehrService.downloadRecord(user, recordId, query.reason);
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    return new StreamableFile(download.contents);
  }

  @Post('records/:id/attachments')
  @UseInterceptors(FilesInterceptor('files', 10))
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN)
  uploadAttachments(
    @CurrentUser() user: JwtUserClaims,
    @Param('id') recordId: string,
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>
  ) {
    return this.ehrService.uploadAttachments(user, recordId, files ?? []);
  }

  @Get('records/:id/attachments/:attachmentId/download')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  async downloadAttachment(
    @CurrentUser() user: JwtUserClaims,
    @Param('id') recordId: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: AccessReasonQueryDto,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => unknown }
  ) {
    const download = await this.ehrService.downloadAttachment(user, recordId, attachmentId, query.reason);
    response.setHeader('Content-Type', download.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    return new StreamableFile(download.contents);
  }

  @Post('consents')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN)
  createConsent(@CurrentUser() user: JwtUserClaims, @Body() dto: CreateConsentDto) {
    return this.ehrService.createConsent(user, dto);
  }

  @Delete('consents/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN)
  revokeConsent(@CurrentUser() user: JwtUserClaims, @Param('id') consentId: string) {
    return this.ehrService.revokeConsent(user, consentId);
  }

  @Get('consents/pet/:petId')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.PET_OWNER)
  listConsents(@CurrentUser() user: JwtUserClaims, @Param('petId') petId: string) {
    return this.ehrService.listConsents(user, petId);
  }

  @Get('audit/pet/:petId')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.PET_OWNER)
  listAudit(@CurrentUser() user: JwtUserClaims, @Param('petId') petId: string) {
    return this.ehrService.listAccessAudit(user, petId);
  }
}
