import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

import { AppointmentType, UserRole } from '@petwell/shared-types';

export class CreateClinicDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsString()
  address!: string;

  @IsString()
  city!: string;

  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

export class UpdateClinicDto extends PartialType(CreateClinicDto) {}

export class AddStaffToClinicDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  professionalLicense?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

export class UpsertClinicServiceDto {
  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  priceCop!: number;

  @IsBoolean()
  isTelemedAvailable!: boolean;
}

export class SearchClinicsQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;
}
