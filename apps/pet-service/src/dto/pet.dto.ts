import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

import { PetSex, PetSpecies } from '@petwell/shared-types';

export class CreatePetDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coOwnerIds?: string[];

  @IsString()
  name!: string;

  @IsEnum(PetSpecies)
  species!: PetSpecies;

  @IsString()
  breed!: string;

  @IsEnum(PetSex)
  sex!: PetSex;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  weightKg!: number;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  microchip?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isSpayedNeutered?: boolean;

  @IsOptional()
  @IsString()
  mainClinicId?: string;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}

export class ListPetsQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  @IsOptional()
  @IsString()
  q?: string;
}
