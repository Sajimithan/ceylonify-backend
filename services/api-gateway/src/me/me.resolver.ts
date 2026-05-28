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
} from '../identity/identity.client';
import { getListing, addAuditLog } from '../listings/listings.client';
import { planItinerary as aiPlanItinerary } from '../ai/ai.service';
import { Listing } from '../listings/listings.resolver';

@ObjectType()
class Me {
  @Field() firebaseUid!: string;
  @Field({ nullable: true }) email?: string;
  @Field() role!: string;
  @Field() isPremium!: boolean;
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
    const profile = (await getUser(user.uid)) as UserProfile;
    return {
      firebaseUid: profile.firebaseUid,
      email: profile.email ?? null,
      role: profile.role,
      isPremium: profile.role === 'HOST' || profile.role === 'ADMIN',
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
  ): Promise<string> {
    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: prompt },
    ];
    return aiPlanItinerary(messages);
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
    return (await addToItinerary(user.uid, listingId, plannedDate, note)) as ItineraryItem;
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
