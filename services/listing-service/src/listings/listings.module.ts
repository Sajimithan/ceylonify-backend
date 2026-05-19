import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  providers: [ListingsService],
  controllers: [ListingsController],
})
export class ListingsModule {}
