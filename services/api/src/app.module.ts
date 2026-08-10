import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { EducationModule } from './modules/education/education.module';
import { ConsentModule } from './modules/consent/consent.module';
import { ReadinessModule } from './modules/readiness/readiness.module';
import { AuditModule } from './modules/audit/audit.module';
import { FinancialModule } from './modules/financial/financial.module';
import { FinancialOrchestrationModule } from './modules/financial-orchestration/financial-orchestration.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AdminModule } from './modules/admin/admin.module';
import { GrowthModule } from './modules/growth/growth.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HealthModule } from './modules/health/health.module';
import { BotModule } from './modules/bot/bot.module';
import { AuthGuard } from './common/guards/auth.guard';
import { AutomationModule } from './modules/automation/automation.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { MiningModule } from './modules/mining/mining.module';
import { MachineModule } from './modules/machine/machine.module';
import { GamesModule } from './modules/games/games.module';
import { QueueModule } from './modules/queue/queue.module';
import { AssetLicenseModule } from './modules/asset-license/asset-license.module';
import { FraudModule } from './modules/fraud/fraud.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    AutomationModule,
    NotificationModule,
    TreasuryModule,
    UserModule,
    OnboardingModule,
    EducationModule,
    ConsentModule,
    ReadinessModule,
    FinancialModule,
    FinancialOrchestrationModule,
    SettlementModule,
    AdminModule,
    GrowthModule,
    MetricsModule,
    HealthModule,
    BotModule,
    MiningModule,
    PaymentOrderModule,
    MachineModule,
    GamesModule,
    QueueModule,
    AssetLicenseModule,
    FraudModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
