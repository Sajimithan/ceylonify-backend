import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { CurrentUser } from './current-user.decorator';
import { sendPasswordResetEmail, sendAdminWelcomeEmail } from '../email/email.service';
import { upsertUser, adminAllUsers, adminChangeUserRole } from '../identity/identity.client';
import { addAuditLog } from '../listings/listings.client';

@Resolver()
export class AuthResolver {
  @Mutation(() => Boolean)
  async forgotPassword(@Args('email') email: string): Promise<boolean> {
    try {
      const link = await admin.auth().generatePasswordResetLink(email.trim());
      await sendPasswordResetEmail(email.trim(), link);
    } catch {
      // always return true — never reveal whether the email exists
    }
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminCreateAdminAccount(
    @CurrentUser() caller: admin.auth.DecodedIdToken,
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<boolean> {
    // 1. Create Firebase auth account
    const firebaseUser = await admin.auth().createUser({
      email: email.trim(),
      password,
      emailVerified: true,
    });

    // 2. Upsert into identity service
    await upsertUser(firebaseUser.uid, email.trim());

    // 3. Find the database record and set role to ADMIN
    const allUsers = (await adminAllUsers()) as Array<{ id: string; firebaseUid: string }>;
    const record = allUsers.find((u) => u.firebaseUid === firebaseUser.uid);
    if (record) {
      await adminChangeUserRole(record.id, 'ADMIN');
    }

    // 4. Audit log
    void addAuditLog('CREATE_ADMIN', caller.uid, firebaseUser.uid, `Created admin account for ${email.trim()}`);

    // 5. Email credentials to new admin (fire-and-forget)
    void sendAdminWelcomeEmail(email.trim(), password);

    return true;
  }
}
