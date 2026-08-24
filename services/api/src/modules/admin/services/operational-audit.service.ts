import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface LogActionParams {
  actorId: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class OperationalAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(params: LogActionParams) {
    const combinedMetadata = {
      ...(params.metadata || {}),
      ...(params.beforeState ? { beforeState: params.beforeState } : {}),
      ...(params.afterState ? { afterState: params.afterState } : {}),
    };

    return this.prisma.operationalAuditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        metadata: combinedMetadata,
      },
    });
  }

  async getAuditLogs(params: { actorId?: string; action?: string; entity?: string; limit?: number; offset?: number }) {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    return this.prisma.operationalAuditLog.findMany({
      where: {
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
