import { Args, Mutation, Resolver } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { sendPasswordResetEmail } from '../email/email.service';

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
}
