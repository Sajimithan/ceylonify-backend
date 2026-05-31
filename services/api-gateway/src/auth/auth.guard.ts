import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { verifyIdToken } from '../firebase/firebase-admin';
import { getUser } from '../identity/identity.client';

interface AuthRequest {
  headers: Record<string, string | undefined>;
  user?: admin.auth.DecodedIdToken;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const contextObj = ctx.getContext<{ req: AuthRequest }>();

    if (!contextObj || !contextObj.req) {
      throw new UnauthorizedException('Request context missing');
    }

    const { req } = contextObj;
    const header = req.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = header.substring('Bearer '.length).trim();
    try {
      const decodedToken = await verifyIdToken(token);
      // Check if user is suspended
      const profile = await getUser(decodedToken.uid).catch(() => null) as { isSuspended?: boolean } | null;
      if (profile?.isSuspended) {
        throw new UnauthorizedException('Account is suspended');
      }
      req.user = decodedToken;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
