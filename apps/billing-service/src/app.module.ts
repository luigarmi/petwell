import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { SharedAuthModule } from '@petwell/shared-auth';
import { RabbitMqEventBus } from '@petwell/shared-events';
import { CorrelationIdMiddleware, JsonLogger } from '@petwell/shared-utils';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { env } from './config';
import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';
import { PrismaService } from './prisma.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { WompiProvider } from './providers/wompi.provider';
import { StorageService } from './storage.service';

@Module({
  imports: [SharedAuthModule.forRoot({ jwtSecret: env.JWT_ACCESS_SECRET })],
  controllers: [HealthController, BillingController],
  providers: [
    PrismaService,
    BillingService,
    StorageService,
    MockPaymentProvider,
    WompiProvider,
    MercadoPagoProvider,
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
