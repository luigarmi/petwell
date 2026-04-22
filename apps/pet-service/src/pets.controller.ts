import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { CreatePetDto, ListPetsQueryDto, UpdatePetDto } from './dto/pet.dto';
import { PetsService } from './pets.service';

@Controller('pets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  createPet(@CurrentUser() user: JwtUserClaims, @Body() dto: CreatePetDto) {
    return this.petsService.createPet(user, dto);
  }

  @Get('summary')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  getSummary(@CurrentUser() user: JwtUserClaims) {
    return this.petsService.summary(user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  listPets(@CurrentUser() user: JwtUserClaims, @Query() query: ListPetsQueryDto) {
    return this.petsService.listPets(user, query);
  }

  @Get(':id/access-profile')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST)
  getAccessProfile(@Param('id') petId: string) {
    return this.petsService.getPetAccessProfile(petId);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  getPet(@CurrentUser() user: JwtUserClaims, @Param('id') petId: string) {
    return this.petsService.getPet(user, petId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST, UserRole.PET_OWNER)
  updatePet(@CurrentUser() user: JwtUserClaims, @Param('id') petId: string, @Body() dto: UpdatePetDto) {
    return this.petsService.updatePet(user, petId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.PET_OWNER)
  deletePet(@CurrentUser() user: JwtUserClaims, @Param('id') petId: string) {
    return this.petsService.deletePet(user, petId);
  }
}

@Controller('pets/internal')
export class InternalPetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get('upcoming-birthdays')
  getUpcomingBirthdays(@Query('from') from: string, @Query('to') to: string) {
    return this.petsService.getUpcomingBirthdays(from, to);
  }

  @Get(':id/access-profile')
  getAccessProfile(@Param('id') petId: string) {
    return this.petsService.getPetAccessProfile(petId);
  }
}
