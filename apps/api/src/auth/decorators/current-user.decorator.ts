import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUserContext } from '@ironloom/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUserContext = request.user;
    return data ? user?.[data] : user;
  },
);
