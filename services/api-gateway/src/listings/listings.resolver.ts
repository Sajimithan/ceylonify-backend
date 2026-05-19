import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  ObjectType,
  Query,
  Resolver,
  Mutation,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

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
} from './listings.client';

@ObjectType()
class Listing {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() description!: string;
  @Field() type!: string;

  @Field({ nullable: true }) category?: string;

  // Note: keep as string if your listing-service returns it as string
  @Field({ nullable: true }) price?: string;

  @Field({ nullable: true }) placeName?: string;
  @Field({ nullable: true }) mapLink?: string;
  @Field({ nullable: true }) imageUrl?: string;

  @Field() status!: string;
  @Field() createdAt!: string;

  // ✅ Helpful for Admin screen (optional)
  @Field({ nullable: true }) lat?: number;
  @Field({ nullable: true }) lng?: number;

  // ✅ who created it (host uid/email). optional.
  @Field({ nullable: true }) createdBy?: string;

  // ✅ if rejected, store reason (optional)
  @Field({ nullable: true }) rejectionReason?: string;
}

interface ListingEntity {
  hostFirebaseUid?: string;
  location?: {
    coordinates: [number, number];
  };
}

@ObjectType()
export class ListingStats {
  @Field() total!: number;
  @Field() pending!: number;
  @Field() approved!: number;
  @Field() rejected!: number;
}

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
}

@Resolver(() => Listing)
export class ListingsResolver {
  // -----------------------
  // Host operations
  // -----------------------
  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async createListing(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('input') input: CreateListingInput,
  ) {
    return (await createListing(user.uid, input)) as Listing;
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

  // -----------------------
  // Admin moderation operations
  // (Day 5)
  // -----------------------

  /**
   * Public Feed: Approved listings for mobile app
   * No authentication required - this is a public endpoint
   */
  @Query(() => [Listing])
  async feed() {
    return (await feed()) as Listing[];
  }

  @Query(() => Listing)
  async listing(@Args('id') id: string) {
    return (await getListing(id)) as Listing;
  }

  // --- ADMIN QUERIES ---

  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async adminAllListings() {
    return (await adminAllListings()) as Listing[];
  }

  @UseGuards(AuthGuard)
  @Query(() => ListingStats)
  async adminListingStats() {
    return (await adminListingStats()) as ListingStats;
  }

  /**
   * Get all PENDING listings for admin review
   * NOTE: Today we only guard with AuthGuard.
   * Later you can add AdminGuard / roles.
   */
  @UseGuards(AuthGuard)
  @Query(() => [Listing])
  async pendingListings() {
    return (await pendingListings()) as Listing[];
  }

  /**
   * Approve a listing
   */
  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async approveListing(@Args('id', { type: () => ID }) id: string) {
    return (await approveListing(id)) as Listing;
  }

  /**
   * Reject a listing with a reason
   */
  @UseGuards(AuthGuard)
  @Mutation(() => Listing)
  async rejectListing(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason') reason: string,
  ) {
    return (await rejectListing(id, reason)) as Listing;
  }

  // Resolvers for derived fields

  @ResolveField(() => Number, { nullable: true })
  lat(@Parent() listing: ListingEntity) {
    if (
      listing.location?.coordinates &&
      listing.location.coordinates.length === 2
    ) {
      return listing.location.coordinates[1];
    }
    return null;
  }

  @ResolveField(() => Number, { nullable: true })
  lng(@Parent() listing: ListingEntity) {
    if (
      listing.location?.coordinates &&
      listing.location.coordinates.length === 2
    ) {
      return listing.location.coordinates[0];
    }
    return null;
  }

  @ResolveField(() => String, { nullable: true })
  createdBy(@Parent() listing: ListingEntity) {
    return listing.hostFirebaseUid || null;
  }
}
