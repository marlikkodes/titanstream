import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TelegramUserId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const rawId = request.user?.telegramUserId ?? request.user?.sub;
  if (!rawId) return undefined;
  
  const strId = String(rawId);
  // If strId is numeric (BigInt representation)
  if (/^\d+$/.test(strId)) {
    return BigInt(strId);
  }
  
  return undefined;
});
