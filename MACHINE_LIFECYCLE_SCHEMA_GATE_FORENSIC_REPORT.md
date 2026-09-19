# MACHINE_LIFECY_SCHEMA_GATE_FORENSIC_REPORT

**Date:** 2025-01-09
**Status:** CRITICAL DOMAIN MODEL INVESTIGATION COMPLETE
**Scope:** Schema reconciliation, domain model analysis, migration strategy

---

## EXECUTIVE SUMMARY

**PRODUCTION STATUS: BLOCKED**

**CRITICAL FINDING:**
The current schema and domain model are **fundamentally misaligned** with the required canonical TitanStream machine architecture (STARTER → PAID with finite lifetime).

**Blockers:**
1. No STARTER/PAID distinction in schema
2. No machine expiry system in schema
3. No purchase provenance tracking in schema
4. Trial machine is virtual/frontend-only (not database-backed)
5. Purchase flow bypasses payment verification
6. Referral qualification uses wrong signal (settlement vs purchase)
7. Multiple competing withdrawal eligibility implementations

**Recommendation:**
**DO NOT proceed with schema changes until the following are resolved:**
1. Confirm STARTER vs PAID domain model with product/business
2. Confirm financial boundary model (Product vs Financial vs Hybrid)
3. Confirm purchase domain model architecture
4. Confirm migration strategy for existing data
5. Confirm whether existing PaymentIntent model should be extended or new model created

---

## 1. CURRENT PRISMA SCHEMA

### 1.1 UserMachine Model

**Location:** `services/api/prisma/schema.prisma:2110-2129`

```prisma
model UserMachine {
  id               String   @id @default(uuid()) @map("user_machine_id")
  telegramUserId   BigInt   @map("telegram_user_id")
  tierCode         String   @map("tier_code")
  name             String   @map("name")
  purchasePrice    Decimal  @map("purchase_price") @db.Decimal(36, 18)
  currency         String   @default("USDT") @map("currency")
  status           String   @default("ACTIVE") @map("status")  // ❌ String, not enum
  capacityGhs      Decimal  @map("capacity_ghs") @db.Decimal(36, 18)
  lifetimeEarnings Decimal  @default(0.0) @map("lifetime_earnings") @db.Decimal(36, 18)
  purchasedAt      DateTime @default(now()) @map("purchased_at")
  activatedAt      DateTime @default(now()) @map("activated_at")
  // ❌ NO type field (TRIAL/PAID/STARTER)
  // ❌ NO expiresAt field
  // ❌ NO purchaseReference field
  // ❌ NO paymentReference field
  // ❌ NO originalPurchaseId field

  user     User            @relation(fields: [telegramUserId], references: [telegramUserId], onDelete: Restrict)
  outputs  MachineOutput[]

  @@index([telegramUserId])
  @@index([status])
  @map("user_machines")
}
```

**CRITICAL VIOLATIONS:**
- ❌ No type classification (TRIAL/PAID/STARTER)
- ❌ No expiry system (no expiresAt)
- ❌ No purchase provenance (no purchaseReference, paymentReference)
- ❌ Status is String (no enum constraint)
- ❌ No upgrade history tracking (no originalPurchaseId)

### 1.2 MachineCatalogItem Model

**Location:** `services/api/prisma/schema.prisma:2698-2750`

```prisma
model MachineCatalogItem {
  id                     String        @id @default(uuid()) @map("machine_id")
  tierCode               String        @unique @map("tier_code")
  name                   String        @map("name")
  description            String        @map("description")
  category               String        @default("STANDARD") @map("category")
  priceUsdt              Decimal       @db.Decimal(36, 18) @map("price_usdt")
  purchaseCurrency       String        @default("USDT") @map("purchase_currency")
  capacityGhs            Decimal       @db.Decimal(36, 18) @map("capacity_ghs")
  dailyYieldEstimateUsdt Decimal       @db.Decimal(36, 18) @map("daily_yield_estimate_usdt")
  // ...
}
```

**Assessment:**
- ✅ Machine catalog exists
- ✅ Defines machine tiers and pricing
- ❌ No machine type classification (STARTER/PAID)

### 1.3 PaymentIntent Model

**Location:** `services/api/prisma/schema.prisma:2922-2959`

```prisma
model PaymentIntent {
  id                  String              @id @default(uuid()) @map("payment_intent_id")
  telegramUserId      BigInt              @map("telegram_user_id")
  userId              String?             @map("user_id")
  reference           String              @unique @map("reference")
  status              PaymentIntentStatus @default(CREATED) @map("status")
  paymentMethod       PaymentMethod      @map("payment_method")
  asset               String              @default("USDT") @map("asset")
  requestedAmount     Decimal             @map("requested_amount") @db.Decimal(36, 18)
  expectedCryptoAmount Decimal            @map("expected_crypto_amount") @db.Decimal(36, 18)
  currency            String              @default("USDT") @map("currency")
  country             String              @map("country")
  network             String              @map("network")
  exchangeRate        Decimal             @map("exchange_rate") @db.Decimal(36, 18)
  merchantDestination  String?             @map("merchant_destination")
  usdtAddress         String?             @map("usdt_address")
  expiresAt           DateTime            @map("expires_at")
  detectedAt          DateTime?           @map("detected_at")
  verifiedAt          DateTime?           @map("verified_at")
  settledAt           DateTime?           @map("settled_at")
  settlementSessionId String?             @map("settlement_session_id")
  // ❌ NO machineId field (no link to UserMachine)
  // ❌ NO purchaseType field (machine vs deposit)
}
```

**Assessment:**
- ✅ PaymentIntent exists with proper payment verification flow
- ❌ No link to UserMachine (no machineId field)
- ❌ No purchaseType field (machine purchase vs deposit)
- ❌ Cannot prove which machine purchase which PaymentIntent

### 1.4 SettlementSession Model

**Location:** `services/api/prisma/schema.prisma:772-817`

```prisma
model SettlementSession {
  id                    String               @id @default(uuid()) @map("settlement_id")
  telegramUserId        BigInt               @map("telegram_user_id")
  operatorId            String?              @map("operator_id")
  merchantId            String?              @map("merchant_id")
  submittedReference    String?              @map("submitted_reference")
  provider              SettlementProviderId @default(INTERNAL_OPERATIONS) @map("provider")
  sessionType           SettlementType       @default(DEPOSIT) @map("session_type")
  asset                 String               @map("asset")
  requestedAmount       Decimal              @map("requested_amount")
  expectedCryptoAmount  Decimal              @map("expected_crypto_amount")
  exchangeRate          Decimal              @map("exchange_rate") @db.Decimal(36, 18)
  country               String               @map("country")
  mobileMoneyNetwork    String               @map("mobile_money_network")
  referenceCode         String               @unique @map("reference_code")
  status                SettlementStatus     @default(CREATED) @map("status")
  // ❌ NO machineId field
  // ❌ sessionType is DEPOSIT or PAYOUT only (no MACHINE_PURCHASE)
}
```

**Assessment:**
- ✅ SettlementSession exists for deposits/payouts
- ❌ No MACHINE_PURCHASE session type
- ❌ No machineId field to link to UserMachine

### 1.5 GrowthContribution Model

**Location:** `services/api/prprisal/schema.prisma:1614-1625`

```prisma
model GrowthContribution {
  id                     String   @id @default(uuid()) @map("id")
  telegramUserId         BigInt   @map("telegram_user_id")
  referralRelationshipId String?  @map("referral_relationship_id")
  campaignCode           String?  @map("campaign_code")
  growthEventId          String?  @map("growth_event_id")
  economicEventType      String   @map("economic_event_type")
  economicEventId        String?  @map("economic_event_id")
  grossRevenueUsdt       Decimal  @default(0) @map("gross_revenue_usdt") @db.Decimal(36, 18)
  directCostUsdt         Decimal  @default(0) @map("direct_cost_usdt") @db.Decimal(36, 18)
  rewardCostUsdt         Decimal  @default(0) @map("reward_cost_usdt") @db.Decimal(36, 18)
  // ❌ NO machineId field
  // ❌ NO purchaseId field
}
```

**Assessment:**
- ✅ GrowthContribution exists for economic events
- ❌ No machineId field to link contribution to specific machine
- ❌ No purchaseId field to link contribution to purchase

### 1.6 PaymentInvoice Model

**Location:** `services/api/prisma/schema.prisma:2023-2042`

```prisma
model PaymentInvoice {
  id                String               @id @default(uuid()) @map("invoice_id")
  telegramUserId    BigInt               @map("telegram_user_id")
  provider          SettlementProviderId @default(CRYPTOBOT) @map("provider")
  externalInvoiceId String               @unique @map("external_invoice_id")
  asset             String               @map("asset")
  amount            Decimal              @map("amount") @db.Decimal(36, 18)
  currency          String               @map("currency")
  payUrl            String               @map("pay_url")
  status            PaymentInvoiceStatus @default(CREATED) @map("status")
  // ❌ Legacy CryptoBot (should be quarantined)
  // ❌ NO machineId field
}
```

**Assessment:**
- ⚠️ Legacy CryptoBot (should be quarantined)
- ❌ No machineId field
- ❌ Not used in current payment flow

### 1.7 Enums

**Machine-Related Enums:**
- ❌ NO MachineType enum (TRIAL/PAID/STARTER)
- ❌ NO MachineStatus enum (status is String)
- ✅ PaymentIntentStatus exists
- ✅ PaymentMethod exists
- ✅ PaymentIntentStatus exists

---

## 2. CURRENT MACHINE DOMAIN

### 2.1 Trial Machine Implementation

**Location:** `services/api/src/modules/machine/machine.service.ts:64-77`

```typescript
{
  tierCode: 'TS_TRIAL',
  name: 'Titan Core',
  priceUsdt: 0.0,
  capacityGhs: 1.0,
  powerRatingW: 10,
  description: 'Permanent baseline core with dual-phase promotional high-yield and standard modes.',
  technicalSummary: 'Permanently active entry-level hash rate generator.',
  simpleExplanation: 'Free baseline node that earns indefinitely.',
  dailyYieldEstimateUsdt: 2.0,
  computeRating: 'Core Queue Class 0',
  performanceTier: 'Baseline Tier',
  capacityScore: 10,
  recommendedFor: 'Starter core for everyone.',
  passiveYieldRate: 0.00000192935,
  promoYieldRate: 0.0000289,
  promoOutputCap: 5.0,  // Suggested $5 cap
}
```

**Implementation:**
- **Location:** `services/api/src/modules/machine/machine.service.ts:218-230`
- **Type:** Virtual/frontend-only object
- **Persistence:** None (not in database)
- **Status:** Always "ACTIVE"
- **Expiry:** None (permanent)
- **Cap:** promoOutputCap: 5.0 (not enforced)

**CRITICAL:**
- ❌ Trial machine is NOT database-backed
- ❌ Trial machine has NO type field in schema
- ❌ Trial machine has $5 cap suggested but NOT enforced
- ❌ Trial machine status is "ACTIVE" (same as paid)

### 2.2 Paid Machine Implementation

**Paid Tiers:**
- TS_C10, TS_A50, TS_P250, TS_X1000, TS_Q2500, etc.

**Purchase Flow:**
- **Location:** `services/api/src/modules/machine/machine.service.ts:315-409`
- **Operation Type:** WRONG - uses `WITHDRAWAL_RESERVE` instead of `MACHINE_PURCHASE_RESERVE`
- **Activation:** Machine created immediately as "ACTIVE" without payment verification
- **Payment Verification:** NO - balance check only, no PaymentIntent integration
- **Purchase Provenance:** NONE - no purchaseReference, no paymentReference

**CRITICAL:**
- ❌ No purchase verification before machine activation
- ❌ No link between UserMachine and PaymentIntent
- ❌ No purchaseReference field to track which payment created which machine
- ❌ Wrong operation type used (WITHDRAWAL_RESERVE)

### 2.3 Repower/Upgrade Implementation

**Repower:**
- **Location:** `services/api/src/modules/machine/machine.service.ts:448-495`
- **Operation Type:** SYSTEM_ALLOCATION (P0-003 - FIXED to MACHINE_REPOWER_RESERVE)
- **Payment:** None (manufactured funds)

**Upgrade:**
- **Location:** `services/api/src/modules/machine/machine.service.ts:497-553`
- **Operation Type:** SYSTEM_ALLOCATION (P0-003 - FIXED to MACHINE_UPGRADE_RESERVE)
- **Payment:** None (manufactured funds)

**CRITICAL:**
- ✅ Fixed to use dedicated operation types
- ⚠️ Still no payment verification required

---

## 3. LEGACY TRIAL INVENTORY

### 3.1 Current Trial Representation

**In Code:**
- Tier code: `TS_TRIAL`
- Type: Virtual/frontend-only object
- Database: NONE
- Status: "ACTIVE" (same as paid)
- Expiry: None (permanent)
- Cap: $5 suggested (not enforced)

**In Schema:**
- NO TRIAL enum
- NO STARTER enum
- NO PAID enum
- NO type field on UserMachine

**CRITICAL:**
- There is NO canonical TRIAL domain model in the schema
- Trial is represented only as a virtual object in code
- No database record of trial machines
- No way to distinguish trial from paid in database

---

## 4. PROPOSED STARTER MODEL

### 4.1 Required Domain Model

**Canonical Lifecycle:**
```
NEW USER
    ↓
STARTER ASSIGNED (database-backed, one per user)
    ↓
STARTER ACTIVE
    ↓
STARTER CAP REACHED ($5 output cap enforced)
    ↓
STARTER COMPLETED
```

**Required Schema:**
```prisma
enum MachineType {
  STARTER
  PAID
}

model UserMachine {
  // ... existing fields ...
  type              MachineType @default(STARTER)
  expiresAt         DateTime?
  purchaseReference String?
  paymentReference  String?
  originalPurchaseId String?
  // ...
}
```

**Required Fields Analysis:**

| Field | Existing equivalent? | Correct model | Required? | Nullable? | Migration strategy | Reason |
|---|---|---|---|---|---|---|
| type | NO | UserMachine | YES | NO | Add field, backfill existing | STARTER/PAID distinction required |
| expiresAt | NO | UserMachine | YES | YES (for STARTER/PAID distinction) | Add field, NULL for STARTER | Expiry system required for PAID |
| purchaseReference | NO | UserMachine | YES | YES (or dedicated model) | Add field, NULL for STARTER | Link to PaymentIntent or dedicated purchase model |
| paymentReference | NO | PaymentIntent/NEW MODEL | YES | YES (or dedicated model) | Add field, NULL for STARTER | Payment provenance tracking |
| originalPurchaseId | NO | UserMachine/NEW MODEL | YES | YES (for upgrades) | Add field, NULL for initial purchase | Upgrade history tracking |

### 4.2 Starter Cap Enforcement

**Current Implementation:**
- Trial machine has `promoOutputCap: 5.0` in catalog
- Cap is NOT enforced anywhere in code
- Cap is frontend/display only

**Required Implementation:**
- **Question:** Is the $5 cap Model A (product progression) or Model B (financial value)?
- **Model A:** Cap represents product capacity only, no ledger accounting
- **Model B:** Cap represents genuine financial value, requires ledger accounting

**BUSINESS DECISION REQUIRED:**
1. Which financial model for Starter cap?
2. If Model B, where is the cap enforced (ledger vs application)?
3. If Model B, what happens when cap is reached?

### 4.3 Starter Uniqueness

**Required Invariant:**
- Exactly one STARTER per canonical user
- Idempotent assignment
- Cannot be created by purchase
- Cannot be converted to PAID

**Migration Strategy:**
- For existing users: check if they have paid machines
- If YES: do nothing (they have PAID, no STARTER needed)
- If NO: create STARTER in database
- For new users: create STARTER automatically on registration

---

## 5. PROPOSED PAID MODEL

### 5.1 Required Domain Model

**Canonical Lifecycle:**
```
PURCHASE_PENDING
    ↓
PAYMENT_CONFIRMED
    ↓
ACTIVE
    ↓
EXPIRING (warning window)
    ↓
EXPIRED
    ↓
RENEWED / REACTIVATED / ARCHIVED
```

**Required Schema:**
```prisma
enum MachineStatus {
  STARTER_ACTIVE
  STARTER_CAP_REACHED
  STARTER_COMPLETED
  PURCHASE_PENDING
  PAYMENT_VERIFIED
  ACTIVE
  EXPIRING_SOON
  EXPIRED
  REACTIVATION_WINDOW
  ARCHIVED
  PAUSED
  MAINTENANCE
  RETIRED
}
```

**Required Fields:**
- `type: MachineType` (STARTER/PAID)
- `expiresAt: DateTime` (NULL for STARTER, finite for PAID)
- `purchaseReference: String` (NULL for STARTER, required for PAID)
- `paymentReference: String` (NULL for STARTER, required for PAID)
- `originalPurchaseId: String` (NULL for initial purchase, required for upgrades)

### 5.2 Expiry System

**Required Parameters (BUSINESS DECISION REQUIRED):**
- Paid machine lifetime (days)
- Expiry warning window (days)
- Reactivation window (days)
- Reactivation fee (% of original price)
- Renewal window (days before expiry)
- Renewal pricing (% of original price)
- Renewal period (days)

### 5.3 Purchase Provenance

**CRITICAL GAP:**
- UserMachine has NO link to PaymentIntent
- No way to prove which payment created which machine
- Purchase verification requires this link

**Proposed Solution Options:**

**Option A: Add machineId to PaymentIntent**
- Add `machineId` field to PaymentIntent
- Link PaymentIntent → UserMachine
- This proves which payment created which machine

**Option B: Create dedicated MachinePurchase model**
- Create new `MachinePurchase` model
- Link PaymentIntent → MachinePurchase → UserMachine
- More normalized but adds complexity

**Option C: Add purchaseReference to UserMachine**
- Add `purchaseReference` field to UserMachine (PaymentIntent ID)
- Simpler but less normalized

**BUSINESS DECISION REQUIRED:**
Which purchase provenance model?

---

## 6. PURCHASE DOMAIN

### 6.1 Current Purchase Domain

**Existing Models:**
- PaymentIntent (exists, for payment verification)
- PaymentAttempt (exists, tracks payment attempts)
- PaymentVerification (exists, admin verification)
- PaymentInvoice (legacy CryptoBot, not used)
- SettlementSession (for deposits/payouts, not machine purchases)
- GrowthContribution (economic events, no machine link)

**GAP:**
- NO dedicated purchase domain for machine purchases
- NO link between PaymentIntent and UserMachine
- NO way to prove which payment created which machine

### 6.2 Proposed Purchase Domain

**Option A: Extend PaymentIntent**
- Add `machineId` field to PaymentIntent
- Add `purchaseType` field to PaymentIntent (DEPOSIT vs MACHINE_PURCHASE)
- This is the simplest option

**Option B: Create MachinePurchase model**
- Create dedicated MachinePurchase model
- Link PaymentIntent → MachinePurchase → UserMachine
- More normalized but adds complexity

**Option C: Use GrowthContribution as purchase evidence**
- GrowthContribution already has `MACHINE_PURCHASE` economicEventType
- Add machineId field to GrowthContribution
- This is the least invasive option

**BUSINESS DECISION REQUIRED:**
Which purchase domain model?

---

## 7. PAYMENT DOMAIN

### 7.1 Current Payment Domain

**PaymentIntent Flow:**
```
CREATED
    ↓
AWAITING_PAYMENT
    ↓
DETECTED
    ↓
VERIFYING
    ↓
VERIFIED
    ↓
SETTLEMENT_PENDING
    ↓
SETTLED
```

**Payment Verification:**
- Admin verification via PaymentVerification model
- Blockchain verification via PaymentAttempt
- External reference tracking

**Assessment:**
- ✅ PaymentIntent exists with proper verification flow
- ✅ PaymentVerification exists for admin verification
- ✅ PaymentAttempt tracks payment attempts
- ❌ NO link to UserMachine

### 7.2 Payment Verification for Machine Purchases

**Current Problem:**
- PaymentIntent can verify payment
- But NO way to link that payment to a specific machine purchase
- Machine purchase uses wrong operation type (WITHDRAWAL_RESERVE)
- Machine is created immediately without payment verification

**Required:**
- Link PaymentIntent to UserMachine
- Use MACHINE_PURCHASE operation type
- Wait for payment verification before activating machine

---

## 8. FINANCIAL BOUNDARY

### 8.1 Current Model Analysis

**Trial Machine Financial Model:**
- `promoOutputCap: 5.0` in catalog
- Cap is NOT enforced
- No ledger accounting for trial output
- Trial output goes to UserMiningState (unclaimedBalance)

**Question:**
- Is the $5 cap:
  - **Model A:** Product progression only (no ledger accounting)?
  - **Model B:** Financial value (requires ledger accounting)?
  - **Model C:** Hybrid (some progression, some financial)?

**BUSINESS DECISION REQUIRED:**
Which financial model for Starter cap?

### 8.2 Implications

**Model A (Product Progression):**
- Cap enforced at application level
- No ledger accounting required
- Starter output is "demo" value
- Withdrawal eligibility should NOT be based on Starter output

**Model B (Financial Value):**
- Cap enforced at ledger level
- Requires ledger accounting for Starter output
- Starter output is real financial value
- Withdrawal eligibility based on total balance (including Starter output)

**Model C (Hybrid):**
- Some portion is progression, some is financial
- Complex to implement
- Requires clear definition of which portion is which

**Recommendation:**
- Model A is simpler and safer for acquisition/onboarding
- Model B creates financial liability and complexity
- Model C is complex and risky

---

## 9. REFERRAL QUALIFICATION

### 9.1 Current Implementation

**ReferralQualificationService:**
- Uses `User.qualifiedReferrals` denormalized counter
- Qualification based on settlement completion
- NO check for machine purchase
- NO check for payment verification

**ReferralService.evaluateQualification:**
- Checks if referee is READY
- Checks if referee has 1+ completed settlement
- NO check for machine purchase
- NO check for payment verification

**CRITICAL VIOLATION:**
- Referral qualification uses settlement completion, NOT machine purchase
- This means deposits qualify referrals, not just machine purchases
- This violates the canonical rule: "5 genuine purchasing referrals"

### 9.2 Required Implementation

**Canonical Rule:**
```
Qualifying referral requires:
1. Direct referral relationship
2. Referred user purchased a genuine Paid Titan machine
3. Payment verified
4. Purchase finalized
5. Machine/purchase not refunded or reversed
```

**Required Changes:**
1. Change qualification to check for Paid machine purchase
2. Check PaymentIntent.VERIFIED or PaymentIntent.SETTLED
3. Check UserMachine.type = PAID
4. Check UserMachine has purchaseReference linking to verified PaymentIntent
5. Check for no refund/reversal

---

## 10. WITHDRAWAL ELIGIBILITY

### 10.1 Current Implementations

**Three Competing Implementations:**
1. ReferralQualificationService (5-referral only)
2. WithdrawalEligibilityService (machine + risk only)
3. WithdrawalService (5-referral inline)

**WithdrawalEligibilityService:**
- Checks for ANY machine with status "ACTIVE"
- NO trial/paid distinction
- NO purchase verification
- NO expiry check

**CRITICAL VIOLATIONS:**
- Multiple competing implementations
- Trial machine not excluded
- No purchase verification
- No expiry check
- No canonical single source of truth

### 10.2 Required Implementation

**Canonical Rule:**
```
Withdrawal requires:
1. 5 genuine purchasing referrals (with purchase verification)
2. Active Paid machine (with purchase verification, not expired)
3. Sufficient available balance
4. Risk/security clearance
5. Valid destination
```

**Required Changes:**
1. Create single canonical WithdrawalEligibilityService
2. Add trial/paid distinction check
3. Add purchase verification check
4. Add expiry check
5. Consolidate all eligibility logic

---

## 11. IDENTITY PERSISTENCE

### 11.1 Current Identity Persistence

**IdentityMasterEngineService:**
- ✅ Resolves ChannelIdentity → UniversalIdentity → User
- ✅ Prevents fallback account creation
- ✅ Uses transactions for registration
- ✅ In-memory cache for DB unavailability (acceptable cache hit)

**Assessment:**
- ✅ Identity persistence is correct
- ✅ Canonical identity resolution is correct
- ⚠️ In-memory cache may serve stale identity (P0-003 - needs review)

### 11.2 Required Invariants

**Starter Uniqueness:**
- One canonical STARTER per user
- Idempotent assignment
- Cannot be created by purchase
- Cannot be converted to PAID

**Ownership:**
- Machine ownership references canonical user identity
- No ownership breakage expected

**Migration Safety:**
- Must preserve UserMachine history
- Must preserve wallet history
- Must preserve referral history
- Must preserve progress history

---

## 12. DATABASE INVARIANTS

### 12.1 Required Invariants

**Starter Uniqueness:**
```sql
-- One STARTER per user
CREATE UNIQUE INDEX ON user_machines (telegramUserId, type) WHERE type = 'STARTER';
```

**Purchase Provenance:**
```sql
-- Every Paid machine must reference a verified purchase
-- This constraint depends on purchase domain model decision
```

**Expiry:**
```sql
-- Paid machines must have finite expiry
-- STARTER machines have NULL expiresAt
```

**History:**
- No migration may reset or overwrite balances
- No migration may erase ledger entries
- No migration may delete machine history
- No migration may erase referral history

---

## 13. MIGRATION SAFETY ASSESSMENT

### 13.1 Proposed Schema Changes

**Change 1: Add MachineType enum**
```prisma
enum MachineType {
  STARTER
  PAID
}
```
**Classification:** SAFE ADDITIVE
**Impact:** New enum, no data loss

**Change 2: Add MachineStatus enum**
```prisma
enum MachineStatus {
  STARTER_ACTIVE
  STARTER_CAP_REACHED
  STARTER_COMPLETED
  PURCHASE_PENDING
  PAYMENT_VERIFIED
  ACTIVE
  EXPIRING_SOON
  EXPIRED
  REACTIVATION_WINDOW
  ARCHIVED
  PAUSED
  MAINTENANCE
  RETIRED
}
```
**Classification:** DATA MIGRATION REQUIRED
**Impact:** Existing status values are String, need migration script

**Change 3: Add fields to UserMachine**
```prisma
type              MachineType @default(STARTER)
expiresAt         DateTime?
purchaseReference String?
paymentReference  String?
originalPurchaseId String?
```
**Classification:** DATA MIGRATION REQUIRED
**Impact:** New fields with NULL defaults, backfill required

**Change 4: Add machineId to PaymentIntent**
```prisma
machineId String?
```
**Classification:** SAFE ADDITIVE
**Impact:** New field with NULL default, no data loss

**Change 5: Add purchaseType to PaymentIntent**
```prisma
purchaseType String? // "DEPOSIT" or "MACHINE_PURCHASE"
```
**Classification:** SAFE ADDITIVE
**Impact:** New field with NULL default, backfill required

### 13.2 Data Migration Matrix

| Existing record | Target representation | Action |
|---|---|---|
| Existing paid machines (status = "ACTIVE") | PAID + ACTIVE + expiresAt = NULL (need business decision on expiry) | Backfill expiresAt based on business decision |
| Virtual trial machines (not in DB) | STARTER (create database record) | Create STARTER for users without paid machines |
| Machines without purchase provenance | QUARANTINE (investigate) | Add to quarantine table for manual review |
| Sandbox/test machines | QUARANTINE/REMOVE | Remove or quarantine |

### 13.3 Risk Assessment

**Risks:**
1. **Expiry backfill:** Need business decision on expiry date for existing paid machines
2. **Purchase provenance:** Existing machines have no purchase provenance - cannot verify which payment created which machine
3. **Status migration:** String → enum migration may fail for invalid values
4. **Trial migration:** Virtual trial machines have no database records - need to create them
5. **Existing paid machines:** If we add expiry, existing paid machines will expire - need business decision

**BLOCKING DECISIONS REQUIRED:**
1. What expiry date to use for existing paid machines?
2. How to handle machines without purchase provenance?
3. What to do with virtual trial machines?
4. Which purchase domain model (extend PaymentIntent vs create MachinePurchase)?

---

## 14. EXACT FILES/REQUIRING CHANGES

### 14.1 Schema Files

**File:** `services/api/prisma/schema.prisma`
- Add MachineType enum
- Add MachineStatus enum
- Add type field to UserMachine
- Add expiresAt field to UserMachine
- Add purchaseReference field to UserMachine
- Add paymentReference field to UserMachine
- Add originalPurchaseId field to UserMachine
- Add machineId field to PaymentIntent
- Add purchaseType field to PaymentIntent

### 14.2 Service Files

**File:** `services/api/src/modules/machine/machine.service.ts`
- Remove virtual trial machine
- Implement STARTER assignment logic
- Implement STARTER cap enforcement
- Implement STARTER lifecycle
- Add purchase verification step
- Add PaymentIntent integration
- Add expiry check

**File:** `services/api/src/modules/growth/referral-qualification.service.ts`
- Change qualification to check for Paid machine purchase
- Add PaymentIntent verification check
- Add UserMachine.type = PAID check
- Add refund/reversal check

**File:** `services/api/src/modules/financial/withdrawal-eligibility.service.ts`
- Add trial/paid distinction check
- Add purchase verification check
- Add expiry check
- Remove any machine existence check without proper verification

**File:** `services/api/src/modules/financial/orchestration/command-processor.service.ts`
- ✅ Already fixed P0-001 (SYSTEM_ALLOCATION admin-only)
- ✅ Already fixed P1-001 (new operation types added)
- ✅ Already fixed P1-003 (machine purchase operation type)

**File:** `services/api/src/modules/payment-intent/payment-intent.service.ts`
- Add machineId field handling
- Add purchaseType field handling
- Add machine purchase logic

### 14.3 Frontend Files

**File:** `apps/web/src/store/useMiningStore.ts`
- Update to handle STARTER vs PAID distinction
- Update to handle expiry

**File:** `apps/web/src/pages/TitanHub/TitanHubScreen.tsx`
- Update to show STARTER vs PAID distinction
- Update to show expiry warnings
- Update to show cap progress for STARTER

---

## 15. IMPLEMENTATION DEPENDENCIES

### 15.1 Blocked By Business Decisions

1. **Starter vs PAID domain model** - Already clarified: STARTER and PAID
2. **Financial boundary model** - Model A vs B vs C for $5 cap
3. **Paid machine lifetime** - Days
4. **Expiry warning window** - Days
5. **Reactivation window** - Days
6. **Renewal window** - Days before expiry
7. **Renewal pricing** - % of original price
8. **Renewal period** - Days
9. **Reactivation fee** - % of original price
10. **Purchase domain model** - Extend PaymentIntent vs create MachinePurchase
11. **Existing paid machine expiry date** - What to do with existing paid machines
12. **Virtual trial machine migration** - How to create database records

### 15.2 Blocked By Technical Decisions

1. **Purchase provenance model** - Which model to use
2. **Starter cap enforcement** - Where to enforce (application vs ledger)
3. **Status migration strategy** - How to migrate String → enum
4. **Trial machine creation strategy** - How to create database records

---

## 16. TEST PLAN

### 16.1 Schema Migration Tests

- Test MachineType enum creation
- Test MachineStatus enum creation
- Test UserMachine field additions
- Test PaymentIntent field additions
- Test data backfill scripts
- Test existing paid machine backfill
- Test virtual trial machine creation

### 16.2 Service Tests

**MachineService:**
- Test STARTER assignment
- Test STARTER cap enforcement
- Test STARTER lifecycle
- Test PAID purchase with payment verification
- Test PAID expiry
- Test PAID renewal
- Test PAID reactivation
- Test trial/paid distinction

**ReferralQualificationService:**
- Test referral qualification with PAID machine purchase
- Test referral qualification with deposit only (should fail)
- Test referral qualification with trial machine (should fail)
- Test referral qualification with refunded purchase (should fail)

**WithdrawalEligibilityService:**
- Test trial machine exclusion
- Test expired machine exclusion
- Test unpaid machine exclusion
- Test purchase verification requirement
- Test expiry check

### 16.3 Integration Tests

- End-to-end purchase → payment → activation flow
- End-to-end referral qualification
- End-to-end withdrawal eligibility

---

## 17. PRODUCTION RISKS

### 17.1 Schema Migration Risks

**Risk 1: Status Migration Failure**
- Existing status values are String
- Migration to enum may fail for invalid values
- **Mitigation:** Add validation before migration, handle invalid values gracefully

**Risk 2: Expiry Backfill**
- Existing paid machines have no expiry
- Need business decision on expiry date
- **Mitigation:** Add business decision approval step before migration

**Risk 3: Purchase Provenance Gap**
- Existing machines have no purchase provenance
- Cannot verify which payment created which machine
- **Mitigation:** Quarantine machines without provenance, require manual review

**Risk 4: Trial Machine Migration**
- Virtual trial machines have no database records
- Need to create database records
- **Mitigation:** Create STARTER records for users without paid machines

### 17.2 Business Logic Risks

**Risk 1: Financial Model Uncertainty**
- Unknown whether $5 cap is financial or progression
- **Mitigation:** Clarify financial model before implementing cap enforcement

**Risk 2: Expiry Date Uncertainty**
- Unknown what expiry date to use for existing paid machines
- **Mitigation:** Get business decision before migration

**Risk 3: Purchase Domain Model Uncertainty**
- Unknown whether to extend PaymentIntent or create MachinePurchase
- **Mitigation: Get business decision before implementation

### 17.3 Technical Risks

**Risk 1: Multiple Eligibility Implementations**
- Three competing implementations may cause confusion
- **Mitigation:** Consolidate into single canonical service before deployment

**Risk 2: In-Memory Identity Cache**
- May serve stale identity during DB unavailability
- **Mitigation:** Review cache TTL and refresh strategy

---

## 18. BUSINESS DECISIONS REQUIRED

### 18.1 Financial Boundary Model

**Question:** Is the Starter's $5 cap:
- **Model A:** Product progression only (no ledger accounting)?
- **Model B:** Financial value (requires ledger accounting)?
- **Model C:** Hybrid (some progression, some financial)?

**Impact:**
- Model A: Cap enforced at application level, no ledger accounting required
- Model B: Cap enforced at ledger level, requires ledger accounting for Starter output
- Model C: Complex to implement, requires clear definition

### 18.2 Paid Machine Lifetime

**Question:** What is the paid machine lifetime in days?

**Options:**
- 30 days
- 60 days
- 90 days
- 120 days
- Other

**Impact:**
- Determines platform liability
- Determines renewal frequency
- Determines user retention

### 18.3 Expiry Parameters

**Question:** What are the expiry parameters?

**Required:**
- Expiry warning window (days before expiry)
- Reactivation window (days after expiry)
- Renewal window (days before expiry)
- Renewal pricing (% of original price)
- Renewal period (days)
- Reactivation fee (% of original price)

### 18.4 Purchase Domain Model

**Question:** Which purchase provenance model?

**Options:**
- **Option A:** Add machineId to PaymentIntent (simplestest)
- **Option B:** Create MachinePurchase model (most normalized)
- **Option C:** Use GrowthContribution (least invasive)

**Impact:**
- Option A: Simple but less normalized
- Option B: Most normalized but adds complexity
- Option C: Least invasive but may be semantically incorrect

### 18.5 Existing Paid Machine Expiry

**Question:** What to do with existing paid machines?

**Options:**
- Set expiry to X days from purchase date
- Set expiry to X days from migration date
- Set expiry to NULL (grandfather existing machines)
- Quarantine machines without purchase provenance

**Impact:**
- Determines user experience for existing paid machines
- Determines platform liability for existing paid machines

### 18.6 Virtual Trial Machine Migration

**Question:** How to handle virtual trial machines?

**Options:**
- Create STARTER database records for all users
- Create STARTER only for users without paid machines
- Do not create STARTER (require explicit opt-in)

**Impact:**
- Determines how many users get STARTER
- Determines migration complexity

---

## 19. RECOMMENDED IMPLEMENTATION SEQUENCE

### Phase 1: Business Decisions (BLOCKED)
1. Clarify financial boundary model for Starter cap
2. Confirm paid machine lifetime
3. Confirm expiry parameters
4. Confirm purchase domain model
5. Confirm existing paid machine expiry strategy
6. Confirm virtual trial machine migration strategy

### Phase 2: Schema Design (BLOCKED)
1. Finalize MachineType enum (STARTER/PAID)
2. Finalize MachineStatus enum (full lifecycle)
3. Finalize field additions to UserMachine
4. Finalize field additions to PaymentIntent
5. Create migration strategy document
6. Create data backfill strategy document

### Phase 3: Schema Implementation (BLOCKED)
1. Add MachineType enum to schema
2. Add MachineStatus enum to schema
3. Add fields to UserMachine
4. Add fields to PaymentIntent
5. Generate migration file
6. Review migration file
4. Test migration in development

### Phase 4: Service Implementation (BLOCKED)
1. Update MachineService for STARTER logic
2. Remove virtual trial machine
3. Implement STARTER cap enforcement
4. Implement PAID purchase verification
5. Update ReferralQualificationService
6. Update WithdrawalEligibilityService
7. Consolidate eligibility implementations

### Phase 5: Testing (BLOCKED)
1. Write schema migration tests
2. Write service unit tests
3. Write integration tests
4. Write adversarial tests
5. Perform regression testing

### Phase 6: Production Certification (BLOCKED)
1. Review all test results
2. Verify all business decisions implemented
3. Verify all P0/P1 findings resolved
4. Generate production readiness report
5. Get production approval

---

## 20. FINAL GATE

**PRODUCTION STATUS: BLOCKED**

**Blockers:**
1. Financial boundary model not clarified
2. Paid machine lifetime not clarified
3. Expiry parameters not clarified
4. Purchase domain model not clarified
5. Existing paid machine expiry strategy not clarified
6. Virtual trial machine migration strategy not clarified

**Recommendation:**
**STOP and present this report for business approval before proceeding with any schema changes.**

The schema changes proposed are significant and have material impact on:
- User experience (expiry of existing paid machines)
- Platform liability (finite vs infinite lifetime)
- Financial accounting (Starter cap model)
- Data migration (existing machines without provenance)
- Purchase verification (linking PaymentIntent to UserMachine)

These decisions cannot be made in isolation without product/business input.

---

## END OF SCHEMA GATE FORENSIC REPORT

**Status:** AWAITING BUSINESS DECISIONS

**Next Step:** Present report for approval and clarification of required business decisions before proceeding with any schema changes.
