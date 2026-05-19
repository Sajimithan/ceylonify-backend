import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { registerDeviceToken } from './notifications.client';

@Resolver()
export class NotificationsResolver {
  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async registerDeviceToken(
    @CurrentUser() user: admin.auth.DecodedIdToken,
    @Args('token') token: string,
  ) {
    await registerDeviceToken(user.uid, token);
    return true;
  }
}
