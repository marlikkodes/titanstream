# MACHINE_LIFECYCLE_SPEC

**Version:** 1.0
**Date:** 2025-01-09
**Status:** SPECIFICATION - READY FOR PHASE C IMPLEMENTATION
**Scope:** Canonical TitanStream machine lifecycle, withdrawal eligibility, and financial operations

---

## 1. NON-NEGOTIABLE BUSINESS RULES

### 1.1 Withdrawal Eligibility Requirements

A user may withdraw funds ONLY when ALL of the following conditions are met:

1. **Identity**: Canonical Titan user identity resolved
2. **Account Status**: Account in good standing (not frozen, suspended, banned)
3. **Available Balance**: Sufficient ledger-derived available balance
4. **Qualified Purchasing Referrals**: At least 5 distinct referred users who have made **genuine qualifying purchases** backed by authoritative financial evidence
5. **Active Paid Machine**: At least one **genuinely purchased, payment-verified, currently active** paid machine
6. **Risk/Security Clearance**: Passes existing risk controls
7. **Valid Destination**: Verified withdrawal destination
8. **Compliance**: All compliance requirements satisfied

### 1.2 Machine Type Distinction

**Trial Machine:**
- Free baseline node for acquisition and activation
- DOES NOT qualify for withdrawal eligibility
- May have earnings for user engagement
- May have time limits or earnings caps (TBD by business decision)
- Cannot be converted to paid machine by database field change alone

**Paid Machine:**
- Requires genuine purchase payment verification
- Qualifies for withdrawal eligibility when active
- Has finite operating lifetime (TBD by business decision)
- Can be renewed, reactivated, repowered, or upgraded according to business rules

### 1.3 Financial Integrity

- Machine purchase MUST use dedicated `MACHINE_PURCHASE` financial operation type
- Machine renewal MUST use dedicated `MACHINE_RENEWAL` financial operation type
- Machine reactivation MUST use dedicated `MACHINE_REACTIVATION` financial operation type
- Machine repower MUST use dedicated `MACHINE_REPOWER` financial operation type
- Machine upgrade MUST use dedicated `MACHINE_UPGRADE` financial operation type
- **NEVER** use `SYSTEM_ALLOCATION` to manufacture value in machine operations
- All machine financial operations must flow through FinancialOrchestrator → Ledger → BalanceEngine
- No direct balance mutations allowed

### 1.4 Authority

- Backend/database/ledger are the only authoritative sources of truth
- Frontend state, localStorage, client parameters cannot determine eligibility
- All state transitions must be backend-driven
- All financial calculations must be backend-driven

---

## 2. MACHINE STATE MODEL

### 2.1 State Definition

```typescript
enum MachineStatus {
  // Trial states
  TRIAL_ACTIVE,           // Trial machine is active (for engagement, not withdrawal eligibility)
  TRIAL_PAUSED,           // Trial machine paused (admin action)
  TRIAL_ARCHIVED,         // Trial machine archived (historical)

  // Purchase flow states
  PAYMENT_PENDING,        // Payment initiated, awaiting confirmation
  PAYMENT_VERIFIED,       // Payment confirmed, awaiting activation
  PAYMENT_FAILED,         // Payment failed or rejected
  PAYMENT_REVERSED,       // Payment refunded/reversed

  // Active lifecycle states
  ACTIVE,                 // Machine is actively operating
  EXPIRING_SOON,          // Within warning window before expiry
  EXPIRED,                // Machine has expired (output paused, eligibility paused)
  REACTIVATION_WINDOW,   // Within reactivation window after expiry
  ARCHIVED,                // Machine is permanently archived (historical)

  // Operational states
  PAUSED,                  // Machine temporarily paused (admin action)
  MAINTENANCE,            // Machine under maintenance (admin action)
  RETIRED,                 // Machine permanently retired (admin action)

  // Upgrade/transition states
  UPGRADING,              // Machine is being upgraded to higher tier
  REPOWERING,              // Machine is being repowered (parameter change)
}
```

### 2.2 State Persistence vs Derivation

**Persisted States:**
- All states above are persisted in the database

**Derived States:**
- `isTrial` - derived from `type` field
- `isExpired` - derived from `expiresAt <= now()`
- `isExpiringSoon` - derived from `expiresAt` window (configurable)
- `isActiveForWithdrawal` - derived from: `type === PAID` AND `status === ACTIVE` AND `expiresAt > now()`

### 2.3 Valid State Transitions

```typescript
const VALID_TRANSITIONS: Record<MachineStatus, MachineStatus[]> = {
  // Trial lifecycle
  TRIAL_ACTIVE: ['TRIAL_PAUSED', 'TRIAL_ARCHIVED'],
  TRIAL_PAUSED: ['TRIAL_ACTIVE', 'TRIAL_ARCHIVED'],
  TRIAL_ARCHIVED: [], // Terminal

  // Purchase flow
  PAYMENT_PENDING: ['PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'PAYMENT_REVERSED'],
  PAYMENT_VERIFIED: ['ACTIVE', 'PAYMENT_FAILED', 'PAYMENT_REVERSED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'ARCHIVED'], // Can retry or archive
  PAYMENT_REVERSED: ['ARCHIVED'], // Cannot retry reversed payment

  // Active lifecycle
  ACTIVE: ['EXPIRING_SOON', 'PAUSED', 'MAINTENANCE', 'RETIRED', 'UPGRADING', 'REPOWERING'],
  EXPIRING_SOON: ['ACTIVE', 'EXPIRED'],
  EXPIRED: ['REACTIVATION_WINDOW', 'ARCHIVED'],
  REACTIVATION_WINDOW: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [], // Terminal

  // Operational
  PAUSED: ['ACTIVE', 'ARCHIVED'],
  MAINTENANCE: ['ACTIVE', 'ARCHIVED'],
  RETIRED: [], // Terminal

  // Transitions
  UPGRADING: ['ACTIVE', 'ARCHIVED'], // Rollback on failure
  REPOWERING: ['ACTIVE', 'ARCHIVED'], // Rollback on failure
};
```

### 2.4 Invalid Transitions

**Prohibited:**
- `ACTIVE → EXPIRED` (must go through EXPIRING_SOON)
- `EXPIRED → ACTIVE` (must go through REACTIVATION_WINDOW)
- `ARCHIVED → ACTIVE` (must purchase new machine)
- `TRIAL_ACTIVE → ACTIVE` (cannot convert trial to paid)
- `PAYMENT_PENDING → ACTIVE` (must verify payment first)
- `UPGRADING → EXPIRED` (cannot upgrade expired machine)
- `REPOWERING → EXPIRED` (cannot repower expired machine)

### 2.5 Transition Triggers and Financial Consequences

| Transition | Trigger | Financial Consequence |
|-----------|---------|------------------------|
| `PAYMENT_PENDING → PAYMENT_VERIFIED` | Payment confirmation webhook/callback | No financial effect yet |
| `PAYMENT_VERIFIED → ACTIVE` | Backend activation after payment verified | Payment settled, machine activated |
| `ACTIVE → EXPIRING_SOON` | Scheduler detects T-14 days | No financial effect |
| `EXPIRING_SOON → EXPIRED` | Scheduler detects `expiresAt` reached | Output paused, eligibility paused |
| `EXPIRED → REACTIVATION_WINDOW` | Auto-transition after expiry | No financial effect |
| `REACTIVATION_WINDOW → ACTIVE` | Successful reactivation payment | Payment settled, machine reactivated |
| `REACTIVATION_WINDOW → ARCHIVED` | Window closes without reactivation | No financial effect |
| `ACTIVE → PAUSED` | Admin action | No financial effect |
| `ACTIVE → RETIRED` | Admin action | No financial effect |
| `ACTIVE → UPGRADING` | Upgrade payment + verification | Upgrade payment settled, tier changed |
| `ACTIVE → REPOWERING` | Repower payment + verification | Repower payment settled, parameters changed |
| `UPGRADING → ACTIVE` | Upgrade completed | No additional financial effect |
| `REPOWERING → ACTIVE` | Repower completed | No additional financial effect |
| `UPGRADING → ARCHIVED` | Upgrade failed, rollback | Upgrade refunded, original tier restored |
| `REPOWERING → ARCHIVED` | Repower failed, rollback | Repower refunded, original parameters restored |

---

## 3. MACHINE TYPES

### 3.1 Canonical Classification

```typescript
enum MachineType {
  TRIAL,  // Free baseline node for acquisition
  PAID,   // Genuinely purchased machine
}
```

### 3.2 Database Schema Fields

```prisma
model UserMachine {
  id               String   @id @default(uuid())
  telegramUserId   BigInt
  type             MachineType @default(TRIAL)
  tierCode         String
  name             String
  purchasePrice    Decimal  @db.Decimal(36, 18)
  currency         String   @default("USDT")
  status           MachineStatus @default(TRIAL_ACTIVE)
  capacityGhs      Decimal  @db.Decimal(36, 18)
  lifetimeEarnings Decimal  @default(0.0)
  purchasedAt      DateTime @default(now())
  activatedAt      DateTime @default(now())
  expiresAt        DateTime?       // Null for trial until decision otherwise
  purchaseReference String?      // PaymentIntent or transaction ID
  paymentReference String?      // External payment reference
  originalPurchaseId String?      // For upgrades - tracks original purchase
  metadata         Json?

  user     User            @relation(fields: [telegramUserId], references: [telegramUserId])
  outputs  MachineOutput[]
  renewalHistory MachineRenewal[]

  @@index([telegramUserId])
  @@index([type])
  @@index([status])
  @@index([expiresAt])
  @@index([purchaseReference])
  @@unique([purchaseReference])
}
```

### 3.3 Field Source of Truth

| Field | Source of Truth | Purpose |
|-------|------------------|---------|
| `id` | Database (auto-generated) | Unique machine identifier |
| `telegramUserId` | User identity resolution | Canonical user ownership |
| `type` | Business rule (TRIAL/PAID) | Machine classification for eligibility |
| `tierCode` | Machine catalog | Machine capability/price tier |
| `name` | Machine catalog | Display name |
| `purchasePrice` | Payment verification | Actual price paid (may differ from catalog if discounted) |
| `currency` | Business rule | Always USDT for now |
| `status` | State machine | Current lifecycle state |
| `capacityGhs` | Machine catalog | Hash rate capacity |
| `lifetimeEarnings` | Mining engine calculation | Total earnings over lifetime |
| `purchasedAt` | Payment verification | When purchase occurred |
| `activatedAt` | Backend activation | When machine became active |
| `expiresAt` | Business rule (or null for trial) | When machine expires (null = permanent for trial) |
| `purchaseReference` | PaymentIntent ID | Links machine to purchase payment |
| `paymentReference` | External payment reference | Links to external transaction |
| `originalPurchaseId` | Upgrade logic | Tracks original machine for upgrade history |
| `metadata` | Extension | Additional parameters (JSON) |

---

## 4. PURCHASE ARCHITECTURE

### 4.1 Domain Model

```typescript
// Machine Purchase Aggregate
interface MachinePurchase {
  id: string;
  userId: string;
  telegramUserId: bigint;
  tierCode: string;
  requestedPrice: number;
  actualPrice?: number;
  status: PurchaseStatus;
  paymentIntentId?: string;
  externalPaymentReference?: string;
  machineId?: string;
  createdAt: DateTime;
  completedAt?: DateTime;
  failureReason?: string;
}

enum PurchaseStatus {
  INITIATED,
  AWAITING_PAYMENT,
  PAYMENT_DETECTED,
  PAYMENT_VERIFIED,
  MACHINE_PROVISIONED,
  COMPLETED,
  FAILED,
  REVERSED,
}
```

### 4.2 Purchase Flow

```
User initiates purchase
    ↓
MachinePurchaseService.createPurchase()
    ↓
Check balance (ledger-derived)
    ↓
Reserve funds (MACHINE_PURCHASE_RESERVE operation)
    ↓
Create PaymentIntent
    ↓
PaymentIntent.AWAITING_PAYMENT
    ↓
User pays (Mobile Money or USDT)
    ↓
PaymentIntent Payment detected/verified
    ↓
PaymentIntent.VERIFIED
    ↓
MachinePurchase.PAYMENT_VERIFIED
    ↓
Create UserMachine (status: PAYMENT_VERIFIED)
    ↓
MachinePurchase.MACHINE_PROVISIONED
    ↓
MACHINE_PURCHASE_SETTLE operation
    ↓
UserMachine.ACTIVE
    ↓
MachinePurchase.COMPLETED
```

### 4.3 What Proves Genuine Purchase?

**Authoritative Chain:**
1. PaymentIntent record exists with matching `purchaseReference`
2. PaymentIntent status is `VERIFIED` or `SETTLED`
3. PaymentIntent has `FinancialOperation` with type `PAYMENT` or equivalent
4. Ledger entries show payment received and settled
5. No reversal/refund record exists for that payment

**Purchase Verification Query:**
```typescript
async verifyPurchase(purchaseReference: string): Promise<VerificationResult> {
  const paymentIntent = await this.prisma.paymentIntent.findUnique({
    where: { id: purchaseReference },
    include: {
      financialOperation: true,
      ledgerEntries: true,
    },
  });

  if (!paymentIntent) {
    return { verified: false, reason: 'PAYMENT_NOT_FOUND' };
  }

  if (paymentIntent.status !== 'VERIFIED' && paymentIntent.status !== 'SETTLED') {
    return { verified: false, reason: `PAYMENT_NOT_VERIFIED: ${paymentIntent.status}` };
  }

  if (!paymentIntent.financialOperation) {
    return { verified: false, reason: 'NO_FINANCIAL_OPERATION' };
  }

  const operation = paymentIntent.financialOperation;
  if (operation.status !== 'COMPLETED') {
    return { verified: false, reason: `FINANCIAL_OPERATION_NOT_COMPLETED: ${operation.status}` };
  }

  // Check for reversal
  const reversal = await this.prisma.financialOperation.findFirst({
    where: {
      idempotencyKey: operation.idempotencyKey,
      operationType: 'REVERSAL',
      status: 'COMPLETED',
    },
  });

  if (reversal) {
    return { verified: false, reason: 'PAYMENT_REVERSED' };
  }

  return { verified: true };
}
```

### 4.4 Duplicate Prevention

**Idempotency Keys:**
- PaymentIntent idempotency key prevents duplicate payment creation
- MachinePurchase idempotency key prevents duplicate purchase attempts
- FinancialOperation idempotency key prevents duplicate financial operations

**Unique Constraints:**
- `purchaseReference` unique on UserMachine (one payment per machine)
- `paymentIntentId` unique on MachinePurchase (one purchase record per payment)

**Idempotency Flow:**
```typescript
// Check for existing machine with same payment
const existingMachine = await this.prisma.userMachine.findFirst({
  where: { purchaseReference: paymentIntentId },
});

if (existingMachine) {
  return {
    idempotent: true,
    existingMachineId: existingMachine.id,
    message: 'Machine already provisioned for this payment',
  };
}
```

### 4.5 Refund/Reversal Handling

**Payment Refund:**
1. PaymentIntent status changes to `REFUNDED` or `REVERSED`
2. FinancialOperation reversal created
3. Machine status transitions: `ACTIVE → FAILED` or `ARCHIVED`
4. Funds returned via ledger reversal
5. Machine output permanently stopped

**Machine Provisioned Refund:**
- If refund occurs after machine provisioned:
  - Machine status → `ARCHIVED`
  - Output stopped
  - Ledger reversal returns funds
  - Historical record preserved (machine remains in database)

---

## 5. WITHDRAWAL GATE

### 5.1 Canonical WithdrawalEligibility Contract

```typescript
interface WithdrawalEligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

interface EligibilityReason {
  code: string;
  message: string;
  passing: boolean;
  priority: number; // 1 = critical, 2 = important, 3 = informational
}

enum EligibilityCode {
  IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND',
  ACCOUNT_NOT_READY = 'ACCOUNT_NOT_READY',
  ACCOUNT_FROZEN = 'ACCOUNT_FROZEN',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_DESTINATION = 'INVALID_DESTINATION',
  INSUFFICIENT_QUALIFIED_REFERRALS = 'INSUFFICIENT_QUALIFIED_REFERRALS',
  NO_ACTIVE_PAID_MACHINE = 'NO_ACTIVE_PAID_MACHINE',
  TRIAL_MACHINE_ONLY = 'TRIAL_MACHINE_ONLY',
  MACHINE_EXPIRED = 'MACHINE_EXPIRED',
  PAYMENT_PENDING_MACHINE = 'PAYMENT_PENDING_MACHINE',
  RISK_LOCKED = 'RISK_LOCKED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  COMPLIANCE_REQUIRED = 'COMPLIANCE_REQUIRED',
}
```

### 5.2 Eligibility Evaluation Order

```typescript
async evaluateWithdrawalEligibility(telegramUserId: bigint, amount: number, destination: string): Promise<WithdrawalEligibilityResult> {
  const reasons: EligibilityReason[] = [];

  // Gate 1: Identity (Priority 1)
  const user = await this.prisma.user.findUnique({ where: { telegramUserId } });
  if (!user) {
    return { eligible: false, reasons: [{ code: 'IDENTITY_NOT_FOUND', message: 'User not found', passing: false, priority: 1 }] };
  }

  // Gate 2: Account Status (Priority 1)
  if (user.state === 'FROZEN' || user.state === 'SUSPENDED' || user.state === 'BANNED') {
    return { eligible: false, reasons: [{ code: user.state, message: `Account ${user.state}`, passing: false, priority: 1 }] };
  }

  if (!user.isReady) {
    reasons.push({ code: 'ACCOUNT_NOT_READY', message: 'Account not ready for withdrawals', passing: false, priority: 1 });
  }

  // Gate 3: Available Balance (Priority 1)
  const availableBalance = await this.getAvailableBalance(telegramUserId, 'USDT');
  if (availableBalance < amount) {
    reasons.push({ code: 'INSUFFICIENT_BALANCE', message: `Insufficient balance: ${availableBalance.toFixed(2)} USDT available`, passing: false, priority: 1 });
  }

  // Gate 4: Valid Destination (Priority 1)
  const destinationValid = await this.validateDestination(destination);
  if (!destinationValid.valid) {
    reasons.push({ code: 'INVALID_DESTINATION', message: destinationValid.reason, passing: false, priority: 1 });
  }

  // Gate 5: 5 Qualified Purchasing Referrals (Priority 1)
  const referralResult = await this.checkQualifiedReferrals(telegramUserId);
  if (!referralResult.passes) {
    reasons.push({
      code: 'INSUFFICIENT_QUALIFIED_REFERRALS',
      message: `Need ${referralResult.remainingNeeded} more genuine purchasing referrals (${referralResult.currentCount}/5)`,
      passing: false,
      priority: 1,
    });
  }

  // Gate 6: Active Paid Machine (Priority 1)
  const machineResult = await this.checkActivePaidMachine(telegramUserId);
  if (!machineResult.passes) {
    reasons.push({
      code: machineResult.code,
      message: machineResult.message,
      passing: false,
      priority: 1,
    });
  }

  // Gate 7: Risk/Security (Priority 2)
  const riskResult = await this.evaluateRisk(telegramUserId, amount);
  if (!riskResult.passes) {
    reasons.push({
      code: 'RISK_LOCKED',
      message: riskResult.reason,
      passing: false,
      priority: 2,
    });
  }

  // Gate 8: Limits (Priority 2)
  const limitResult = await this.checkLimits(telegramUserId, amount);
  if (!limitResult.passes) {
    reasons.push({
      code: 'LIMIT_EXCEEDED',
      message: limitResult.reason,
      passing: false,
      priority: 2,
    });
  }

  const eligible = reasons.filter(r => r.priority === 1).length === 0;

  return { eligible, reasons };
}
```

### 5.3 Trial Machine Exclusion Proof

```typescript
async checkActivePaidMachine(telegramUserId: bigint): Promise<MachineGateResult> {
  // Check for active PAID machines (exclude TRIAL and exclude EXPIRED)
  const paidMachines = await this.prisma.userMachine.findMany({
    where: {
      telegramUserId,
      type: 'PAID',
      status: 'ACTIVE',
      expiresAt: { gt: new Date() }, // Not expired
    },
  });

  if (paidMachines.length === 0) {
    // Check if user has trial machine
    const trialMachine = await this.prisma.userMachine.findFirst({
      where: {
        telegramUserId,
        type: 'TRIAL',
        status: 'TRIAL_ACTIVE',
      },
    });

    if (trialMachine) {
      return {
        passes: false,
        code: 'TRIAL_MACHINE_ONLY',
        message: 'The Free Trial Machine does not qualify for withdrawals. Purchase a paid Titan Machine to enable withdrawals.',
      };
    }

    return {
      passes: false,
      code: 'NO_ACTIVE_PAID_MACHINE',
      message: 'An active paid Titan Machine is required for withdrawals.',
    };
  }

  return {
    passes: true,
    code: 'PAID_MACHINE_ACTIVE',
    message: 'Paid machine requirement satisfied.',
  };
}
```

### 5.4 Proof of Required Failures

| Scenario | Trial Machine | Active Paid Machine | <5 Referrals | Expected Result |
|----------|---------------|-------------------|---------------|----------------|
| Trial + 5 referrals | ❌ FAIL | N/A | ❌ FAIL | TRIAL_MACHINE_ONLY |
| Trial + 4 referrals | ❌ FAIL | N/A | ❌ FAIL | TRIAL_MACHINE_ONLY + INSUFFICIENT_QUALIFIED_REFERRALS |
| Paid Active + 4 referrals | N/A | ✅ PASS | ❌ FAIL | INSUFFICIENT_QUALIFIED_REFERRALS |
| Paid Active + 5 referrals | N/A | ✅ PASS | ✅ PASS | ELIGIBLE |
| Paid Expired + 5 referrals | N/A | ❌ FAIL | ✅ PASS | MACHINE_EXPIRED |
| Payment Pending + 5 referrals | N/A | ❌ FAIL | ✅ PASS | PAYMENT_PENDING_MACHINE |
| Refunded Purchase + 5 referrals | N/A | ❌ FAIL | ✅ PASS | NO_ACTIVE_PAID_MACHINE |

---

## 6. EXPIRY ECONOMICS

### 6.1 PROPOSED PARAMETERS (REQUIRES BUSINESS APPROVAL)

**BUSINESS DECISION REQUIRED:**

| Parameter | Proposed Value | Rationale |
|-----------|----------------|-----------|
| **Paid Machine Lifetime** | 90 days | Reasonable operating period, allows full value realization, prevents unbounded liability |
| **Expiry Warning Window** | 14 days | Gives users adequate notice to renew |
| **Warning Triggers** | T-14, T-7, T-3, T-1 days | Graduated urgency without spam |
| **Reactivation Window** | 7 days | Grace period after expiry |
| **Reactivation Fee** | 10% of original purchase price | Small penalty to encourage renewal, discourage procrastination |
| **Reactivation Period** | Same as original lifetime (90 days) | Full lifecycle extension |
| **Renewal Window** | Any time before expiry | Allow early renewal |
| **Renewal Pricing** | 90% of original purchase price | Small discount for loyalty |
| **Renewal Period** | Same as original lifetime (90 days) | Full lifecycle extension |
| **Renewal Stacking** | Not allowed (max forward period = lifetime) | Prevents prepaying years in advance |
| **Renewal Behavior** | Extends from current `expiresAt` (remaining time + new period) | Preserves unused time |
| **Trial Machine Lifetime** | Permanent (no expiry) | Trial remains free and indefinite for acquisition |
| **Trial Machine Earnings Cap** | $5 USDT lifetime cap (or TBD) | Prevents trial abuse |
| **Trial Machine Time Limit** | None (or TBD) | Trial remains indefinite |

**Economic Impact:**

With 90-day lifetime:
- Tier pricing remains unchanged
- Users get 90 days of operation
- Annual revenue per user = purchase price × (365/90) = 4.05 × purchase price
- Renewal revenue at 90% price = 0.9 × purchase price per cycle
- Active users renew 4 times per year = 3.6 × purchase price per year
- Total annual revenue per active user = 7.65 × purchase price

**Example TS_P250 ($250):**
- One-time purchase revenue: $250
- Annual revenue without renewal: $2,737.50 (current model - UNBOUNDED)
- Annual revenue with 90-day + renewal model: $1,912.50
- Platform liability is BOUNDED (max 90 days per active machine)

**Rationale:**
- 90-day lifetime balances user value with platform sustainability
- Renewal model creates recurring revenue
- Bounded liability protects platform from un obligations
- Early renewal with remaining time preservation rewards loyalty
- Reactivation fee discourages abandonment without penalty

### 6.2 Output Behavior After Expiry

**When machine expires:**
- Output completely stops
- `UserMiningState` multiplier set to 0
- Machine status = `EXPIRED`
- Withdrawal eligibility pauses (machine gate fails)
- Balance, ledger history, referral history, progression remain intact

**When machine reactivated:**
- Output resumes from previous level
- `UserMiningState` multiplier restored
- Machine status = `ACTIVE`
- Withdrawal eligibility resumes (if other gates pass)
- Historical earnings preserved

### 6.3 Withdrawal Behavior After Expiry

**Expired machine:**
- Withdrawal eligibility paused
- User receives clear reason: "Your Titan Machine has expired. Reactivate a paid machine to restore withdrawal eligibility."
- User can still view machine in history
- User cannot use expired machine to bypass withdrawal gate

**Reactivated machine:**
- Withdrawal eligibility restored immediately
- No re-qualification of other gates required
- Machine appears as active in UI

---

## 7. RENEWAL

### 7.1 Renewal Definition

**Renewal extends the operating period of an existing active paid machine.**

### 7.2 Renewal Architecture

**Prerequisites:**
- Machine type = PAID
- Machine status = ACTIVE
- Machine not expired (or within reactivation window)
- User has sufficient balance

**Canonical Operation:**

```
User requests renewal
    ↓
Check machine eligibility
    ↓
Calculate renewal price (90% of original purchase price)
    ↓
Check balance
    ↓
MACHINE_RENEWAL_RESERVE operation (ledger: USER_ASSET_LIABILITY → RENEWAL_SUSPENSE)
    ↓
Create PaymentIntent for renewal fee
    ↓
PaymentIntent.AWAITING_PAYMENT
    ↓
User pays renewal fee
    ↓
PaymentIntent.VERIFIED
    ↓
MACHINE_RENEWAL_SETTLE operation (ledger: RENEWAL_SUSPENSE → PLATFORM_RESERVE)
    ↓
Create MachineRenewal record
    ↓
Update machine.expiresAt = current expiresAt + renewal period (90 days)
    ↓
Machine remains ACTIVE
    ↓
Notification: "Machine renewed until [new expiry date]"
```

### 7.3 Renewal Before Expiry

**Behavior:**
- Early renewal allowed any time before expiry
- New expiry = current expiresAt + renewal period
- Remaining time is preserved (not lost)
- User gets full value

**Example:**
- Current expiry: Day 27 of 90
- Renewal requested: Day 50
- New expiry: Day 50 + 90 = Day 140
- User gets 50 + 90 = 140 days total (no value lost)

### 7.4 Ledger Operations

**MACHINE_RENEWAL_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (renewal fee)
RENEWAL_SUSPENSE       CREDIT  (renewal fee)
```

**MACHINE_RENEWAL_SETTLE:**
```
RENEWAL_SUSPENSE       DEBIT  (renewal fee)
PLATFORM_RESERVE      CREDIT  (renewal fee)
```

### 7.5 Idempotency

**Idempotency Key:** `renewal_{machineId}_{idempotencyKey}`

**Duplicate Prevention:**
- Check for pending renewal in MachineRenewal table
- Check for recent renewal (within 24 hours) to prevent accidental double renewal
- FinancialOperation idempotency prevents double charging

### 7.6 Reversal/Refund Handling

**If renewal payment fails:**
- Rollback: `RENEWAL_SUSPENSE → USER_ASSET_LIABILITY`
- Machine expiresAt unchanged
- Machine remains ACTIVE (no effect on remaining time)
- User may retry

**If renewal payment is refunded:**
- Rollback: `RENEWAL_SUSPENSE → USER_ASSET_LIABILITY`
- Machine expiresAt unchanged
- Machine remains ACTIVE (no effect on remaining time)

---

## 8. REACTIVATION

### 8.1 Reactivation Definition

**Reactivation restores an expired machine to active status after paying a reactivation fee.**

### 8.2 Reactivation Architecture

**Prerequisites:**
- Machine type = PAID
- Machine status = EXPIRED
- Within reactivation window (7 days after expiry)
- Original purchase reference exists

**Canonical Operation:**

```
User requests reactivation
    ↓
Check reactivation eligibility
    ↓
Calculate reactivation fee (10% of original purchase price)
    ↓
Check balance
    ↓
MACHINE_REACTIVATION_RESERVE operation (ledger: USER_ASSET_LIABILITY → REACTIVATION_SUSPENSE)
    ↓
Create PaymentIntent for reactivation fee
    ↓
PaymentIntent.AWAITING_PAYMENT
    ↓
User pays reactivation fee
    ↓
PaymentIntent.VERIFIED
    ↓
MACHINE_REACTIVATION_SETTLE operation (ledger: REACTIVATION_SUSPENSE → PLATFORM_RESERVE)
    ↓
Create MachineRenewal record (type: REACTIVATION)
↓
Update machine:
  - status = ACTIVE
  - expiresAt = originalExpiresAt + 90 days (full reactivation period)
  - activatedAt = now()
↓
Notification: "Machine reactivated until [new expiry date]"
```

### 8.3 Reactivation Window

**Window:** 7 days after `expiresAt`

**Behavior:**
- Within window: reactivation allowed with fee
- After window: reactivation not allowed, must purchase new machine
- Machine status transitions: `EXPIRED → ARCHIVED` after window closes

### 8.4 Identity Preservation

**Reactivation preserves:**
- Original machine identity (same `id`)
- Original tier
- Original purchase history
- Original earnings history
- All historical data immutable

**Reactivation updates:**
- `expiresAt` (extended)
- `activatedAt` (reset to now)
- `status` (EXPIRED → ACTIVE)
- Renewal history record added

### 8.5 Ledger Operations

**MACHINE_REACTIVATION_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (reactivation fee)
REACTIVATION_SUSPENSE   CREDIT  (reactivation fee)
```

**MACHINE_REACTIVATION_SETTLE:**
```
REACTIVATION_SUSPENSE   DEBIT  (reactivation fee)
PLATFORM_RESERVE      CREDIT  (reactivation fee)
```

### 8.6 Withdrawal Eligibility After Reactivation

**Successful reactivation:**
- Machine immediately satisfies paid machine gate
- Withdrawal eligibility restored (if other gates pass)
- No waiting period

---

## 9. REPOWER

### 9.1 Repower Definition

**Repower changes operational parameters of an active machine without changing tier or lifetime.**

**CRITICAL:** Repower does NOT:
- Change machine tier
- Extend machine lifetime
- Manufacture free balance
- Arbitrarily increase yield

### 9.2 Repower Parameters (BUSINESS DECISION REQUIRED)

**PROPOSED PARAMETERS (TBD):**

| Parameter | Proposed Change | Rationale |
|-----------|-----------------|-----------|
| Interactive bonus cap | Increase by X% | Optional enhancement for engagement |
| Promotional yield rate | Adjust by ±Y% | Optional promotional tuning |
| Spin speed multiplier | Adjust by ±Z% | UI/engagement enhancement |
| Max multiplier | Adjust by ±W% | Yield ceiling adjustment |

**IMPORTANT:** All repower changes must be:
- Server-authoritative
- Economically modeled
- Configurable
- Reversible

### 9.3 Repower Architecture

**Prerequisites:**
- Machine type = PAID
- Machine status = ACTIVE
- Machine not expired
- Repower payment required (fee-based)

**Canonical Operation:**

```
User requests repower
    ↓
Check repower eligibility
    ↓
Calculate repower fee (15% of original purchase price)
    ↓
Check balance
    ↓
MACHINE_REPOWER_RESERVE operation (ledger: USER_ASSET_LIABILITY → REPOWER_SUSPENSE)
    ↓
Create PaymentIntent for repower fee
    ↓
PaymentIntent.ALANDING_PAYMENT
↓
User pays repower fee
↓
PaymentIntent.VERIFIED
↓
MACHINE_REPOWER_SETTLE operation (ledger: REPOWER_SUSPENSE → PLATFORM_RESERVE)
↓
Create MachineRenewal record (type: REPOWER)
↓
Update machine metadata with new parameters
↓
Machine remains ACTIVE (no status change)
↓
Notification: "Machine repowered successfully"
```

### 9.4 Parameter Change Policy

**Old parameters preserved:**
- Original tier
- Original purchase price
- Original expiresAt
- All historical data

**New parameters:**
- Stored in `metadata` field
- Applied to mining engine
- Recorded in MachineRenewal record for rollback

**Rollback:**
- If repower fails or refunded, revert metadata to previous values
- Fee refunded via ledger reversal

### 9.5 Ledger Operations

**MACHINE_REPOWER_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (repower fee)
REPOWER_SUSPENSE       CREDIT  (repower fee)
```

**MACHINE_REPOWER_SETTLE:**
```
REPOWER_SUSPENSE       DEBIT  (repower fee)
PLATFORM_RESERVE      CREDIT  (repower fee)
```

---

## 10. UPGRADE

### 10.1 Upgrade Definition

**Upgrade changes the machine to a higher tier with different capacity and yield.**

### 10.2 Upgrade Architecture

**Prerequisites:**
- Machine type = PAID
- Machine status = ACTIVE
- Machine not expired
- Target tier is higher value than current tier

**Canonical Operation:**

```
User requests upgrade
    ↓
Check upgrade eligibility
    ↓
Calculate upgrade cost (target tier price - current purchase price)
↓
Check balance
↓
MACHINE_UPGRADE_RESERVE operation (ledger: USER_ASSET_LICABILITY → UPGRADE_SUSPENSE)
↓
Create PaymentIntent for upgrade fee
↓
PaymentIntent.AWAITING_PAYMENT
↓
User pays upgrade fee
↓
PaymentIntent.VERIFIED
↓
MACHINE_UPGRADE_SETTLE operation (ledger: UPGRADE_SUSPENSE → PLATFORM_RESERVE)
↓
Create MachineRenewal record (type: UPGRADE)
↓
Update machine:
  - tierCode = target tier
  - name = target tier name
  - capacityGhs = target tier capacity
  - purchasePrice = target tier price
  - originalPurchaseId = current machine id
  - status = UPGRADING
↓
If upgrade successful:
  - status = ACTIVE
  - activatedAt = now()
  - expiresAt = original expiresAt + (remaining proportion of original lifetime × target tier lifetime ratio)
↓
If upgrade fails:
  - Rollback all fields to original values
  - Refund upgrade fee
↓
Notification: "Machine upgraded to [new tier]"
```

### 10.3 Lifetime Handling (BUSINESS DECISION REQUIRED)

**Option A: Reset Lifetime**
- New machine gets full new lifetime (90 days)
- Original lifetime lost

**Option B: Proportional Extension**
- New machine gets extended lifetime proportional to cost difference
- Example: 50% cost difference = 50% more lifetime

**Option C: Preserve and Extend**
- Remaining original time + full new lifetime
- User gets more than 90 days (premium)

**RECOMMENDATION:** Option B (Proportional Extension) - balances cost with lifetime

### 10.4 Ledger Operations

**MACHINE_UPGRADE_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (upgrade fee)
UPGRADE_SUSPENSE       CREDIT  (upgrade fee)
```

**MACHINE_UPGRADE_SETTLE:**
```
UPGRADE_SUSPENSE       DEBIT  (upgrade fee)
PLATFORM_RESERVE      CREDIT  (upgrade fee)
```

### 10.5 Rollback

**If upgrade fails:**
- Rollback: `UPGRADE_SUSPENSE → USER_ASSET_LIABILITY`
- Machine reverts to original tier and parameters
- Refund upgrade fee via ledger reversal
- Machine status: `UPGRADING → ACTIVE`

---

## 11. FINANCIAL OPERATION TYPES

### 11.1 Operation Taxonomy

```typescript
enum FinancialOperationType {
  // Existing
  INTERNAL_ADJUSTMENT,
  SYSTEM_ALLOCATION,
  REVERSAL,

  // Withdrawal (existing)
  WITHDRAWAL_RESERVE,
  WITHDRAWAL_SETTLE,
  WITHDRAWAL_REVERSAL,

  // NEW: Machine operations
  MACHINE_PURCHASE_RESERVE,
  MACHINE_PURCHASE_SETTLE,
  MACHINE_RENEWAL_RESERVE,
  MACHINE_RENEWAL_SETTLE,
  MACHINE_REACTIVATION_RESERVE,
  MACHINE_REACTIVATION_SETTLE,
  MACHINE_REPOWER_RESERVE,
  MACHINE_REPOWER_SETTLE,
  MACHINE_UPGRADE_RESERVE,
  MACHINE_UPGRADE_SETTLE,
}
```

### 11.2 Ledger Account Mapping

**MACHINE_PURCHASE_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (purchase price)
MACHINE_PURCHASE_SUSPENSE CREDIT  (purchase price)
```

**MACHINE_PURCHASE_SETTLE:**
```
MACHINE_PURCHASE_SUSPENSE DEBIT  (purchase price)
PLATFORM_RESERVE        CREDIT  (purchase price)
```

**MACHINE_RENEWAL_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (renewal fee)
RENEWAL_SUSPENSE       CREDIT  (renewal fee)
```

**MACHINE_RENEWAL_SETTLE:**
```
RENEWAL_SUSPENSE       DEBIT  (renewal fee)
PLATFORM_RESERVE      CREDIT  (renewal fee)
```

**MACHINE_REACTIVATION_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (reactivation fee)
REACTIVATION_SUSPENSE   CREDIT  (reactivation fee)
```

**MACHINE_REACTIVATION_SETTLE:**
```
REACTIVATION_SUSPENSE   DEBIT  (reactivation fee)
PLATFORM_RESERVE      CREDIT  (reactivation fee)
```

**MACHINE_REPOWER_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (repower fee)
REPOWER_SUSPENSE       CREDIT  (repower fee)
```

**MACHINE_REPOWER_SETTLE:**
```
REPOWER_SUSPENSE       DEBIT  (repower fee)
PLATFORM_RESERVE      CREDIT  (repower fee)
```

**MACHINE_UPGRADE_RESERVE:**
```
USER_ASSET_LIABILITY  DEBIT  (upgrade fee)
UPGRADE_SUSPENSE       CREDIT  (upgrade fee)
```

**MACHINE_UPGRADE_SETTLE:**
```
UPGRADE_SUSPENSE       DEBIT  (upgrade fee)
PLATFORM_RESERVE      CREDIT  (upgrade fee)
```

### 11.3 SYSTEM_ALLOCATION Usage

**CRITICAL:** SYSTEM_ALLOCATION must NOT be used for user-facing machine operations.

**ALLOWED USES:**
- Internal accounting adjustments
- Internal operational tests
- Platform-level rebalancing (by super-admin only)

**PROHIBITED USES:**
- Machine purchase
- Machine renewal
- Machine reactivation
- Machine repower
- Machine upgrade
- Any user-accessible operation

**Legacy Quarantine:**
- Existing repower/upgrade using SYSTEM_ALLOCATION must be removed
- Code must be refactored to use dedicated operation types

---

## 12. CONCURRENCY

### 12.1 Duplicate Purchase Prevention

**Mechanism 1: PaymentIntent Idempotency**
- PaymentIntent idempotency key prevents duplicate payment creation
- MachinePurchase checks for existing machine with same `purchaseReference`

**Mechanism 2: Database Transaction**
```typescript
await this.prisma.$transaction(async (tx) => {
  // Check for existing machine
  const existing = await tx.userMachine.findFirst({
    where: { purchaseReference: paymentIntentId },
  });

  if (existing) {
    return { idempotent: true, existingMachineId: existing.id };
  }

  // Reserve funds
  await this.orchestrator.requestOperation({...});

  // Create machine
  const machine = await tx.userMachine.create({...});

  // Create purchase record
  await tx.machinePurchase.create({...});
});
```

**Mechanism 3: Unique Constraint**
```prisma
@@unique([purchaseReference])
```

### 12.2 Double Renewal Prevention

**Mechanism 1: Pending Renewal Check**
```typescript
const pendingRenewal = await this.prisma.machineRenewal.findFirst({
  where: {
    userMachineId: machineId,
    status: 'PENDING',
  },
});

if (pendingRenewal) {
  throw new BadRequestException('RENEWAL_IN_PROGRESS');
}
```

**Mechanism 2: Time-Based Lock**
```typescript
const recentRenewal = await this.prisma.machineRenewal.findFirst({
  where: {
    userMachineId: machineId,
    appliedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});

if (recentRenewal) {
  throw new BadRequestException('RENEWAL_TOO_SOON');
}
```

### 12.3 Expiry Boundary Concurrency

**Scenario:** Renewal at exact expiry boundary

**Mechanism: Database Transaction with Version Check**
```typescript
await this.prisma.$transaction(async (tx) => {
  const machine = await tx.userMachine.findUnique({
    where: { id: machineId },
  });

  // Check expiry at read time
  const isExpiredAtRead = machine.expiresAt && machine.expiresAt <= new Date();

  // Version check to prevent mid-transaction expiry
  if (isExpiredAtRead) {
    // Handle as reactivation instead
    // ...
  }

  // Apply renewal
  const newExpiresAt = new Date(machine.expiresAt || now).getTime() + renewalMs;
  await tx.userMachine.update({
    where: { id: machineId },
    data: { expiresAt: newExpiresAt },
  });
});
```

### 12.4 Simultaneous Reactivation + Renewal

**Prevention:**
- If machine is in REACTIVATION_WINDOW, only reactivation allowed
- If machine is ACTIVE, only renewal allowed
- Mutual exclusion in state machine

### 12.5 Duplicate Payment Callback Prevention

**Mechanism: PaymentIntent Idempotency**
- PaymentIntent idempotency key prevents double processing
- MachinePurchase checks payment verification before provisioning

**Mechanism: Unique Constraint**
```prisma
@@unique([purchaseReference])
```

---

## 13. NOTIFICATIONS

### 13.1 Notification Events

| Event | Template Code | Timing | Channel(s) |
|-------|---------------|--------|-----------|
| Machine purchased | MACHINE_PURCHASED | After payment verified | Telegram, WhatsApp |
| Machine activated | MACHINE_ACTIVATED | After activation | Telegram, WhatsApp |
| Machine expiring soon | MACHINE_EXPIRING_SOON | T-14, T-7, T-3, T-1 days | Telegram, WhatsApp |
| Machine expired | MACHINE_EXPIRED | On expiry transition | Telegram, WhatsApp |
| Reactivation available | REACTIVATION_AVAILABLE | On entry to REACTIVATION_WINDOW | Telegram, WhatsApp |
| Renewal available | RENEWAL_AVAILABLE | Within 14 days of expiry | Telegram, WhatsApp |
| Renewal completed | RENEWAL_COMPLETED | After renewal settles | Telegram, WhatsApp |
| Reactivation completed | REACTIVATION_COMPLETED | After reactivation settles | Telegram, WhatsApp |
| Upgrade completed | UPGRADE_COMPLETED | After upgrade settles | Telegram, WhatsApp |
| Repower completed | REPOWER_COMPLETED | After repower settles | Telegram, WhatsApp |

### 13.2 Notification Idempotency

**Mechanism:**
- Track sent notifications in `NotificationLog` table
- Check for recent notification before sending
- Use notification idempotency keys

```typescript
const recentNotification = await this.prisma.notificationLog.findFirst({
  where: {
    userId: telegramUserId,
    templateCode,
    entityId: machineId,
    sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});

if (recentNotification) {
  return; // Already sent recently
}
```

### 13.3 Notification Content

**Expiring Soon (T-14):**
```
🤖 Your Titan Machine is expiring soon!

Machine: [machine name]
Expires in: 14 days

Renew now to continue mining without interruption.
```

**Expiring Soon (T-7):**
```
⚠️ Your Titan Machine expires in 7 days!

Machine: [machine name]
Expires: [date]

Don't lose your mining progress.
```

**Expired:**
```
❌ Your Titan Machine has expired.

Machine: [machine name]
Expired: [date]

Your wallet, progress and history remain intact.

Reactivate within 7 days to restore service.
```

**Reactivation Available:**
```
✅ Reactivation window is now open!

Machine: [machine name]
Reactivation fee: $X.XX USDT

Reactivate to restore service for another 90 days.
```

---

## 14. ECONOMIC SUSTAINABILITY

### 14.1 Current vs Proposed Model

**Current Model (UNBOUNDED LIABILITY):**
- One-time purchase
- Permanent lifetime
- 29-40 day payback
- Infinite profit after payback
- No renewal revenue
- No reactivation revenue
- Unbounded platform liability per user

**Proposed Model (BOUNDED LIABILITY + RECURRING REVENUE):**
- One-time purchase (90-day lifetime)
- Renewal at 90% price every 90 days
- Reactivation at 10% fee within 7-day window
- Repower at 15% fee (parameter changes)
- Upgrade at cost difference
- Bounded platform liability (max 90 days per active machine)
- Recurring revenue stream

### 14.2 Revenue Projection (Per Active User Per Year)

**TS_P250 ($250) Example:**

| Revenue Source | Current Model | Proposed Model |
|---------------|---------------|----------------|
| Initial purchase | $250 | $250 |
| Renewals (4/year @ $225) | $0 | $900 |
| Reactivations (assumes 10% of users) | $0 | $25 |
| Repowers (assumes 20% of users @ $37.50) | $0 | $50 |
| **Total** | **$250/year** | **$1,225/year** |

**TS_X1000 ($1,000) Example:**

| Revenue Source | Current Model | Proposed Model |
|---------------|---------------|----------------|
| Initial purchase | $1,000 | $1,000 |
| Renewals (4/year @ $900) | $0 | $3,600 |
| Reactivations (10% @ $100) | $0 | $100 |
| Repowers (20% @ $150) | $0 | $200 |
| **Total** | **$1,000/year** | **$4,900/year** |

**Conclusion:** Proposed model increases annual revenue by 4-5x while bounding liability.

### 14.3 Cost Analysis (BUSINESS DECISION REQUIRED)

**Required Analysis:**
- Actual cloud compute cost per GH/s
- Payment processing costs
- Referral acquisition costs
- Customer support costs
- Platform infrastructure costs
- Risk reserve requirements

**Assumptions (to be validated):**
- 70% COGS for hardware estimate may need adjustment
- Profit margin should account for all costs
- Risk reserve should cover expected refund rate

### 14.4 Risk Management

**Refund Rate Risk:**
- Refund rate requires business decision
- Refund rate impacts net margin
- Refund rate should inform reserve ratio

**Payment Failure Risk:**
- Payment failure rate requires business decision
- Affects net revenue
- Should inform pricing

**Default Risk Rate Assumption (TO BE VALIDATED):**
- Assume 5% refund/reversal rate
- Adjust pricing accordingly

---

## 15. PHASE C IMPLEMENTATION PLAN

### 15.1 Database Migration Steps

**Step 1: Add MachineType enum**
```sql
ALTER TYPE "MachineType" ADD VALUE 'PAID';
```

**Step 2: Add MachineStatus enum**
```sql
CREATE TYPE "MachineStatus" AS ENUM (
  'TRIAL_ACTIVE',
  'TRIAL_PAUSED',
  'TRIAL_ARCHIVED',
  'PAYMENT_PENDING',
  'PAYMENT_VERIFIED',
  'PAYMENT_FAILED',
  'PAYMENT_REVERSED',
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'REACTIVATION_WINDOW',
  'ARCHIVED',
  'PAUSED',
  'MAINTENANCE',
  'RETIRED',
  'UPGRADING',
  'REPOWERING'
);
```

**Step 3: Add fields to UserMachine**
```sql
ALTER TABLE "user_machines"
ADD COLUMN "type" "MachineType" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "purchaseReference" TEXT,
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "originalPurchaseId" TEXT;
```

**Step 4: Create MachineRenewal table**
```sql
CREATE TABLE "machine_renewals" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userMachineId" TEXT NOT NULL,
  "renewalType" "RenewalType" NOT NULL,
  "amountUsdt" DECIMAL(36,18) NOT NULL,
  "operationId" TEXT NOT NULL,
  "previousExpiresAt" TIMESTAMP(3) NOT NULL,
  "newExpiresAt" TIMESTAMP(3) NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "metadata" JSONB,

  CONSTRAINT "machine_renewals_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "user_machines"("id") ON DELETE CASCADE
);

CREATE INDEX "machine_renewals_userMachineId_idx" ON "machine_renewals"("userMachineId");
CREATE INDEX "machine_renewals_appliedAt_idx" ON "machine_renewals"("appliedAt");
```

**Step 5: Create MachinePurchase table**
```sql
CREATE TABLE "machine_purchases" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" TEXT,
  "telegramUserId" BIGINT,
  "tierCode" TEXT NOT NULL,
  "requestedPrice" DECIMAL(36,18) NOT NULL,
  "actualPrice" DECIMAL(36,18),
  "status" "PurchaseStatus" NOT NULL,
  "paymentIntentId" TEXT,
  "externalPaymentReference" TEXT,
  "machineId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,

  CONSTRAINT "machine_purchases_paymentIntentId_unique" UNIQUE ("paymentIntentId")
);

CREATE INDEX "machine_purchases_telegramUserId_idx" ON "machine_purchases"("telegramUserId");
CREATE INDEX "machine_purchases_status_idx" ON "machine_purchases"("status");
```

**Step 6: Create PurchaseStatus enum**
```sql
CREATE TYPE "PurchaseStatus" AS ENUM (
  'INITIATED',
  'AWAITING_PAYMENT',
  'PAYMENT_DETECTED',
  'PAYMENT_VERIFIED',
  'MACHINE_PROVISIONED',
  'COMPLETED',
  'FAILED',
  'REVERSED'
);
```

**Step 7: Create RenewalType enum**
```sql
CREATE TYPE "RenewalType" AS ENUM (
  'INITIAL_PURCHASE',
  'RENEWAL',
  'REPOWER',
  'UPGRADE',
  'REACTIVATION'
);
```

**Step 8: Update existing machines**
```sql
-- Set type based on tierCode
UPDATE "user_machines"
SET "type" = CASE
  WHEN "tierCode" = 'TS_TRIAL' THEN 'TRIAL'
  ELSE 'PAID'
END;

-- Set expiresAt for PAID machines (90 days from purchasedAt)
UPDATE "user_machines"
SET "expiresAt" = "purchasedAt" + INTERVAL '90 days'
WHERE "type" = 'PAID' AND "expiresAt" IS NULL;
```

**Step 9: Add unique constraint**
```sql
ALTER TABLE "user_machines"
ADD CONSTRAINT "user_machines_purchaseReference_unique" UNIQUE ("purchaseReference");
```

### 15.2 Service Implementation Order

**Phase C.1: Database Migration**
- Apply Prisma schema changes
- Generate Prisma client
- Test migration in development

**Phase C.2: Financial Operation Types**
- Add new operation types to FinancialOperationType enum
- Update command processor to handle new operations
- Add ledger account mappings

**Phase C.3: MachineType Migration**
- Update MachineService to distinguish trial vs paid
- Add `type` field to catalog
- Update trial machine generation

**Phase C.4: Purchase Flow**
- Create MachinePurchaseService
- Integrate with PaymentIntent
- Implement purchase verification
- Implement idempotency

**Phase C.5: State Machine**
- Implement state machine with transitions
- Add state validation middleware
- Add audit events

**Phase C.6: Expiry Engine**
- Create expiry scheduler
- Implement expiry check logic
- Add warning notifications
- Implement reactivation window logic

**Phase C.7: Renewal Service**
- Create MachineRenewalService
- Implement renewal pricing
- Implement renewal execution
- Add rollback logic

**Phase C.8: Reactivation Service**
- Create MachineReactivationService
- Implement reactivation window check
- Implement reactivation execution
- Add window close logic

**Phase C.9: Repower Service**
- Create MachineRepowerService
- Define repower parameters
- Implement parameter change logic
- Add rollback logic

**Phase C.10: Upgrade Service**
- Create MachineUpgradeService
- Implement upgrade pricing
- Implement lifetime handling
- Add rollback logic

**Phase C.11: WithdrawalEligibilityService Update**
- Add 5-referral gate
- Add paid machine gate with trial exclusion
- Add expiry check
- Add purchase verification check

**Phase C.12: Notification Integration**
- Add new notification templates
- Implement idempotency
- Add Telegram/WhatsApp delivery

**Phase C.13: Tests**
- Unit tests for all services
- Integration tests for purchase flow
- State machine tests
- Expiry scheduler tests
- Renewal/reactivation tests
- Withdrawal eligibility tests
- Concurrency tests
- Adversarial tests

---

## 16. OPEN BUSINESS DECISIONS

### CRITICAL DECISIONS REQUIRED BEFORE IMPLEMENTATION

| Decision ID | Decision Required | Current Status | Recommended Value | Rationale |
|-------------|------------------|---------------|------------------|-----------|
| BD-001 | Machine lifetime (permanent vs finite) | BLOCKED | 90 days | Bounded liability, recurring revenue |
| BD-002 | Expiry warning window | BLOCKED | 14 days | User notice, prevents surprise |
| BD-003 | Reactivation window | BLOCKED | 7 days | Grace period, encourages reactivation |
| BD-004 | Reactivation fee | BLOCKED | 10% of original | Small penalty, discourages abandonment |
| BD-005 | Reactivation period | BLOCKED | 90 days | Full lifecycle extension |
| BD-006 | Renewal window | BLOCKED | Any time before expiry | Early renewal allowed |
| BD-007 | Renewal pricing | BLOCKED | 90% of original | Loyalty discount |
| BD-008 | Renewal period | BLOCKED | 90 days | Consistent lifetime |
| BD-009 | Renewal stacking | BLOCKED | Not allowed | Bounded forward period |
| BD-010 | Renewal behavior | BLOCKED | Extend from current expiresAt | Preserve remaining time |
| BD-011 | Repower fee | BLOCKED | 15% of original | Parameter change fee |
| DB-012 | Repower parameters | BLOCKED | TBD (TBD) | Business decision required |
| DB-013 | Upgrade lifetime handling | BLOCKED | Proportional extension | Cost-proportional lifetime |
| BD-014 | Trial machine earnings cap | BLOCKED | $5 USDT lifetime or TBD | Prevent trial abuse |
| BD-015 | Trial machine time limit | BLOCKED | None or TBD | TBD |
| BD-016 | Cloud compute cost per GH/s | BLOCKED | TBD | Required for economic validation |
| BD-017 | 70% COGS accuracy | BLOCKED | TBD | Required for margin validation |
| BD-018 | Refund/reversal rate | BLOCKED | TBD | Required for risk modeling |
| BD-019 | Risk reserve ratio | BLOCKED | TBD | Required for solvency |

---

## 17. CODE PATHS TO REMOVE/REPLACE

### 17.1 Remove SYSTEM_ALLOCATION from Machine Operations

**Files to modify:**
- `services/api/src/modules/machine/machine.service.ts`
  - Lines 461-469: repower using SYSTEM_ALLOCATION
  - Lines 514-523: upgrade using SYSTEM_ALLOCATION

**Replace with:**
- Use dedicated operation types
- Integrate with PaymentIntent for payment verification

### 17.2 Fix Purchase Operation Type

**Files to modify:**
- `services/api/src/modules/machine/machine.service.ts`
  - Line 366: Using `WITHDRAWAL_RESERVE` for purchase

**Replace with:**
- Use `MACHINE_PURCHASE_RESERVE`
- Follow proper purchase flow through PaymentIntent

### 17.3 Remove Hardcoded Trial Machine

**Files to modify:**
- `services/api/src/modules/machine/machine.service.ts`
  - Lines 218-230: Hardcoded trial machine

**Replace with:**
- Trial machine should be persisted in database with `type: TRIAL`
- Add migration to create trial machine for existing users without one

### 17.4 Fix WithdrawalEligibilityService

**Files to modify:**
- `services/api/src/modules/financial/withdrawal-eligibility.service.ts`
  - Lines 48-57: Machine gate without trial/paid distinction
  - Missing 5-referral gate

**Replace with:**
- Add separate policies for:
  - ReferralQualificationPolicy (5 genuine purchasing referrals)
  - PaidMachinePolicy (active paid machine, trial excluded)
  - MachineExpiryPolicy (active, not expired)

### 17.5 Update Machine Status Strings

**Files to modify:**
- `services/api/src/modules/machine/machine.service.ts`
  - Line 52: Status uses String type (no enum constraint)

**Replace with:**
- Use MachineStatus enum
- Implement state machine validation

---

## 18. TEST STRATEGY

### 18.1 Unit Tests

**Machine Lifecycle Tests:**
- Trial machine cannot satisfy withdrawal gate
- Paid active machine satisfies withdrawal gate
- Expired paid machine fails withdrawal gate
- Payment pending machine fails withdrawal gate
- State transitions are validated
- Invalid transitions are rejected

**Purchase Flow Tests:**
- Duplicate payment prevented
- Duplicate machine provision prevented
- Payment failure rolls back
- Payment reversal cancels machine
- Idempotency keys work correctly

**Renewal Tests:**
- Renewal extends expiresAt correctly
- Early renewal preserves remaining time
- Duplicate renewal prevented
- Renewal payment failure rolls back
- Renewal outside window rejected

**Reactivation Tests:**
- Reactivation allowed within window
- Reactivation outside window rejected
- Reactivation fee calculated correctly
- Reactivation extends from original expiry
- Expired machine cannot be renewed

**Repower Tests:**
- Repower changes parameters correctly
- Repower payment failure rolls back
- Repower cannot change tier
- Repower cannot extend lifetime

**Upgrade Tests:**
- Upgrade changes tier correctly
- Upgrade cost calculated correctly
- Upgrade preserves original identity
- Upgrade failure rolls back
- Upgrade extends lifetime proportionally

### 18.2 Integration Tests

**Purchase Flow Integration:**
- End-to-end purchase → payment → activation
- PaymentIntent integration
- FinancialOrchestrator integration
- Ledger settlement verification

**Withdrawal Eligibility Integration:**
- Full eligibility evaluation with all gates
- Trial exclusion verified
- 5-referral gate verified
- Paid machine gate verified
- Expiry gate verified

**Concurrency Tests:**
- Simultaneous purchase requests
- Simultaneous renewal requests
- Renewal at expiry boundary
- Simultaneous reactivation + renewal
- Duplicate payment callbacks

### 18.3 Adversarial Tests

**Trial Machine Bypass Attempts:**
- Try to upgrade trial to paid (should fail)
- Try to change trial type field directly (should fail)
- Try to set trial expiresAt (should be ignored)

**Purchase Bypass Attempts:**
- Try to create machine without payment (should fail)
- Try to reuse payment reference (should fail)
- Try to modify payment status (should fail)

**Eligibility Bypass Attempts:**
- Try to withdraw with trial only (should fail)
- Try to withdraw with expired machine (should fail)
- Try to withdraw with payment pending machine (should fail)
- Try to bypass 5-referral gate (should fail)

**Financial Attack Attempts:**
- Try to manufacture funds via SYSTEM_ALLOCATION (should fail)
- Try to repower without payment (should fail)
- Try to upgrade without payment (should fail)
- Try to extend expiresAt without payment (should fail)

---

## 19. PRODUCTION GATE

**STATUS: BLOCKED - BUSINESS DECISIONS REQUIRED**

The specification is complete and ready for implementation, BUT production certification cannot proceed until the following business decisions are approved:

### REQUIRED BUSINESS DECISIONS

| Decision ID | Description | Impact |
|-------------|-------------|--------|
| BD-001 | Machine lifetime (90 days vs permanent) | Affects liability model, revenue model |
| BD-002 | Expiry warning window (14 days) | Affects user experience |
| BD-003 | Reactivation window (7 days) | Affects user experience |
| BD-004 | Reactivation fee (10% of original) | Affects user experience |
| BD-005 | Reactivation period (90 days) | Affects economics |
| BD-006 | Renewal window (any time before expiry) | Affects user experience |
| BD-007 | Renewal pricing (90% of original) | Affects revenue model |
| BD-008 | Renewal period (90 days) | Affects economics |
| BD-009 | Renewal stacking (not allowed) | Affects liability model |
| BD-010 | Renewal behavior (extend from current expiresAt) | Affects user experience |
| BD-011 | Repower fee (15% of original) | Affects revenue model |
| BD-012 | Repower parameters (TBD) | Affects product features |
| BD-013 | Upgrade lifetime handling (proportional extension) | Affects user experience |
| BD-014 | Trial machine earnings cap ($5 or TBD) | Affects economics |
| BD-015 | Trial machine time limit (none or TBD) | Affects economics |
| BD-016 | Cloud compute cost per GH/s | REQUIRED for sustainability |
| BD-017 | 70% COGS accuracy | REQUIRED for margin validation |
| BD-018 | Refund/reversal rate | REQUIRED for risk modeling |
| BD-019 | Risk reserve ratio | REQUIRED for solvency |

### IMPLEMENTATION BLOCKERS

**BLOCKED UNTIL BD-001 through BD-019 are approved:**
- Database migration cannot proceed without lifetime decision
- Pricing models cannot be set without business decisions
- Economic sustainability cannot be validated without cost data
- Risk parameters cannot be set without rate data

---

## 20. SUMMARY

### 20.1 Deliverables

1. ✅ **MACHINE_LIFECYCLE_SPEC.md** (this document)
2. ⏳ **State-transition diagram** (to be created in Phase C)
3. ⏳ **Domain/entity model** (defined in this spec)
4. ⏳ **Withdrawal eligibility decision tree** (defined in this spec)
5. ✅ **Financial operation taxonomy** (defined in this spec)
6. ✅ **Economic assumptions table** (defined in this spec)
7. ✅ **Open business decisions table** (defined in this spec)
8. ⏳ **Phase C implementation plan** (defined in this spec)
9. ⏳ **Test strategy** (defined in this spec)
10. ✅ **Code paths to remove/replace** (defined in this spec)

### 20.2 Specification Status

- ✅ Business rules clearly defined
- ✅ State machine designed
- ✅ Machine types defined
- ✅ Purchase architecture designed
- ✅ Withdrawal gate contract defined
- ✅ Expiry economics proposed
- ✅ Renewal architecture defined
- ✅ Reactivation architecture defined
- ✅ Repower semantics defined
- ✅ Upgrade architecture defined
- ✅ Financial operation taxonomy defined
- ✅ Concurrency protections designed
- ✅ Notification events defined
- ✅ Economic sustainability modeled
- ✅ Implementation order planned
- ✅ Test strategy defined
- ⏳ Database migration script pending (blocked until business decisions)
- ⏳ State transition diagram pending (blocked until business decisions)
- ⏳ Domain model documentation pending (blocked until business decisions)

### 20.3 Production Readiness

**BLOCKED** - Cannot proceed to Phase C implementation until business decisions BD-001 through BD-019 are approved.

**Next Step:** Present business decisions to product/business owner for approval.

---

**END OF PHASE B SPECIFICATION**
