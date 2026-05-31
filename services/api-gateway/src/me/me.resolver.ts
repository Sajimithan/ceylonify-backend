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
} from '../identity/identity.client';
import { getListing, addAuditLog, searchListings, approvedCountByHost } from '../listings/listings.client';
import { planItinerary as aiPlanItinerary } from '../ai/ai.service';
import { Listing } from '../listings/listings.resolver';

@ObjectType()
class Me {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() role!: string;
  @Field() isPremium!: boolean;
  @Field({ nullable: true }) displayName?: string;
  @Field({ nullable: true }) avatarUrl?: string;
}

@ObjectType()
class AppNotification {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() body!: string;
  @Field() type!: string;
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
  @Field({ nullable: true }) listingTitle?: string;
  @Field({ nullable: true }) listingImageUrl?: string;
  @Field({ nullable: true }) listingType?: string;
  @Field({ nullable: true }) listingPlaceName?: string;
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
    const profile = (await getUser(user.uid)) as UserProfile & { displayName?: string; avatarUrl?: string };
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      isPremium: profile.role === 'HOST' || profile.role === 'ADMIN',
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
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
    const profile = (await getUser(user.uid)) as UserProfile & { displayName?: string; avatarUrl?: string };
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      isPremium: profile.role === 'HOST' || profile.role === 'ADMIN',
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
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
    return (await getNotifications(user.uid)) as AppNotification[];
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

  // ── AI Planner ───────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => PlanResult)
  async planItinerary(
    @Args('prompt') prompt: string,
    @Args('history', { type: () => [ChatMessageInput], nullable: true, defaultValue: [] })
    history: ChatMessageInput[],
    @Args('listingId', { nullable: true, type: () => ID }) listingId?: string,
  ): Promise<{ text: string; listings: PlanListing[] }> {
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
    return aiPlanItinerary(messages, listingsContext.length ? listingsContext : undefined);
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
}
