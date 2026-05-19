import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResolver } from './health.resolver';

@Module({
  providers: [HealthService, HealthResolver],
})
export class HealthModule {}
