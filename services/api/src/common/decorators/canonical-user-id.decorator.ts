import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extracts the canonical User.id (UUID) from the authenticated request's IdentityContext or User object.
 */
export const CanonicalUserId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const userId = request.identity?.userId || request.user?.id || request.user?.sub || request.user?.adminId;
  if (!userId) {
    throw new UnauthorizedException('UNAUTHORIZED: Canonical User ID not found in request context');
  }
  return String(userId);
});
