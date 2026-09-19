# MACHINE_LIFECYCLE_WITHDRAWAL_GATE_AUDIT

**Date:** 2025-01-09
**Status:** CRITICAL ARCHITECTURAL VIOLATIONS IDENTIFIED
**Scope:** Complete TitanStream machine lifecycle and withdrawal eligibility forensic audit

---

## EXECUTIVE SUMMARY

The current TitanStream machine implementation contains **CRITICAL VIOLATIONS** of the required machine lifecycle and withdrawal eligibility specification. The system is **NOT PRODUCTION-SAFE** and requires complete reconstruction.

### Key Blockers

1. **No machine expiry system exists** - Machines are permanent, no lifecycle
2. **Trial Machine NOT excluded from withdrawal eligibility** - Current eligibility accepts any active machine
3. **No distinction between Trial and Paid machines** - Both treated as ACTIVE
4. **No canonical paid machine verification** - No check for purchase verification
5. **SYSTEM_ALLOCATION used for repower/upgrade** - Can manufacture funds without proof
6. **No renewal/reactivation system** - Cannot extend or reactivate machines
7. **No expiry notifications** - No lifecycle warnings
8. **No proper purchase operation** - Uses WITHDRAWAL_RESERVE for machine purchase
9. **WithdrawalEligibilityService incomplete** - Missing 5-referral gate
10. **No economic analysis of machine tiers** - Revenue/impact unknown

---

## 1. CURRENT MACHINE ARCHITECTURE

### Database Schema

**UserMachine Model** (schema.prisma lines 2100-2119)

```prisma
model UserMachine {
  id               String   @id @default(uuid())
  telegramUserId   BigInt
  tierCode         String
  name             String
  purchasePrice    Decimal  @db.Decimal(36, 18)
  currency         String   @default("USDT")
  status           String   @default("ACTIVE")
  capacityGhs      Decimal  @db.Decimal(36, 18)
  lifetimeEarnings Decimal  @default(0.0)
  purchasedAt      DateTime @default(now())
  activatedAt      DateTime @default(now())

  user     User            @relation(fields: [telegramUserId], references: [telegramUserId])
  outputs  MachineOutput[]

  @@index([telegramUserId])
  @@index([status])
}
```

**CRITICAL MISSING FIELDS:**
- ❌ `type` field to distinguish TRIAL vs PAID
- ❌ `expiresAt` field for expiry
- ❌ `purchaseReference` for payment verification
- ❌ `renewalHistory` for lifecycle tracking
- ❌ `originalPurchaseId` for upgrade tracking

**Status field:** String (no enum constraint)
- Current values: 'CREATED', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'MAINTENANCE', 'RETIRED'
- Missing: 'EXPIRED', 'EXPIRING_SOON', 'REACTIVATION_WINDOW', 'ARCHIVED'

### Machine Service

**Location:** `services/api/src/modules/machine/machine.service.ts`

**Machine Tiers** (lines 62-174):

| Tier Code | Name | Price USDT | Capacity GH/s | Daily Yield USDT |
|-----------|------|------------|---------------|------------------|
| TS_TRIAL | Titan Core | 0.0 | 1.0 | 2.0 |
| TS_C10 | Ripple X14 | 10.99 | 5.0 | 0.27 |
| TS_A50 | Surge R28 | 50.0 | 25.0 | 1.40 |
| TS_P250 | Torrent V63 | 250.0 | 130.0 | 7.50 |
| TS_X1000 | Cascade M91 | 1000.0 | 550.0 | 32.00 |
| TS_Q2500 | StreamTitan 2028 | 2500.0 | 1500.0 | 85.00 |

**Economic Calibration Knobs** (for each tier):
- `passiveYieldRate` - Base passive yield rate
- `promoYieldRate` - Promotional yield rate
- `promoOutputCap` - Promotional output cap
- `spinnerSpeedMultiplier` - UI spinner speed
- `promoSpinnerSpeedMultiplier` - Promotional spinner speed
- `maxMultiplier` - Maximum yield multiplier
- `multiplierDecayPerSec` - Multiplier decay rate
- `interactiveBaseRate` - Interactive bonus rate
- `interactiveBonusCap` - Interactive bonus cap
- `promoMultiplierInfluence` - Promotional multiplier influence

---

## 2. CURRENT TRIAL MACHINE

### Implementation

**Location:** `machine.service.ts` lines 218-230

```typescript
const trialMachine: UserMachineAsset = {
  id: 'mach_free_trial',
  telegramUserId: (typeof userIdOrTelegramId === 'bigint' ? userIdOrTelegramId : BigInt(0)).toString(),
  tierCode: 'TS_TRIAL',
  name: 'Titan Core',
  purchasePrice: 0.0,
  currency: 'USDT',
  status: 'ACTIVE',
  capacityGhs: 1.0,
  lifetimeEarnings: 0.0,
  purchasedAt: new Date(0).toISOString(),
  activatedAt: new Date(0).toISOString(),
};
```

**CRITICAL VIOLATION:**
- ❌ Trial machine is **hardcoded** and **always returned** in `getUserMachines()`
- ❌ Trial machine has status 'ACTIVE' (same as paid machines)
- ❌ No way to distinguish trial from paid in the returned list
- ❌ Trial machine has no database record (virtual)
- ❌ No `type` field to filter out trial from eligibility checks

**Trial Machine Description** (lines 69-72):
```
"Free baseline node that earns indefinitely."
```

**VIOLATION:** Spec requires trial to be for acquisition/activation only, not indefinite earnings for withdrawal eligibility.

---

## 3. CURRENT PAID MACHINE TIERS

### Tier Analysis

Based on catalog in `machine.service.ts`:

| Tier | Price | Lifetime | Daily Yield | Annual Yield | Payback Period |
|------|-------|----------|-------------|--------------|----------------|
| TS_C10 | $10.99 | PERMANENT | $0.27 | $98.55 | ~40 days |
| TS_A50 | $50.00 | PERMANENT | $1.40 | $511.00 | ~36 days |
| TS_P250 | $250.00 | PERMANENT | $7.50 | $2,737.50 | ~33 days |
| TS_X1000 | $1,000.00 | PERMANENT | $32.00 | $11,680.00 | ~31 days |
| TS_Q2500 | $2,500.00 | PERMANENT | $85.00 | $31,025.00 | ~29 days |

**CRITICAL FINDING:**
- ❌ All paid machines are **PERMANENT** (no expiry)
- ❌ Payback periods are extremely short (29-40 days)
- ❌ After payback, machines generate pure profit indefinitely
- ❌ No lifetime limit creates unlimited platform liability
- ❌ No renewal revenue model (one-time purchase only)
- ❌ No reactivation revenue (one-time purchase only)

**Economic Concerns:**
- No platform margin calculation in catalog
- No hardware cost validation
- No cloud compute cost tracking
- GrowthContribution uses fixed 70% COGS estimate (may not reflect actual costs)
- Unlimited lifetime creates unbounded liability
- No sustainability analysis

---

## 4. CURRENT MACHINE EXPIRY BEHAVIOR

### Current State

**CRITICAL VIOLATION:**
- ❌ **No expiry system exists**
- ❌ No `expiresAt` field in UserMachine schema
- ❌ No expiry scheduler
- ❌ No expiry check in any service
- ❌ No expiry state transitions
- ❌ No expiry notifications

**Evidence:**
- UserMachine schema has no `expiresAt` field
- MachineService has no expiry-related methods
- No scheduler/cron job for expiry processing
- WithdrawalEligibilityService does not check expiry

**Impact:**
- Machines never expire
- Trial machine remains active indefinitely
- Paid machines remain active indefinitely
- No renewal revenue possible
- No reactivation revenue possible
- Platform liability is unbounded

---

## 5. CURRENT RENEWAL/REPOWER BEHAVIOR

### Repower Implementation

**Location:** `machine.service.ts` lines 448-495

```typescript
async repowerMachine(userIdOrTelegramId: string | bigint, machineId: string) {
  const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);
  const machine = await this.prisma.userMachine.findUnique({
    where: { id: machineId },
  });
  if (!machine || machine.telegramUserId !== telegramUserId) {
    throw new NotFoundException('Machine not found');
  }

  const tier = this.catalog.find((t) => t.tierCode === machine.tierCode);
  const repowerFee = tier ? tier.priceUsdt * 0.15 : 1.65;

  // Record double-entry repower transaction in Ledger
  await this.orchestrator.requestOperation({
    telegramUserId,
    operationType: FinancialOperationType.SYSTEM_ALLOCATION,  // DANGEROUS
    assetCode: 'USDT',
    amount: repowerFee.toString(),
    idempotencyKey: `repower_${machineId}_${Date.now()}`,
    reference: `repower_${machineId}`,
    metadata: { machineId, repowerFee },
  });

  const updated = await this.prisma.userMachine.update({
    where: { id: machineId },
    data: {
      status: 'ACTIVE',
      activatedAt: new Date(),  // Only updates activatedAt, does NOT extend expiresAt
    },
  });

  // ... notification and audit

  return {
    success: true,
    machine: updated,
    message: `Machine ${machine.name} repowered successfully for 30 days!`,  // LIES - no 30 day extension
  };
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Uses `SYSTEM_ALLOCATION` - can manufacture funds without payment proof
2. ❌ Does NOT extend `expiresAt` (no expiry to extend)
3. ❌ Message claims "30 days" but nothing actually extends
4. ❌ No payment verification
5. ❌ No purchase operation
6. ❌ No ledger settlement

### Upgrade Implementation

**Location:** `machine.service.ts` lines 497-553

```typescript
async upgradeMachineTier(userIdOrTelegramId: string | bigint, currentMachineId: string, targetTierCode: string) {
  // ... validation

  const currentTier = this.catalog.find((t) => t.tierCode === currentMachine.tierCode);
  const currentPrice = currentTier ? currentTier.priceUsdt : currentMachine.purchasePrice.toNumber();
  const upgradeCost = Math.max(0, targetTier.priceUsdt - currentPrice);

  if (upgradeCost > 0) {
    await this.orchestrator.requestOperation({
      telegramUserId,
      operationType: FinancialOperationType.SYSTEM_ALLOCATION,  // DANGEROUS
      assetCode: 'USDT',
      amount: upgradeCost.toString(),
      idempotencyKey: `upgrade_${currentMachineId}_${Date.now()}`,
      reference: `upgrade_${currentMachineId}`,
      metadata: { currentMachineId, targetTierCode, upgradeCost },
    });
  }

  const updatedMachine = await this.prisma.userMachine.update({
    where: { id: currentMachineId },
    data: {
      tierCode: targetTier.tierCode,
      name: targetTier.name,
      capacityGhs: targetTier.capacityGhs,
      purchasePrice: targetTier.priceUsdt,  // OVERWRITES original price
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
  });

  // ... recalc and audit
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Uses `SYSTEM_ALLOCATION` - can manufacture funds
2. ❌ Overwrites `purchasePrice` - loses original purchase history
3. ❌ No payment verification
4. ❌ No purchase operation
5. ❌ No ledger settlement
6. ❌ No upgrade history tracking

### Purchase Implementation

**Location:** `machine.service.ts` lines 315-446

```typescript
async purchaseMachine(userIdOrTelegramId: string | bigint, tierCode: string) {
  // ... validation

  // Balance is sufficient: execute financial deduction via orchestrator
  const reference = `mach_buy_${tierCode}_${Date.now()}`;
  await this.orchestrator.requestOperation({
    telegramUserId,
    operationType: FinancialOperationType.WITHDRAWAL_RESERVE,  // WRONG OPERATION TYPE
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
      status: 'ACTIVE',
      capacityGhs: tier.capacityGhs,
    },
  });

  // ... growth contribution, notification, audit
}
```

**CRITICAL VIOLATIONS:**
1. ❌ Uses `WITHDRAWAL_RESERVE` for purchase - wrong operation type
2. ❌ Should use dedicated `MACHINE_PURCHASE` operation type
3. ❌ Purchase is not verified against payment
4. ❌ No external payment verification
5. ❌ Machine created BEFORE payment verified
6. ❌ No purchase reference stored
7. ❌ No settlement operation to finalize purchase

---

## 6. CURRENT WITHDRAWAL ELIGIBILITY

### WithdrawalEligibilityService

**Location:** `services/api/src/modules/financial/withdrawal-eligibility.service.ts`

**Current Eligibility Rules** (lines 34-142):

```typescript
// Rule 1: Machine Ownership & Active Power Status
const userMachines = await this.prisma.userMachine.findMany({
  where: { telegramUserId: bigIntUserId },
});
const hasActiveMachine = userMachines.some((m) => m.status === 'ACTIVE');
if (hasActiveMachine || userMachines.length > 0) {
  passedRules.push('RULE_ACTIVE_MACHINE_POWERED');
} else {
  failedRules.push('RULE_NO_ACTIVE_MACHINE');
  internalEligibilityScore -= 25;
}
```

**CRITICAL VIOLATIONS:**
1. ❌ **Does NOT check for 5 genuine purchasing referrals** - missing gate
2. ❌ **Does NOT distinguish Trial from Paid machine** - trial passes gate
3. ❌ Does NOT check for purchase verification
4. ❌ Does NOT check for expiry (no expiry to check)
5. ❌ Accepts ANY active machine including Trial
6. ❌ No referral qualification policy
7. ❌ No paid machine policy

**Rule 2-7:** Other rules (minimum threshold, compliance, treasury, operator contribution, fraud score, transaction exposure) - these are valid but insufficient without the two core business gates.

---

## 7. CONFLICTS WITH SPECIFICATION

### Specification Requirement

> **Withdrawal eligibility = 5 genuine purchasing referrals + ≥1 active paid machine**

### Current Implementation

> **Withdrawal eligibility = any active machine (including trial) + other risk rules**

**Conflicts:**

| Requirement | Current | Status |
|-------------|---------|--------|
| 5 genuine purchasing referrals | ❌ Not checked | MISSING |
| Active paid machine | ❌ Any machine accepted | WRONG |
| Trial machine excluded | ❌ Trial passes gate | WRONG |
| Purchase verification | ❌ Not checked | MISSING |
| Machine expiry | ❌ No expiry | MISSING |
| Paid vs Trial distinction | ❌ No type field | MISSING |

---

## 8. DATABASE CHANGES REQUIRED

### Required New Fields

**UserMachine model:**

```prisma
model UserMachine {
  id               String   @id @default(uuid())
  telegramUserId   BigInt
  tierCode         String
  name             String
  type             MachineType @default(TRIAL)  // NEW
  purchasePrice    Decimal  @db.Decimal(36, 18)
  currency         String   @default("USDT")
  status           MachineStatus @default(ACTIVE)  // NEW ENUM
  capacityGhs      Decimal  @db.Decimal(36, 18)
  lifetimeEarnings Decimal  @default(0.0)
  purchasedAt      DateTime @default(now())
  activatedAt      DateTime @default(now())
  expiresAt        DateTime?                       // NEW
  purchaseReference String?                         // NEW
  originalPurchaseId String?                         // NEW for upgrades

  user     User            @relation(fields: [telegramUserId], references: [telegramUserId])
  outputs  MachineOutput[]
  renewalHistory MachineRenewal[]                  // NEW relation

  @@index([telegramUserId])
  @@index([status])
  @@index([type])                                  // NEW
  @@index([expiresAt])                             // NEW
}

enum MachineType {
  TRIAL
  PAID
}

enum MachineStatus {
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
  ACTIVE
  EXPIRING_SOON
  EXPIRED
  REACTIVATION_WINDOW
  ARCHIVED
}
```

**New Models:**

```prisma
model MachineRenewal {
  id               String   @id @default(uuid())
  userMachineId     String
  renewalType       RenewalType
  amountUsdt        Decimal  @db.Decimal(36, 18)
  operationId      String
  previousExpiresAt DateTime
  newExpiresAt      DateTime
  appliedAt         DateTime @default(now())
  metadata          Json?

  userMachine UserMachine @relation(fields: [userMachineId], references: [id])

  @@index([userMachineId])
  @@index([appliedAt])
}

enum RenewalType {
  INITIAL_PURCHASE
  RENEWAL
  REPOWER
  UPGRADE
  REACTIVATION
}
```

---

## 9. STATE MACHINE

### Current State Machine

**Status values in schema:** String (no constraint)

**Current statuses used:**
- CREATED
- PENDING_PAYMENT
- ACTIVE
- PAUSED
- MAINTENANCE
- RETIRED

**Missing states:**
- ELIGIBILITY_CHECKING
- ELIGIBLE
- RESERVED
- EXPIRING_SOON
- EXPIRED
- REACTIVATION_WINDOW
- ARCHIVED

### Required State Machine

```typescript
const ALLOWED_TRANSITIONS: Record<MachineStatus, MachineStatus[]> = {
  CREATED: ['ELIGIBILITY_CHECKING', 'FAILED', 'CANCELLED'],
  ELIGIBILITY_CHECKING: ['ELIGIBLE', 'FAILED', 'REJECTED'],
  ELIGIBLE: ['RESERVED', 'FAILED', 'CANCELLED'],
  RESERVED: ['ACTIVE', 'FAILED', 'REVERSAL_PENDING'],
  ACTIVE: ['EXPIRING_SOON', 'PAUSED', 'MAINTENANCE', 'REACTIVATION_WINDOW'],
  EXPIRING_SOON: ['ACTIVE', 'EXPIRED'],
  EXPIRED: ['REACTIVATION_WINDOW', 'ARCHIVED'],
  REACTIVATION_WINDOW: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [], // Terminal
  PAUSED: ['ACTIVE'],
  MAINTENANCE: ['ACTIVE'],
  RETIRED: [], // Terminal
  FAILED: [],
  CANCELLED: [],
  REJECTED: [],
  REVERSAL_PENDING: ['ACTIVE', 'REVERSED'],
  REVERSED: [],
};
```

---

## 10. ECONOMIC MODEL

### Current Machine Economics

**GrowthContribution for Machine Purchase** (lines 125-144 in growth-contribution.service.ts):

```typescript
async recordMachineContribution(
  machineId: string,
  telegramUserId: bigint,
  purchasePrice: string | number,
  tierCode: string,
) {
  const price = new Prisma.Decimal(purchasePrice || 0);
  // 30% upfront hardware margin basis (70% COGS for cloud compute provisioning)
  const directCost = price.mul(0.70);

  return this.recordContribution({
    telegramUserId,
    economicEventType: 'MACHINE_PURCHASE',
    economicEventId: machineId,
    grossRevenueUsdt: price.toString(),
    directCostUsdt: directCost.toString(),
    costBasis: 'ESTIMATED_HARDWARE_70PCT',
    isCostEstimated: true,
  });
}
```

**Economic Analysis:**

| Tier | Price | Est. Cost (70%) | Est. Margin (30%) | Annual Yield | Payback | Annual Margin After Payback |
|------|-------|-----------------|-------------------|-------------|---------|------------------------------|
| TS_C10 | $10.99 | $7.69 | $3.30 | $98.55 | 40 days | $95.25/year (infinite) |
| TS_A50 | $50.00 | $35.00 | $15.00 | $511.00 | 36 days | $496.00/year (infinite) |
| TS_P250 | $250.00 | $175.00 | $75.00 | $2,737.50 | 33 days | $2,662.50/year (infinite) |
| TS_X1000 | $1,000.00 | $700.00 | $300.00 | $11,680.00 | 31 days | $11,380.00/year (infinite) |
| TS_Q2500 | $2,500.00 | $1,750.00 | $750.00 | $31,025.00 | 29 days | $30,275.00/year (infinite) |

**CRITICAL ECONOMIC CONCERNS:**

1. ❌ **Unbounded platform liability** - Machines generate profit indefinitely after payback
2. ❌ **No renewal revenue model** - One-time purchase only
3. ❌ **No sustainability analysis** - What happens when 10,000 users have machines?
4. ❌ **Cost basis is estimated** - 70% may not reflect actual cloud compute costs
5. ❌ **No scaling cost tracking** - Does cost scale with users?
6. ❌ **No risk pricing** - No fee for platform risk
7. ❌ **No inflation protection** - Fixed price, indefinite yield

**BUSINESS DECISION REQUIRED:**
- Should machines have finite lifetime?
- What should the lifetime be?
- What should renewal pricing be?
- What should renewal period be?
- Can renewals stack?
- What is the economic model for sustainability?

---

## 11. WITHDRAWAL GATE PROOF

### Current Implementation

**WithdrawalEligibilityService** checks machine ownership (lines 48-57):

```typescript
const userMachines = await this.prisma.userMachine.findMany({
  where: { telegramUserId: bigIntUserId },
});
const hasActiveMachine = userMachines.some((m) => m.status === 'ACTIVE');
if (hasActiveMachine || userMachines.length > 0) {
  passedRules.push('RULE_ACTIVE_MACHINE_POWERED');
} else {
  failedRules.push('RULE_NO_ACTIVE_MACHINE');
  internalEligibilityScore -= 25;
}
```

**Status:** ❌ **FAIL**

**Problems:**
1. Does NOT distinguish Trial from Paid
2. Does NOT check for 5 genuine purchasing referrals
3. Does NOT verify purchase payment
4. Does NOT check expiry

**Required Implementation:**

```typescript
async checkPaidMachineGate(telegramUserId: bigint): Promise<PaidMachineResult> {
  // Check for active PAID machines (exclude TRIAL)
  const paidMachines = await this.prisma.userMachine.findMany({
    where: {
      telegramUserId,
      type: 'PAID',
      status: 'ACTIVE',
      expiresAt: { gt: new Date() }, // Not expired
    },
  });

  if (paidMachines.length === 0) {
    return {
      passes: false,
      reason: 'NO_ACTIVE_PAID_MACHINE',
      message: 'An active paid Titan Machine is required for withdrawals.',
    };
  }

  return {
    passes: true,
    reason: 'PAID_MACHINE_ACTIVE',
    message: 'Paid machine requirement satisfied.',
  };
}
```

---

## 12. TRIAL EXCLUSION PROOF

### Current Implementation

**Status:** ❌ **FAIL**

**Evidence:**
1. Trial machine is hardcoded in `getUserMachines()` (line 218-230)
2. Trial machine has `status: 'ACTIVE'` (line 225)
3. Trial machine has `tierCode: 'TS_TRIAL'` (line 221)
4. WithdrawalEligibilityService checks `status === 'ACTIVE'` (line 51)
5. Trial machine passes the machine gate

**Required Implementation:**

```typescript
async checkTrialExclusion(telegramUserId: bigint): Promise<TrialExclusionResult> {
  const trialMachine = await this.prisma.userMachine.findFirst({
    where: {
      telegramUserId,
      tierCode: 'TS_TRIAL',
      type: 'TRIAL',
    },
  });

  if (trialMachine && trialMachine.status === 'ACTIVE') {
    // Check if user ALSO has active paid machine
    const paidMachines = await this.prisma.userMachine.findMany({
      where: {
        telegramUserId,
        type: 'PAID',
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });

    if (paidMachines.length === 0) {
      return {
        passes: false,
        reason: 'TRIAL_ONLY',
        message: 'The Free Trial Machine does not qualify for withdrawals. Purchase a paid Titan Machine to enable withdrawals.',
      };
    }
  }

  return {
    passes: true,
    reason: 'PAID_MACHINE_EXISTS',
    message: 'Paid machine requirement satisfied.',
  };
}
```

---

## 13. WALLET PRESERVATION PROOF

### Current Implementation

**Status:** ✅ **PASS**

**Evidence:**
1. Machine purchase uses `FinancialOrchestrator.requestOperation()` (line 364)
2. Repower uses `FinancialOrchestrator.requestOperation()` (line 461)
3. Upgrade uses `FinancialOrchestrator.requestOperation()` (line 514)
4. No direct balance mutations found
5. BalanceService only reads from ledger (balance.service.ts lines 14-71)
6. All accounting flows through ledger

**Concerns:**
- ⚠️ Purchase uses wrong operation type (`WITHDRAWAL_RESERVE` instead of `MACHINE_PURCHASE`)
- ⚠️ Repower/Upgrade use `SYSTEM_ALLOCATION` (dangerous but still goes through ledger)

**Assessment:**
- ✅ No direct balance mutations
- ✅ All financial operations go through ledger
- ⚠️ Operation types need correction
- ⚠️ SYSTEM_ALLOCATION needs to be removed from user-accessible paths

---

## 14. NOTIFICATIONS

### Current Implementation

**Machine Purchase Notification** (lines 299-303, 404-408):

```typescript
await this.notification.createNotification({
  userId: telegramUserId,
  templateCode: 'MACHINE_ACTIVATED',
  variables: { machineName: `${machineName} (${capacityGhs} GH/s)` },
});
```

**Status:** ⚠️ **PARTIAL**

**Missing:**
- ❌ No expiry notifications (EXPIRING_SOON, EXPIRY_7_DAYS, EXPIRY_3_DAYS, EXPIRY_24_HOURS, EXPIRED)
- ❌ No reactivation notifications
- ❌ No renewal notifications
- ❌ Notification idempotency not verified

**Required:**
```typescript
// Expiry warning notifications
async sendExpiryWarning(machineId: string, daysRemaining: number) {
  await this.notification.createNotification({
    userId: telegramUserId,
    templateCode: 'MACHINE_EXPIRING_SOON',
    variables: { daysRemaining, machineName },
  });
}

// Expired notification
async sendExpiredNotification(machineId: string) {
  await this.notification.createNotification({
    userId: telegramUserId,
    templateCode: 'MACHINE_EXPIRED',
    variables: { machineName },
  });
}
```

---

## 15. TESTS

### Current Tests

**WithdrawalEligibilityService Spec** (treasury/operator-intelligence.spec.ts lines 65-85):

```typescript
it('should evaluate internal withdrawal eligibility and return 7-rule diagnostics', async () => {
  const internalEval = await eligibilityService.evaluateEligibility('123456', 50.0);

  expect(internalEval.eligibility).toBe(true);
  expect(internalEval.internalEligibilityScore).toBeGreaterThanOrEqual(70);
  expect(internalEval.fraudScore).toBeLessThan(50);
  expect(internalEval.passedRules.length).toBeGreaterThan(0);
});
```

**Status:** ❌ **FAIL**

**Missing Tests:**
- ❌ Trial machine exclusion test
- ❌ Paid machine gate test
- ❌ 5-referral gate test
- ❌ Expiry test
- ❌ Wallet preservation test
- ❌ Referral preservation test
- ❌ Progress preservation test
- ❌ Renewal test
- ❌ Invalid renewal test
- ❌ Duplicate renewal test
- ❌ Scheduler restart test
- ❌ Concurrent withdrawal/renewal test

---

## 16. REMAINING BUSINESS DECISIONS

### CRITICAL BUSINESS DECISIONS REQUIRED

1. **Machine Lifetime**
   - Should paid machines have finite lifetime?
   - If yes, what should the lifetime be? (30 days? 90 days? 180 days? 365 days?)
   - If no, how to handle unbounded liability?

2. **Renewal Model**
   - Should machines be renewable?
   - What should renewal pricing be? (same as purchase? discount? premium?)
   - What should renewal period be? (same as original? configurable?)
   - Can renewals stack? (max forward period? queued?)

3. **Reactivation Model**
   - Should expired machines be reactivatable?
   - What should reactivation window be? (7 days? 14 days? 30 days?)
   - What should reactivation pricing be? (renewal fee? penalty? full price?)
   - What happens after reactivation window closes? (archived? new purchase?)

4. **Repower vs Renewal**
   - What is the difference between repower and renewal?
   - Does repower change parameters (yield, capacity, benefits)?
   - Are repower benefits economically modeled?

5. **Trial Machine Economics**
   - Should trial machine have earnings cap?
   - Should trial machine have time limit?
   - Should trial machine earnings count toward user balance?

6. **Purchase Verification**
   - What constitutes "verified payment" for machine purchase?
   - Should use PaymentIntent or existing system?
   - What happens if payment fails after machine creation?

7. **Economic Sustainability**
   - What is the actual cloud compute cost per GH/s?
   - Is 70% COGS estimate accurate?
   - What is the platform risk margin needed?
   - How many machines can the platform support financially?

8. **Operation Types**
   - Should `MACHINE_PURCHASE` be added to FinancialOperationType?
   - Should `MACHINE_RENEWAL` be added?
   - Should `MACHINE_REPOWER` be added?
   - Should `MACHINE_UPGRADE` be added?

---

## END OF PHASE A FORENSIC AUDIT

**STATUS:** CRITICAL VIOLATIONS IDENTIFIED - STOP BEFORE IMPLEMENTATION

The current machine system does not meet the specification requirements and requires complete reconstruction. Business decisions must be made before proceeding to implementation.

---

## GATE CONDITION

**STOP - DO NOT PROCEED TO IMPLEMENTATION**

The following critical blockers must be resolved before Phase B:

1. ✅ **Current architecture fully documented** - This report
2. ❌ **Machine lifetime business decision** - Permanent or finite?
3. ❌ **Renewal model business decision** - Pricing, period, stacking?
4. ❌ **Reactivation model business decision** - Window, pricing, archival?
5. ❌ **Repower vs Renewal definition** - What's the difference?
6. ❌ **Trial machine economics** - Earnings cap? Time limit?
7. ❌ **Purchase verification definition** - What proves payment?
8. ❌ **Economic sustainability analysis** - Real costs, margins, scalability?

**ACTION REQUIRED:**
Before proceeding to Phase B implementation, obtain:
- Machine lifetime policy (permanent vs finite, duration if finite)
- Renewal policy (pricing, period, stacking rules)
- Reactivation policy (window, pricing, archival)
- Repower definition and benefits
- Trial machine limits (earnings cap, time limit)
- Purchase verification method
- Economic sustainability analysis

---

## PRODUCTION STATUS

**BLOCKED** - Cannot proceed without business decisions

The system is not production-safe due to:
- No machine expiry (unbounded liability)
- Trial machine qualifies for withdrawal (spec violation)
- No 5-referral gate (spec violation)
- SYSTEM_ALLOCATION abuse in repower/upgrade
- Wrong operation types for financial operations
- No renewal/reactivation infrastructure
- No expiry notifications
- No economic sustainability model
