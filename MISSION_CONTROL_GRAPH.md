# TITANSTREAM MISSION CONTROL — DOMAIN GRAPH & ARCHITECTURAL TOPOLOGY

**Generated:** 2026-08-26  
**Auditor:** Antigravity Advanced Agentic Core  
**Standard:** Enterprise Domain-Driven Architecture (DDD) & Control Plane Isolation

---

## 1. Domain Architecture Graph

```
                                  TITANSTREAM PLATFORM
                                           │
    ┌──────────────────────────────────────┼──────────────────────────────────────┐
    │                                      │                                      │
    ▼                                      ▼                                      ▼
┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
│       IDENTITY        │      │    FINANCE & LEDGER   │      │      SETTLEMENT       │
│───────────────────────│      │───────────────────────│      │───────────────────────│
│ • User                │      │ • FinancialAccount    │      │ • SettlementSession   │
│ • UniversalIdentity   │      │ • LedgerAccount       │      │ • PaymentOrder        │
│ • ChannelIdentity     │      │ • LedgerEntry         │      │ • SettlementProvider  │
│ • PhoneVerification   │      │ • Double-Entry Bal    │      │ • VerificationQueue   │
└───────────────────────┘      └───────────────────────┘      └───────────────────────┘
    │                                      │                                      │
    │                                      ▼                                      │
    │                          ┌───────────────────────┐                          │
    │                          │       TREASURY        │                          │
    │                          │───────────────────────│                          │
    │                          │ • SystemReserve       │                          │
    │                          │ • UsdtConfig          │                          │
    │                          │ • MobileMoneyMerchant │                          │
    │                          │ • ReserveRatio / RCR  │                          │
    │                          └───────────────────────┘                          │
    │                                      │                                      │
    ├──────────────────────────────────────┼──────────────────────────────────────┤
    │                                      │                                      │
    ▼                                      ▼                                      ▼
┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
│   ECONOMY & FLEET     │      │    COMMUNICATIONS     │      │      OPERATIONS       │
│───────────────────────│      │───────────────────────│      │───────────────────────│
│ • MachineCatalogItem  │      │ • TelegramBotGateway  │      │ • EmergencySwitches   │
│ • UserMachineFleet    │      │ • WhatsAppBaileysGate │      │ • MaintenanceModeGate │
│ • AssetYieldSchedule  │      │ • InboundWebhookQueue │      │ • OperationsQueue/DLQ │
│ • PowerCapacity (GH/s)│      │ • NotificationChannel │      │ • SystemIncidentEngine│
└───────────────────────┘      └───────────────────────┘      └───────────────────────┘
    │                                      │                                      │
    └──────────────────────────────────────┼──────────────────────────────────────┘
                                           │
                                           ▼
                               ┌───────────────────────┐
                               │   SECURITY & AUDIT    │
                               │───────────────────────│
                               │ • AdminUser / RBAC    │
                               │ • DualAuthorization   │
                               │ • AuditEvent          │
                               │ • RiskEvent / FraudSOC│
                               └───────────────────────┘
                                           │
                                           ▼
                       ═════════════════════════════════
                         ADMIN MISSION CONTROL PLANE
                         (GET /api/v1/admin/dashboard)
                       ═════════════════════════════════
```

---

## 2. Domain Source-of-Truth Mapping

### 1. Identity Domain
- **Source of Truth**: `Prisma: User, UniversalIdentity, ChannelIdentity`
- **Domain Service**: `IdentityService`, `UserInvestigationService`
- **Ownership**: User profile, channel binding, phone verification.

### 2. Finance & Double-Entry Ledger Domain
- **Source of Truth**: `Prisma: FinancialAccount, LedgerAccount, LedgerEntry, FinancialTransaction`
- **Domain Service**: `FinancialService`, `LedgerService`
- **Invariants**: Debits = Credits at all times; ledger accounts `SYSTEM_RESERVE` and `USER_ASSET_LIABILITY`.

### 3. Treasury Domain
- **Source of Truth**: `LedgerEntry`, `CommandCenterConfigService: CryptoWalletConfig, MobileMoneyConfig`
- **Domain Service**: `TreasuryService`, `FinancialAdminService`
- **Ownership**: Solvency metrics, Reserve Ratio (Target >= 150%), Revenue Coverage Ratio (RCR), Treasury Health Score.

### 4. Settlement & Rails Domain
- **Source of Truth**: `Prisma: SettlementSession, PaymentOrder`
- **Domain Service**: `SettlementService`, `ProviderRegistryService`, `AdminSettlementService`
- **Ownership**: Deposits, on-chain TRC-20 payouts, Pesapal Mobile Money callbacks, DLQ verification.

### 5. Economy & Machine Fleet Domain
- **Source of Truth**: `CommandCenterConfigService: MachineCatalog`, `Prisma: UserMachine`
- **Domain Service**: `MachineAdminService`, `MiningEngineService`
- **Ownership**: Compute asset catalogue (Pulse Gen, Impulse Core, Turbine Loop X, Quantum Vortex G3), active network hashrate (GH/s), yield emission schedules.

### 6. Communications Domain
- **Source of Truth**: `TelegramGatewayService`, `AdminWhatsappService` (Baileys daemon)
- **Ownership**: Telegram bot status (`@titanstream_bot`), WhatsApp gateway session status, phone OTP dispatch.

### 7. Operations & Platform Configuration Domain
- **Source of Truth**: `CommandCenterConfigService: CommandCenterSettings`, `IncidentEngineService`, `Prisma: OperationsQueueItem`
- **Domain Service**: `OperationsService`, `CommandCenterConfigService`
- **Ownership**: Feature kill switches (USSD, Instant Withdrawals, USDT Deposits, Mining Claims), system maintenance mode, DLQ retry/resolve engine, active incident tracking.

### 8. Security & Audit Domain
- **Source of Truth**: `Prisma: AdminUser, AdminSession, AuditEvent, RiskEvent`
- **Domain Service**: `AdminAuthService`, `OperationalAuditService`, `FraudCenterService`, `DualAuthorizationService`
- **Ownership**: Role-Based Access Control (Super Admin `5387655307`), immutable audit trail, velocity alarms, Sybil/shared-device detection.
