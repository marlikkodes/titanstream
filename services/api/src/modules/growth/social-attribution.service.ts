import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface RecordAttributionDto {
  trackingCode: string;
  refereeId?: bigint;
  channel?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ipHash?: string;
  deviceHash?: string;
  stage?: 'CLICK' | 'SIGNUP' | 'ONBOARDED' | 'QUALIFIED' | 'SETTLED';
}

@Injectable()
export class SocialAttributionService {
  private readonly logger = new Logger(SocialAttributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record social attribution step from click to settlement.
   */
  async recordAttribution(dto: RecordAttributionDto) {
    try {
      const participation = await this.prisma.socialMissionParticipation.findUnique({
        where: { trackingCode: dto.trackingCode },
      });

      if (!participation) {
        this.logger.debug(`[SocialAttribution] Unknown tracking code: ${dto.trackingCode}`);
        return null;
      }

      // Fraud check: prevent self-referral
      if (dto.refereeId && dto.refereeId === participation.telegramUserId) {
        this.logger.warn(`[SocialAttribution] Self-referral detected for user ${dto.refereeId}. Attribution rejected.`);
        return null;
      }

      const attribution = await this.prisma.socialAttribution.create({
        data: {
          participationId: participation.id,
          referrerId: participation.telegramUserId,
          refereeId: dto.refereeId,
          channel: dto.channel || 'TELEGRAM',
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          ipHash: dto.ipHash,
          deviceHash: dto.deviceHash,
          stage: dto.stage || 'CLICK',
        },
      });

      // Increment participation actions count
      await this.prisma.socialMissionParticipation.update({
        where: { id: participation.id },
        data: {
          currentActionCount: { increment: 1 },
        },
      });

      return attribution;
    } catch (err: any) {
      this.logger.warn(`Failed to record social attribution: ${err.message}`);
      return null;
    }
  }

  /**
   * Resolve tracking code to participant info.
   */
  async resolveTrackingCode(trackingCode: string) {
    return this.prisma.socialMissionParticipation.findUnique({
      where: { trackingCode },
      include: {
        mission: true,
        user: { select: { telegramUsername: true, firstName: true } },
      },
    });
  }
}
