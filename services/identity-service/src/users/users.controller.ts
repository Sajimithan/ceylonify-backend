import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Day-before event reminder — runs every hour, fires at 9 AM UTC
    setInterval(() => this.sendDayBeforeReminders(), 60 * 60 * 1000);
    // Also run once on startup (catches missed runs during restarts)
    this.sendDayBeforeReminders();
  }

  private async sendDayBeforeReminders() {
    const now = new Date();
    if (now.getUTCHours() !== 9) return; // only at 9 AM UTC

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStart = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0));
    const tomorrowEnd   = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 59));

    const items = await this.prisma.itineraryItem.findMany({
      where: { plannedDate: { gte: tomorrowStart, lte: tomorrowEnd } },
      include: { user: true },
    });

    for (const item of items) {
      await this.prisma.notification.create({
        data: {
          userId: item.userId,
          title: '📅 Reminder: Tomorrow\'s Plan',
          body: `You have an experience planned for tomorrow. Have a great trip!`,
          type: 'REMINDER',
        },
      });
    }
  }

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

  // ── Profile ───────────────────────────────────────────────────────────────

  @Patch(':firebaseUid/profile')
  async updateProfile(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { displayName?: string; avatarUrl?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      },
      select: { id: true, displayName: true, avatarUrl: true },
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  @Post(':firebaseUid/notifications')
  async createNotification(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { title: string; body: string; type: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.notification.create({
      data: { userId: user.id, title: body.title, body: body.body, type: body.type },
    });
  }

  @Get(':firebaseUid/notifications')
  async getNotifications(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return [];
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Patch(':firebaseUid/notifications/:id/read')
  async markNotificationRead(
    @Param('firebaseUid') firebaseUid: string,
    @Param('id') id: string,
  ) {
    await this.prisma.notification.updateMany({ where: { id }, data: { read: true } });
    return { ok: true };
  }

  @Patch(':firebaseUid/notifications/read-all')
  async markAllNotificationsRead(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { ok: true };
    await this.prisma.notification.updateMany({ where: { userId: user.id }, data: { read: true } });
    return { ok: true };
  }
}
