import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { SharedAuthModule } from '@petwell/shared-auth';
import { RabbitMqEventBus } from '@petwell/shared-events';
import { CorrelationIdMiddleware, JsonLogger } from '@petwell/shared-utils';

import { env } from './config';
import { DailyTelemedProvider } from './providers/daily-telemed.provider';
import { MockTelemedProvider } from './providers/mock-telemed.provider';
import { TwilioTelemedProvider } from './providers/twilio-telemed.provider';
import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';
import { PrismaService } from './prisma.service';
import { TelemedController } from './telemed.controller';
import { TelemedService } from './telemed.service';

@Module({
  imports: [SharedAuthModule.forRoot({ jwtSecret: env.JWT_ACCESS_SECRET })],
  controllers: [HealthController, TelemedController],
  providers: [
    PrismaService,
    TelemedService,
    MockTelemedProvider,
    TwilioTelemedProvider,
    DailyTelemedProvider,
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
