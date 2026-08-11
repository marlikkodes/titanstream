import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../database/prisma.module';
import { FinancialOrchestrationModule } from '../../financial-orchestration/financial-orchestration.module';
import { FinancialModule } from '../../financial/financial.module';
import { ExchangeRateService } from '../../financial/exchange-rate.service';
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
    ExchangeRateService,
  ],
  exports: [
    PesapalClient,
    PesapalProvider,
    PesapalReconciliationService,
    ExchangeRateService,
  ],
})
export class PesapalModule {}
