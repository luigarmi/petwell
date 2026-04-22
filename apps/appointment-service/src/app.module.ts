import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { SharedAuthModule } from '@petwell/shared-auth';
import { RabbitMqEventBus } from '@petwell/shared-events';
import { CorrelationIdMiddleware, JsonLogger } from '@petwell/shared-utils';

import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { env } from './config';
import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [HttpModule, SharedAuthModule.forRoot({ jwtSecret: env.JWT_ACCESS_SECRET })],
  controllers: [HealthController, AppointmentController],
  providers: [
    PrismaService,
    AppointmentService,
    AppHealthService,
    JsonLogger,
    {
      provide: RabbitMqEventBus,
      useFactory: () =>
        new RabbitMqEventBus({
          serviceName: env.SERVICE_NAME,
          url: env.RABBITMQ_URL
        })
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
