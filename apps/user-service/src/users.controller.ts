import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@petwell/shared-auth';
import { JwtUserClaims, UserRole } from '@petwell/shared-types';

import { ListUsersQueryDto, UpdateProfileDto, UpdateUserRoleDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUserClaims) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtUserClaims, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN)
  listUsers(@CurrentUser() user: JwtUserClaims, @Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(user, query);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPERADMIN)
  updateRole(@CurrentUser() actor: JwtUserClaims, @Param('id') userId: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateUserRole(actor.role, userId, dto);
  }

  @Get('permissions/catalog')
  getPermissionsCatalog() {
    return this.usersService.getPermissionsCatalog();
  }
}

@Controller('users/internal')
export class InternalUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/contact')
  getUserContact(@Param('id') userId: string) {
    return this.usersService.getUserContact(userId);
  }
}
