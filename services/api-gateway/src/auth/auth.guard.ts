import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as admin from 'firebase-admin';
import { verifyIdToken } from '../firebase/firebase-admin';

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
      req.user = decodedToken; // attach decoded token to request
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
