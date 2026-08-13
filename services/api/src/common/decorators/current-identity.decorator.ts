import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IdentityContext } from '../../modules/identity/interfaces/identity-master.interface';

/**
 * Extracts the full canonical IdentityContext from the authenticated request.
 */
export const CurrentIdentity = createParamDecorator((data: unknown, ctx: ExecutionContext): IdentityContext => {
  const request = ctx.switchToHttp().getRequest();
  return request.identity || request.user;
});
