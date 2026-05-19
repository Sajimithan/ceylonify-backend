import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as admin from 'firebase-admin';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const contextObj = ctx.getContext<{
      req: { user?: admin.auth.DecodedIdToken };
    }>();
    return contextObj?.req?.user;
  },
);
