import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from './roles.decorator';

interface RolesRequest {
  role?: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const contextObj = ctx.getContext<{ req: RolesRequest }>();

    if (!contextObj || !contextObj.req) {
      return false;
    }

    const { req } = contextObj;
    const role = req.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
