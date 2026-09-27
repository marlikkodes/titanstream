import { Module } from '@nestjs/common';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentIntentController } from './payment-intent.controller';
// LEGACY: PaymentApprovalQueueController temporarily disabled until admin guard paths verified
// import { PaymentApprovalQueueController } from './payment-approval-queue.controller';
import { MobileMoneyApprovalQueueService } from './mobile-money-approval-queue.service';
import { UsdtAutomatedVerificationService } from './usdt-automated-verification.service';
import { UsdtExceptionQueueService } from './usdt-exception-queue.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { AdminFourEyesService } from './admin-four-eyes.service';
import { PrismaModule } from '../../database/prisma.module';
import { FinancialOrchestrationModule } from '../financial-orchestration/financial-orchestration.module';
import { FinancialModule } from '../financial/financial.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { AutomationModule } from '../automation/automation.module';
import { PremiumModule } from '../premium/premium.module';

@Module({
  imports: [
    PrismaModule,
    FinancialOrchestrationModule,
    FinancialModule,
    NotificationModule,
    AuditModule,
    AutomationModule,
    PremiumModule,
  ],
  controllers: [PaymentIntentController], // PaymentApprovalQueueController temporarily disabled
  providers: [PaymentIntentService, MobileMoneyApprovalQueueService, UsdtAutomatedVerificationService, UsdtExceptionQueueService, PaymentIdempotencyService, AdminFourEyesService],
  exports: [PaymentIntentService, MobileMoneyApprovalQueueService, UsdtAutomatedVerificationService, UsdtExceptionQueueService, PaymentIdempotencyService, AdminFourEyesService],
})
export class PaymentIntentModule {}
