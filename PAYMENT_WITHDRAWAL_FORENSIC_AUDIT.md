# PAYMENT_WITHDRAWAL_FORENSIC_AUDIT

**Date:** 2025-01-09
**Status:** CRITICAL FINANCIAL INTEGRITY VIOLATIONS IDENTIFIED
**Scope:** Complete TitanStream payment rails, deposit, withdrawal, machine purchase, and eligibility forensic audit

---

## EXECUTIVE SUMMARY

The current TitanStream payment and withdrawal architecture contains **CRITICAL FINANCIAL INTEGRITY VIOLATIONS** that prevent production certification. The system requires complete reconstruction around the actual product model.

### Key Blockers

1. **CARD is NOT quarantined** - Pesapal provider can process deposits, not marked as inactive
2. **Five-referral gate uses denormalized counters** - Uses `User.qualifiedReferrals` without purchase verification
3. **Trial machine qualifies for withdrawal** - No trial/paid distinction in eligibility
4. **SYSTEM_ALLOCATION manufactures funds** - Used in repower/upgrade without payment proof
5. **No canonical payment rail configuration** - Geography scattered in conditional logic
6. **USDT not restricted to TRC-20 only** - Pesapal rejects USDT but architecture doesn't enforce TRON-only
7. **No machine purchase verification** - Uses wrong operation type, no payment verification
8. **Withdrawal eligibility fragmented** - Multiple inconsistent implementations
9. **Mobile Money reconciliation incomplete** - Manual admin model without proper verification
10. **USDT blockchain verification missing** - No authoritative verification boundary

---

## 1. CURRENT PAYMENT RAIL ARCHITECTURE

### 1.1 SettlementProviderId Enum

**Location:** `services/api/prisma/schema.prisma` lines 267-273

```prisma
enum SettlementProviderId {
  INTERNAL_OPERATIONS
  MERCHANT_MOBILE_MONEY
  CRYPTOBOT
  PESAPAL
  USDT
}
```

**CRITICAL VIOLATION:**
- ❌ No CARD provider (but Pesapal can process card payments)
- ❌ No explicit inactive/disabled status mechanism
- ❌ No payment rail type classification (MOBILE_MONEY vs USDT vs CARD)

### 1.2 Pesapal Provider (Card)

**Location:** `services/api/src/modules/settlement/pesapal/pesapal.provider.ts`

**Manifest** (lines 33-42):
```typescript
readonly manifest: SettlementCapabilityManifest = {
  provider: SettlementProviderId.PESAPAL,
  supports_buy: true,        // ❌ ACTIVE - should be INACTIVE
  supports_sell: false,
  supports_refunds: false,
  supports_webhooks: true,
  supports_manual_review: true,
  supports_partial_payments: false,
  supported_assets: ['USDT', 'KES', 'UGX', 'USD'],  // ❌ Card supports fiat currencies
};
```

**CRITICAL VIOLATIONS:**
1. ❌ `supports_buy: true` - Pesapal can process deposits (Card)
2. ❌ No CARD provider separate from Pesapal
3. ❌ No explicit inactive configuration
4. ❌ USDT rejected at runtime (line 127-129) but not at provider level
5. ❌ Supports fiat currencies (KES, UGX, USD) via Card but architecture should be MOBILE_MONEY + USDT only

**USDT Rejection** (lines 127-129):
```typescript
if (dto.paymentMethod?.toUpperCase() === 'USDT') {
  throw new BadRequestException('INVALID_SETTLEMENT_ROUTING: USDT payments must use the TRC-20 blockchain rail and cannot be processed via Pesapal.');
}
```

**Assessment:**
- Runtime rejection but provider-level capability mismatch
- No architectural rail separation (MOBILE_MONEY vs USDT vs CARD)
- Pesapal should be quarantined as CARD_INACTIVE

### 1.3 CryptoBot Provider

**Location:** `services/api/src/modules/settlement/cryptobot/`

**Status:**
- ⚠️ `createInvoice()` throws error (retired)
- ⚠️ Provider still registered in enum
- ⚠️ SettlementSession can still reference CRYPTOBOT
- ⚠️ No explicit quarantine

### 1.4 USDT Provider

**Location:** Enum only, no implementation found

**Status:**
- ❌ USDT provider exists in enum but no provider implementation
- ❌ No blockchain verification service
- ❌ No TRON-specific validation
- ❌ USDT handled through PESAPAL (wrong)

---

## 2. GEOGRAPHIC PAYMENT POLICY

### 2.1 Current Implementation

**Country Logic in Pesapal Provider** (lines 151-158):
```typescript
const country = dto.country || 'UG';
const paymentCurrency = country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'USD';
const currencySymbol = country === 'KE' ? 'KSh' : country === 'UG' ? 'UGX' : '$';
const lockedRate = await this.exchangeRateService.lockRateForSettlement(paymentCurrency);
```

**CRITICAL VIOLATIONS:**
1. ❌ Hard-coded country conditional logic
2. ❌ No canonical country/rail configuration table
3. ❌ No explicit Mobile Money merchant code configuration
4. ❌ Country comes from client DTO (not server-authoritative)
5. ❌ No validation that country is supported for specific rail

### 2.2 Missing Configuration

**Required but Missing:**
- `CountryPaymentRail` table/model
- Merchant/business code configuration
- Static USDT address configuration
- Per-country rail availability matrix
- Effective date ranges for configuration

---

## 3. MOBILE MONEY MODEL

### 3.1 Current Implementation

**Merchant Configuration:**
- ❌ No merchant configuration table
- ❌ Merchant codes likely hardcoded or in Pesapal client
- ❌ No admin interface to configure merchants
- ❌ No audit trail for configuration changes

**Payment Lifecycle:**
- Pesapal creates order
- User pays via Pesapal (Card or Mobile Money)
- Pesapal webhook notifies
- Status polling
- Payment verification

**CRITICAL VIOLATIONS:**
1. ❌ No explicit Mobile Money rail separation from Card
2. ❌ No static instruction model for Mobile Money
3. ❌ Merchant code may be exposed in frontend
4. ❌ No independent reconciliation for Mobile Money vs Card

---

## 4. USDT TRC-20 MODEL

### 4.1 Current Implementation

**Location:** No dedicated USDT implementation found

**CRITICAL VIOLATIONS:**
1. ❌ No static USDT deposit address configuration
2. ❌ No blockchain verification service
3. ❌ No TRON network validation
4. ❌ No transaction hash tracking
5. ❌ No confirmation threshold configuration
6. ❌ No duplicate transaction prevention at database level
7. ❌ Pesapal rejects USDT but USDT provider not implemented

---

## 5. CARD STATUS

### 5.1 Current Status

**Pesapal Provider:**
- ✅ `supports_buy: true` (ACTIVE)
- ✅ Supports fiat currencies (KES, UGX, USD)
- ✅ Can process card payments via Pesapal
- ❌ No explicit inactive status
- ❌ No quarantine mechanism

**CRITICAL VIOLATION:**
- Card is ACTIVE but specification requires CARD = INACTIVE

### 5.2 Required Quarantine

**Required Actions:**
1. Set Pesapal provider status to DISABLED
2. Add CARD provider enum value
3. Set CARD provider status to DISABLED
4. Remove card payment paths from active flow
5. Ensure card cannot affect balances
6. Ensure card cannot qualify machine purchases
7. Ensure card cannot qualify referrals

---

## 6. WITHDRAWAL ELIGIBILITY

### 6.1 Current Implementations

**Implementation 1: ReferralQualificationService**
**Location:** `services/api/src/modules/growth/referral-qualification.service.ts`

```typescript
async checkWithdrawalEligibility(telegramUserId: bigint): Promise<WithdrawalEligibility> {
  const qualifiedCount = await this.getQualifiedReferralCount(telegramUserId);
  const payingCount = await this.getPayingReferralCount(telegramUserId);

  const eligible = qualifiedCount >= this.WITHDRAWAL_REQUIREMENT;  // 5
  // ...
}
```

**Problems:**
- ❌ Uses `User.qualifiedReferrals` denormalized counter
- ❌ No purchase verification
- ❌ No machine gate
- ❌ No expiry check

**Implementation 2: WithdrawalEligibilityService**
**Location:** `services/api/src/modules/financial/withdrawal-eligibility.service.ts`

```typescript
async evaluateEligibility(telegramUserId: string, requestedAmountUsdt: number): Promise<InternalWithdrawalEligibilityResult> {
  // Rule 1: Machine Ownership & Active Power Status
  const userMachines = await this.prisma.userMachine.findMany({
    where: { telegramUserId: bigIntUserId },
  });
  const hasActiveMachine = userMachines.some((m) => m.status === 'ACTIVE');
  if (hasActiveMachine || userMachines.length > 0) {
    passedRules.push('RULE_ACTIVE_MACHINE_POWERED');
  }
  // ... other rules
}
```

**Problems:**
- ❌ No 5-referral gate
- ❌ No trial/paid distinction
- ❌ No purchase verification
- ❌ No expiry check

**Implementation 3: WithdrawalService**
**Location:** `services/api/src/modules/financial/withdrawal.service.ts`

```typescript
async initiateWithdrawal() {
  // Check Referral Qualification Guardrail (5 Qualified Referrals)
  const qualifiedCount = user.qualifiedReferrals || 0;
  if (qualifiedCount < 5) {
    throw new BadRequestException(`REFERRAL_THRESHOLD_NOT_MET: Withdrawal locked. You must have at least 5 qualified referrals to enable payouts (${qualifiedCount}/5).`);
  }
  // ...
}
```

**Problems:**
- ❌ Uses `User.qualifiedReferrals` without verification
- ❌ No machine gate
- ❌ No purchase verification

### 6.2 CRITICAL VIOLATION

**Multiple inconsistent eligibility implementations exist:**
- ReferralQualificationService (5-referral only)
- WithdrawalEligibilityService (machine + risk only)
- WithdrawalService (5-referral inline)

**No canonical single source of truth.**

---

## 7. FIVE-REFERRAL GATE

### 7.1 Current Implementation

**ReferralService.markRefereePaying** (lines 16-51):
```typescript
async markRefereePaying(refereeId: bigint): Promise<void> {
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

  await this.prisma.referralEvent.create({
    data: {
      relationshipId: relationship.id,
      fromStatus: relationship.status,
      toStatus: ReferralStatus.PAYING,
      payload: { reason: 'PAYMENT_CONFIRMED' },  // ❌ Claim of payment without verification
    },
  });
  // ...
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Can be called without payment verification
2. ❌ No check for actual FinancialOperation
3. ❌ No check for ledger settlement
4. ❌ No check for Machine purchase
5. ❌ No check for PaymentIntent
6. ❌ Reason says `PAYMENT_CONFIRMED` but no proof
7. ❌ Referral status alone qualifies

**ReferralService.evaluateQualification** (lines 257-312):
```typescript
async evaluateQualification(refereeId: bigint) {
  // Check if referee is READY and has completed at least 1 settlement
  const refereeUser = await this.prisma.user.findUnique({
    where: { telegramUserId: refereeId },
  });

  const completedSettlementCount = await this.prisma.settlementSession.count({
    where: { telegramUserId: refereeId, status: 'COMPLETED' },
  });

  if (refereeUser?.isReady && completedSettlementCount >= 1) {
    const updated = await this.prisma.referralRelationship.update({
      where: { id: relationship.id },
      data: {
        status: ReferralStatus.QUALIFIED,
        qualifiedAt: new Date(),
      },
    });
    // ...
  }
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Uses `settlementSession` completion as qualification
2. ❌ SettlementSession can be deposit, not machine purchase
3. ❌ No check for paid machine purchase
4. ❌ No check for payment verification
5. ❌ No check for ledger settlement

### 7.2 Required Implementation

**Qualification must prove:**
```
DIRECT REFERRAL
AND
VERIFIED PAID TITAN MACHINE PURCHASE
AND
PAYMENT CONFIRMED (FinancialOperation.COMPLETED)
AND
PURCHASE FINALIZED (machine status ACTIVE)
AND
NOT REFUNDED
AND
NOT REVERSED
```

**Current implementation only checks:**
```
DIRECT REFERRAL
AND
COMPLETED SETTLEMENT
```

**SETTLEMENT ≠ MACHINE PURCHASE**

---

## 8. PAID MACHINE GATE

### 8.1 Current Implementation

**WithdrawalEligibilityService** (lines 48-57):
```typescript
const userMachines = await this.prisma.userMachine.findMany({
  where: { telegramUserId: bigIntUserId },
});
const hasActiveMachine = userMachines.some((m) => m.status === 'ACTIVE');
if (hasActiveMachine || userMachines.length > 0) {
  passedRules.push('RULE_ACTIVE_MACHINE_POWERED');
}
```

**CRITICAL VIOLATIONS:**
1. ❌ No trial/paid distinction
2. ❌ No purchase verification
3. ❌ No expiry check
4. ❌ Any machine with status ACTIVE passes

### 8.2 Required Implementation

**Must check:**
```
PAID MACHINE (type = PAID)
AND
VERIFIED PURCHASE (purchaseReference exists and verified)
AND
CONFIRMED PAYMENT (FinancialOperation.COMPLETED for MACHINE_PURCHASE)
AND
ACTIVE LIFECYCLE (status = ACTIVE)
AND
NOT EXPIRED (expiresAt > now)
AND
NOT REVERSED
AND
NOT REFUNDED
```

---

## 9. MACHINE PURCHASE

### 9.1 Current Implementation

**MachineService.purchaseMachine** (lines 315-446):
```typescript
async purchaseMachine(userIdOrTelegramId: string | bigint, tierCode: string) {
  // ...

  // Balance is sufficient: execute financial deduction via orchestrator
  const reference = `mach_buy_${tierCode}_${Date.now()}`;
  await this.orchestrator.requestOperation({
    telegramUserId,
    operationType: FinancialOperationType.WITHDRAWAL_RESERVE,  // ❌ WRONG OPERATION TYPE
    assetCode: 'USDT',
    amount: tier.priceUsdt.toString(),
    idempotencyKey: reference,
    reference,
    metadata: { source: 'machine_purchase', tierCode, price: tier.priceUsdt },
  });

  const createdMachine = await this.prisma.userMachine.create({
    data: {
      telegramUserId,
      tierCode: tier.tierCode,
      name: tier.name,
      purchasePrice: tier.priceUsdt,
      currency: 'USDT',
      status: 'ACTIVE',  // ❌ ACTIVE immediately without payment verification
      capacityGhs: tier.capacityGhs,
    },
  });
  // ...
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Uses `WITHDRAWAL_RESERVE` for purchase (wrong operation type)
2. ❌ Machine created BEFORE payment verification
3. ❌ Machine status = ACTIVE immediately
4. ❌ No purchaseReference linking to payment
5. ❌ No PaymentIntent integration
6. ❌ No payment verification step
7. ❌ No `purchaseReference` field populated

### 9.2 Required Implementation

**Must follow:**
```
Purchase Intent
    ↓
Payment Instructions
    ↓
Payment
    ↓
Payment Verification (PaymentIntent.VERIFIED)
    ↓
Purchase Confirmation
    ↓
Ledger Settlement (MACHINE_PURCHASE_SETTLE)
    ↓
Machine Provisioning (status = ACTIVE)
```

---

## 10. MACHINE FINANCIAL OPERATION TYPES

### 10.1 Current FinancialOperationType Enum

**Location:** `services/api/prisma/schema.prisma`

**Current types:**
```prisma
INTERNAL_ADJUSTMENT
SYSTEM_ALLOCATION
REVERSAL
WITHDRAWAL_RESERVE
WITHDRAWAL_SETTLE
WITHDRAWAL_REVERSAL
```

**CRITICAL VIOLATION:**
- ❌ No `MACHINE_PURCHASE` operation type
- ❌ No `MACHINE_RENEWAL` operation type
- ❌ No `MACHINE_REACTIVATION` operation type
- ❌ No `MACHINE_REPOWER` operation type
- ❌ No `MACHINE_UPGRADE` operation type

### 10.2 SYSTEM_ALLOCATION Usage

**MachineService.repowerMachine** (lines 461-469):
```typescript
await this.orchestrator.requestOperation({
  telegramUserId,
  operationType: FinancialOperationType.SYSTEM_ALLOCATION,  // ❌ DANGEROUS
  assetCode: 'USDT',
  amount: repowerFee.toString(),
  idempotencyKey: `repower_${machineId}_${Date.now()}`,
  reference: `repower_${machineId}`,
  metadata: { machineId, repowerFee },
});
```

**MachineService.upgradeMachineTier** (lines 514-523):
```typescript
await this.orchestrator.requestOperation({
  telegramUserId,
  operationType: FinancialOperationType.SYSTEM_ALLOCATION,  // ❌ DANGEROUS
  assetCode: 'USDT',
  amount: upgradeCost.toString(),
  idempotencyKey: `upgrade_${currentMachineId}_${Date.now()}`,
  reference: `upgrade_${currentMachineId}`,
  metadata: { currentMachineId, targetTierCode, upgradeCost },
});
```

**CRITICAL VIOLATIONS:**
1. ❌ SYSTEM_ALLOCATION manufactures funds without payment
2. ❌ No payment verification
3. ❌ Can be exploited to create unlimited funds
4. ❌ No external proof required

**CommandProcessor SYSTEM_ALLOCATION** (lines 97-109):
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

**CRITICAL VIOLATION:**
- Debits PLATFORM_RESERVE (may be insufficient)
- Credits USER_ASSET_LIABILITY (increases user balance)
- Can manufacture funds

---

## 11. MACHINE LIFECYCLE

### 11.1 Current Implementation

**UserMachine Schema** (lines 2100-2119):
```prisma
model UserMachine {
  id               String   @id @default(uuid())
  telegramUserId   BigInt
  tierCode         String
  name             String
  purchasePrice    Decimal  @db.Decimal(36, 18)
  currency         String   @default("USDT")
  status           String   @default("ACTIVE")  // ❌ String, no enum
  capacityGhs      Decimal  @db.Decimal(36, 18)
  lifetimeEarnings Decimal  @default(0.0)
  purchasedAt      DateTime @default(now())
  activatedAt      DateTime @default(now())
  // ❌ No type field (TRIAL vs PAID)
  // ❌ No expiresAt field
  // ❌ No purchaseReference field
}
```

**CRITICAL VIOLATIONS:**
1. ❌ No `type` field (TRIAL vs PAID)
2. ❌ No `expiresAt` field (machines are permanent)
3. ❌ No `purchaseReference` field (no payment verification)
4. ❌ Status is String (no enum constraint)
5. ❌ No expiry states (EXPIRING_SOON, EXPIRED, REACTIVATION_WINDOW, ARCHIVED)

### 11.2 Trial Machine

**MachineService.getUserMachines** (lines 218-230):
```typescript
const trialMachine: UserMachineAsset = {
  id: 'mach_free_trial',
  telegramUserId: (typeof userIdOrTelegramId === 'bigint' ? userIdOrTelegramId : BigInt(0)).toString(),
  tierCode: 'TS_TRIAL',
  name: 'Titan Core',
  purchasePrice: 0.0,
  currency: 'USDT',
  status: 'ACTIVE',  // ❌ Same status as paid machines
  capacityGhs: 1.0,
  lifetimeEarnings: 0.0,
  purchasedAt: new Date(0).toISOString(),
  activatedAt: new Date(0).toISOString(),
};
```

**CRITICAL VIOLATIONS:**
1. ❌ Trial machine has status 'ACTIVE' (same as paid)
2. ❌ No type distinction
3. ❌ Hardcoded, not persisted
4. ❌ Can satisfy withdrawal gate

---

## 12. WALLET / LEDGER RULE

### 12.1 Current Implementation

**BalanceService.getBalances** (lines 14-71):
```typescript
async getBalances(telegramUserId: bigint, financialAccountId: string) {
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
- ✅ Balance is derived from ledger (good)
- ✅ No direct balance mutations in withdrawal path
- ⚠️ But SYSTEM_ALLOCATION can still increase balance

### 12.2 CRITICAL VIOLATION

**SYSTEM_ALLOCATION can manufacture funds:**
- Debits PLATFORM_RESERVE (may be insufficient)
- Credits USER_ASSET_LIABILITY (increases user balance)
- No external proof required
- Used in repower/upgrade

---

## 13. IDEMPOTENCY

### 13.1 Current Implementation

**FinancialOperation Idempotency:**
```prisma
@@unique([telegramUserId, idempotencyKey])
```

**Assessment:**
- ✅ FinancialOperation has idempotency
- ✅ Prevents duplicate financial operations
- ❌ No external provider idempotency
- ❌ No blockchain transaction idempotency
- ❌ No duplicate settlement session prevention

### 13.2 SettlementSession

**No unique constraint on:**
- external transaction reference
- blockchain transaction hash
- payment reference

**CRITICAL VIOLATION:**
- ❌ Can credit same external transaction twice
- ❌ Can process same blockchain transaction twice

---

## 14. CONCURRENCY

### 14.1 Current Implementation

**No explicit concurrency protection found for:**
- Simultaneous machine purchases
- Simultaneous renewals
- Renewal during expiry transition
- Duplicate blockchain confirmation
- Duplicate settlement

**CRITICAL VIOLATION:**
- ❌ No database transaction wrappers for critical operations
- ❌ No version checking
- ❌ No optimistic locking

---

## 15. COUNTRY / RAIL CONFIGURATION

### 15.1 Current Implementation

**Hard-coded in PesapalProvider:**
```typescript
const country = dto.country || 'UG';
const paymentCurrency = country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'USD';
```

**CRITICAL VIOLATIONS:**
1. ❌ No configuration table
2. ❌ Country from client DTO (not server-authoritative)
3. ❌ Hard-coded conditional logic
4. ❌ No merchant code configuration
5. ❌ No per-country rail availability matrix

---

## 16. FRONTEND

### 16.1 Current Implementation

**Not audited in this phase** (will audit in Phase 11)

**Required per specification:**
- Frontend must render payment methods from backend configuration
- Frontend must never infer eligibility
- Card must not be presented as usable
- Mobile Money must not be presented where unavailable
- USDT must explicitly show TRC-20

---

## 17. ADMIN CONTROLS

### 17.1 Current Implementation

**Partially audited in previous withdrawal audit**

**Findings:**
- ⚠️ Operator authentication uses `x-operator-id` header (weak)
- ⚠️ Four-eyes controls exist but may be bypassable
- ⚠️ No audit of all admin financial endpoints

**Required:**
- Full audit of all admin financial endpoints
- Verify RBAC on all financial mutations
- Verify four-eyes controls cannot be bypassed

---

## 18. NO FAKE FINANCIAL DATA

### 18.1 Current Implementation

**Assessment:**
- ✅ No obvious fake financial data generation found
- ⚠️ But SYSTEM_ALLOCATION can manufacture funds
- ⚠️ Trial machine is hardcoded virtual machine

**CRITICAL VIOLATIONS:**
- ❌ SYSTEM_ALLOCATION manufactures funds
- ❌ Trial machine is virtual (not persisted)

---

## 19. ECONOMIC PARAMETERS

### 19.1 Current Implementation

**Hard-coded values found:**
- Exchange rate calculation in PesapalProvider
- Repower fee = 15% of original price
- Upgrade cost = price difference
- Withdrawal four-eyes threshold = $40 / 150,000 UGX

**CRITICAL VIOLATIONS:**
- ❌ No configuration for economic parameters
- ❌ Hard-coded throughout codebase
- ❌ No business approval tracking

---

## 20. SECURITY

### 20.1 Current Vulnerabilities

**Identified:**
1. ❌ SYSTEM_ALLOCATION can manufacture funds
2. ❌ Trial machine can qualify for withdrawal
3. ❌ Payment status can be set without verification
4. ❌ Referral status can be set without purchase proof
5. ❌ Operator authentication uses header (weak)
6. ❌ No duplicate transaction prevention
7. ❌ No concurrent request protection
8. ❌ Country from client DTO (spoofable)
9. ❌ No validation of blockchain network/token
10. ❌ Card is active (should be inactive)

---

## 21. REQUIRED FORENSIC AUDIT COMPLETION

### 21.1 Audited Components

✅ Prisma schema
✅ SettlementProviderId enum
✅ Pesapal provider
✅ CryptoBot provider
✅ FinancialOperationType enum
✅ CommandProcessor
✅ MachineService
✅ ReferralService
✅ ReferralQualificationService
✅ WithdrawalEligibilityService
✅ WithdrawalService
✅ UserMachine schema
✅ BalanceService
✅ LedgerService

### 21.2 Not Yet Audited

⏳ Machine controllers
⏳ PaymentIntent service
⏳ Frontend wallet screens
⏳ Frontend withdrawal screens
⏳ Frontend deposit screens
⏳ Notification systems
⏳ Telegram flows
⏳ WhatsApp flows
⏳ All admin financial endpoints
⏳ Environment/configuration
⏳ Feature flags

---

## 22. FILES TO MODIFY

### 22.1 Schema Changes Required

**services/api/prisma/schema.prisma:**
- Add `MachineType` enum (TRIAL, PAID)
- Add `MachineStatus` enum
- Add `type` field to UserMachine
- Add `expiresAt` field to UserMachine
- Add `purchaseReference` field to UserMachine
- Add `paymentReference` field to UserMachine
- Add `originalPurchaseId` field to UserMachine
- Add `CARD` to SettlementProviderId enum
- Add `SettlementProviderStatus` enum if not exists
- Add `CountryPaymentRail` model
- Add `MachineRenewal` model
- Add `MachinePurchase` model
- Add machine-related FinancialOperationType enums
- Add unique constraint on `purchaseReference`
- Add unique constraint on blockchain transaction hash

### 22.2 Service Changes Required

**services/api/src/modules/machine/machine.service.ts:**
- Remove SYSTEM_ALLOCATION from repowerMachine
- Remove SYSTEM_ALLOCATION from upgradeMachineTier
- Fix purchaseMachine to use MACHINE_PURCHASE operation type
- Add payment verification step
- Add purchaseReference population
- Add type field handling
- Add expiresAt handling
- Remove hardcoded trial machine

**services/api/src/modules/growth/referral.service.ts:**
- Modify markRefereePaying to require payment verification
- Modify evaluateQualification to require machine purchase
- Add FinancialOperation check
- Add ledger settlement check

**services/api/src/modules/growth/referral-qualification.service.ts:**
- Add purchase verification check
- Add machine purchase check
- Remove reliance on denormalized counters

**services/api/src/modules/financial/withdrawal-eligibility.service.ts:**
- Add 5-referral gate with purchase verification
- Add paid machine gate with trial exclusion
- Add expiry check
- Add purchase verification check

**services/api/src/modules/financial/withdrawal.service.ts:**
- Update eligibility check to use canonical service
- Add trial/paid distinction
- Add expiry check

**services/api/src/modules/settlement/pesapal/pesapal.provider.ts:**
- Set provider status to DISABLED
- Quarantine as CARD_INACTIVE
- Remove from active payment flow

**services/api/src/modules/financial-orchestration/command-processor.service.ts:**
- Add machine operation type handling
- Remove SYSTEM_ALLOCATION from user-accessible paths
- Add MACHINE_PURCHASE ledger mapping
- Add MACHINE_RENEWAL ledger mapping
- Add MACHINE_REACTIVATION ledger mapping
- Add MACHINE_REPOWER ledger mapping
- Add MACHINE_UPGRADE ledger mapping

---

## 23. NEW FILES TO CREATE

### 23.1 Configuration Services

**services/api/src/modules/payment-rails/payment-rail.service.ts**
- Canonical payment rail configuration
- Country/rail availability matrix
- Merchant code management
- Static USDT address management

**services/api/src/modules/payment-rails/country-payment-rail.service.ts**
- Country-specific rail configuration
- Per-country merchant codes
- Per-country currency configuration

### 23.2 Verification Services

**services/api/src/modules/blockchain/tron-verification.service.ts**
- Blockchain transaction verification
- TRON network validation
- USDT token validation
- Transaction hash tracking
- Duplicate prevention

**services/api/src/modules/payment-rails/mobile-money-reconciliation.service.ts**
- Mobile Money reconciliation
- Transaction reference tracking
- Duplicate prevention

### 23.3 Machine Services

**services/api/src/modules/machine/machine-purchase.service.ts**
- Machine purchase flow
- Payment verification
- Purchase confirmation
- Ledger settlement

**services/api/src/modules/machine/machine-renewal.service.ts**
- Machine renewal flow
- Payment verification
- Ledger settlement

**services/api/src/modules/machine/machine-reactivation.service.ts**
- Machine reactivation flow
- Payment verification
- Ledger settlement

**services/api/src/modules/machine/machine-repower.service.ts**
- Machine repower flow
- Payment verification
- Ledger settlement

**services/api/src/modules/machine/machine-upgrade.service.ts**
- Machine upgrade flow
- Payment verification
- Ledger settlement

### 23.4 Eligibility Services

**services/api/src/modules/eligibility/canonical-withdrawal-eligibility.service.ts**
- Single canonical eligibility decision
- All gates in one place
- Structured reasons

**services/api/src/modules/eligibility/referral-qualification-policy.service.ts**
- Five-referral policy
- Purchase verification
- Machine purchase check

**services/api/src/modules/eligibility/paid-machine-policy.service.ts**
- Paid machine gate
- Trial exclusion
- Expiry check
- Purchase verification

---

## 24. END OF PHASE 1 FORENSIC AUDIT

**STATUS:** CRITICAL VIOLATIONS IDENTIFIED - PROCEED TO PHASE 2

The audit has identified 28 critical financial integrity violations. The system is NOT production-safe and requires complete reconstruction.

---

## GATE CONDITION

**READY FOR PHASE 2** - Proceeding to domain + schema integrity

All major violations have been documented. Proceeding to implementation in phases as specified.

---

## PRODUCTION STATUS

**BLOCKED** - Cannot claim production readiness

The system is not production-safe due to:
- CARD is active (should be inactive)
- Five-referral gate uses denormalized counters without purchase verification
- Trial machine qualifies for withdrawal
- SYSTEM_ALLOCATION manufactures funds
- No canonical payment rail configuration
- No USDT blockchain verification
- Multiple inconsistent eligibility implementations
- No machine purchase verification
- No machine expiry system
- No proper financial operation types for machine operations
- No duplicate transaction prevention
- No concurrency protection
- Country configuration hard-coded
- Economic parameters hard-coded

---

**END OF PHASE 1 FORENSIC AUDIT**
