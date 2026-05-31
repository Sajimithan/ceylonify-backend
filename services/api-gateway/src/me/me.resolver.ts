import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  ObjectType,
  Field,
  Float,
  Mutation,
  Args,
  ID,
  InputType,
  ResolveField,
  Parent,
  Int,
} from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  upsertUser,
  getUser,
  adminAllUsers,
  adminUserStats,
  adminChangeUserRole,
  getSavedListings,
  addSavedListing,
  removeSavedListing,
  getItinerary,
  addToItinerary,
  updateItineraryNote,
  removeFromItinerary,
  updateUserProfile,
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  saveChat,
  getSavedChats,
  deleteSavedChat,
  updateUserLocation,
  submitHostApplication,
  adminPendingHostApplications,
  adminReviewHostApplication,
  getAiUsage,
  incrementAiUsage,
  updateSubscription,
  getFeatureFlags,
  updateFeatureFlagClient,
  getHostApplication,
  updateUserPhone,
  markEmailVerifiedClient,
  markPhoneVerifiedClient,
  selfUpgradePremiumClient,
  deleteUserAccount,
  checkGoing,
  shareExperience,
  getMyExperiences,
  deleteExperience,
  getListingExperiences,
  getAllHosts,
  getHostProfile,
  suspendUser,
  activateUser,
  broadcastNotification,
  getAllFcmTokens,
  getSubscriptionHistory,
} from '../identity/identity.client';
import { getListing, addAuditLog, searchListings, approvedCountByHost, listingsByHost, suspendListing } from '../listings/listings.client';
import { planItinerary as aiPlanItinerary } from '../ai/ai.service';
import { Listing } from '../listings/listings.resolver';

@ObjectType()
class AiUsageType {
  @Field(() => Int) requestsUsed!: number;
  @Field(() => Int) monthlyLimit!: number;
  @Field(() => Int) remaining!: number;
  @Field() resetAt!: string;
}

@ObjectType()
class Me {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() role!: string;
  @Field() subscriptionTier!: string;
  @Field() isPremium!: boolean;
  @Field() isSuspended!: boolean;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field(() => AiUsageType) aiUsage!: AiUsageType;
  @Field({ nullable: true }) emailVerifiedAt?: string;
  @Field({ nullable: true }) phoneVerifiedAt?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) subscriptionExpiresAt?: string;
}

@ObjectType()
class AppNotification {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() body!: string;
  @Field() type!: string;
  @Field({ nullable: true }) resourceId?: string;
  @Field() read!: boolean;
  @Field() createdAt!: string;
}

@ObjectType()
class SavedChat {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() messages!: string;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
class PlanListing {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field({ nullable: true }) imageUrl?: string;
  @Field({ nullable: true }) placeName?: string;
  @Field({ nullable: true }) price?: string;
  @Field() type!: string;
}

@ObjectType()
class PlanResult {
  @Field() text!: string;
  @Field(() => [PlanListing]) listings!: PlanListing[];
}

@ObjectType()
class UserRecord {
  @Field() id!: string;
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() role!: string;
  @Field() createdAt!: string;
  @Field({ nullable: true }) badgeLevel?: string;
  @Field(() => Int, { nullable: true }) approvedCount?: number;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) isSuspended?: boolean;
  @Field({ nullable: true }) subscriptionExpiresAt?: string;
}

@ObjectType()
class SubscriptionEventType {
  @Field(() => ID) id!: string;
  @Field() fromTier!: string;
  @Field() toTier!: string;
  @Field() changedAt!: string;
  @Field() changedBy!: string;
}

@ObjectType()
class FeatureFlagType {
  @Field() key!: string;
  @Field() label!: string;
  @Field() description!: string;
  @Field() enabledForTravelers!: boolean;
  @Field() enabledForHosts!: boolean;
  @Field() updatedAt!: string;
  @Field({ nullable: true }) updatedByAdminUid?: string;
}

@ObjectType()
class UserStats {
  @Field() total!: number;
  @Field() travelers!: number;
  @Field() hosts!: number;
  @Field() admins!: number;
}

interface UserProfile {
  firebaseUid: string;
  email?: string;
  role: string;
}

@ObjectType()
class ItineraryItem {
  @Field(() => ID) id!: string;
  @Field() listingId!: string;
  @Field() plannedDate!: string;
  @Field({ nullable: true }) note?: string;
  @Field() createdAt!: string;
  @Field() isGoingEntry!: boolean;
  @Field({ nullable: true }) listingTitle?: string;
  @Field({ nullable: true }) listingImageUrl?: string;
  @Field({ nullable: true }) listingType?: string;
  @Field({ nullable: true }) listingPlaceName?: string;
}

@ObjectType()
class ExperienceUser {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
}

@ObjectType()
class EventExperience {
  @Field(() => ID) id!: string;
  @Field() listingId!: string;
  @Field(() => Int) rating!: number;
  @Field() text!: string;
  @Field(() => [String]) imageUrls!: string[];
  @Field() createdAt!: string;
  @Field({ nullable: true }) user?: ExperienceUser;
}

@ObjectType()
class HostCard {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field() badgeLevel!: string;
  @Field(() => Int) approvedCount!: number;
  @Field() createdAt!: string;
}

@ObjectType()
class AdminHostDetail {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field({ nullable: true }) email?: string;
  @Field() createdAt!: string;
  @Field() badgeLevel!: string;
  @Field(() => Int) approvedCount!: number;
  @Field(() => Int) totalViews!: number;
  @Field(() => [Listing]) upcomingEvents!: Listing[];
  @Field(() => [Listing]) pastEvents!: Listing[];
}

@ObjectType()
class HostPublicProfile {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field() createdAt!: string;
  @Field() badgeLevel!: string;
  @Field(() => Int) approvedCount!: number;
  @Field(() => [Listing]) upcomingEvents!: Listing[];
  @Field(() => [Listing]) pastEvents!: Listing[];
  @Field(() => [EventExperience]) pastExperiences!: EventExperience[];
}

@InputType()
class ChatMessageInput {
  @Field() role!: string;
  @Field() content!: string;
}

function computeBadgeLevel(count: number): string {
  if (count >= 30) return 'DIAMOND';
  if (count >= 15) return 'GOLD';
  if (count >= 5)  return 'SILVER';
  if (count >= 1)  return 'BRONZE';
  return 'NONE';
}

function computeLimit(role: string, tier: string): number {
  if (role === 'ADMIN') return 9999;
  if (role === 'HOST')  return 50;
  if (tier === 'PREMIUM') return 30;
  return 5;
}

@ObjectType()
class HostApplicationRecord {
  @Field() id!: string;
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() hostTypes!: string;
  @Field({ nullable: true }) businessName?: string;
  @Field({ nullable: true }) businessAddress?: string;
  @Field({ nullable: true }) businessLat?: number;
  @Field({ nullable: true }) businessLng?: number;
  @Field({ nullable: true }) phoneNumber?: string;
  @Field({ nullable: true }) licenseNumber?: string;
  @Field({ nullable: true }) idType?: string;
  @Field({ nullable: true }) idDocumentUrl?: string;
  @Field({ nullable: true }) businessDocUrl?: string;
  @Field({ nullable: true }) healthCertUrl?: string;
  @Field({ nullable: true }) licenseDocUrl?: string;
  @Field({ nullable: true }) bankDocUrl?: string;
  @Field() status!: string;
  @Field() submittedAt!: string;
  @Field({ nullable: true }) reviewedAt?: string;
  @Field({ nullable: true }) reviewNote?: string;
}

@InputType()
class SubmitHostApplicationInput {
  @Field() hostTypes!: string;
  @Field({ nullable: true }) businessName?: string;
  @Field({ nullable: true }) businessAddress?: string;
  @Field({ nullable: true }) businessLat?: number;
  @Field({ nullable: true }) businessLng?: number;
  @Field({ nullable: true }) phoneNumber?: string;
  @Field({ nullable: true }) licenseNumber?: string;
  @Field({ nullable: true }) idType?: string;
  @Field({ nullable: true }) idDocumentUrl?: string;
  @Field({ nullable: true }) businessDocUrl?: string;
  @Field({ nullable: true }) healthCertUrl?: string;
  @Field({ nullable: true }) licenseDocUrl?: string;
  @Field({ nullable: true }) bankDocUrl?: string;
}

@Resolver(() => UserRecord)
export class MeResolver {
  @UseGuards(AuthGuard)
  @Query(() => Me)
  async me(@CurrentUser() user: admin.auth.DecodedIdToken) {
    await upsertUser(user.uid, user.email);
    const [profile, usage] = await Promise.all([
      getUser(user.uid) as Promise<UserProfile & { displayName?: string; avatarUrl?: string; subscriptionTier?: string; isPremium?: boolean; isSuspended?: boolean; emailVerifiedAt?: string; phoneVerifiedAt?: string; phone?: string; subscriptionExpiresAt?: string }>,
      getAiUsage(user.uid).catch(() => null),
    ]);
    const tier = profile.subscriptionTier ?? 'FREE';
    const limit = computeLimit(profile.role, tier);
    const used = usage?.requestsUsed ?? 0;
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      subscriptionTier: tier,
      isPremium: profile.isPremium || profile.role === 'HOST' || profile.role === 'ADMIN',
      isSuspended: profile.isSuspended ?? false,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      phone: profile.phone ?? null,
      emailVerifiedAt: profile.emailVerifiedAt ?? null,
      phoneVerifiedAt: profile.phoneVerifiedAt ?? null,
      subscriptionExpiresAt: profile.subscriptionExpiresAt ?? null,
      aiUsage: {
        requestsUsed: used,
        monthlyLimit: limit,
        remaining: Math.max(0, limit - used),
        resetAt: usage?.resetAt ?? new Date().toISOString(),
      },
    };
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Me)
  async updateProfile(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('displayName', { nullable: true }) displayName?: string,
    @Args('avatarUrl', { nullable: true }) avatarUrl?: string,
  ) {
    await updateUserProfile(user.uid, { displayName, avatarUrl });
    const [profile, usage] = await Promise.all([
      getUser(user.uid) as Promise<UserProfile & { displayName?: string; avatarUrl?: string; subscriptionTier?: string; isPremium?: boolean }>,
      getAiUsage(user.uid).catch(() => null),
    ]);
    const tier = profile.subscriptionTier ?? 'FREE';
    const limit = computeLimit(profile.role, tier);
    const used = usage?.requestsUsed ?? 0;
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      subscriptionTier: tier,
      isPremium: profile.isPremium || profile.role === 'HOST' || profile.role === 'ADMIN',
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      aiUsage: {
        requestsUsed: used,
        monthlyLimit: limit,
        remaining: Math.max(0, limit - used),
        resetAt: usage?.resetAt ?? new Date().toISOString(),
      },
    };
  }

  // ── Saved Listings ──────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async savedListings(@CurrentUser() user: admin.auth.DecodedIdToken) {
    const saved = (await getSavedListings(user.uid)) as { listingId: string }[];
    if (!saved.length) return [];
    const results = await Promise.all(
      saved.map(({ listingId }) => getListing(listingId).catch(() => null)),
    );
    return results.filter(Boolean);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async saveListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
  ) {
    await addSavedListing(user.uid, listingId);
    // Trigger in-app notification (best effort)
    void getListing(listingId).then((l: any) => {
      createNotification(user.uid, '❤️ Listing Saved', `"${l?.title ?? 'A listing'}" was added to your saved list.`, 'SAVE');
    }).catch(() => {});
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async unsaveListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
  ) {
    await removeSavedListing(user.uid, listingId);
    return true;
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [AppNotification])
  async myNotifications(@CurrentUser() user: admin.auth.DecodedIdToken) {
    try {
      return (await getNotifications(user.uid)) as AppNotification[];
    } catch {
      return [];
    }
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async markNotificationRead(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('notificationId', { type: () => ID }) notificationId: string,
  ) {
    await markNotificationRead(user.uid, notificationId);
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async markAllNotificationsRead(@CurrentUser() user: admin.auth.DecodedIdToken) {
    await markAllNotificationsRead(user.uid);
    return true;
  }

  // ── Saved Chats ────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [SavedChat])
  async savedChats(@CurrentUser() user: admin.auth.DecodedIdToken) {
    return (await getSavedChats(user.uid)) as SavedChat[];
  }

  @UseGuards(AuthGuard)
  @Mutation(() => SavedChat)
  async saveChat(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('name') name: string,
    @Args('messages') messages: string,
  ) {
    return (await saveChat(user.uid, name, messages)) as SavedChat;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteSavedChat(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('chatId', { type: () => ID }) chatId: string,
  ) {
    await deleteSavedChat(user.uid, chatId);
    return true;
  }

  // ── Device Token ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async registerDeviceToken(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('token') token: string,
  ) {
    try {
      const axios = (await import('axios')).default;
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
      await axios.post(`${notifUrl}/devices/register`, { uid: user.uid, token });
    } catch {
      // best effort
    }
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async updateUserLocation(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('lat', { type: () => Float }) lat: number,
    @Args('lng', { type: () => Float }) lng: number,
  ) {
    await updateUserLocation(user.uid, lat, lng);
    return true;
  }

  // ── Feature Flags ────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [FeatureFlagType])
  async featureFlags() {
    return getFeatureFlags();
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminUpdateFeatureFlag(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('key') key: string,
    @Args('enabledForTravelers', { nullable: true, type: () => Boolean }) enabledForTravelers?: boolean,
    @Args('enabledForHosts', { nullable: true, type: () => Boolean }) enabledForHosts?: boolean,
  ) {
    await updateFeatureFlagClient(key, { enabledForTravelers, enabledForHosts }, user.uid);
    return true;
  }

  // ── Admin User Phone ──────────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminUpdateUserPhone(
    @Args('firebaseUid') firebaseUid: string,
    @Args('phone') phone: string,
  ) {
    await updateUserPhone(firebaseUid, phone);
    return true;
  }

  // ── AI Planner ───────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => PlanResult)
  async planItinerary(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('prompt') prompt: string,
    @Args('history', { type: () => [ChatMessageInput], nullable: true, defaultValue: [] })
    history: ChatMessageInput[],
    @Args('listingId', { nullable: true, type: () => ID }) listingId?: string,
  ): Promise<{ text: string; listings: PlanListing[] }> {
    // Quota enforcement
    const usage = await getAiUsage(user.uid).catch(() => null);
    const role = (usage?.role ?? 'TRAVELER');
    const tier = (usage?.subscriptionTier ?? 'FREE');
    const limit = computeLimit(role, tier);
    const used = usage?.requestsUsed ?? 0;
    if (used >= limit) {
      throw new Error(
        `QUOTA_EXCEEDED: You have used ${used}/${limit} AI requests this month. ` +
        (tier === 'FREE' ? 'Upgrade to Premium for more requests.' : 'Your monthly quota will reset next month.'),
      );
    }

    // Fetch the specific listing from the map card (becomes primary context)
    let primaryListing: any = null;
    if (listingId) {
      try { primaryListing = await getListing(listingId); } catch {}
    }

    // Category keyword → enum value map for supplementary category search
    const CATEGORY_KEYWORDS: Record<string, string> = {
      beach: 'BEACH', coastal: 'BEACH', shore: 'BEACH',
      culture: 'CULTURE', cultural: 'CULTURE',
      heritage: 'HERITAGE', temple: 'HERITAGE', history: 'HERITAGE',
      adventure: 'ADVENTURE', hike: 'ADVENTURE', trek: 'ADVENTURE',
      food: 'FOOD', cuisine: 'FOOD', dining: 'FOOD',
      wellness: 'WELLNESS', spa: 'WELLNESS', yoga: 'WELLNESS',
      nature: 'NATURE', wildlife: 'NATURE', safari: 'NATURE',
      party: 'BEACH', festival: 'CULTURE',
    };
    const promptLower = prompt.toLowerCase();
    const detectedCategories = new Set<string>();
    for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
      if (promptLower.includes(kw)) detectedCategories.add(cat);
    }

    // Run text search + one category search per detected category in parallel
    let searchResults: any[] = [];
    try {
      const searches = [
        searchListings({ q: prompt.slice(0, 150), limit: 5, includePremium: true }),
        ...[...detectedCategories].map((cat) =>
          searchListings({ category: cat, limit: 5, includePremium: true }),
        ),
      ];
      const allResults = await Promise.all(searches.map((p) => p.catch(() => null)));
      const seen = new Set<string>();
      for (const result of allResults) {
        for (const l of (result as any)?.listings ?? []) {
          if (!seen.has(l.id)) { seen.add(l.id); searchResults.push(l); }
        }
      }
    } catch {}

    // Build context — primary listing first, then search results (excluding primary)
    const listingsContext = [
      ...(primaryListing ? [{ ...primaryListing, isPrimary: true }] : []),
      ...searchResults
        .filter((l: any) => l.id !== primaryListing?.id)
        .map((l: any) => ({ ...l, isPrimary: false })),
    ];

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: prompt },
    ];
    const result = await aiPlanItinerary(messages, listingsContext.length ? listingsContext : undefined);
    // Increment usage counter after successful AI call (fire-and-forget)
    void incrementAiUsage(user.uid, result.tokensUsed ?? 0);
    return result;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminUpdateUserSubscription(
    @Args('targetFirebaseUid') targetFirebaseUid: string,
    @Args('tier') tier: string,
  ): Promise<boolean> {
    await updateSubscription(targetFirebaseUid, tier as 'FREE' | 'PREMIUM');
    return true;
  }

  // ── Itinerary ────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [ItineraryItem])
  async myItinerary(@CurrentUser() user: admin.auth.DecodedIdToken) {
    const items = (await getItinerary(user.uid)) as any[];
    return Promise.all(
      items.map(async (item) => {
        try {
          const listing = (await getListing(item.listingId)) as any;
          return {
            ...item,
            listingTitle: listing?.title ?? null,
            listingImageUrl: listing?.imageUrl ?? null,
            listingType: listing?.type ?? null,
            listingPlaceName: listing?.placeName ?? null,
          };
        } catch {
          return { ...item, listingTitle: null, listingImageUrl: null, listingType: null, listingPlaceName: null };
        }
      }),
    );
  }

  @UseGuards(AuthGuard)
  @Mutation(() => ItineraryItem)
  async addToItinerary(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
    @Args('plannedDate') plannedDate: string,
    @Args('note', { nullable: true }) note?: string,
  ) {
    const item = (await addToItinerary(user.uid, listingId, plannedDate, note)) as ItineraryItem;
    // Trigger in-app notification (best effort)
    void getListing(listingId).then((l: any) => {
      const dateStr = new Date(plannedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      createNotification(user.uid, '📅 Added to Itinerary', `"${l?.title ?? 'A listing'}" added to your plan for ${dateStr}.`, 'ITINERARY');
    }).catch(() => {});
    return item;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => ItineraryItem)
  async updateItineraryNote(
    @Args('itemId', { type: () => ID }) itemId: string,
    @Args('note') note: string,
  ) {
    return (await updateItineraryNote(itemId, note)) as ItineraryItem;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async removeFromItinerary(@Args('itemId', { type: () => ID }) itemId: string) {
    await removeFromItinerary(itemId);
    return true;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [UserRecord])
  async adminAllUsers() {
    return (await adminAllUsers()) as UserRecord[];
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => UserStats)
  async adminUserStats() {
    return (await adminUserStats()) as UserStats;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => UserRecord)
  async adminChangeUserRole(
    @CurrentUser() adminUser: admin.auth.DecodedIdToken,
    @Args('id') id: string,
    @Args('role') role: string,
  ) {
    const result = (await adminChangeUserRole(id, role)) as UserRecord;
    void addAuditLog('CHANGE_USER_ROLE', adminUser.uid, id, `Changed role to ${role}`);
    return result;
  }

  // ── Host Applications ────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => HostApplicationRecord, { nullable: true })
  async myHostApplication(@CurrentUser() user: admin.auth.DecodedIdToken) {
    try {
      return (await getHostApplication(user.uid)) as HostApplicationRecord | null;
    } catch {
      return null;
    }
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async submitHostApplication(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('input') input: SubmitHostApplicationInput,
  ): Promise<boolean> {
    await submitHostApplication({ firebaseUid: user.uid, email: user.email, ...input });
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [HostApplicationRecord])
  async adminPendingHostApplications(): Promise<HostApplicationRecord[]> {
    return (await adminPendingHostApplications()) as HostApplicationRecord[];
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminReviewHostApplication(
    @CurrentUser() adminUser: admin.auth.DecodedIdToken,
    @Args('firebaseUid') firebaseUid: string,
    @Args('approve') approve: boolean,
    @Args('reviewNote', { nullable: true }) reviewNote?: string,
  ): Promise<boolean> {
    await adminReviewHostApplication(firebaseUid, approve, reviewNote);
    if (approve) {
      const allUsers = (await adminAllUsers()) as Array<{ id: string; firebaseUid: string }>;
      const target = allUsers.find((u) => u.firebaseUid === firebaseUid);
      if (target) {
        await adminChangeUserRole(target.id, 'HOST');
        void addAuditLog('ACTIVATE_HOST', adminUser.uid, target.id, `Activated host account for ${firebaseUid}`);
        // Copy phone from application to user profile for emergency contact access
        void getHostApplication(firebaseUid).then((app) => {
          if (app?.phoneNumber) updateUserPhone(firebaseUid, app.phoneNumber);
        });
      }
    }
    return true;
  }

  // ── Badge resolve fields ─────────────────────────────────────────────────────

  @ResolveField(() => String, { nullable: true })
  async badgeLevel(@Parent() user: UserRecord): Promise<string> {
    if (user.role !== 'HOST' && user.role !== 'ADMIN') return 'NONE';
    const count = await approvedCountByHost(user.firebaseUid);
    return computeBadgeLevel(count);
  }

  @ResolveField(() => Int, { nullable: true })
  async approvedCount(@Parent() user: UserRecord): Promise<number> {
    if (user.role !== 'HOST' && user.role !== 'ADMIN') return 0;
    return approvedCountByHost(user.firebaseUid);
  }

  // ── Delete Account ────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteMyAccount(@CurrentUser() user: admin.auth.DecodedIdToken): Promise<boolean> {
    await deleteUserAccount(user.uid);
    await admin.auth().deleteUser(user.uid).catch(() => {});
    return true;
  }

  // ── F2: Premium Verification ─────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async markEmailVerified(@CurrentUser() user: admin.auth.DecodedIdToken): Promise<boolean> {
    const firebaseUser = await admin.auth().getUser(user.uid);
    if (!firebaseUser.emailVerified) throw new Error('Email is not verified yet. Please check your inbox.');
    await markEmailVerifiedClient(user.uid);
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async markPhoneVerified(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('phone') phone: string,
  ): Promise<boolean> {
    await markPhoneVerifiedClient(user.uid, phone);
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Me)
  async selfUpgradeToPremium(@CurrentUser() user: admin.auth.DecodedIdToken) {
    const result = (await selfUpgradePremiumClient(user.uid)) as any;
    const [profile, usage] = await Promise.all([
      getUser(user.uid) as Promise<any>,
      getAiUsage(user.uid).catch(() => null),
    ]);
    const tier = profile.subscriptionTier ?? 'PREMIUM';
    const limit = computeLimit(profile.role, tier);
    const used = usage?.requestsUsed ?? 0;
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      subscriptionTier: tier,
      isPremium: true,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      phone: profile.phone ?? null,
      emailVerifiedAt: result.emailVerifiedAt ?? null,
      phoneVerifiedAt: result.phoneVerifiedAt ?? null,
      aiUsage: { requestsUsed: used, monthlyLimit: limit, remaining: Math.max(0, limit - used), resetAt: usage?.resetAt ?? new Date().toISOString() },
    };
  }

  // ── F4: "I'm Going" ──────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => Boolean)
  async isGoing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
  ): Promise<boolean> {
    const result = await checkGoing(user.uid, listingId);
    return result.isGoing;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => ItineraryItem)
  async markGoing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
  ) {
    const existing = await checkGoing(user.uid, listingId);
    if (existing.isGoing && existing.itemId) {
      const items = (await getItinerary(user.uid)) as any[];
      const item = items.find((i: any) => i.id === existing.itemId);
      if (item) return { ...item, listingTitle: null, listingImageUrl: null, listingType: null, listingPlaceName: null };
    }
    const listing = (await getListing(listingId)) as any;
    const plannedDate = listing?.startDateTime ?? new Date().toISOString();
    const item = (await addToItinerary(user.uid, listingId, plannedDate, undefined, true)) as any;
    try {
      const l = listing as any;
      const dateStr = new Date(plannedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      void createNotification(user.uid, '🎫 Marked as Going', `You\'re going to "${l?.title ?? 'an event'}" on ${dateStr}.`, 'ITINERARY');
    } catch {}
    return { ...item, listingTitle: listing?.title ?? null, listingImageUrl: listing?.imageUrl ?? null, listingType: listing?.type ?? null, listingPlaceName: listing?.placeName ?? null };
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async unmarkGoing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
  ): Promise<boolean> {
    const existing = await checkGoing(user.uid, listingId);
    if (existing.isGoing && existing.itemId) {
      await removeFromItinerary(existing.itemId);
    }
    return true;
  }

  // ── F5: Experience Sharing ────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => EventExperience)
  async shareExperience(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
    @Args('rating', { type: () => Int }) rating: number,
    @Args('text') text: string,
    @Args('imageUrls', { type: () => [String], nullable: true, defaultValue: [] }) imageUrls: string[],
  ) {
    return (await shareExperience(user.uid, listingId, rating, text, imageUrls)) as EventExperience;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteMyExperience(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await deleteExperience(user.uid, id);
    return true;
  }

  @UseGuards(AuthGuard)
  @Query(() => [EventExperience])
  async myExperiences(@CurrentUser() user: admin.auth.DecodedIdToken) {
    return (await getMyExperiences(user.uid)) as EventExperience[];
  }

  @Query(() => [EventExperience])
  async listingExperiences(@Args('listingId', { type: () => ID }) listingId: string) {
    return (await getListingExperiences(listingId)) as EventExperience[];
  }

  // ── F3: Admin Host Detail ─────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => AdminHostDetail)
  async adminHostDetail(@Args('firebaseUid') firebaseUid: string): Promise<AdminHostDetail> {
    const [userProfile, listings, approvedCount] = await Promise.all([
      getHostProfile(firebaseUid) as Promise<any>,
      listingsByHost(firebaseUid) as Promise<any[]>,
      approvedCountByHost(firebaseUid),
    ]);
    const now = new Date();
    const isPastEvent = (l: any) => {
      if (l.type !== 'EVENT' || !l.startDateTime) return false;
      const dt = new Date(l.startDateTime);
      return !isNaN(dt.getTime()) && dt < now;
    };
    const upcomingEvents = listings.filter((l: any) => !isPastEvent(l));
    const pastEvents = listings.filter((l: any) => isPastEvent(l));
    const totalViews = listings.reduce((sum: number, l: any) => sum + (l.viewCount ?? 0), 0);
    return {
      firebaseUid: userProfile.firebaseUid,
      displayName: userProfile.displayName ?? null,
      avatarUrl: userProfile.avatarUrl ?? null,
      email: userProfile.email ?? null,
      createdAt: userProfile.createdAt,
      badgeLevel: computeBadgeLevel(approvedCount),
      approvedCount,
      totalViews,
      upcomingEvents,
      pastEvents,
    };
  }

  // ── F6: Host Discovery ────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [HostCard])
  async allHosts(
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
  ): Promise<HostCard[]> {
    const hosts = (await getAllHosts(limit, offset)) as any[];
    return Promise.all(
      hosts.map(async (h: any) => {
        const count = await approvedCountByHost(h.firebaseUid);
        return { ...h, badgeLevel: computeBadgeLevel(count), approvedCount: count };
      }),
    );
  }

  @UseGuards(AuthGuard)
  @Query(() => HostPublicProfile)
  async hostPublicProfile(@Args('firebaseUid') firebaseUid: string): Promise<HostPublicProfile> {
    const [userProfile, listings, approvedCount] = await Promise.all([
      getHostProfile(firebaseUid) as Promise<any>,
      listingsByHost(firebaseUid) as Promise<any[]>,
      approvedCountByHost(firebaseUid),
    ]);
    const approvedListings = listings.filter((l: any) => l.status === 'APPROVED');
    const now = new Date();
    const isPastEvent = (l: any) => {
      if (l.type !== 'EVENT' || !l.startDateTime) return false;
      const dt = new Date(l.startDateTime);
      return !isNaN(dt.getTime()) && dt < now;
    };
    const upcomingEvents = approvedListings.filter((l: any) => !isPastEvent(l));
    const pastEvents = approvedListings.filter((l: any) => isPastEvent(l));
    const experiencesByListing = await Promise.all(
      pastEvents.map((l: any) => getListingExperiences(l.id).catch(() => [])),
    );
    const pastExperiences = (experiencesByListing.flat() as any[]).filter(Boolean);
    return {
      firebaseUid: userProfile.firebaseUid,
      displayName: userProfile.displayName ?? null,
      avatarUrl: userProfile.avatarUrl ?? null,
      createdAt: userProfile.createdAt,
      badgeLevel: computeBadgeLevel(approvedCount),
      approvedCount,
      upcomingEvents,
      pastEvents,
      pastExperiences,
    };
  }

  // ── P3.1: Account Suspension ──────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminSuspendUser(
    @CurrentUser() adminUser: admin.auth.DecodedIdToken,
    @Args('firebaseUid') firebaseUid: string,
  ): Promise<boolean> {
    await suspendUser(firebaseUid);
    void addAuditLog('SUSPEND_USER', adminUser.uid, firebaseUid, `Suspended user account`);
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminActivateUser(
    @CurrentUser() adminUser: admin.auth.DecodedIdToken,
    @Args('firebaseUid') firebaseUid: string,
  ): Promise<boolean> {
    await activateUser(firebaseUid);
    void addAuditLog('ACTIVATE_USER', adminUser.uid, firebaseUid, `Activated user account`);
    return true;
  }

  // ── P3.2: Suspend Listing ─────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminSuspendListing(
    @CurrentUser() adminUser: admin.auth.DecodedIdToken,
    @Args('id') id: string,
  ): Promise<boolean> {
    await suspendListing(id, adminUser.uid);
    return true;
  }

  // ── P3.4: Admin Announcements ─────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Int)
  async adminBroadcastAnnouncement(
    @Args('title') title: string,
    @Args('body') body: string,
  ): Promise<number> {
    const notifServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
    const [dbResult, tokens] = await Promise.all([
      broadcastNotification(title, body),
      getAllFcmTokens(),
    ]);
    // Fire-and-forget push to all FCM tokens
    if (tokens.length > 0) {
      const axios = (await import('axios')).default;
      void Promise.allSettled(
        tokens.map((t) => axios.post(`${notifServiceUrl}/notify`, { uid: t.firebaseUid, title, body }).catch(() => {}))
      );
    }
    return dbResult.sent;
  }

  // ── P4.2: Subscription History ────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [SubscriptionEventType])
  async adminSubscriptionHistory(@Args('firebaseUid') firebaseUid: string) {
    return (await getSubscriptionHistory(firebaseUid)) as SubscriptionEventType[];
  }
}
