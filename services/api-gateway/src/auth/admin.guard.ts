import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { getUser } from '../identity/identity.client';

interface UserProfile {
  role: string;
}

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext<{ req: { user?: admin.auth.DecodedIdToken } }>().req;

    const uid = request.user?.uid;
    if (!uid) {
      throw new UnauthorizedException('Not authenticated');
    }

    const profile = (await getUser(uid)) as UserProfile;
    if (profile?.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }
    return true;
  }
}
