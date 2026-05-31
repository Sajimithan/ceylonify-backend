import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
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

  @Get('approved-count')
  approvedCount(@Query('hostUid') hostUid: string) {
    return this.listings.approvedCountByHost(hostUid).then((count) => ({ count }));
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includePremium') includePremium?: string,
    @Query('startAfter') startAfter?: string,
    @Query('startBefore') startBefore?: string,
  ) {
    return this.listings.searchListings({
      q,
      category,
      type,
      limit: limit ? parseInt(limit, 10) : 12,
      offset: offset ? parseInt(offset, 10) : 0,
      includePremium: includePremium !== 'false',
      startAfter,
      startBefore,
    });
  }

  @Get('nearby')
  nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listings.searchNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Get single listing
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listings.findOne(id);
  }

  // Admin: approve
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Headers('x-admin-uid') adminUid?: string) {
    return this.listings.approve(id, adminUid ?? 'system');
  }

  // Admin: reject
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Headers('x-admin-uid') adminUid: string | undefined,
    @Body() body: { reason?: string },
  ) {
    const reason = (body?.reason ?? '').trim();
    return this.listings.reject(id, reason || 'No reason provided', adminUid ?? 'system');
  }

  // Admin: get audit logs
  @Get('audit/all')
  adminGetAuditLogs() {
    return this.listings.adminGetAuditLogs();
  }

  // Admin: write audit entry (called from gateway for non-listing events)
  @Post('audit')
  addAuditLog(@Body() body: { action: string; adminFirebaseUid: string; resourceId?: string; details?: string }) {
    return this.listings.addAuditLog(body.action, body.adminFirebaseUid, body.resourceId, body.details);
  }

  // Traveler: report a listing
  @Post(':id/report')
  reportListing(
    @Param('id') id: string,
    @Headers('x-user-uid') uid: string,
    @Body() body: { reason: string; comment?: string },
  ) {
    return this.listings.reportListing(uid, id, body.reason, body.comment);
  }

  // Admin: get all reports
  @Get('reports/all')
  adminGetReports() {
    return this.listings.adminGetReports();
  }

  // Admin: dismiss report
  @Patch('reports/:reportId/dismiss')
  adminDismissReport(@Param('reportId') reportId: string) {
    return this.listings.adminDismissReport(reportId);
  }

  // Admin: action report (remove the listing)
  @Patch('reports/:reportId/action')
  adminActionReport(@Param('reportId') reportId: string) {
    return this.listings.adminActionReport(reportId);
  }
}
