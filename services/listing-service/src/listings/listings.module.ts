import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { Report } from './report.entity';
import { AuditLog } from './audit-log.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Report, AuditLog])],
  providers: [ListingsService],
  controllers: [ListingsController],
})
export class ListingsModule {}
