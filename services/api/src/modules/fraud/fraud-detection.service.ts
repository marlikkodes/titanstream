import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReferralGraphService } from '../growth/referral-graph.service';
import { UserState } from '@prisma/client';

@Injectable()
export interface UserRiskEvaluation {
  score: number; // 0 - 100
  level: 'LOW' | 'MEDIUM' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  recommendation: 'ALLOW' | 'MONITOR' | 'DELAY' | 'REVIEW' | 'BLOCK';
  indicators: string[];
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReferralGraphService))
    private readonly referralGraphService: ReferralGraphService,
  ) {}

  /**
   * Multi-Signal Risk Scoring Engine:
   * Computes a risk score [0 - 100] evaluating account age, referral graph,
   * reward velocity, downstream activity ratio, and game telemetry.
   */
  async evaluateUserRiskScore(telegramUserId: bigint): Promise<UserRiskEvaluation> {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
    });

    if (!user) {
      return { score: 100, level: 'CRITICAL', recommendation: 'BLOCK', indicators: ['USER_NOT_FOUND'] };
    }

    let score = 0;
    const indicators: string[] = [];

    // 1. Account Age Signal
    const ageMs = Date.now() - user.createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) {
      score += 25;
      indicators.push('FRESH_ACCOUNT_UNDER_1H');
    } else if (ageHours < 24) {
      score += 10;
      indicators.push('NEW_ACCOUNT_UNDER_24H');
    }

    // 2. Referral Chain & Structure
    try {
      const chain = await this.referralGraphService.getReferralChain(telegramUserId);
      if (chain.length >= 4) {
        score += 20;
        indicators.push(`DEEP_REFERRAL_CHAIN_DEPTH_${chain.length}`);
      }
    } catch (e) {
      // ignore
    }

    // 3. Downstream Activity Ratio (Referral farming check)
    try {
      const downstream = await this.referralGraphService.getDownstreamCount(telegramUserId);
      if (downstream.total >= 5 && downstream.qualified === 0) {
        score += 25;
        indicators.push('REFERRAL_FARMING_ZERO_QUALIFIED_RATIO');
      }
    } catch (e) {
      // ignore
    }

    // 4. Reward Velocity Signal (Claims in last 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const recentClaims = await this.prisma.reward.count({
      where: {
        telegramUserId,
        status: 'CLAIMED',
        processedAt: { gte: oneHourAgo },
      },
    });
    if (recentClaims >= 5) {
      score += 30;
      indicators.push(`HIGH_REWARD_VELOCITY_${recentClaims}_IN_1H`);
    }

    // 5. Shared IP Cluster Soft Signal (Informational only — max 15 points, allowing households <= 5)
    if (user.lastActiveIp) {
      const clusterCount = await this.prisma.user.count({
        where: { lastActiveIp: user.lastActiveIp },
      });
      if (clusterCount > 5) {
        score += 15;
        indicators.push(`LARGE_IP_CLUSTER_${clusterCount}_USERS`);
      }
    }

    // Clamp score [0, 100]
    score = Math.min(100, Math.max(0, score));

    let level: UserRiskEvaluation['level'] = 'LOW';
    let recommendation: UserRiskEvaluation['recommendation'] = 'ALLOW';

    if (score >= 90) {
      level = 'CRITICAL';
      recommendation = 'BLOCK';
    } else if (score >= 70) {
      level = 'HIGH';
      recommendation = 'REVIEW';
    } else if (score >= 50) {
      level = 'ELEVATED';
      recommendation = 'DELAY';
    } else if (score >= 30) {
      level = 'MEDIUM';
      recommendation = 'MONITOR';
    } else {
      level = 'LOW';
      recommendation = 'ALLOW';
    }

    return { score, level, recommendation, indicators };
  }

  /**
   * Detect IP address clustering (multiple accounts operating from same IP).
   */
  async analyzeIpClusters(): Promise<{ flagged: number; details: any[] }> {
    const ipGroups = await this.prisma.user.groupBy({
      by: ['lastActiveIp'],
      where: {
        lastActiveIp: { not: null },
      },
      _count: { telegramUserId: true },
      having: {
        telegramUserId: { _count: { gt: 3 } },
      },
    });

    const details = await Promise.all(
      ipGroups.map(async (group) => {
        const users = await this.prisma.user.findMany({
          where: { lastActiveIp: group.lastActiveIp },
          select: {
            telegramUserId: true,
            telegramUsername: true,
            state: true,
            createdAt: true,
          },
        });
        return {
          ipAddress: group.lastActiveIp,
          accountCount: group._count.telegramUserId,
          users: users.map((u) => ({
            telegramUserId: u.telegramUserId.toString(),
            username: u.telegramUsername,
            state: u.state,
          })),
        };
      }),
    );

    return {
      flagged: ipGroups.length,
      details,
    };
  }

  /**
   * Check for circular referral loops in the graph.
   */
  async checkReferralGraph(): Promise<{ flagged: boolean; cycles: any[] }> {
    const cycles = await this.referralGraphService.detectCycles();
    return {
      flagged: cycles.length > 0,
      cycles,
    };
  }

  /**
   * Automatically suspend flagged suspicious account clusters.
   */
  async autoSuspendCluster(ipAddress: string): Promise<{ suspendedCount: number }> {
    if (!ipAddress) return { suspendedCount: 0 };

    const usersToSuspend = await this.prisma.user.findMany({
      where: {
        lastActiveIp: ipAddress,
        state: { notIn: [UserState.BANNED_USER, UserState.SUSPENDED_USER] },
      },
      select: { telegramUserId: true },
    });

    for (const u of usersToSuspend) {
      await this.prisma.user.update({
        where: { telegramUserId: u.telegramUserId },
        data: { state: UserState.SUSPENDED_USER },
      });

      await this.prisma.userStateTransition.create({
        data: {
          telegramUserId: u.telegramUserId,
          fromState: UserState.ACTIVE_USER,
          toState: UserState.SUSPENDED_USER,
          reason: `FRAUD_IP_CLUSTER_AUTO_SUSPEND:${ipAddress}`,
        },
      });
    }

    this.logger.warn(`Suspended ${usersToSuspend.length} users associated with IP cluster ${ipAddress}`);

    return {
      suspendedCount: usersToSuspend.length,
    };
  }
}
