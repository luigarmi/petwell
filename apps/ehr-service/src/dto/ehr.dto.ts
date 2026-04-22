import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEhrRecordDto {
  @IsString()
  petId!: string;

  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsString()
  consultation!: string;

  @IsOptional()
  @IsString()
  reasonForVisit?: string;

  @IsOptional()
  @IsString()
  anamnesis?: string;

  @IsOptional()
  @IsString()
  physicalExam?: string;

  @IsString()
  diagnosis!: string;

  @IsString()
  vaccines!: string;

  @IsOptional()
  @IsString()
  treatments?: string;

  @IsString()
  prescriptions!: string;

  @IsString()
  labResults!: string;

  @IsOptional()
  @IsString()
  imagingReports?: string;

  @IsString()
  clinicalNotes!: string;
}

export class CreateConsentDto {
  @IsString()
  petId!: string;

  @IsOptional()
  @IsString()
  sourceClinicId?: string;

  @IsString()
  targetClinicId!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  scopeSummary?: string;

  @IsOptional()
  @IsString()
  ownerApprovedByUserId?: string;

  @IsOptional()
  @IsDateString()
  ownerApprovedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AccessReasonQueryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
