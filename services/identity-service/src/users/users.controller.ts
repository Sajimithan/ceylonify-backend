import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Post('upsert-from-firebase')
  async upsertFromFirebase(
    @Body()
    body: {
      firebaseUid: string;
      email?: string;
      role?: Role;
    },
  ) {
    return this.prisma.user.upsert({
      where: { firebaseUid: body.firebaseUid },
      update: { email: body.email ?? undefined },
      create: {
        firebaseUid: body.firebaseUid,
        email: body.email,
        role: body.role ?? Role.TRAVELER,
      },
    });
  }

  @Post('get-by-firebase')
  async getByFirebase(@Body() body: { firebaseUid: string }) {
    return this.prisma.user.findUnique({
      where: { firebaseUid: body.firebaseUid },
    });
  }

  @Get('all')
  async getAllUsers() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Get('stats')
  async getStats() {
    const total = await this.prisma.user.count();
    const travelers = await this.prisma.user.count({ where: { role: Role.TRAVELER } });
    const hosts = await this.prisma.user.count({ where: { role: Role.HOST } });
    const admins = await this.prisma.user.count({ where: { role: Role.ADMIN } });
    return { total, travelers, hosts, admins };
  }

  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.prisma.user.update({ where: { id }, data: { role: body.role } });
  }

  // ── Saved Listings ────────────────────────────────────────────────────────

  @Get(':firebaseUid/saved')
  async getSavedListings(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return [];
    return this.prisma.savedListing.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':firebaseUid/saved/:listingId')
  async saveListing(
    @Param('firebaseUid') firebaseUid: string,
    @Param('listingId') listingId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.savedListing.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: {},
    });
  }

  @Delete(':firebaseUid/saved/:listingId')
  async unsaveListing(
    @Param('firebaseUid') firebaseUid: string,
    @Param('listingId') listingId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { ok: true };
    await this.prisma.savedListing.deleteMany({
      where: { userId: user.id, listingId },
    });
    return { ok: true };
  }

  // ── FCM Token ─────────────────────────────────────────────────────────────

  @Patch(':firebaseUid/fcm-token')
  async updateFcmToken(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { fcmToken: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: user.id },
      data: { fcmToken: body.fcmToken },
      select: { id: true, fcmToken: true },
    });
  }

  @Get(':firebaseUid/fcm-token')
  async getFcmToken(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { fcmToken: true },
    });
    return { fcmToken: user?.fcmToken ?? null };
  }

  // ── Itinerary ─────────────────────────────────────────────────────────────

  @Get(':firebaseUid/itinerary')
  async getItinerary(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return [];
    return this.prisma.itineraryItem.findMany({
      where: { userId: user.id },
      orderBy: { plannedDate: 'asc' },
    });
  }

  @Post(':firebaseUid/itinerary')
  async addToItinerary(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { listingId: string; plannedDate: string; note?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.itineraryItem.create({
      data: {
        userId: user.id,
        listingId: body.listingId,
        plannedDate: new Date(body.plannedDate),
        note: body.note,
      },
    });
  }

  @Patch('itinerary/:itemId/note')
  async updateItineraryNote(
    @Param('itemId') itemId: string,
    @Body() body: { note: string },
  ) {
    return this.prisma.itineraryItem.update({
      where: { id: itemId },
      data: { note: body.note },
    });
  }

  @Delete('itinerary/:itemId')
  async removeFromItinerary(@Param('itemId') itemId: string) {
    await this.prisma.itineraryItem.delete({ where: { id: itemId } });
    return { ok: true };
  }
}
