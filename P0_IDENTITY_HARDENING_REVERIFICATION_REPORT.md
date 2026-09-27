# TITANSTREAM — P0 IDENTITY HARDENING RE-VERIFICATION REPORT

**Date:** 2026-09-24
**Previous Verdict:** PARTIALLY VERIFIED — BLOCKED BY 3 CRITICAL FINDINGS
**Current Verdict:** PARTIALLY VERIFIED — BLOCKED BY 2 CRITICAL FINDINGS
**Auditor:** Automated Forensic Verification System

---

## EXECUTIVE SUMMARY

The re-verification found that **1 of 3 previous blockers has been resolved** (schema uniqueness constraint added), but **2 CRITICAL BLOCKERS remain** that must be fixed before deployment.

**Status:** DO NOT DEPLOY. Remediation required for 2 remaining blockers.

---

## BLOCKER RESOLUTION STATUS

### ✅ RESOLVED: Schema Uniqueness Constraint

**Previous Blocker #2** has been fixed:
- **File:** `services/api/prisma/schema.prisma`
- **Line:** 2208
- **Change:** Added `@@unique([provider, identifier])` to `ChannelIdentity` model

**Evidence:**
```prisma
model ChannelIdentity {
  id         String           @id @default(uuid()) @map("channel_identity_id")
  identityId String           @map("identity_id")
  provider   IdentityProvider @map("provider")
  identifier String           @map("identifier")
  phone      String?          @map("phone")
  telegramId String?          @map("telegram_id")
  verified   Boolean          @default(true) @map("verified")
  metadata   Json             @default("{}") @map("metadata")
  createdAt  DateTime         @default(now()) @map("created_at")

  identity UniversalIdentity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([provider, identifier])  // ✅ ADDED
  @@index([identityId])
  @@map("channel_identities")
}
```

**Impact:** This prevents race conditions that could create duplicate channel identities for the same provider/identifier combination.

---

## REMAINING CRITICAL BLOCKERS (P0)

### BLOCKER #1: Ledger Balance Calculation is Fundamentally Incorrect

**Severity:** P0 — CRITICAL FINANCIAL INTEGRITY BUG
**Status:** ❌ UNRESOLVED
**File:** `services/api/src/modules/identity/identity-master.service.ts`
**Lines:** 556-561

**Finding:**

The ledger balance calculation is still naive and incorrect:

```typescript
const ledgerBalance = ledgerEntries.reduce((sum, entry) => {
  const amount = Number(entry.amount);
  // Debit entries (negative amounts from debit accounts)
  // Credit entries (positive amounts from credit accounts)
  return sum + amount;
}, 0);
```

**Why This is Still Wrong:**

1. **No distinction between debit and credit entries** — The code simply sums all amounts without considering entry type
2. **No handling of entry types** — Ledger entries have types (DEBIT/CREDIT) that determine whether they increase or decrease balance
3. **Comment is misleading** — The comment suggests understanding of debit/credit accounting but the implementation does not reflect it
4. **Violates double-entry accounting principles** — Proper ledger balance calculation requires:
   - For debit accounts: sum DEBIT entries - sum CREDIT entries
   - For credit accounts: sum CREDIT entries - sum DEBIT entries
   - Or use entry types to determine direction

**Production Risk:**

- **Financial value destruction** — Balances will be calculated incorrectly
- **Lost funds** — Users may see incorrect balances after reconciliation
- **Audit trail corruption** — Financial invariants violated

**Required Fix:**

```typescript
const ledgerBalance = ledgerEntries.reduce((sum, entry) => {
  const amount = Number(entry.amount);
  // Correct: Consider entry type and account type
  // DEBIT entries increase debit accounts, decrease credit accounts
  // CREDIT entries increase credit accounts, decrease debit accounts
  if (entry.entryType === 'DEBIT') {
    return sum + amount; // Debit increases balance
  } else if (entry.entryType === 'CREDIT') {
    return sum - amount; // Credit decreases balance
  }
  return sum;
}, 0);
```

**OR** query the ledger's pre-calculated balance if available via a service method.

**Validation:**

1. Add test: Create two accounts with known ledger entries
2. Calculate balance manually using correct accounting
3. Run reconciliation
4. Verify selected account matches expected (highest CORRECT balance)
5. Verify all ledger entries preserved and no duplicates

**Production Gate:** BLOCKED until fixed and tested.

---

### BLOCKER #2: Step-Up Token Violates JWT Subject Standardization

**Severity:** P0 — JWT CONSISTENCY VIOLATION
**Status:** ❌ UNRESOLVED
**File:** `services/api/src/modules/auth/auth.service.ts`
**Lines:** 930-933

**Finding:**

The step-up authorization token still uses `userId` instead of `UniversalIdentity.id`:

```typescript
const stepUpToken = this.jwtService.sign(
  { sub: userId, type: 'step_up', purpose: 'financial_authorization' },
  { expiresIn: '5m' },
);
```

**Why This is Still Wrong:**

1. **Violates JWT subject standardization** — All other auth paths use `UniversalIdentity.id`
2. **Inconsistent token interpretation** — Guards may assume `sub` is always canonical identity
3. **Creates edge case** — Step-up tokens don't follow established pattern
4. **Implementation claimed "completed" but missed this path**

**Evidence:**

The implementation report stated:
> "JWT subject now consistently uses UniversalIdentity.id (canonical identity) across all authentication paths"

But this path was missed.

**Production Risk:**

- **Token validation failures** — Guards expecting `UniversalIdentity.id` may fail
- **Authorization bypass** — Incorrect subject could allow wrong user authorization
- **Audit trail inconsistency** — Different token subjects across paths

**Required Fix:**

```typescript
// Get canonical identity ID first
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: { identityId: true },
});

const canonicalId = user?.identityId || userId;

const stepUpToken = this.jwtService.sign(
  { sub: canonicalId, type: 'step_up', purpose: 'financial_authorization' },
  { expiresIn: '5m' },
);
```

**Validation:**

1. Create step-up token
2. Verify `sub` is `UniversalIdentity.id`
3. Verify token validation works correctly
4. Verify authorization check works

**Production Gate:** BLOCKED until fixed.

---

## FULL VERIFICATION SUMMARY

### P0 Items

| Item | Status | Notes |
|------|--------|-------|
| Reconciliation endpoint authentication | ✅ VERIFIED | Admin-only, server-side enforcement |
| Ledger-backed financial reconciliation | ❌ BLOCKED | Balance calculation incorrect (Blocker #1) |
| WhatsApp mock-user removal | ✅ VERIFIED | Throws error, no mock creation |
| Canonical identity selection | ✅ VERIFIED | 7-factor scoring, deterministic |
| Ledger-entry migration | ⚠️ PARTIAL | Migration logic correct, selection wrong (Blocker #1) |

### P1 Items

| Item | Status | Notes |
|------|--------|-------|
| Machine ownership merging | ✅ VERIFIED | Reassigns telegramUserId correctly |
| Referral relationship merging | ✅ VERIFIED | Merges relationships and history |
| Session restore mapping verification | ✅ VERIFIED | Rejects inconsistent mappings |
| JWT subject standardization | ❌ BLOCKED | Step-up token uses userId (Blocker #2) |

### P2 Items

| Item | Status | Notes |
|------|--------|-------|
| Cache TTL and invalidation | ✅ VERIFIED | 5-minute TTL, post-reconciliation invalidation |

### Additional Verifications

| Item | Status | Notes |
|------|--------|-------|
| Financial atomicity | ✅ VERIFIED | Transaction wraps entire reconciliation |
| Financial invariant (no bypass) | ✅ VERIFIED | No direct balance manipulation |
| DB failure behavior | ✅ VERIFIED | All paths fail closed |
| Session restore edge cases | ✅ VERIFIED | Frontend rejects correctly |
| Cache security/cross-instance | ⚠️ PARTIAL | Process-local cache, no logout invalidation |
| Machine merge integrity | ✅ VERIFIED | No duplicate machine check needed |
| Referral merge integrity | ✅ VERIFIED | No self-referral check needed |
| Financial history preservation | ✅ VERIFIED | No ledger entry deletion |
| Deleted identity semantics | ✅ VERIFIED | DELETED_USER state, points to canonical |
| Race conditions | ✅ VERIFIED | Transaction + uniqueness constraint now sufficient |
| Schema alignment | ✅ VERIFIED | Uniqueness constraint added, purchaseReference removed |
| Test coverage | ❌ INSUFFICIENT | No automated reconciliation tests |
| Production preconditions | ⚠️ PARTIAL | 2 blockers remain |

---

## UPDATED VERDICT

## PARTIALLY VERIFIED — BLOCKED BY 2 CRITICAL FINDINGS

### Blockers (Must Fix Before Deployment)

1. **CRITICAL — Ledger Balance Calculation Bug** (P0) — UNRESOLVED
   - File: `identity-master.service.ts` lines 556-561
   - Fix: Implement correct debit/credit accounting
   - Test: Add ledger balance calculation tests

2. **CRITICAL — Step-Up Token Subject** (P0) — UNRESOLVED
   - File: `auth.service.ts` line 931
   - Fix: Use `UniversalIdentity.id` as `sub`
   - Test: Verify token subject consistency

### Resolved

3. **CRITICAL — Missing Uniqueness Constraint** (P0) — ✅ RESOLVED
   - Schema constraint added: `@@unique([provider, identifier])`
   - No migration needed if schema not yet deployed

### Should Fix (Before Production)

4. **Logout Cache Invalidation** (P1)
   - Add logout endpoint
   - Invalidate cache on logout
   - Consider shared cache for multi-instance

5. **Canonical Selection Tie-Breaker** (P1)
   - Add secondary sort (e.g., `id` or `createdAt`)
   - Ensure deterministic selection

### Nice to Have (Post-Deployment)

6. **Automated Test Coverage** (P2)
   - Add reconciliation test suite
   - Add canonical selection tests
   - Add merge operation tests

---

## DEPLOYMENT RECOMMENDATION

**DO NOT DEPLOY**

The implementation has 2 CRITICAL BLOCKERS that violate financial integrity and JWT consistency. The ledger balance calculation bug alone could result in incorrect user balances after reconciliation.

**Required Actions:**

1. Fix ledger balance calculation (P0) — Blocker #1
2. Fix step-up token subject (P0) — Blocker #2
3. Add tests for all changes
4. Re-run verification after fixes
5. Only deploy after all blockers resolved

**Estimated Effort:** 2-4 hours (fixes + tests + verification)

---

## PROGRESS SUMMARY

**Previous Audit:** 3 blockers identified
**Current Audit:** 1 blocker resolved, 2 blockers remain
**Resolution Rate:** 33% (1/3)

**Next Steps:**
1. Fix ledger balance calculation
2. Fix step-up token subject
3. Add comprehensive tests
4. Final verification
5. Deploy

---

**END OF RE-VERIFICATION REPORT**
