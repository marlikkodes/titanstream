import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OperatorAmountActionDto, OperatorNoteDto } from './dto/operator-action.dto';
import { OperatorId } from './operator-auth.decorator';
import { SettlementService } from './settlement.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { RbacGuard } from '../admin/guards/rbac.guard';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { AdminPermission } from '../admin/interfaces/admin-permissions.enum';

@Controller('api/v1/operator-portal/settlements')
@UseGuards(AdminAuthGuard, RbacGuard)
export class OperationsPortalController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  list(@OperatorId() operatorId: string) {
    return this.settlements.listOperatorSettlements(operatorId);
  }

  @Post(':settlementId/accept')
  @Permissions(AdminPermission.SETTLEMENT_REVIEW)
  accept(@OperatorId() operatorId: string, @Param('settlementId') settlementId: string) {
    return this.settlements.accept(operatorId, settlementId);
  }

  @Post(':settlementId/reject')
  @Permissions(AdminPermission.SETTLEMENT_REVIEW)
  reject(@OperatorId() operatorId: string, @Param('settlementId') settlementId: string, @Body() body: Partial<OperatorNoteDto>) {
    return this.settlements.reject(operatorId, settlementId, body.note);
  }

  @Post(':settlementId/payment-received')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  paymentReceived(@OperatorId() operatorId: string, @Param('settlementId') settlementId: string, @Body() dto: OperatorAmountActionDto) {
    return this.settlements.confirmPaymentReceived(operatorId, settlementId, dto.amount);
  }

  @Post(':settlementId/usdt-sent')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  usdtSent(@OperatorId() operatorId: string, @Param('settlementId') settlementId: string, @Body() dto: OperatorAmountActionDto) {
    return this.settlements.confirmUsdtSent(operatorId, settlementId, dto.amount);
  }

  @Post(':settlementId/notes')
  @Permissions(AdminPermission.ADMIN_NOTES_WRITE)
  addNote(@OperatorId() operatorId: string, @Param('settlementId') settlementId: string, @Body() dto: OperatorNoteDto) {
    return this.settlements.addOperatorNote(operatorId, settlementId, dto.note);
  }
}
