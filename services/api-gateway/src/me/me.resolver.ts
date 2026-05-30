import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  ObjectType,
  Field,
  Mutation,
  Args,
  ID,
  InputType,
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
} from '../identity/identity.client';
import { getListing, addAuditLog, searchListings } from '../listings/listings.client';
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
class UserRecord {
  @Field() id!: string;
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() role!: string;
  @Field() createdAt!: string;
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

@Resolver()
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

  // ── AI Planner ───────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => String)
  async planItinerary(
    @Args('prompt') prompt: string,
    @Args('history', { type: () => [ChatMessageInput], nullable: true, defaultValue: [] })
    history: ChatMessageInput[],
    @Args('listingId', { nullable: true }) listingId?: string,
  ): Promise<string> {
    // Fetch the specific listing from the map card (becomes primary context)
    let primaryListing: any = null;
    if (listingId) {
      try { primaryListing = await getListing(listingId); } catch {}
    }

    // Search our DB for listings relevant to the user's prompt
    let searchResults: any[] = [];
    try {
      const result = (await searchListings({ q: prompt.slice(0, 150), limit: 5, includePremium: true })) as any;
      searchResults = result?.listings ?? [];
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
}
