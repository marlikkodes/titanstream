import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REQUIRE_STEP_UP_KEY } from '../decorators/step-up.decorator';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isStepUpRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If step-up is not explicitly required by decorator, allow execution
    if (isStepUpRequired === false) return true;

    const request = context.switchToHttp().getRequest();
    const stepUpToken = request.headers['x-step-up-token'] || request.headers['x-stepup-token'];

    if (!stepUpToken) {
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: 'High-assurance step-up re-authentication is required to complete this action.',
      });
    }

    try {
      const payload = this.jwtService.verify(stepUpToken as string);
      if (payload.type !== 'step_up') {
        throw new ForbiddenException({ code: 'INVALID_STEP_UP_TOKEN', message: 'Token is not a valid step-up authorization token.' });
      }

      // Check if step-up token matches authenticated user identity
      const authenticatedUserId = request.user?.id || request.user?.titanUserId || request.user?.sub;
      if (payload.sub && authenticatedUserId && String(payload.sub) !== String(authenticatedUserId)) {
        throw new ForbiddenException({ code: 'STEP_UP_USER_MISMATCH', message: 'Step-up token does not belong to the current authenticated user.' });
      }

      return true;
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException({
        code: 'STEP_UP_EXPIRED',
        message: 'Step-up authorization token has expired or is invalid. Please re-authenticate.',
      });
    }
  }
}
