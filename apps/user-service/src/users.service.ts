import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { JwtUserClaims, ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

import { ListUsersQueryDto, UpdateProfileDto, UpdateUserRoleDto } from './dto/user.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clinicMemberships: {
          where: { active: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      clinicIds: user.clinicMemberships.map((membership) => membership.clinicId),
      permissions: ROLE_PERMISSIONS[user.role as UserRole]
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: {
        clinicMemberships: {
          where: { active: true }
        }
      }
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      clinicIds: user.clinicMemberships.map((membership) => membership.clinicId),
      permissions: ROLE_PERMISSIONS[user.role as UserRole]
    };
  }

  async listUsers(actor: JwtUserClaims, query: ListUsersQueryDto) {
    if (actor.role !== UserRole.SUPERADMIN && query.clinicId && !actor.clinicIds.includes(query.clinicId)) {
      throw new ForbiddenException('You do not have access to this clinic');
    }

    const membershipFilter =
      actor.role === UserRole.SUPERADMIN
        ? query.clinicId
          ? {
              some: {
                clinicId: query.clinicId,
                active: true
              }
            }
          : undefined
        : {
            some: {
              clinicId: query.clinicId ?? { in: actor.clinicIds },
              active: true
            }
          };

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: query.role,
        OR: query.search
          ? [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } }
            ]
          : undefined,
        clinicMemberships: membershipFilter
      },
      include: {
        clinicMemberships: {
          where: { active: true }
        }
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }]
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      clinicIds: user.clinicMemberships.map((membership) => membership.clinicId)
    }));
  }

  async updateUserRole(actorRole: UserRole, userId: string, dto: UpdateUserRoleDto) {
    if (actorRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Only superadmin can update global user roles');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role }
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      permissions: ROLE_PERMISSIONS[updated.role as UserRole]
    };
  }

  getPermissionsCatalog() {
    return ROLE_PERMISSIONS;
  }

  async getUserContact(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone
    };
  }
}
