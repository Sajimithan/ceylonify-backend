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
import { enhanceDescription, moderateListing } from '../ai/ai.service';
import { getUser } from '../identity/identity.client';

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
  reportListing,
  adminGetReports,
  adminDismissReport,
  adminActionReport,
  adminGetAuditLogs,
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
    const result = (await createListing(user.uid, input)) as Listing;
    // Fire-and-forget AI moderation — never blocks creation
    void moderateListing(input.title, input.description).then((r) => {
      if (r.flagged) {
        console.warn(
          `[AI] Listing ${result.id} flagged for: ${r.reason ?? 'unknown'}`,
        );
      }
    });
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
  ) {
    await reportListing(user.uid, listingId, reason, comment);
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Query(() => [ListingReport])
  async adminReports() {
    return (await adminGetReports()) as ListingReport[];
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

  // ── Search / Browse ───────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => SearchResult)
  async searchListings(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('q', { nullable: true }) q?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('limit', { nullable: true, type: () => Int }) limit?: number,
    @Args('offset', { nullable: true, type: () => Int }) offset?: number,
    @Args('startAfter', { nullable: true }) startAfter?: string,
    @Args('startBefore', { nullable: true }) startBefore?: string,
  ) {
    const profile = (await getUser(user.uid)) as { role: string } | null;
    const isPremium = profile?.role === 'HOST' || profile?.role === 'ADMIN';
    return (await searchListings({ q, category, type, limit, offset, includePremium: isPremium, startAfter, startBefore })) as SearchResult;
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
