import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, SubscriptionTier } from '@prisma/client';
import Filter from 'bad-words';

@Controller('users')
export class UsersController implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Day-before event reminder — runs every hour, fires at 9 AM UTC
    setInterval(() => this.sendDayBeforeReminders(), 60 * 60 * 1000);
    // Also run once on startup (catches missed runs during restarts)
    this.sendDayBeforeReminders();
    // Seed default feature flags (idempotent — upsert never overwrites existing values)
    await this.seedFeatureFlags();
  }

  private async seedFeatureFlags() {
    const FLAGS = [
      { key: 'AI_TRIP_PLANNER',       label: 'AI Trip Planner',       description: 'Enable the AI-powered travel planning feature',        enabledForTravelers: true,  enabledForHosts: true  },
      { key: 'HOST_LISTING_CREATION', label: 'Listing Creation',       description: 'Allow hosts to create and edit listings',              enabledForTravelers: false, enabledForHosts: true  },
      { key: 'NEAR_ME_SEARCH',        label: 'Near Me Search',         description: 'Enable location-based nearby experiences search',      enabledForTravelers: true,  enabledForHosts: true  },
      { key: 'MAP_VIEW',              label: 'Map View',               description: 'Enable map view in browse/explore screens',            enabledForTravelers: true,  enabledForHosts: true  },
      { key: 'EVENT_NOTIFICATIONS',   label: 'Event Notifications',    description: 'Push notifications for nearby new events (mobile)',    enabledForTravelers: true,  enabledForHosts: false },
      { key: 'ITINERARY_PLANNER',    label: 'Itinerary Planner',      description: 'Enable trip itinerary planning feature',               enabledForTravelers: true,  enabledForHosts: false },
    ];
    for (const flag of FLAGS) {
      await this.prisma.featureFlag.upsert({ where: { key: flag.key }, create: flag, update: {} });
    }
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
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        displayName: true,
        role: true,
        subscriptionTier: true,
        isPremium: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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

  @Get('admins')
  async getAdmins() {
    return this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { firebaseUid: true, fcmToken: true },
    });
  }

  @Get('nearby-travelers')
  async getNearbyTravelers(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const radius = radiusKm ? parseFloat(radiusKm) : 50;
    return this.prisma.$queryRaw`
      SELECT "firebaseUid", "fcmToken"
      FROM "User"
      WHERE role = 'TRAVELER'
        AND "lastLat" IS NOT NULL AND "lastLng" IS NOT NULL
        AND (6371 * acos(
              cos(radians(${latN})) * cos(radians("lastLat")) *
              cos(radians("lastLng") - radians(${lngN})) +
              sin(radians(${latN})) * sin(radians("lastLat"))
            )) <= ${radius}
    `;
  }

  @Patch(':firebaseUid/location')
  async updateLocation(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.prisma.user.update({
      where: { firebaseUid },
      data: { lastLat: body.lat, lastLng: body.lng },
      select: { id: true },
    });
  }

  @Patch(':firebaseUid/phone')
  async updatePhone(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { phone: string },
  ) {
    return this.prisma.user.update({
      where: { firebaseUid },
      data: { phone: body.phone },
      select: { id: true, phone: true },
    });
  }

  // ── Feature Flags ─────────────────────────────────────────────────────────

  @Get('feature-flags')
  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  @Patch('feature-flags/:key')
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() body: { enabledForTravelers?: boolean; enabledForHosts?: boolean; adminUid?: string },
  ) {
    return this.prisma.featureFlag.update({
      where: { key },
      data: {
        ...(body.enabledForTravelers !== undefined && { enabledForTravelers: body.enabledForTravelers }),
        ...(body.enabledForHosts !== undefined && { enabledForHosts: body.enabledForHosts }),
        updatedByAdminUid: body.adminUid,
      },
    });
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
    @Body() body: { listingId: string; plannedDate: string; note?: string; isGoingEntry?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.itineraryItem.create({
      data: {
        userId: user.id,
        listingId: body.listingId,
        plannedDate: new Date(body.plannedDate),
        note: body.note,
        isGoingEntry: body.isGoingEntry ?? false,
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
    @Body() body: { title: string; body: string; type: string; resourceId?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.notification.create({
      data: {
        userId: user.id,
        title: body.title,
        body: body.body,
        type: body.type,
        ...(body.resourceId ? { resourceId: body.resourceId } : {}),
      },
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

  // ── Saved Chats ───────────────────────────────────────────────────────────

  @Post(':firebaseUid/chats')
  async saveChat(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { name: string; messages: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.savedChat.create({
      data: { userId: user.id, name: body.name, messages: body.messages },
      select: { id: true, name: true, messages: true, createdAt: true, updatedAt: true },
    });
  }

  @Get(':firebaseUid/chats')
  async getSavedChats(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return [];
    return this.prisma.savedChat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true, messages: true },
    });
  }

  @Delete(':firebaseUid/chats/:chatId')
  async deleteSavedChat(
    @Param('firebaseUid') firebaseUid: string,
    @Param('chatId') chatId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { ok: true };
    await this.prisma.savedChat.deleteMany({ where: { id: chatId, userId: user.id } });
    return { ok: true };
  }

  // ── AI Usage ──────────────────────────────────────────────────────────────

  @Get(':firebaseUid/ai-usage')
  async getAiUsage(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');

    let usage = await this.prisma.aiUsage.findUnique({ where: { userId: user.id } });

    // Lazy monthly reset: if resetAt is a previous calendar month, reset counters
    if (usage) {
      const resetDate = new Date(usage.resetAt);
      const now = new Date();
      const isOldMonth =
        resetDate.getUTCFullYear() < now.getUTCFullYear() ||
        resetDate.getUTCMonth() < now.getUTCMonth();
      if (isOldMonth) {
        usage = await this.prisma.aiUsage.update({
          where: { userId: user.id },
          data: { requestsUsed: 0, tokensUsed: 0, resetAt: now },
        });
      }
    }

    return {
      requestsUsed: usage?.requestsUsed ?? 0,
      tokensUsed: usage?.tokensUsed ?? 0,
      resetAt: usage?.resetAt ?? new Date(),
      subscriptionTier: user.subscriptionTier,
      isPremium: user.isPremium,
      role: user.role,
    };
  }

  @Post(':firebaseUid/ai-usage/increment')
  async incrementAiUsage(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { tokensUsed: number },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');

    const tokens = body.tokensUsed ?? 0;
    return this.prisma.aiUsage.upsert({
      where: { userId: user.id },
      create: { userId: user.id, requestsUsed: 1, tokensUsed: tokens, resetAt: new Date() },
      update: { requestsUsed: { increment: 1 }, tokensUsed: { increment: tokens } },
    });
  }

  @Patch(':firebaseUid/subscription')
  async updateSubscription(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { tier: 'FREE' | 'PREMIUM' },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: body.tier as SubscriptionTier,
        isPremium: body.tier === 'PREMIUM',
      },
      select: { id: true, firebaseUid: true, subscriptionTier: true, isPremium: true },
    });
  }

  // ── F2: Email + Phone Verification & Self-Upgrade ─────────────────────────

  @Patch(':firebaseUid/mark-email-verified')
  async markEmailVerified(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
      select: { emailVerifiedAt: true },
    });
    return updated;
  }

  @Patch(':firebaseUid/mark-phone-verified')
  async markPhoneVerified(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { phone: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phone: body.phone, phoneVerifiedAt: new Date() },
      select: { phone: true, phoneVerifiedAt: true },
    });
    return updated;
  }

  @Post(':firebaseUid/self-upgrade-premium')
  async selfUpgradePremium(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.emailVerifiedAt || !user.phoneVerifiedAt) {
      throw new ForbiddenException('Email and phone must be verified before upgrading to Premium');
    }
    return this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: SubscriptionTier.PREMIUM, isPremium: true },
      select: { id: true, firebaseUid: true, subscriptionTier: true, isPremium: true, emailVerifiedAt: true, phoneVerifiedAt: true },
    });
  }

  // ── F3: Host public profile ────────────────────────────────────────────────

  @Get('host/:firebaseUid')
  async getHostProfile(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findFirst({
      where: { firebaseUid, role: Role.HOST },
      select: { id: true, firebaseUid: true, displayName: true, avatarUrl: true, email: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Host not found');
    return user;
  }

  // ── F4: "I'm Going" ────────────────────────────────────────────────────────

  @Get(':firebaseUid/going/:listingId')
  async checkGoing(
    @Param('firebaseUid') firebaseUid: string,
    @Param('listingId') listingId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { isGoing: false, itemId: null };
    const item = await this.prisma.itineraryItem.findFirst({
      where: { userId: user.id, listingId, isGoingEntry: true },
    });
    return { isGoing: !!item, itemId: item?.id ?? null };
  }

  // ── F5: Event Experiences ─────────────────────────────────────────────────

  private profanityFilter = new Filter();

  @Post(':firebaseUid/experiences')
  async createExperience(
    @Param('firebaseUid') firebaseUid: string,
    @Body() body: { listingId: string; rating: number; text: string; imageUrls?: string[] },
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    if (!body.listingId || !body.text) throw new BadRequestException('listingId and text are required');
    if (body.rating < 1 || body.rating > 5) throw new BadRequestException('Rating must be 1–5');
    if (this.profanityFilter.isProfane(body.text)) {
      throw new BadRequestException('Content contains inappropriate language');
    }
    return this.prisma.eventExperience.upsert({
      where: { userId_listingId: { userId: user.id, listingId: body.listingId } },
      create: {
        userId: user.id,
        listingId: body.listingId,
        rating: body.rating,
        text: body.text,
        imageUrls: body.imageUrls ?? [],
      },
      update: {
        rating: body.rating,
        text: body.text,
        imageUrls: body.imageUrls ?? [],
      },
    });
  }

  @Get(':firebaseUid/experiences')
  async getMyExperiences(@Param('firebaseUid') firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return [];
    return this.prisma.eventExperience.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete(':firebaseUid/experiences/:id')
  async deleteExperience(
    @Param('firebaseUid') firebaseUid: string,
    @Param('id') id: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.eventExperience.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  }

  // ── F6: All Hosts list ─────────────────────────────────────────────────────

  @Get('hosts')
  async getAllHosts(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.prisma.user.findMany({
      where: { role: Role.HOST },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 20,
      skip: offset ? parseInt(offset, 10) : 0,
      select: { id: true, firebaseUid: true, displayName: true, avatarUrl: true, email: true, createdAt: true },
    });
  }
}

// ── Shared experiences endpoint (not user-scoped) ──────────────────────────

@Controller('experiences')
export class ExperiencesController {
  constructor(private prisma: PrismaService) {}

  @Get('listing/:listingId')
  async getListingExperiences(@Param('listingId') listingId: string) {
    return this.prisma.eventExperience.findMany({
      where: { listingId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firebaseUid: true, displayName: true, avatarUrl: true } },
      },
    });
  }
}
