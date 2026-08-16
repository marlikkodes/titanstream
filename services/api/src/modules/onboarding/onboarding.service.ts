import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserState, AuditEventType } from '../../common/interfaces/user-state.enum';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OnboardingService {
  private readonly allowedTransitions: Record<UserState, UserState[]> = {
    [UserState.NEW]: [UserState.AUTHENTICATED],
    [UserState.AUTHENTICATED]: [UserState.ONBOARDING_STARTED],
    [UserState.ONBOARDING_STARTED]: [UserState.EDUCATION_REQUIRED],
    [UserState.EDUCATION_REQUIRED]: [UserState.EDUCATION_COMPLETE],
    [UserState.EDUCATION_COMPLETE]: [UserState.CONSENT_REQUIRED],
    [UserState.CONSENT_REQUIRED]: [UserState.READY],
    [UserState.READY]: [],
    [UserState.ONBOARDING_WELCOME]: [UserState.ONBOARDING_EDUCATION],
    [UserState.ONBOARDING_EDUCATION]: [UserState.EDUCATION_COMPLETE],
    [UserState.CONSENT_PENDING]: [UserState.READY_FOR_PLATFORM],
    [UserState.READY_FOR_PLATFORM]: [UserState.ELIGIBLE_USER, UserState.READY],
    [UserState.ELIGIBLE_USER]: [UserState.ACTIVE_USER],
    [UserState.ACTIVE_USER]: [UserState.DORMANT_USER, UserState.FROZEN],
    [UserState.DORMANT_USER]: [UserState.ACTIVE_USER],
    [UserState.ONBOARDING_STALLED]: [UserState.ONBOARDING_STARTED],
    [UserState.CONSENT_EXPIRED]: [UserState.CONSENT_REQUIRED],
    [UserState.FROZEN]: [UserState.ACTIVE_USER, UserState.SUSPENDED_USER],
    [UserState.SUSPENDED_USER]: [UserState.ACTIVE_USER, UserState.BANNED_USER],
    [UserState.BANNED_USER]: [],
    [UserState.DELETED_USER]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProgress(userKey: string | bigint) {
    const user = await this.getUser(userKey);
    const progress = await this.prisma.onboardingProgress.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    if (!progress) {
      throw new NotFoundException('ONBOARDING_NOT_FOUND');
    }
    return progress;
  }

  async startOnboarding(userKey: string | bigint) {
    const user = await this.getUser(userKey);
    const currentState = user.state as UserState;
    if (currentState !== UserState.AUTHENTICATED && currentState !== UserState.NEW) {
      throw new BadRequestException(`Cannot start onboarding from state ${currentState}`);
    }

    await this.transitionState(user.id, UserState.ONBOARDING_STARTED, 'User started onboarding');

    let progress = await this.prisma.onboardingProgress.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    if (progress) {
      progress = await this.prisma.onboardingProgress.update({
        where: { id: progress.id },
        data: {
          currentStep: 'welcome',
          isCompleted: false,
          completedAt: null,
        },
      });
    } else {
      progress = await this.prisma.onboardingProgress.create({
        data: {
          telegramUserId: user.telegramUserId || BigInt(0),
          currentStep: 'welcome',
          stepsCompleted: [],
        },
      });
    }

    if (user.telegramUserId) {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.ONBOARDING_STARTED,
        description: 'User started the onboarding flow',
      });
    }

    return progress;
  }

  async completeStep(userKey: string | bigint, step: string) {
    const user = await this.getUser(userKey);
    let progress = await this.prisma.onboardingProgress.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });
    if (!progress) throw new NotFoundException('ONBOARDING_NOT_FOUND');

    const stepsCompleted: string[] = (progress.stepsCompleted as string[]) || [];
    if (!stepsCompleted.includes(step)) {
      stepsCompleted.push(step);
    }

    const updatedProgress = await this.prisma.onboardingProgress.update({
      where: { id: progress.id },
      data: {
        currentStep: step,
        stepsCompleted: stepsCompleted,
      },
    });

    if (user.telegramUserId) {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.ONBOARDING_STEP_COMPLETED,
        description: `Completed onboarding step: ${step}`,
        metadata: { step, totalSteps: stepsCompleted.length },
      });
    }

    return updatedProgress;
  }

  async transition(userKey: string | bigint, newState: UserState, trigger = 'api', metadata: any = {}) {
    const user = await this.getUser(userKey);
    const fromState = user.state as UserState;
    if (!this.allowedTransitions[fromState]?.includes(newState)) {
      throw new BadRequestException(`Invalid onboarding transition ${fromState} -> ${newState}`);
    }

    await this.transitionState(user.id, newState, trigger, metadata);
    return this.getState(user.id);
  }

  async resumeOnboarding(userKey: string | bigint) {
    const user = await this.getUser(userKey);
    const userState = user.state as UserState;
    if (userState === UserState.ONBOARDING_STALLED) {
      const progress = await this.prisma.onboardingProgress.findFirst({
        where: { telegramUserId: user.telegramUserId || undefined },
      });
      if (!progress) throw new NotFoundException('ONBOARDING_NOT_FOUND');

      await this.transitionState(user.id, UserState.ONBOARDING_STARTED, 'Resumed from stalled');

      if (user.telegramUserId) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.ONBOARDING_RESUMED,
          description: 'User resumed stalled onboarding',
          metadata: { previousStep: progress.currentStep },
        });
      }

      return progress;
    }

    throw new BadRequestException(`Cannot resume onboarding from state ${userState}`);
  }

  async getState(userKey: string | bigint) {
    const user = await this.getUser(userKey);
    const progress = await this.prisma.onboardingProgress.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    const remainingModules = await this.countRemainingModules(user);
    const consentsCompleted = await this.countConsentsCompleted(user);

    return {
      state: user.state,
      progress: progress || { currentStep: 'welcome', stepsCompleted: [], isCompleted: false },
      remainingModules,
      consentsCompleted,
      isReady: user.isReady,
    };
  }

  private async getUser(userKey: string | bigint) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey as string } });
    } else {
      const telegramUserId = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      user = await this.prisma.user.findUnique({ where: { telegramUserId } });
    }

    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }

  private async countRemainingModules(user: any): Promise<number> {
    const totalModules = await this.prisma.educationModule.count({
      where: { isActive: true, mandatory: true },
    });
    const completedModules = await this.prisma.educationCompletion.count({
      where: {
        telegramUserId: user.telegramUserId || undefined,
        status: 'COMPLETED',
        module: { mandatory: true },
      },
    });
    return Math.max(0, totalModules - completedModules);
  }

  private async countConsentsCompleted(user: any): Promise<number> {
    return this.prisma.userConsent.count({
      where: { telegramUserId: user.telegramUserId || undefined, isActive: true },
    });
  }

  private async transitionState(userId: string, newState: UserState, reason: string, metadata: any = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const fromState = user.state as UserState;

    await this.prisma.user.update({
      where: { id: userId },
      data: { state: newState },
    });

    if (user.telegramUserId) {
      await this.prisma.userStateTransition.create({
        data: {
          telegramUserId: user.telegramUserId,
          fromState,
          toState: newState,
          reason,
          triggerEvent: reason,
          metadata,
        },
      });

      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_STATE_CHANGED,
        description: `State transition: ${fromState} -> ${newState}`,
        metadata: { fromState, toState: newState, trigger: reason, ...metadata },
      });
    }
  }
}
