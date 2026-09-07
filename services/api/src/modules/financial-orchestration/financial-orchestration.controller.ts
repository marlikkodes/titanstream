import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../financial/dto/pagination.dto';
import { CreateFinancialOperationDto } from './dto/create-financial-operation.dto';
import { FinancialOrchestratorService } from './financial-orchestrator.service';
import { ReconciliationService } from './reconciliation.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { RbacGuard } from '../admin/guards/rbac.guard';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { AdminPermission } from '../admin/interfaces/admin-permissions.enum';
import { CurrentAdmin, AuthenticatedAdmin } from '../admin/decorators/current-admin.decorator';

@ApiTags('Financial Orchestration')
@Controller('financial/orchestration')
export class FinancialOrchestrationController {
  constructor(
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly reconciliation: ReconciliationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('operations')
  @UseGuards(AdminAuthGuard, RbacGuard)
  @Permissions(AdminPermission.BALANCE_ADJUST)
  @ApiOperation({ summary: 'Execute an administrative financial operation through the orchestrator' })
  requestOperation(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: CreateFinancialOperationDto,
  ) {
    const targetTelegramUserId = dto.telegramUserId ? BigInt(dto.telegramUserId) : BigInt(0);
    return this.orchestrator.requestOperation({
      ...dto,
      telegramUserId: targetTelegramUserId,
      userId: dto.userId,
      metadata: {
        ...(dto.metadata || {}),
        executedByAdminId: admin.id,
        executedByAdminUsername: admin.username,
      },
    } as any);
  }

  @Get('operations')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List current user financial operations' })
  async listOperations(@CanonicalUserId() userId: string, @Query() query: PaginationDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const isUuid = userId.includes('-');
    let telegramUserId: bigint | undefined = /^\d+$/.test(userId) ? BigInt(userId) : undefined;
    if (isUuid) {
      const u = await this.prisma.user.findUnique({ where: { id: userId } });
      telegramUserId = u?.telegramUserId || undefined;
    }
    const items = await this.prisma.financialOperation.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return { items, pagination: { limit, offset } };
  }

  @Post('reconciliation/trigger')
  @UseGuards(AdminAuthGuard, RbacGuard)
  @Permissions(AdminPermission.RECONCILIATION_RUN)
  @ApiOperation({ summary: 'Trigger a full end-to-end financial reconciliation audit sweep' })
  triggerReconciliation(@Query('source') source?: string) {
    return this.reconciliation.runFullReconciliation(source || 'ADMIN_TRIGGER');
  }

  @Get('reconciliation/runs')
  @UseGuards(AdminAuthGuard, RbacGuard)
  @Permissions(AdminPermission.RECONCILIATION_RUN)
  @ApiOperation({ summary: 'List recent financial reconciliation runs and checkpoints' })
  listReconciliationRuns(@Query('limit') limit?: number) {
    return this.reconciliation.getRecentRuns(limit ? Number(limit) : 20);
  }
}
