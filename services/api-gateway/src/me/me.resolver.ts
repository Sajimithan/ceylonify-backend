import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  ObjectType,
  Field,
  Mutation,
  Args,
  ID,
} from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../auth/auth.guard';
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
} from '../identity/identity.client';
import { getListing } from '../listings/listings.client';
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

  // ── Admin ───────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Query(() => [UserRecord])
  async adminAllUsers() {
    return (await adminAllUsers()) as UserRecord[];
  }

  @UseGuards(AuthGuard)
  @Query(() => UserStats)
  async adminUserStats() {
    return (await adminUserStats()) as UserStats;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => UserRecord)
  async adminChangeUserRole(
    @Args('id') id: string,
    @Args('role') role: string,
  ) {
    return (await adminChangeUserRole(id, role)) as UserRecord;
  }
}
