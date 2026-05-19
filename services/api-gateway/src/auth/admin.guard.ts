import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext<{ req: { user?: { email?: string } } }>()
      .req;

    const user = request.user;
    const email = (user?.email || '').toLowerCase();

    const allow = new Set(['admin@test.com']); // ✅ replace
    if (!allow.has(email)) {
      throw new UnauthorizedException('Admin access required');
    }
    return true;
  }
}
