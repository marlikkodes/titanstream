import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../database/prisma.module';
import { FinancialOrchestrationModule } from '../../financial-orchestration/financial-orchestration.module';
import { FinancialModule } from '../../financial/financial.module';
import { ProviderEventService } from '../provider-event.service';
import { SettlementRiskService } from '../settlement-risk.service';
import { PesapalClient } from './pesapal.client';
import { PesapalController } from './pesapal.controller';
import { PesapalProvider } from './pesapal.provider';
import { PesapalReconciliationService } from './pesapal.reconciliation.service';

@Module({
  imports: [PrismaModule, FinancialOrchestrationModule, forwardRef(() => FinancialModule)],
  controllers: [PesapalController],
  providers: [
    PesapalClient,
    PesapalProvider,
    PesapalReconciliationService,
    ProviderEventService,
    SettlementRiskService,
  ],
  exports: [
    PesapalClient,
    PesapalProvider,
    PesapalReconciliationService,
  ],
})
export class PesapalModule {}
