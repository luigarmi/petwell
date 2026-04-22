import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { SharedAuthModule } from '@petwell/shared-auth';
import { CorrelationIdMiddleware, JsonLogger } from '@petwell/shared-utils';

import { env } from './config';
import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';
import { InternalPetsController, PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [SharedAuthModule.forRoot({ jwtSecret: env.JWT_ACCESS_SECRET })],
  controllers: [HealthController, PetsController, InternalPetsController],
  providers: [PrismaService, PetsService, AppHealthService, JsonLogger]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
