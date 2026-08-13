import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DurableQueueService, QueueJobPayload } from '../../queue/durable-queue.service';
import { SettlementService } from '../settlement.service';
import { CreateSettlementSessionDto } from '../dto/create-settlement-session.dto';
import { PlatformOperationsEngineService } from '../../admin/services/platform-operations-engine.service';

@Injectable()
export class SettlementWorker {
  private readonly logger = new Logger(SettlementWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: SettlementService,
    private readonly queueService: DurableQueueService,
    @Optional() @Inject(forwardRef(() => PlatformOperationsEngineService)) private readonly opsEngine?: PlatformOperationsEngineService,
  ) {}

  /**
   * Process queued settlement jobs with Stage 2 emergency switch assertions & idempotency.
   */
  async processJob(job: QueueJobPayload<{ userId?: string; telegramUserId?: bigint; dto: CreateSettlementSessionDto }>): Promise<{ success: boolean; session?: any }> {
    if (!job || !job.data) {
      throw new Error('INVALID_SETTLEMENT_JOB_PAYLOAD');
    }

    const { userId, telegramUserId, dto } = job.data;
    const userKey = userId || telegramUserId;

    // 1. Stage 2 Operational Switch Enforcement
    if (this.opsEngine) {
      await this.opsEngine.assertOperationalModeAllowed('SETTLEMENT', dto.asset);
    }

    try {
      const session = await this.settlementService.createCustomerSession(userKey as any, dto);
      await this.queueService.acknowledgeCompletion(job.jobId, 'settlements');
      this.logger.log(`[SettlementWorker] Processed settlement job ${job.jobId} (Reference: ${session.referenceCode})`);
      return { success: true, session };
    } catch (err: any) {
      this.logger.error(`[SettlementWorker] Failed settlement job ${job.jobId}: ${err.message}`);
      await this.queueService.handleFailure(job, err);
      throw err;
    }
  }
}
