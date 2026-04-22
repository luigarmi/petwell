import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  appointmentId!: string;

  @IsString()
  clinicId!: string;

  @IsString()
  ownerId!: string;

  @IsString()
  veterinarianId!: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;
}
