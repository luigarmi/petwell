import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { SharedAuthModule } from '@petwell/shared-auth';
import { RabbitMqEventBus } from '@petwell/shared-events';
import { JsonLogger, CorrelationIdMiddleware } from '@petwell/shared-utils';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { env } from './config';
import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';
import { PrismaService } from './prisma.service';
import { InternalUsersController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SharedAuthModule.forRoot({ jwtSecret: env.JWT_ACCESS_SECRET })],
  controllers: [HealthController, AuthController, UsersController, InternalUsersController, ClinicsController],
  providers: [
    PrismaService,
    AuthService,
    UsersService,
    ClinicsService,
    AppHealthService,
    JsonLogger,
    {
      provide: RabbitMqEventBus,
      useFactory: () =>
        new RabbitMqEventBus({
          serviceName: env.SERVICE_NAME,
          url: env.RABBITMQ_URL
        })
    },
    JwtService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
