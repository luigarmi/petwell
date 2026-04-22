import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

import { AppointmentStatus, AppointmentType } from '@petwell/shared-types';

export class CreateScheduleDto {
  @IsString()
  clinicId!: string;

  @IsString()
  veterinarianId!: string;

  @Type(() => Number)
  @IsInt()
  weekday!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  slotDurationMinutes!: number;
}

export class CreateScheduleBlockDto {
  @IsString()
  clinicId!: string;

  @IsOptional()
  @IsString()
  veterinarianId?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListScheduleBlocksQueryDto {
  @IsString()
  clinicId!: string;

  @IsOptional()
  @IsString()
  veterinarianId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class QueryAvailabilityDto {
  @IsString()
  clinicId!: string;

  @IsString()
  veterinarianId!: string;

  @IsDateString()
  date!: string;
}

export class CreateAppointmentDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  clinicId!: string;

  @IsString()
  veterinarianId!: string;

  @IsString()
  petId!: string;

  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RescheduleAppointmentDto {
  @IsDateString()
  startsAt!: string;
}

export class CreateWaitlistDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  clinicId!: string;

  @IsOptional()
  @IsString()
  veterinarianId?: string;

  @IsString()
  petId!: string;

  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @IsDateString()
  desiredDate!: string;
}

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  veterinarianId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
