import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  Query,
  Resolver,
  Mutation,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { enhanceDescription, moderateListing, aiReviewContent } from '../ai/ai.service';
import { getUser, createNotification, getAdminUsers, getNearbyTravelers } from '../identity/identity.client';
import axios from 'axios';

async function notifyUsers(
  notifUrl: string,
  uids: string[],
  title: string,
  body: string,
) {
  await Promise.allSettled(
    uids.map((uid) => axios.post(`${notifUrl}/notify`, { uid, title, body }).catch(() => {})),
  );
}

const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

import {
  createListing,
  updateListing,
  deleteListing,
  myListings,
  pendingListings,
  approveListing,
  rejectListing,
  feed,
  getListing,
  adminAllListings,
  adminListingStats,
  searchListings,
  nearbyListings,
  reportListing,
  adminGetReports,
  adminDismissReport,
  adminActionReport,
  adminGetAuditLogs,
  approvedCountByHost,
} from './listings.client';

// ── ObjectTypes ──────────────────────────────────────────────────────────────

@ObjectType()
export class Listing {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() description!: string;
  @Field() type!: string;

  @Field({ nullable: true }) category?: string;
  @Field({ nullable: true }) price?: string;
  @Field({ nullable: true }) placeName?: string;
  @Field({ nullable: true }) mapLink?: string;
  @Field({ nullable: true }) imageUrl?: string;

  @Field() status!: string;
  @Field() createdAt!: string;

  @Field({ nullable: true }) lat?: number;
  @Field({ nullable: true }) lng?: number;
  @Field({ nullable: true }) createdBy?: string;
  @Field({ nullable: true }) rejectionReason?: string;

  @Field({ nullable: true }) startDateTime?: string;
  @Field() isPremium!: boolean;
  @Field(() => Int) viewCount!: number;
}

@ObjectType()
export class ListingStats {
  @Field() total!: number;
  @Field() pending!: number;
  @Field() approved!: number;
  @Field() rejected!: number;
}

@ObjectType()
class SearchResult {
  @Field(() => [Listing]) listings!: Listing[];
  @Field(() => Int) total!: number;
}

@ObjectType()
class ListingReport {
  @Field(() => ID) id!: string;
  @Field() listingId!: string;
  @Field() reporterFirebaseUid!: string;
  @Field() reason!: string;
  @Field({ nullable: true }) comment?: string;
  @Field(() => [String], { nullable: true }) imageUrls?: string[];
  @Field() status!: string;
  @Field() createdAt!: string;
}

@ObjectType()
class AuditLogEntry {
  @Field(() => ID) id!: string;
  @Field() action!: string;
  @Field() adminFirebaseUid!: string;
  @Field({ nullable: true }) resourceId?: string;
  @Field({ nullable: true }) details?: string;
  @Field() createdAt!: string;
}

@ObjectType()
class AIModerationResult {
  @Field() safe!: boolean;
  @Field() confidence!: number;
  @Field(() => [String]) flags!: string[];
  @Field() summary!: string;
}

@ObjectType()
class HostBadgeResult {
  @Field() approvedCount!: number;
  @Field() badgeLevel!: string;
}

function computeBadge(count: number): string {
  if (count >= 30) return 'DIAMOND';
  if (count >= 15) return 'GOLD';
  if (count >= 5)  return 'SILVER';
  if (count >= 1)  return 'BRONZE';
  return 'NONE';
}

// ── InputTypes ───────────────────────────────────────────────────────────────

@InputType()
class CreateListingInput {
  @Field() title!: string;
  @Field() description!: string;
  @Field() type!: string;

  @Field({ nullable: true }) category?: string;
  @Field({ nullable: true }) price?: number;
  @Field({ nullable: true }) startDateTime?: string;
  @Field({ nullable: true }) placeName?: string;
  @Field({ nullable: true }) mapLink?: string;
  @Field({ nullable: true }) imageUrl?: string;

  @Field() lat!: number;
  @Field() lng!: number;
  @Field({ nullable: true }) isPremium?: boolean;
}

@InputType()
class UpdateListingInput {
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) type?: string;

  @Field({ nullable: true }) category?: string;
  @Field({ nullable: true }) price?: number;
  @Field({ nullable: true }) startDateTime?: string;
  @Field({ nullable: true }) placeName?: string;
  @Field({ nullable: true }) mapLink?: string;
  @Field({ nullable: true }) imageUrl?: string;

  @Field({ nullable: true }) lat?: number;
  @Field({ nullable: true }) lng?: number;
  @Field({ nullable: true }) isPremium?: boolean;
}

// ── Entity interface (for field resolvers) ───────────────────────────────────

interface ListingEntity {
  id?: string;
  hostFirebaseUid?: string;
  rejectReason?: string;
  isPremium?: boolean;
  viewCount?: number;
  location?: { coordinates: [number, number] };
}

// ── Resolver ─────────────────────────────────────────────────────────────────

@Resolver(() => Listing)
export class ListingsResolver {
  // ── Host operations ───────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async createListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('input') input: CreateListingInput,
  ) {
    const result = (await createListing(user.uid, input)) as Listing & { placeName?: string };
    // Fire-and-forget AI moderation — never blocks creation
    void moderateListing(input.title, input.description).then((r) => {
      if (r.flagged) {
        console.warn(
          `[AI] Listing ${result.id} flagged for: ${r.reason ?? 'unknown'}`,
        );
      }
    });
    // Fire-and-forget: notify all admins about new submission
    void (async () => {
      try {
        const admins = await getAdminUsers();
        const uids = admins.map((a) => a.firebaseUid);
        const title = 'New listing pending review';
        const body = `"${input.title}" was submitted and needs approval.`;
        await notifyUsers(NOTIF_URL, uids, title, body);
        await Promise.allSettled(uids.map((uid) => createNotification(uid, title, body, 'LISTING_SUBMITTED')));
      } catch { /* silent */ }
    })();
    // Fire-and-forget: notify nearby travelers for EVENT type
    if (input.type === 'EVENT') {
      void (async () => {
        try {
          const travelers = await getNearbyTravelers(input.lat, input.lng, 50);
          const uids = travelers.map((t) => t.firebaseUid);
          const title = 'New event near you';
          const body = `${input.title}${input.placeName ? ` at ${input.placeName}` : ''}`;
          await notifyUsers(NOTIF_URL, uids, title, body);
          await Promise.allSettled(uids.map((uid) => createNotification(uid, title, body, 'NEW_EVENT_NEARBY')));
        } catch { /* silent */ }
      })();
    }
    return result;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async updateListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('id') id: string,
    @Args('input') input: UpdateListingInput,
  ) {
    return (await updateListing(user.uid, id, input)) as Listing;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async deleteListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('id') id: string,
  ) {
    return (await deleteListing(user.uid, id)) as Listing;
  }

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async myListings(@CurrentUser() user: admin.auth.DecodedIdToken) {
    return (await myListings(user.uid)) as Listing[];
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async reportListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('listingId', { type: () => ID }) listingId: string,
    @Args('reason') reason: string,
    @Args('comment', { nullable: true }) comment?: string,
    @Args('imageUrls', { type: () => [String], nullable: true }) imageUrls?: string[],
  ) {
    await reportListing(user.uid, listingId, reason, comment, imageUrls);
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [ListingReport])
  async adminReports() {
    const raw = (await adminGetReports()) as (ListingReport & { imageUrls?: string })[];
    return raw.map((r) => ({
      ...r,
      imageUrls: r.imageUrls ? (JSON.parse(r.imageUrls) as string[]) : [],
    }));
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminDismissReport(@Args('reportId', { type: () => ID }) reportId: string) {
    await adminDismissReport(reportId);
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminActionReport(@Args('reportId', { type: () => ID }) reportId: string) {
    await adminActionReport(reportId);
    return true;
  }

  // ── AI ────────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Mutation(() => String)
  async enhanceDescription(@Args('text') text: string) {
    return enhanceDescription(text);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => AIModerationResult)
  async aiReviewListing(
    @Args('title') title: string,
    @Args('description') description: string,
  ): Promise<AIModerationResult> {
    return aiReviewContent(title, description);
  }

  @Query(() => HostBadgeResult)
  async hostBadge(@Args('firebaseUid') firebaseUid: string): Promise<HostBadgeResult> {
    const count = await approvedCountByHost(firebaseUid);
    return { approvedCount: count, badgeLevel: computeBadge(count) };
  }

  // ── Search / Browse ───────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => SearchResult)
  async searchListings(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('q', { nullable: true }) q?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('hidePastEvents', { nullable: true, type: () => Boolean }) hidePastEvents?: boolean,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
    @Args('startAfter', { nullable: true }) startAfter?: string,
    @Args('startBefore', { nullable: true }) startBefore?: string,
  ) {
    const profile = (await getUser(user.uid)) as { role: string } | null;
    const isPremium = profile?.role === 'HOST' || profile?.role === 'ADMIN';
    return (await searchListings({ q, category, type, limit, offset, includePremium: isPremium, startAfter, startBefore, hidePastEvents })) as SearchResult;
  }

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async nearbyListings(
    @Args('lat', { type: () => Number }) lat: number,
    @Args('lng', { type: () => Number }) lng: number,
    @Args('radiusKm', { nullable: true, type: () => Number }) radiusKm?: number,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
  ) {
    return (await nearbyListings({ lat, lng, radiusKm, limit })) as Listing[];
  }

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async relatedListings(
    @Args('listingId') listingId: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
  ) {
    const listing = (await getListing(listingId)) as ListingEntity & { category?: string };
    if (!listing?.category) return [];
    const result = (await searchListings({
      category: listing.category,
      limit: (limit ?? 4) + 1,
      offset: 0,
    })) as SearchResult;
    return result.listings.filter((l) => l.id !== listingId).slice(0, limit ?? 4);
  }

  // ── Public ────────────────────────────────────────────────────────────────

  @Query(() => [Listing])
  async feed() {
    return (await feed()) as Listing[];
  }

  @UseGuards(AuthGuard)
  @Query(() => Listing)
  async listing(@Args('id') id: string) {
    return (await getListing(id)) as Listing;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [Listing])
  async adminAllListings() {
    return (await adminAllListings()) as Listing[];
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => ListingStats)
  async adminListingStats() {
    return (await adminListingStats()) as ListingStats;
  }

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async pendingListings() {
    return (await pendingListings()) as Listing[];
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Listing)
  async approveListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return (await approveListing(id, user.uid)) as Listing;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Listing)
  async rejectListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('id', { type: () => ID }) id: string,
    @Args('reason') reason: string,
  ) {
    return (await rejectListing(id, reason, user.uid)) as Listing;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [AuditLogEntry])
  async adminAuditLogs() {
    return (await adminGetAuditLogs()) as AuditLogEntry[];
  }

  // ── Field resolvers ───────────────────────────────────────────────────────

  @ResolveField(() => Number, { nullable: true })
  lat(@Parent() listing: ListingEntity) {
    return listing.location?.coordinates?.[1] ?? null;
  }

  @ResolveField(() => Number, { nullable: true })
  lng(@Parent() listing: ListingEntity) {
    return listing.location?.coordinates?.[0] ?? null;
  }

  @ResolveField(() => String, { nullable: true })
  createdBy(@Parent() listing: ListingEntity) {
    return listing.hostFirebaseUid ?? null;
  }

  @ResolveField(() => String, { nullable: true })
  rejectionReason(@Parent() listing: ListingEntity) {
    return listing.rejectReason ?? null;
  }

  @ResolveField(() => Boolean)
  isPremium(@Parent() listing: ListingEntity) {
    return listing.isPremium ?? false;
  }

  @ResolveField(() => Int)
  viewCount(@Parent() listing: ListingEntity) {
    return listing.viewCount ?? 0;
  }
}
