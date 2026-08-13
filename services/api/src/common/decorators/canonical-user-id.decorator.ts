import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the canonical User.id (UUID) from the authenticated request's IdentityContext or User object.
 */
export const CanonicalUserId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const userId = request.identity?.userId || request.user?.id || request.user?.sub;
  if (!userId) {
    throw new Error('CANONICAL_USER_ID_NOT_FOUND_IN_REQUEST');
  }
  return String(userId);
});
