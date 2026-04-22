import { createHash, randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { RabbitMqEventBus, createEventPayload } from '@petwell/shared-events';
import {
  DEMO_IDS,
  EVENT_NAMES,
  JwtUserClaims,
  NotificationChannel,
  ROLE_PERMISSIONS,
  UserRole
} from '@petwell/shared-types';
import { hashPassword, verifyPassword } from '@petwell/shared-utils';

import { env } from './config';
import { ForgotPasswordDto, LoginDto, LogoutDto, RefreshTokenDto, RegisterOwnerDto, ResetPasswordDto } from './dto/auth.dto';
import { PrismaService } from './prisma.service';

type UserRecord = Awaited<ReturnType<AuthService['getUserByEmail']>>;

@Injectable()
export class AuthService {
  private readonly refreshJwt = new JwtService({
    secret: env.JWT_REFRESH_SECRET,
    signOptions: { expiresIn: env.JWT_REFRESH_TTL as never }
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventBus: RabbitMqEventBus
  ) {}

  async registerOwner(dto: RegisterOwnerDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash: await hashPassword(dto.password),
        role: UserRole.PET_OWNER
      }
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    const user = await this.getUserByEmail(dto.email);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, userAgent, ipAddress);
  }

  async refresh(dto: RefreshTokenDto, userAgent?: string, ipAddress?: string) {
    const tokenPayload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: tokenPayload.sid }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh session is not valid');
    }

    if (session.tokenHash !== this.hashToken(dto.refreshToken)) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    return this.issueTokens(session.userId, userAgent, ipAddress, session.id);
  }

  async logout(dto: LogoutDto) {
    const tokenPayload = await this.verifyRefreshToken(dto.refreshToken);

    await this.prisma.refreshSession.updateMany({
      where: {
        id: tokenPayload.sid,
        tokenHash: this.hashToken(dto.refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.getUserByEmail(dto.email);
    if (!user) {
      return { success: true };
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt
      }
    });

    await this.eventBus.publish(
      EVENT_NAMES.NOTIFICATION_REQUESTED,
      createEventPayload({
        channel: NotificationChannel.EMAIL,
        recipient: user.email,
        subject: 'Recupera tu acceso a PetWell',
        template: 'password-reset',
        variables: {
          firstName: user.firstName,
          resetUrl: `${env.PUBLIC_APP_URL}/reset-password?token=${token}`,
          expiresAt: expiresAt.toISOString()
        }
      })
    );

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordResetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.hashToken(dto.token),
        consumedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!passwordResetToken) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordResetToken.userId },
        data: { passwordHash: await hashPassword(dto.newPassword) }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { consumedAt: new Date() }
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: passwordResetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    return { success: true };
  }

  async getDemoUsers() {
    const users = await this.prisma.user.findMany({
      where: { isDemo: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }]
    });

    return {
      password: 'Petwell123!',
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role
      })),
      seedReferences: DEMO_IDS
    };
  }

  private async issueTokens(userId: string, userAgent?: string, ipAddress?: string, previousSessionId?: string) {
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

    const claims = this.buildClaims(user);
    const accessToken = await this.jwtService.signAsync(claims, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL as never
    });

    const refreshSessionId = randomUUID();
    const refreshToken = await this.refreshJwt.signAsync({
      sub: user.id,
      sid: refreshSessionId,
      type: 'refresh'
    });

    await this.prisma.refreshSession.create({
      data: {
        id: refreshSessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        userAgent,
        ipAddress,
        replacedBySessionId: previousSessionId ?? null
      }
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserProfile(user)
    };
  }

  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        clinicMemberships: {
          where: { active: true }
        }
      }
    });
  }

  private buildClaims(user: NonNullable<UserRecord>): JwtUserClaims {
    const clinicIds = user.clinicMemberships.map((membership) => membership.clinicId);

    return {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      clinicIds,
      permissions: ROLE_PERMISSIONS[user.role as UserRole]
    };
  }

  private toUserProfile(user: NonNullable<UserRecord>) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      clinicIds: user.clinicMemberships.map((membership) => membership.clinicId),
      professionalLicense: user.professionalLicense,
      permissions: ROLE_PERMISSIONS[user.role as UserRole]
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.refreshJwt.verifyAsync<{ sub: string; sid: string; type: string }>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
