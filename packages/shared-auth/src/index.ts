import { createParamDecorator, DynamicModule, ExecutionContext, Inject, Injectable, Module, SetMetadata } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtUserClaims, Permission, ROLE_PERMISSIONS, UserRole } from '@petwell/shared-types';

const AUTH_OPTIONS = Symbol('AUTH_OPTIONS');
const ROLES_KEY = 'petwell_roles';
const PERMISSIONS_KEY = 'petwell_permissions';

export interface SharedAuthOptions {
  jwtSecret: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AUTH_OPTIONS) options: SharedAuthOptions) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: options.jwtSecret
    });
  }

  validate(payload: JwtUserClaims) {
    return payload;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user: JwtUserClaims }>();
  return request.user;
});

@Injectable()
export class RolesGuard {
  canActivate(context: ExecutionContext) {
    const roles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as UserRole[] | undefined;

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUserClaims }>();
    return request.user ? roles.includes(request.user.role) : false;
  }
}

@Injectable()
export class PermissionsGuard {
  canActivate(context: ExecutionContext) {
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, context.getHandler()) as Permission[] | undefined;

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUserClaims }>();
    if (!request.user) {
      return false;
    }

    const availablePermissions = request.user.permissions?.length
      ? request.user.permissions
      : ROLE_PERMISSIONS[request.user.role] ?? [];

    return permissions.every((permission) => availablePermissions.includes(permission));
  }
}

@Module({})
export class SharedAuthModule {
  static forRoot(options: SharedAuthOptions): DynamicModule {
    return {
      module: SharedAuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: options.jwtSecret })
      ],
      providers: [
        {
          provide: AUTH_OPTIONS,
          useValue: options
        },
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard
      ],
      exports: [PassportModule, JwtModule, JwtAuthGuard, RolesGuard, PermissionsGuard]
    };
  }
}
