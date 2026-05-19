import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Delete } from '@nestjs/common';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  // Host creates listing
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Headers('x-user-uid') uid: string, @Body() dto: CreateListingDto) {
    return this.listings.create(uid, dto);
  }

  // Host sees own listings
  @Get('me')
  myListings(@Headers('x-user-uid') uid: string) {
    return this.listings.myListings(uid);
  }

  // Host updates listing
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(
    @Param('id') id: string,
    @Headers('x-user-uid') uid: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(uid, id, dto);
  }

  // Host deletes listing
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Headers('x-user-uid') uid: string,
  ) {
    return this.listings.delete(uid, id);
  }

  // Admin: pending list
  @Get('feed')
  findAll() {
    return this.listings.findAll();
  }

  @Get('pending')
  pending() {
    return this.listings.findPending();
  }

  @Get('all')
  findAllAdmin() {
    return this.listings.findAllAdmin();
  }

  @Get('stats')
  getStats() {
    return this.listings.getListingStats();
  }

  // Get single listing
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listings.findOne(id);
  }

  // Admin: approve
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.listings.approve(id);
  }

  // Admin: reject
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    const reason = (body?.reason ?? '').trim();
    return this.listings.reject(id, reason || 'No reason provided');
  }
}
