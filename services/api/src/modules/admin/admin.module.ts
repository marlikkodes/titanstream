import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { FinancialModule } from '../financial/financial.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { PaymentOrderModule } from '../payment-order/payment-order.module';
import { PremiumModule } from '../premium/premium.module';

import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminMerchantController } from './controllers/admin-merchant.controller';
import { AdminObservabilityController } from './controllers/admin-observability.controller';
import { AdminRiskController } from './controllers/admin-risk.controller';
import { AdminSettlementController } from './controllers/admin-settlement.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminWithdrawalController } from './controllers/admin-withdrawal.controller';
import { MerchantPortalController } from './controllers/merchant-portal.controller';
import { AdminOperationsController } from './controllers/admin-operations.controller';
import { CommandCenterConfigController } from './controllers/command-center-config.controller';
import { AdminManagementController } from './controllers/admin-management.controller';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminSettlementService } from './services/admin-settlement.service';
import { MerchantPerformanceService } from './services/merchant-performance.service';
import { MerchantPortalService } from './services/merchant-portal.service';
import { OperationalAuditService } from './services/operational-audit.service';
import { RiskOperationsService } from './services/risk-operations.service';
import { SettlementObservabilityService } from './services/settlement-observability.service';
import { SupportService } from './services/support.service';
import { UserInvestigationService } from './services/user-investigation.service';
import { OperationsService } from './services/operations.service';
import { IncidentEngineService } from './services/incident-engine.service';
import { OperationalSearchService } from './services/operational-search.service';
import { CommandCenterConfigService } from './services/command-center-config.service';
import { AdminManagementService } from './services/admin-management.service';
import { LiveEventStreamService } from './services/live-event-stream.service';
import { UniversalSearchService } from './services/universal-search.service';
import { FraudCenterService } from './services/fraud-center.service';
import { FinancialSimulationLabService } from './services/financial-simulation-lab.service';
import { DualAuthorizationService } from './services/dual-authorization.service';
import { CentralDataSyncService } from './services/central-data-sync.service';
import { IdentityService } from '../identity/identity.service';
import { AuthModule } from '../auth/auth.module';

import { MachineModule } from '../machine/machine.module';
import { AdminFinancialController } from './controllers/admin-financial.controller';
import { FinancialAdminService } from './services/financial-admin.service';
import { AdminMachineController } from './controllers/admin-machine.controller';
import { AdminReadinessController } from './controllers/admin-readiness.controller';
import { ProductionReadinessEngineService } from './services/production-readiness-engine.service';
import { AdminIntelligenceController } from './controllers/admin-intelligence.controller';
import { AdminOperationsHqController } from './controllers/admin-operations-hq.controller';
import { ObservabilityIntelligenceEngineService } from './services/observability-intelligence-engine.service';
import { PlatformOperationsEngineService } from './services/platform-operations-engine.service';
import { MachineAdminService } from './services/machine-admin.service';

import { AdminWhatsappController } from './controllers/admin-whatsapp.controller';
import { NotificationModule } from '../notification/notification.module';

import { AdminMerchantService } from './services/admin-merchant.service';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule,
    forwardRef(() => SettlementModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => FinancialModule),
    forwardRef(() => TreasuryModule),
    forwardRef(() => PaymentOrderModule),
    forwardRef(() => MachineModule),
    PremiumModule,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminFinancialController,
    AdminIntelligenceController,
    AdminMachineController,
    AdminOperationsHqController,
    AdminReadinessController,
    AdminSettlementController,
    AdminMerchantController,
    AdminUserController,
    AdminRiskController,
    AdminSupportController,
    AdminObservabilityController,
    MerchantPortalController,
    AdminWithdrawalController,
    AdminOperationsController,
    CommandCenterConfigController,
    AdminManagementController,
    AdminWhatsappController,
  ],
  providers: [
    AdminAuthGuard,
    RbacGuard,
    ProductionReadinessEngineService,
    ObservabilityIntelligenceEngineService,
    PlatformOperationsEngineService,
    FinancialAdminService,
    MachineAdminService,
    AdminAuthService,
    DualAuthorizationService,
    IdentityService,
    LiveEventStreamService,
    UniversalSearchService,
    FraudCenterService,
    FinancialSimulationLabService,
    OperationalAuditService,
    AdminDashboardService,
    AdminSettlementService,
    MerchantPerformanceService,
    MerchantPortalService,
    UserInvestigationService,
    RiskOperationsService,
    SupportService,
    SettlementObservabilityService,
    OperationsService,
    IncidentEngineService,
    OperationalSearchService,
    CommandCenterConfigService,
    AdminManagementService,
    AdminMerchantService,
    CentralDataSyncService,
  ],
  exports: [
    CentralDataSyncService,
    ProductionReadinessEngineService,
    ObservabilityIntelligenceEngineService,
    PlatformOperationsEngineService,
    FinancialAdminService,
    MachineAdminService,
    AdminAuthService,
    DualAuthorizationService,
    IdentityService,
    LiveEventStreamService,
    UniversalSearchService,
    FraudCenterService,
    FinancialSimulationLabService,
    OperationalAuditService,
    AdminDashboardService,
    AdminSettlementService,
    MerchantPerformanceService,
    MerchantPortalService,
    UserInvestigationService,
    RiskOperationsService,
    SupportService,
    SettlementObservabilityService,
    OperationsService,
    IncidentEngineService,
    OperationalSearchService,
    CommandCenterConfigService,
    AdminManagementService,
    AdminAuthGuard,
    RbacGuard,
  ],
})
export class AdminModule {}
