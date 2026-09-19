# WITHDRAWAL_PHASE_0_FORENSIC_REPORT

**Date:** 2025-01-09
**Status:** CRITICAL SAFETY FINDINGS IDENTIFIED
**Scope:** Complete TitanStream withdrawal system forensic audit

---

## EXECUTIVE SUMMARY

The current TitanStream withdrawal system contains **CRITICAL FINANCIAL SAFETY VIOLATIONS** that prevent production certification. The system is **NOT PRODUCTION-SAFE** and requires complete reconstruction.

### Key Blockers

1. **Eligibility is NOT based on authoritative purchase evidence** - Uses `User.qualifiedReferrals` counter without proof of genuine qualifying purchases
2. **No dedicated Withdrawal domain** - Uses SettlementSession as withdrawal aggregate, mixing deposits and payouts
3. **No proper withdrawal state machine** - Missing explicit state transitions and validation
4. **No jurisdiction/capability engine** - Client can override payment methods via `country` parameter
5. **No external provider integration** - Admin manual execution model without provider APIs
6. **No USDT blockchain integration** - No TRON broadcast, TXID verification, or blockchain watcher
7. **SYSTEM_ALLOCATION remains exploitable** - CryptoBot provider can still mint funds via SYSTEM_ALLOCATION
8. **Operator authentication bypassed** - Uses `x-operator-id` header without proper authentication
9. **No proper destination validation** - Weak phone/address validation
10. **Missing reconciliation engine** - No independent verification of external payouts

---

## CURRENT ARCHITECTURE

### Primary Withdrawal Flow

```
User Request
    ↓
WithdrawalService.initiateWithdrawal()
    ↓
User.qualifiedReferrals check (line 85-90)
    ↓
Recipient lock (lines 92-129)
    ↓
Risk evaluation (line 139)
    ↓
FinancialOrchestrator.requestOperation(WITHDRAWAL_RESERVE) (lines 154-166)
    ↓
SettlementSession.create() (lines 171-202)
    ↓
Status: AWAITING_ADMIN_EXECUTION
    ↓
Admin claim execution (lines 264-293)
    ↓
Admin mark executed (lines 327-351)
    ↓
Admin submit proof (lines 354-404)
    ↓
FinancialOrchestrator.requestOperation(WITHDRAWAL_SETTLE) (lines 425-433)
    ↓
Status: COMPLETED
```

### Database Model Used

**Primary aggregate:** `SettlementSession` (schema.prisma lines 772-821)

**Critical fields:**
- `sessionType: PAYOUT` (line 779)
- `provider: MERCHANT_MOBILE_MONEY | USDT` (line 778)
- `status: SettlementStatus` (line 787)
- `orchestratorReference` (line 804)
- `payoutTxHash` (line 800)
- `requiresFourEyes` (line 797)
- `verifiedRecipientAddress` (line 801)

**Missing dedicated withdrawal models:**
- No `Withdrawal` table
- No `WithdrawalAttempt` table
- No `WithdrawalVerification` table
- No `WithdrawalDestination` table
- No `WithdrawalAuditEvent` table

---

## CRITICAL FINANCIAL SAFETY VIOLATIONS

### 1. ELIGIBILITY NOT BASED ON AUTHORITATIVE PURCHASE EVIDENCE

**Location:** `services/api/src/modules/financial/withdrawal.service.ts` lines 84-90

```typescript
// Check Referral Qualification Guardrail (5 Qualified Referrals)
const qualifiedCount = user.qualifiedReferrals || 0;
if (qualifiedCount < 5) {
  throw new BadRequestException(
    `REFERRAL_THRESHOLD_NOT_MET: Withdrawal locked. You must have at least 5 qualified referrals to enable payouts (${qualifiedCount}/5).`,
  );
}
```

**Problem:**
- Uses `User.qualifiedReferrals` integer counter
- No verification that these referrals made **genuine qualifying purchases**
- Counter can be incremented without financial proof
- No link to `FinancialOperation`, `LedgerEntry`, or `PaymentIntent` records

**ReferralQualificationService:** `services/api/src/modules/growth/referral-qualification.service.ts`

```typescript
async getQualifiedReferralCount(telegramUserId: bigint): Promise<number> {
  const user = await this.prisma.user.findUnique({
    where: { telegramUserId },
    select: { qualifiedReferrals: true },
  });
  return user?.qualifiedReferrals ?? 0;
}
```

**Problem:**
- Simply reads the counter from User table
- `recountQualifiedReferrals()` (lines 140-161) only counts ReferralRelationship status
- No check for actual settled purchases
- No link to financial settlement records

**Referral status enum:** `ReferralStatus` includes `QUALIFIED`, `PAYING`, `REWARDED` but these are set based on:

**ReferralService.markRefereePaying:** `services/api/src/modules/growth/referral.service.ts` lines 16-50

```typescript
async markRefereePaying(refereeId: bigint): Promise<void) {
  const relationship = await this.prisma.referralRelationship.findUnique({
    where: { refereeId },
  });

  if (!relationship) return;

  if (
    relationship.status === ReferralStatus.PAYING ||
    relationship.status === ReferralStatus.REWARDED
  ) return;

  const updated = await this.prisma.referralRelationship.update({
    where: { id: relationship.id },
    data: { status: ReferralStatus.PAYING },
  });
  // ...
}
```

**Problem:**
- Status can be set to PAYING without proof of purchase
- No requirement for `FinancialOperation.COMPLETED`
- No requirement for `LedgerEntry` showing payment
- No requirement for `PaymentIntent.VERIFIED` or `SETTLED`

**Required fix:**
Create `WithdrawalEligibilityService` that queries authoritative purchase records:
- Count distinct referrals with `FinancialOperation.COMPLETED` of type `SYSTEM_ALLOCATION` or purchase-related
- Verify purchase amount > 0
- Verify purchase not reversed
- Verify purchase from authorized payment rail (not CryptoBot, not fake allocation)

---

### 2. NO DEDICATED WITHDRAWAL DOMAIN

**Location:** Entire withdrawal system uses `SettlementSession`

**Problem:**
- `SettlementSession` is shared between deposits (DEPOSIT) and payouts (PAYOUT)
- No separation of concerns
- Mixing deposit and payout logic in same table
- No dedicated withdrawal lifecycle tracking
- No withdrawal-specific audit trail

**Required fix:**
Create dedicated withdrawal domain models:
- `Withdrawal` - Primary withdrawal aggregate
- `WithdrawalAttempt` - External payout attempts
- `WithdrawalVerification` - External verification records
- `WithdrawalDestination` - Validated destinations
- `WithdrawalAuditEvent` - Withdrawal-specific audit

---

### 3. NO PROPER WITHDRAWAL STATE MACHINE

**Location:** `withdrawal.service.ts` - No explicit state machine

**Current states used:** `SettlementStatus` enum (schema.prisma lines 211-240)

```typescript
enum SettlementStatus {
  REQUESTED
  RISK_CHECKING
  CREATED
  INITIALIZED
  OPERATOR_ASSIGNED
  MERCHANT_ASSIGNED
  WAITING_FOR_PAYMENT
  WAITING_PAYMENT
  AWAITING_ADMIN_EXECUTION
  ADMIN_EXECUTION_IN_PROGRESS
  PAYOUT_EXECUTED
  PROOF_SUBMITTED
  PROOF_VERIFICATION_REQUIRED
  AWAITING_VERIFICATION
  VERIFYING
  APPROVED
  POSTED
  PAYMENT_RECEIVED
  USDT_SENT
  COMPLETED
  FAILED
  EXPIRED
  CANCELLED
  REJECTED
  REVERSED
  DISPUTED
  RISK_FLAGGED
  RISK_HOLD
}
```

**Problem:**
- No explicit allowed transition matrix
- Any state transition is possible via direct `update()` calls
- No validation of state transitions
- Mix of deposit and payout states
- No `RESERVED`, `SUBMITTED`, `CONFIRMING` states for proper withdrawal lifecycle

**Transitions in current code:**
- CREATED → AWAITING_ADMIN_EXECUTION (line 183)
- AWAITING_ADMIN_EXECUTION → ADMIN_EXECUTION_IN_PROGRESS (line 281)
- ADMIN_EXECUTION_IN_PROGRESS → PAYOUT_EXECUTED (line 339)
- PAYOUT_EXECUTED → PROOF_SUBMITTED / PROOF_VERIFICATION_REQUIRED (line 379)
- PROOF_SUBMITTED → COMPLETED (via verifyAndSettleWithdrawal line 438)
- Any → REJECTED (line 499)
- Any → EXPIRED (line 560)

**Missing states:**
- ELIGIBILITY_CHECKING
- ELIGIBLE
- RESERVED
- EXECUTION_PENDING
- SUBMITTED
- PROVIDER_PENDING
- CONFIRMING
- REVERSAL_PENDING

**Required fix:**
Implement explicit state machine with:
- `allowedTransitions[currentState]` validation
- Audit event on every transition
- State-specific business rules

---

### 4. NO JURISDICTION/CAPABILITY ENGINE

**Location:** `withdrawal.service.ts` - No jurisdiction validation

**Current network check:** lines 63, 95-96, 114-116

```typescript
const isMobileMoney = ['MOMO', 'MOBILE_MONEY', 'MTN', 'AIRTEL'].includes(netUpper);

if (isMobileMoney) {
  mmNetwork = dto.mobileMoneyNetwork || (netUpper === 'AIRTEL' ? 'AIRTEL' : 'MTN');
  // ...
} else {
  // USDT TRC-20 Recipient Lock
  if (netUpper !== 'TRC20' && netUpper !== 'TRON' && netUpper !== 'USDT') {
    throw new BadRequestException(`UNSUPPORTED_CRYPTO_NETWORK: USDT withdrawals require TRON (TRC-20) network. Provided: ${dto.network}`);
  }
```

**Problem:**
- Client can specify `country` parameter (line 19 in DTO)
- No server-side jurisdiction determination
- No region policy engine
- Client can override by changing `country` field
- No enforcement of East Africa (UG, KE, TZ, RW) vs rest-of-world policies
- No RESTRICTED/BLOCKED jurisdiction check

**Required fix:**
Create:
- `JurisdictionService` - Determine user jurisdiction from IP/phone/registered data
- `RegionPolicyService` - Define allowed methods per region
- `WithdrawalCapabilityService` - Enforce capability rules

---

### 5. NO EXTERNAL PROVIDER INTEGRATION

**Location:** Admin manual execution model

**Current flow:**
1. Admin claims withdrawal (line 264-293)
2. Admin gets payout instructions (line 296-325)
3. Admin marks as executed (line 327-351)
4. Admin submits proof (line 354-404)
5. Admin verifies and settles (line 406-474)

**Problem:**
- No provider API integration
- No external payout execution by server
- Admin manually executes payouts outside system
- No provider reference returned by API
- No automated status polling
- No provider callback handling
- Manual proof submission (can be forged)

**Required fix:**
Create:
- `MobileMoneyWithdrawalProvider` - Abstract provider interface
- Provider implementations for MTN, Airtel, etc.
- Server-side payout execution
- Provider status polling
- Provider callback verification

---

### 6. NO USDT BLOCKCHAIN INTEGRATION

**Location:** No blockchain provider exists

**Current USDT handling:**
- Line 114-116: Only validates network string
- Line 117-128: Only validates stored address
- No TRON broadcast
- No TXID generation
- No blockchain verification
- No confirmation threshold checking
- No blockchain watcher

**Problem:**
- USDT withdrawals cannot be executed
- No TRON integration
- No private key management
- No transaction construction
- No broadcast mechanism
- No transaction monitoring

**Required fix:**
Create:
- `BlockchainProvider` interface
- `TronBlockchainProvider` implementation
- Secure private key management
- Transaction construction and signing
- Broadcast mechanism
- Transaction verification
- Blockchain watcher

---

### 7. SYSTEM_ALLOCATION REMAINS EXPLOITABLE

**Location:** `services/api/src/modules/settlement/cryptobot/cryptobot.provider.ts` lines 89-97

```typescript
const reference = `settlement_${settlementId}`;
await this.orchestrator.requestOperation({
  telegramUserId: session.telegramUserId,
  operationType: FinancialOperationType.SYSTEM_ALLOCATION,
  assetCode: session.asset,
  amount: session.expectedCryptoAmount.toString(),
  idempotencyKey: reference,
  reference,
  metadata: { source: 'cryptobot_settlement', settlementId, provider: this.providerId, ...context },
});
```

**Problem:**
- CryptoBot provider can mint funds via `SYSTEM_ALLOCATION`
- Although `createSettlement()` throws error (line 58), `approveSettlement()` can still be called
- No check that CryptoBot is retired
- `SYSTEM_ALLOCATION` directly credits `USER_ASSET_LIABILITY` without external proof
- Can be exploited to manufacture funds

**Ledger posting for SYSTEM_ALLOCATION:** `command-processor.service.ts` lines 97-109

```typescript
if (command.operationType === FinancialOperationType.SYSTEM_ALLOCATION) {
  lines.push({
    ledgerAccountCode: 'PLATFORM_RESERVE',
    entryType: LedgerEntryType.DEBIT,
    amount: command.amount,
    reference: `${command.reference}-dr`,
  });
  lines.push({
    ledgerAccountCode: 'USER_ASSET_LIABILITY',
    entryType: LedgerEntryType.CREDIT,
    amount: command.amount,
    reference: `${command.reference}-cr`,
  });
}
```

**Problem:**
- Debits PLATFORM_RESERVE (may be insufficient)
- Credits USER_ASSET_LIABILITY (increases user balance)
- No external verification
- No proof of payment

**Required fix:**
- Remove or quarantine CryptoBot provider entirely
- Remove SYSTEM_ALLOCATION from user-accessible paths
- Ensure SYSTEM_ALLOCATION only for internal accounting
- Audit all SYSTEM_ALLOCATION usage

---

### 8. OPERATOR AUTHENTICATION BYPASSED

**Location:** `services/api/src/modules/settlement/operator-auth.decorator.ts`

```typescript
export const OperatorId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['x-operator-id'];
});
```

**Problem:**
- Reads operator ID from `x-operator-id` header
- No authentication verification
- No session validation
- No authorization check
- Any client can set this header
- Can impersonate any operator

**Required fix:**
- Use authenticated operator session/token
- Derive operatorId from session
- Verify operator is active and authorized
- Remove header-based identity assertion

---

### 9. NO PROPER DESTINATION VALIDATION

**Location:** `withdrawal.service.ts` lines 96-129

**Mobile Money validation:**
```typescript
if (!user.withdrawalPhoneNumber && !user.phoneNumber && dto.destinationAddress) {
  const initialPhone = this.normalizeUgandaPhone(dto.destinationAddress.trim());
  await this.prisma.user.update({
    where: { telegramUserId: dto.telegramUserId },
    data: {
      withdrawalPhoneNumber: initialPhone,
      withdrawalPhoneVerified: true,
      withdrawalPhoneVerifiedAt: new Date(),
    },
  });
  user.withdrawalPhoneNumber = initialPhone;
}
```

**Problem:**
- Client can set initial phone on first withdrawal
- No network validation
- No phone format validation beyond normalization
- No country code validation
- Cooling period exists but can be bypassed on first withdrawal

**USDT validation:**
```typescript
if (!user.verifiedUsdtAddress && dto.destinationAddress) {
  await this.prisma.user.update({
    where: { telegramUserId: dto.telegramUserId },
    data: { verifiedUsdtAddress: dto.destinationAddress.trim(), usdtAddressVerified: true, usdtAddressVerifiedAt: new Date() },
    });
  verifiedRecipient = dto.destinationAddress.trim();
}
```

**Problem:**
- Client can set USDT address on first withdrawal
- No TRON address format validation
- No checksum validation
- No network validation
- No contract validation

**Required fix:**
- Create `WithdrawalDestination` domain
- Validate phone format, network, provider
- Validate TRON address format, checksum, network
- Pre-registration requirement
- Cooling period enforcement

---

### 10. MISSING RECONCILIATION ENGINE

**Location:** No reconciliation service exists

**Current verification:**
- Admin submits proof (line 354-404)
- Admin verifies and settles (line 406-474)
- No independent verification
- No provider status check
- No blockchain verification

**Problem:**
- Manual proof submission
- No automated reconciliation
- No duplicate detection
- No mismatch detection
- No manual review queue for anomalies

**Required fix:**
Create `WithdrawalReconciliationService`:
- For Mobile Money: Query provider API for payout status
- For USDT: Query blockchain for transaction confirmation
- Match external truth to internal records
- Detect duplicates, mismatches, anomalies
- Route to manual review

---

## ALL WITHDRAWAL-RELATED ENDPOINTS

### User Endpoints

**Withdrawal Controller:** `services/api/src/modules/financial/withdrawal.controller.ts`

Based on service methods:
- `POST /withdrawals` - `initiateWithdrawal()` (line 47)
- `GET /withdrawals/history` - `getUserWithdrawalHistory()` (line 616)

### Admin Endpoints

**Admin Withdrawal Controller:** `services/api/src/modules/admin/controllers/admin-withdrawal.controller.ts`

- `GET /admin/withdrawals` - List withdrawals (line 23)
- `GET /admin/withdrawals/:id/payout-instructions` - Get payout details (line 60)
- `POST /admin/withdrawals/:id/claim` - Claim for execution (line 66)
- `POST /admin/withdrawals/:id/mark-executed` - Mark as executed (line 72)
- `POST /admin/withdrawals/:id/submit-proof` - Submit payout proof (line 78)
- `POST /admin/withdrawals/:id/verify-and-settle` - Verify and settle (line 88)
- `POST /admin/withdrawals/:id/approve` - Approve (line 99)
- `POST /admin/withdrawals/:id/reject` - Reject (line 110)
- `POST /admin/withdrawals/:id/retry` - Retry (line 120)

### Treasury Operator Endpoints

**Treasury Operator Controller:** `services/api/src/modules/treasury/treasury-operator.controller.ts`

Legacy endpoints for order approval/rejection (now quarantined based on PaymentIntent work).

---

## ALL FINANCIAL MUTATION PATHS

### Financial Orchestrator Operations

**Command Processor:** `services/api/src/modules/financial-orchestration/command-processor.service.ts`

**WITHDRAWAL_RESERVE** (lines 110-122):
```typescript
lines.push({
  ledgerAccountCode: 'USER_ASSET_LIABILITY',
  entryType: LedgerEntryType.DEBIT,
  amount: command.amount,
  reference: `${command.reference}-dr`,
});
lines.push({
  ledgerAccountCode: 'SUSPENSE',
  entryType: LedgerEntryType.CREDIT,
  amount: command.amount,
  reference: `${command.reference}-cr`,
});
```

**WITHDRAWAL_SETTLE** (lines 123-135):
```typescript
lines.push({
  ledgerAccountCode: 'SUSPENSE',
  entryType: LedgerEntryType.DEBIT,
  amount: command.amount,
  reference: `${command.reference}-dr`,
});
lines.push({
  ledgerAccountCode: 'PLATFORM_RESERVE',
  entryType: LedgerEntryType.CREDIT,
  amount: command.amount,
  reference: `${command.reference}-cr`,
});
```

**WITHDRAWAL_REVERSAL** (lines 136-148):
```typescript
lines.push({
  ledgerAccountCode: 'SUSPENSE',
  entryType: LedgerEntryType.DEBIT,
  amount: command.amount,
  reference: `${command.reference}-dr`,
});
lines.push({
  ledgerAccountCode: 'USER_ASSET_LIABILITY',
  entryType: LedgerEntryType.CREDIT,
  amount: command.amount,
  reference: `${command.reference}-cr`,
});
```

**SYSTEM_ALLOCATION** (lines 97-109):
```typescript
lines.push({
  ledgerAccountCode: 'PLATFORM_RESERVE',
  entryType: LedgerEntryType.DEBIT,
  amount: command.amount,
  reference: `${command.reference}-dr`,
});
lines.push({
  ledgerAccountCode: 'USER_ASSET_LIABILITY',
  entryType: LedgerEntryType.CREDIT,
  amount: command.amount,
  reference: `${command.reference}-cr`,
});
```

**Assessment:**
- ✅ WITHDRAWAL_RESERVE: Correct accounting (reserve user funds)
- ✅ WITHDRAWAL_SETTLE: Correct accounting (release suspense to platform reserve)
- ✅ WITHDRAWAL_REVERSAL: Correct accounting (return funds to user)
- ❌ SYSTEM_ALLOCATION: DANGEROUS - can mint funds without external proof

### Direct Balance Mutations

**Balance Service:** `services/api/src/modules/financial/balance.service.ts`

```typescript
async getBalances(telegramUserId: bigint, financialAccountId: string) {
  // Only READS from ledger entries
  const entries = await this.prisma.ledgerEntry.findMany({
    where: {
      financialAccountId,
      assetCode: asset.assetCode,
      ledgerAccount: { code: 'USER_ASSET_LIABILITY' },
    },
    select: { amount: true, entryType: true },
  });

  const available = entries.reduce((total, entry) => {
    return entry.entryType === LedgerEntryType.CREDIT
      ? total.plus(entry.amount)
      : total.minus(entry.amount);
  }, new Prisma.Decimal(0));
  // ...
}
```

**Assessment:**
- ✅ Balance is derived from ledger (no direct mutations)
- ✅ No direct balance.update() calls in withdrawal path

### AssetBalance Mutations

**Schema:** `AssetBalance` model (schema.prisma lines 454-475)

Fields:
- `availableBalance`
- `lockedBalance`
- `totalEarned`

**Assessment:**
- ❓ Unclear if AssetBalance is updated in withdrawal path
- ❓ Need to verify if any code directly updates AssetBalance
- ❓ If AssetBalance is updated, it must be in sync with ledger

---

## ALL LEGACY/DEPRECATED PATHS

### CryptoBot Provider

**Location:** `services/api/src/modules/settlement/cryptobot/`

**Files:**
- `cryptobot.provider.ts` - Settlement provider implementation
- `cryptobot.client.ts` - API client
- `cryptobot.controller.ts` - Controller
- `cryptobot.types.ts` - Types

**Status:**
- ❌ `createSettlement()` throws error (line 58) - funding retired
- ❌ `createInvoice()` throws error (cryptobot.client.ts line 37) - API disabled
- ⚠️ `approveSettlement()` still calls SYSTEM_ALLOCATION (line 89-97) - DANGEROUS
- ⚠️ Provider still registered in module - can be called if route exists

**Required action:**
- Complete removal or full quarantine
- Ensure no endpoint can call `approveSettlement()`
- Remove SYSTEM_ALLOCATION from CryptoBot
- Remove from module registration

### PaymentOrder Legacy

**Location:** `services/api/src/modules/payment-order/`

**Status:**
- ✅ Most methods quarantined (based on PaymentIntent work)
- ✅ Throws deprecation errors
- ⚠️ Legacy order approval/rejection paths in treasury may still exist

### SettlementSession for Withdrawals

**Problem:**
- SettlementSession is the shared deposit/payout aggregate
- Should be deprecated for withdrawals
- New Withdrawal domain needed

---

## CONCURRENCY AND IDEMPOTENCY

### Current Idempotency

**Withdrawal Service:** line 136
```typescript
const idKey = idempotencyKey || `wd_${dto.telegramUserId}_${Date.now()}`;
```

**Financial Orchestrator:** Uses `idempotencyKey` with uniqueness constraint (schema.prisma line 586)
```typescript
@@unique([telegramUserId, idempotencyKey])
```

**Assessment:**
- ✅ FinancialOperation has idempotency
- ✅ Duplicate requests rejected at orchestrator level
- ❌ No external provider idempotency
- ❌ Provider retries could cause duplicate payouts
- ❌ No idempotency for provider API calls

### Daily Limit Concurrency

**Risk Service:** `services/api/src/modules/financial/withdrawal-risk.service.ts`

**Assessment:**
- ❓ Need to verify if daily limit check is race-safe
- ❓ Concurrent withdrawals could exceed limit
- ❓ Need atomic limit checking

---

## RESTART RECOVERY

### Current State

**All withdrawal state in database:**
- ✅ SettlementSession persisted
- ✅ FinancialOperation persisted
- ✅ LedgerEntry persisted
- ❌ No in-memory state (good)
- ❌ No recovery workers for stuck withdrawals
- ❌ No reconciliation of orphaned withdrawals

**Stuck withdrawal scenarios:**
- Withdrawal reserved but admin never claims
- Withdrawal claimed but never executed
- Withdrawal executed but never verified
- Withdrawal verified but never settled
- Withdrawal expired but not reversed

**Assessment:**
- ✅ State is durable
- ❌ No automatic recovery
- ❌ No monitoring for stuck withdrawals
- ❌ No expiration sweeper (exists but may not be scheduled)

**Expiration Sweeper:** `withdrawal.service.ts` lines 535-573
```typescript
async expireStaleWithdrawals() {
  const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h timeout
  const staleSessions = await this.prisma.settlementSession.findMany({
    where: {
      sessionType: 'PAYOUT',
      status: { in: [SettlementStatus.AWAITING_ADMIN_EXECUTION, SettlementStatus.WAITING_PAYMENT, SettlementStatus.WAITING_FOR_PAYMENT] },
      createdAt: { lt: expiredCutoff },
    },
  });
  // ... reverses via WITHDRAWAL_REVERSAL
}
```

**Assessment:**
- ✅ Expiration sweeper exists
- ❓ Need to verify if scheduled/cron job runs
- ❓ Need to verify all relevant statuses covered

---

## OBSERVABILITY

### Current Events

**Event Bus:** `withdrawal.service.ts` publishes events:
- `WithdrawalRequested` (line 205)
- `WithdrawalReserved` (line 219)
- `WithdrawalAwaitingAdminExecution` (line 231)
- `WithdrawalClaimed` (line 285)
- `WithdrawalPayoutExecuted` (line 343)
- `WithdrawalProofSubmitted` (line 391)
- `WithdrawalCompleted` (line 461)
- `WithdrawalRejected` (line 517)
- `WithdrawalReversed` (line 525)
- `WithdrawalExpired` (line 563)

**Assessment:**
- ✅ Good event coverage
- ✅ Structured events with correlation IDs
- ❓ Need to verify event consumers exist
- ❓ Need to verify monitoring/alerting configured

### Audit Logging

**Operational Audit Service:** Used in rejection (line 452)

**Assessment:**
- ✅ Audit events created
- ❓ Need to verify audit trail completeness
- ❓ Need to verify audit queryability

---

## FOUR-EYES CONTROLS

### Current Implementation

**Threshold:** $40 / 150,000 UGX (line 150)
```typescript
const requiresFourEyes = dto.amount >= 40 || requestedFiatAmount >= 150000;
```

**Four-Eyes validation:** line 415-419
```typescript
if (session.requiresFourEyes && session.claimedByAdminId && session.claimedByAdminId === adminId) {
  throw new BadRequestException(
    'CANNOT_SELF_APPROVE_FOUR_EYES: High-value withdrawals require Four-Eyes dual control. A second administrator must verify and settle this payout.',
  );
}
```

**Assessment:**
- ✅ Four-eyes threshold defined
- ✅ Self-approval prevented
- ✅ Dual authorization token required (admin-withdrawal.controller.ts line 124-132)
- ❓ Need to verify RBAC roles enforced
- ❓ Need to verify operator roles

---

## PRODUCTION READINESS ASSESSMENT

### CRITICAL BLOCKERS

1. ❌ **Eligibility not based on authoritative purchase evidence** - User can qualify without genuine purchases
2. ❌ **No dedicated withdrawal domain** - Mixing deposits and payouts
3. ❌ **No proper state machine** - Arbitrary state transitions possible
4. ❌ **No jurisdiction/capability engine** - Client can override payment methods
5. ❌ **No external provider integration** - Manual admin execution only
6. ❌ **No USDT blockchain integration** - Cannot execute USDT withdrawals
7. ❌ **SYSTEM_ALLOCATION exploitable** - Can mint funds without proof
8. ❌ **Operator authentication bypassed** - Header-based identity
9. ❌ **No proper destination validation** - Weak validation
10. ❌ **Missing reconciliation engine** - No independent verification

### HIGH RISK

11. ❌ **No external idempotency** - Provider retries could duplicate payouts
12. ❌ **Daily limit not race-safe** - Concurrent withdrawals could exceed limit
13. ❌ **No recovery workers** - Stuck withdrawals may not auto-recover
14. ❌ **CryptoBot not fully removed** - SYSTEM_ALLOCATION path still exists

### MEDIUM RISK

15. ⚠️ **Expiration sweeper may not be scheduled** - Need to verify cron job
16. ⚠️ **Event consumers may not exist** - Need to verify monitoring
17. ⚠️ **AssetBalance sync with ledger** - Need to verify consistency

### ACCEPTABLE

18. ✅ **Financial accounting is correct** - Ledger entries are proper
19. ✅ **Balance is derived from ledger** - No direct mutations
20. ✅ **Four-eyes controls exist** - Self-approval prevented
21. ✅ **State is durable** - Database persistence
22. ✅ **Event coverage is good** - Structured events with correlation IDs

---

## PROPOSED MIGRATION MAP

### Phase 1: Create Withdrawal Domain

**New models:**
```prisma
model Withdrawal {
  id String @id @default(uuid())
  userId String
  telegramUserId BigInt
  asset String
  method String // MOBILE_MONEY, USDT_TRC20
  network String
  requestedAmount Decimal @db.Decimal(36, 18)
  feeAmount Decimal @db.Decimal(36, 18)
  netAmount Decimal @db.Decimal(36, 18)
  status WithdrawalStatus
  jurisdiction String
  destinationId String
  eligibilitySnapshot Json
  riskDecision Json
  reservedOperationId String?
  settlementOperationId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  expiresAt DateTime?
  completedAt DateTime?
  failureReason String?
  rejectionReason String?

  user User @relation(fields: [userId], references: [id])
  destination WithdrawalDestination
  attempts WithdrawalAttempt[]
  verifications WithdrawalVerification[]
  auditEvents WithdrawalAuditEvent[]
}

model WithdrawalStatus {
  CREATED
  ELIGIBILITY_CHECKING
  ELIGIBLE
  RESERVED
  PENDING_REVIEW
  APPROVED
  EXECUTION_PENDING
  SUBMITTED
  PROVIDER_PENDING
  CONFIRMING
  SETTLED
  FAILED
  REJECTED
  MANUAL_REVIEW
  REVERSAL_PENDING
  REVERSED
  CANCELLED
}

model WithdrawalAttempt {
  id String @id @default(uuid())
  withdrawalId String
  attemptNumber Int
  provider String
  providerIdempotencyKey String
  providerReference String?
  status WithdrawalAttemptStatus
  submittedAt DateTime?
  providerResponse Json?
  failureReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  withdrawal Withdrawal @relation(fields: [withdrawalId], references: [id])
}

model WithdrawalVerification {
  id String @id @default(uuid())
  withdrawalId String
  attemptId String?
  verificationType String // PROVIDER_STATUS, BLOCKCHAIN_TX
  externalReference String
  verificationResult Json
  status WithdrawalVerificationStatus
  verifiedAt DateTime?
  verifiedBy String? // SYSTEM or ADMIN
  createdAt DateTime @default(now())

  withdrawal Withdrawal @relation(fields: [withdrawalId], references: [id])
}

model WithdrawalDestination {
  id String @id @default(uuid())
  userId String
  type String // PHONE, TRON_ADDRESS
  value String
  network String?
  provider String?
  status String // PENDING, VERIFIED, REJECTED
  verifiedAt DateTime?
  verificationMetadata Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  withdrawals Withdrawal[]
}

model WithdrawalAuditEvent {
  id String @id @default(uuid())
  withdrawalId String
  eventType String
  actorId String
  actorType String
  fromStatus String?
  toStatus String?
  payload Json
  createdAt DateTime @default(now())

  withdrawal Withdrawal @relation(fields: [withdrawalId], references: [id])
}
```

### Phase 2: Implement State Machine

```typescript
const ALLOWED_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  CREATED: ['ELIGIBILITY_CHECKING', 'FAILED', 'CANCELLED'],
  ELIGIBILITY_CHECKING: ['ELIGIBLE', 'FAILED', 'REJECTED'],
  ELIGIBLE: ['RESERVED', 'FAILED', 'CANCELLED'],
  RESERVED: ['PENDING_REVIEW', 'APPROVED', 'REVERSAL_PENDING', 'FAILED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'MANUAL_REVIEW'],
  APPROVED: ['EXECUTION_PENDING', 'REVERSAL_PENDING'],
  EXECUTION_PENDING: ['SUBMITTED', 'FAILED'],
  SUBMITTED: ['PROVIDER_PENDING', 'CONFIRMING', 'FAILED'],
  PROVIDER_PENDING: ['CONFIRMING', 'FAILED', 'MANUAL_REVIEW'],
  CONFIRMING: ['SETTLED', 'FAILED', 'MANUAL_REVIEW'],
  SETTLED: [], // Terminal
  FAILED: ['REVERSAL_PENDING'],
  REJECTED: ['REVERSAL_PENDING'],
  MANUAL_REVIEW: ['SETTLED', 'REJECTED', 'REVERSAL_PENDING'],
  REVERSAL_PENDING: ['REVERSED', 'FAILED'],
  REVERSED: [], // Terminal
  CANCELLED: [], // Terminal
};
```

### Phase 3: Create WithdrawalEligibilityService

```typescript
@Injectable()
export class WithdrawalEligibilityService {
  async checkEligibility(telegramUserId: bigint): Promise<EligibilityResult> {
    // Count distinct referrals with COMPLETED purchases
    const purchases = await this.prisma.financialOperation.findMany({
      where: {
        referrerId: telegramUserId, // Need to add referrerId to FinancialOperation
        operationType: FinancialOperationType.SYSTEM_ALLOCATION, // Or purchase type
        status: FinancialOperationStatus.COMPLETED,
      },
      distinct: ['telegramUserId'],
    });

    const distinctPurchasers = purchases.length;

    if (distinctPurchasers < 5) {
      return {
        eligible: false,
        qualifiedCount: distinctPurchasers,
        requirement: 5,
        reason: `Need ${5 - distinctPurchasers} more genuine purchasing referrals`,
      };
    }

    return { eligible: true, qualifiedCount: distinctPurchasers, requirement: 5 };
  }
}
```

### Phase 4: Implement Provider Abstraction

```typescript
interface WithdrawalProvider {
  createPayout(request: PayoutRequest): Promise<PayoutResponse>;
  getPayoutStatus(providerReference: string): Promise<PayoutStatus>;
  verifyPayout(providerReference: string): Promise<VerificationResult>;
  cancelPayout(providerReference: string): Promise<CancellationResult>;
}

interface MobileMoneyWithdrawalProvider extends WithdrawalProvider {
  validatePhone(phone: string, network: string): ValidationResult;
}

interface BlockchainWithdrawalProvider extends WithdrawalProvider {
  validateAddress(address: string, network: string): ValidationResult;
  getBalance(): Promise<Decimal>;
  estimateFee(address: string, amount: Decimal): Promise<Decimal>;
  broadcastTransfer(transaction: SignedTransaction): Promise<TxId>;
  getTransaction(txId: string): Promise<Transaction>;
  getConfirmations(txId: string): Promise<number>;
}
```

### Phase 5: Implement Reconciliation

```typescript
@Injectable()
export class WithdrawalReconciliationService {
  async reconcileMobileMoney(attemptId: string): Promise<ReconciliationResult> {
    const attempt = await this.prisma.withdrawalAttempt.findUnique({
      where: { id: attemptId },
    });

    const providerStatus = await this.provider.getPayoutStatus(attempt.providerReference);

    if (providerStatus === 'SUCCESS') {
      await this.verifyWithdrawal(attempt.withdrawalId, {
        type: 'PROVIDER_STATUS',
        externalReference: attempt.providerReference,
        result: providerStatus,
      });
      return { status: 'MATCHED' };
    }

    if (providerStatus === 'FAILED') {
      return { status: 'FAILED' };
    }

    return { status: 'PENDING' };
  }

  async reconcileUSDT(attemptId: string): Promise<ReconciliationResult> {
    const attempt = await this.prisma.withdrawalAttempt.findUnique({
      where: { id: attemptId },
    });

    const tx = await this.blockchainProvider.getTransaction(attempt.providerReference);

    if (!tx) {
      return { status: 'NOT_FOUND' };
    }

    if (tx.confirmations >= REQUIRED_CONFIRMATIONS) {
      await this.verifyWithdrawal(attempt.withdrawalId, {
        type: 'BLOCKCHAIN_TX',
        externalReference: attempt.providerReference,
        result: tx,
      });
      return { status: 'CONFIRMED' };
    }

    return { status: 'PENDING_CONFIRMATIONS' };
  }
}
```

---

## GATE CONDITION

**STOP - DO NOT PROCEED TO IMPLEMENTATION**

The following critical blockers must be resolved before implementation:

1. ✅ **Current architecture fully documented** - This report
2. ❌ **Authoritative purchase source identified** - Need to identify what constitutes a "genuine qualifying purchase"
3. ❌ **Provider API credentials available** - Need Mobile Money provider credentials
4. ❌ **USDT signing infrastructure available** - Need secure key management for TRON
5. ❌ **Business requirements clarified** - Need confirmation on:
   - What exactly constitutes a "genuine qualifying purchase"?
   - Which Mobile Money providers to integrate?
   - What confirmation threshold for USDT?
   - What four-eyes thresholds?
   - What daily limits?

**ACTION REQUIRED:**
Before proceeding to Phase 1 implementation, obtain:
- Clarification on "genuine qualifying purchase" definition
- Mobile Money provider API credentials and documentation
- USDT TRON signing infrastructure or secure key management solution
- Confirmation on business rules (thresholds, limits, providers)

---

## END OF PHASE 0 FORENSIC REPORT
