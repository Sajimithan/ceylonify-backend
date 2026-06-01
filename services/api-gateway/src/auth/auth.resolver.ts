import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { CurrentUser } from './current-user.decorator';
import { sendPasswordResetEmail, sendAdminWelcomeEmail, sendEmailVerificationEmail } from '../email/email.service';
import { getFirebaseAdminApp } from '../firebase/firebase-admin';
import { upsertUser, adminAllUsers, adminChangeUserRole } from '../identity/identity.client';
import { addAuditLog } from '../listings/listings.client';

@Resolver()
export class AuthResolver {
  @Mutation(() => Boolean)
  async forgotPassword(@Args('email') email: string): Promise<boolean> {
    try {
      getFirebaseAdminApp();
      const link = await admin.auth().generatePasswordResetLink(email.trim());
      await sendPasswordResetEmail(email.trim(), link);
    } catch (err) {
      console.error('[forgotPassword] failed:', err);
    }
    return true;
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async sendEmailVerification(
    @CurrentUser() caller: admin.auth.DecodedIdToken,
  ): Promise<boolean> {
    try {
      getFirebaseAdminApp();
      const firebaseUser = await admin.auth().getUser(caller.uid);
      if (!firebaseUser.email || firebaseUser.emailVerified) return true;
      const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:5173';
      const link = await admin.auth().generateEmailVerificationLink(firebaseUser.email, {
        url: `${webAppUrl}/account?verified=email`,
      });
      await sendEmailVerificationEmail(firebaseUser.email, link);
    } catch (err) {
      console.error('[sendEmailVerification] failed:', err);
    }
    return true;
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async adminCreateAdminAccount(
    @CurrentUser() caller: admin.auth.DecodedIdToken,
    @Args('email') email: string,
  ): Promise<boolean> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
    const bytes = require('crypto').randomBytes(12) as Buffer;
    const password = Array.from(bytes).map((b: number) => chars[b % chars.length]).join('');

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
