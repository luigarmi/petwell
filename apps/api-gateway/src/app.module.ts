import { Module } from '@nestjs/common';

import { JsonLogger } from '@petwell/shared-utils';

import { HealthController } from './health.controller';
import { AppHealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [AppHealthService, JsonLogger]
})
export class AppModule {}
