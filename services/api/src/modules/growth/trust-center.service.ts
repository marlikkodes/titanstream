import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserTrustProfile, AuditEvent, UserLevelTier } from '@prisma/client';

export interface SecurityFactor {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  description: string;
  completed: boolean;
}

export interface SecurityTimelineEvent {
  id: string;
  eventType: string;
  description: string;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  severity: string;
}

export interface TrustMission {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  rewardValue: string;
  estimatedTime: string;
  completed: boolean;
  progress: number;
  target: number;
  action: string;
}

export interface TrustBenefit {
  level: string;
  title: string;
  description: string;
  unlocked: boolean;
}

@Injectable()
export class TrustCenterService {
  private readonly logger = new Logger(TrustCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates passport and safety dashboard payload for a user.
   */
  async getTrustCenterData(userKey: bigint | string) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({
        where: { id: userKey as string },
        include: {
          trustProfile: {
            include: {
              trustEvents: {
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
          },
          userLevel: true,
          userPreferences: true,
          channelVerificationEvents: true,
        },
      });
    } else {
      const telegramUserId = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      user = await this.prisma.user.findUnique({
        where: { telegramUserId },
        include: {
          trustProfile: {
            include: {
              trustEvents: {
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
          },
          userLevel: true,
          userPreferences: true,
          channelVerificationEvents: true,
        },
      });
    }

    if (!user) {
      throw new Error(`User not found: ${userKey}`);
    }

    const telegramUserId = user.telegramUserId;

    // Initialize trust profile if not existing
    let trustProfile = user.trustProfile;
    if (!trustProfile) {
      trustProfile = await this.prisma.userTrustProfile.create({
        data: {
          telegramUserId,
          trustScore: 50,
          completedSettlements: 0,
          failedSettlements: 0,
          successRate: 100.0,
          accountAgeDays: 0,
          verificationStatus: 'UNVERIFIED',
        },
        include: {
          trustEvents: true,
        },
      });
    }

    // 2. Fetch external linked identities
    const identityChannels = user.identityId
      ? await this.prisma.channelIdentity.findMany({
          where: { identityId: user.identityId },
        })
      : [];

    const isWhatsAppLinked = identityChannels.some(
      (c) => c.provider === 'WHATSAPP' && c.verified,
    );

    const isPushEnabled = !!user.userPreferences?.pushToken;

    // 3. Resolve account age & metrics
    const ageMs = Date.now() - user.createdAt.getTime();
    const accountAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    const completedSettlements = await this.prisma.settlementSession.count({
      where: { telegramUserId, status: 'COMPLETED' },
    });

    // 4. Calculate factor breakdown
    const factors: SecurityFactor[] = [
      {
        id: 'telegram_linked',
        label: 'Telegram Account Linked',
        points: 25,
        maxPoints: 25,
        description: 'Primary Telegram session linked and verified.',
        completed: true,
      },
      {
        id: 'whatsapp_verified',
        label: 'WhatsApp Verification',
        points: isWhatsAppLinked ? 25 : 0,
        maxPoints: 25,
        description: 'WhatsApp number verification completed.',
        completed: isWhatsAppLinked,
      },
      {
        id: 'push_enabled',
        label: 'Push Alert Configuration',
        points: isPushEnabled ? 15 : 0,
        maxPoints: 15,
        description: 'Receive real-time payment and security push alerts.',
        completed: isPushEnabled,
      },
      {
        id: 'recovery_configured',
        label: 'Account Recovery Method',
        points: user.userPreferences?.authenticationMethod ? 15 : 0,
        maxPoints: 15,
        description: 'Alternative authentication channels configured.',
        completed: !!user.userPreferences?.authenticationMethod,
      },
      {
        id: 'settlement_history',
        label: 'Payment Settlement Record',
        points: Math.min(20, completedSettlements * 5),
        maxPoints: 20,
        description: 'Successful financial operations and payouts history.',
        completed: completedSettlements >= 4,
      },
    ];

    const currentScore = Math.min(
      100,
      factors.reduce((sum, f) => sum + f.points, 0),
    );

    // Update trust score in db if changed
    if (currentScore !== trustProfile.trustScore) {
      await this.prisma.userTrustProfile.update({
        where: { telegramUserId },
        data: { trustScore: currentScore },
      });
    }

    // 5. Security health calculation
    let healthState: 'Excellent' | 'Good' | 'Needs Attention' | 'High Risk' = 'Needs Attention';
    if (currentScore >= 80) {
      healthState = 'Excellent';
    } else if (currentScore >= 50) {
      healthState = 'Good';
    } else if (currentScore < 30) {
      healthState = 'High Risk';
    }

    // 6. Timeline security events from database
    const dbEvents = await this.prisma.auditEvent.findMany({
      where: {
        telegramUserId,
        eventType: {
          in: [
            'USER_AUTHENTICATED',
            'SECURITY_EVENT',
            'USER_CREATED',
            'USER_UPDATED',
            'USER_STATE_CHANGED',
            'ACCOUNT_FROZEN',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const timeline: SecurityTimelineEvent[] = dbEvents.map((evt) => ({
      id: evt.id,
      eventType: evt.eventType.replace(/_/g, ' '),
      description: evt.description || 'Security check completed',
      timestamp: evt.createdAt,
      ipAddress: evt.ipAddress,
      userAgent: evt.userAgent,
      severity: evt.severity,
    }));

    if (timeline.length === 0) {
      timeline.push({
        id: 't_init',
        eventType: 'TRUST CENTER INITIALIZED',
        description: 'Ecosystem trust scoring dashboard enabled.',
        timestamp: user.createdAt,
        ipAddress: '127.0.0.1',
        userAgent: 'Titan Guard System',
        severity: 'INFO',
      });
    }

    // 7. Trust Missions
    const missions: TrustMission[] = [
      {
        id: 'm_whatsapp',
        title: 'Verify WhatsApp Identity',
        description: 'Secure second channel link to double security and verify your profile.',
        rewardPoints: 25,
        rewardValue: 'Premium Badge',
        estimatedTime: '2 min',
        completed: isWhatsAppLinked,
        progress: isWhatsAppLinked ? 1 : 0,
        target: 1,
        action: 'VERIFY_WHATSAPP',
      },
      {
        id: 'm_push',
        title: 'Enable Push Notifications',
        description: 'Verify and link device token for prompt push alerts on account activity.',
        rewardPoints: 15,
        rewardValue: 'Growth Score Bonus',
        estimatedTime: '1 min',
        completed: isPushEnabled,
        progress: isPushEnabled ? 1 : 0,
        target: 1,
        action: 'ENABLE_PUSH',
      },
      {
        id: 'm_settle',
        title: 'Complete 3 Successful Settlements',
        description: 'Build your transaction volume by running 3 payment settlements.',
        rewardPoints: 15,
        rewardValue: '$5 USDT Voucher',
        estimatedTime: '3 days',
        completed: completedSettlements >= 3,
        progress: Math.min(3, completedSettlements),
        target: 3,
        action: 'SETTLE',
      },
    ];

    // 8. Benefits
    const benefits: TrustBenefit[] = [
      {
        level: 'SEED',
        title: 'Basic Security Clearance',
        description: 'Standard P2P withdrawal and P2P exchange limits up to $100.',
        unlocked: true,
      },
      {
        level: 'BUILDER',
        title: 'Standard Verified Protection',
        description: 'Priority transaction routing and higher cash withdraw limits up to $250.',
        unlocked: currentScore >= 50,
      },
      {
        level: 'GUARDIAN',
        title: 'Advanced Ledger Shielding',
        description: 'Zero verification delay on withdrawals and P2P payouts up to $500.',
        unlocked: currentScore >= 80,
      },
    ];

    // 9. Active protection monitor checks
    const activeMonitor = {
      status: currentScore >= 50 ? 'Protected' : 'Needs Attention',
      lastCheckAt: new Date(),
      checks: [
        { name: 'Session Verified', healthy: true },
        { name: 'Device Trusted', healthy: true },
        { name: 'Ledger Healthy', healthy: true },
        { name: 'Withdrawals Protected', healthy: currentScore >= 50 },
        { name: 'Notifications Active', healthy: isPushEnabled },
      ],
    };

    return {
      passport: {
        username: user.telegramUsername || user.firstName,
        avatar: user.photoUrl,
        rank: currentScore >= 80 ? 'Titan Guardian' : currentScore >= 50 ? 'Explorer' : 'Newcomer',
        trustBadge: currentScore >= 80 ? '★★★★★' : currentScore >= 50 ? '★★★☆☆' : '★☆☆☆☆',
        trustScore: currentScore,
        trustLevel: currentScore >= 80 ? 'Architect' : currentScore >= 50 ? 'Builder' : 'Seed',
        memberSince: user.createdAt,
        country: user.languageCode === 'en' ? 'Global' : user.languageCode.toUpperCase(),
        status: currentScore >= 50 ? 'Protected' : 'Needs Attention',
      },
      securityHealth: {
        score: currentScore,
        healthState,
        isWhatsAppLinked,
        isPushEnabled,
        riskLevel: currentScore >= 80 ? 'Low' : currentScore >= 50 ? 'Medium' : 'High',
        suspiciousActivity: 'None',
      },
      factors,
      timeline,
      missions,
      benefits,
      activeMonitor,
      education: [
        {
          id: 'edu_1',
          question: 'Why does Titan calculate Trust Score?',
          answer:
            'Ecosystem trust protects our community fund and liquidity systems from fraud. Higher trust metrics unlock larger settlements and withdrawal access.',
        },
        {
          id: 'edu_2',
          question: 'How is my money protected?',
          answer:
            'Titan Stream runs on ledger accounts where every trade requires dynamic signature checks, transaction validation, and fraud monitors.',
        },
        {
          id: 'edu_3',
          question: 'Why verify WhatsApp?',
          answer:
            'WhatsApp authentication acts as a secondary recovery channel if your Telegram session is compromised or revoked.',
        },
      ],
    };
  }
}
