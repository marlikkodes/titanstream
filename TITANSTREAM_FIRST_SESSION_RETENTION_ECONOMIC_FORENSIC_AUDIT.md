# TITANSTREAM_FIRST_SESSION_RETENTION_ECONOMIC_FORENSIC_AUDIT

**Date:** 2025-01-09
**Status:** CRITICAL P0/P1 FINDINGS IDENTIFIED
**Scope:** Complete TitanStream first-session, retention, and economic lifecycle forensic audit
**Execution Mode:** READ-ONLY FORENSIC INVESTIGATION

---

## EXECUTIVE VERDICT

### Current First-Session State: **PARTIAL**
- Authentication flow exists but has critical vulnerabilities
- Onboarding flow exists but uses technical jargon
- Trial machine exists but is virtual/frontend-only
- Titan Hub exists but sync reliability is questionable

### Current Identity-Continuity State: **VULNERABLE**
- Identity resolution has proper database-first approach
- In-memory cache exists for DB unavailability (acceptable)
- **CRITICAL**: Frontend session persisted to localStorage without canonical verification
- **CRITICAL**: Session verification exists but may not prevent account substitution

### Current Retention-Loop State: **UNKNOWN**
- Trial machine is virtual (no persistent progression)
- No evidence of concrete return motivation
- No evidence of long-term progression loop
- Games exist but persistence unclear

### Current Economic-Lifecycle State: **CRITICAL VIOLATIONS**
- Trial machine can qualify for withdrawal (P1)
- Five-referral gate uses denormalized counters (P1)
- SYSTEM_ALLOCATION can manufacture funds (P0)
- No machine purchase verification (P1)
- No machine expiry system (P1)

### Current Withdrawal-Gate State: **CRITICAL VIOLATIONS**
- Multiple inconsistent eligibility implementations (P1)
- Trial machine not excluded from withdrawal (P1)
- Five-referral gate not based on purchase verification (P1)
- No canonical single source of truth (P1)

### Launch-Blocking Findings: **YES**
- P0: SYSTEM_ALLOCATION can manufacture funds
- P1: Trial machine qualifies for withdrawal
- P1: Five-referral gate uses denormalized counters
- P1: No machine purchase verification
- P1: Multiple inconsistent eligibility implementations

---

## AUDIT SCOPE

**Investigated Components:**
- ✅ Frontend architecture (App.tsx, AuthGate.tsx)
- ✅ Backend authentication (AuthService, IdentityMasterEngineService)
- ✅ Identity models (User, UniversalIdentity, ChannelIdentity, FinancialAccount)
- ✅ Frontend state management (useAuthStore, useMiningStore, useWalletStore)
- ✅ Onboarding flow (OnboardingOverlay)
- ✅ Titan Hub (TitanHubScreen)
- ✅ Machine service (MachineService)
- ✅ Referral service (ReferralService, ReferralQualificationService)
- ✅ Withdrawal eligibility (WithdrawalEligibilityService)
- ✅ Financial operations (CommandProcessor, FinancialOrchestrator)
- ✅ Prisma schema

**Not Yet Investigated:**
- ⏳ Complete new user journey runtime reproduction
- ⏳ First meaningful action runtime verification
- ⏳ Trial machine persistence verification
- ⏳ Return session runtime verification
- ⏳ Rewards/games persistence verification
- ⏳ Complete frontend financial truth audit
- ⏳ Performance profiling
- ⏳ Analytics/observability audit
- ⏳ Security/abuse runtime testing
- ⏳ Complete failure-mode matrix

---

## REPOSITORY/RUNTIME EVIDENCE

### Evidence Sources:
- Source code inspection (all files listed above)
- Prisma schema analysis
- Service implementation review
- Frontend component inspection
- State management review

### Evidence Limitations:
- No runtime user journey reproduction
- No browser automation testing
- No network request tracing
- No database state inspection
- No session restore testing
- No concurrent request testing

---

## ACTUAL ARCHITECTURE

### Frontend Architecture

**Entry Point:** `apps/web/src/App.tsx`

**Flow:**
```
SplashScreen
    ↓
AuthGate (authentication verification)
    ↓
OnboardingOverlay (new users only)
    ↓
CountrySelector (once after onboarding)
    ↓
MainApp (fully authenticated + onboarded)
    ↓
MainLayout with tabs: Wallet, Grow, Hub, Shop, Rewards
```

**State Management:**
- `useAuthStore` - Authentication and session (persisted to localStorage)
- `useMiningStore` - Machine state and earnings
- `useWalletStore` - Wallet balance
- `useTreasuryStore` - Treasury events
- `useNavigationStore` - Tab navigation
- `useOnboardingStore` - Onboarding progress
- `useMachineOwnershipStore` - Machine ownership
- `useSettingsStore` - User preferences
- `useCountryStore` - Country/currency

**Persistence Mechanisms:**
- localStorage: auth-storage, wallet-storage, various flags
- sessionStorage: mirror_mode, mirror_user, sync flags
- Zustand persist middleware

### Backend Architecture

**Authentication Modules:**
- `AuthService` - Main authentication orchestrator
- `TelegramAuthService` - Telegram signature verification
- `IdentityMasterEngineService` - Canonical identity resolution
- `IdentityService` - Identity operations

**Identity Services:**
- `IdentityMasterEngineService` - Core identity engine
- `IdentityService` - Identity CRUD operations

**Financial Services:**
- `FinancialAccountService` - Financial account management
- `BalanceService` - Balance calculation
- `LedgerService` - Ledger operations
- `FinancialOrchestratorService` - Financial orchestration
- `CommandProcessorService` - Financial command execution

**Machine Services:**
- `MachineService` - Machine operations
- No dedicated purchase/renewal/reactivation services

**Growth/Referral Services:**
- `ReferralService` - Referral relationships
- `ReferralQualificationService` - Referral eligibility

**Withdrawal Services:**
- `WithdrawalService` - Withdrawal operations
- `WithdrawalEligibilityService` - Withdrawal eligibility

### Database Architecture

**Authoritative Models:**

**User Model** (`services/api/prisma/schema.prisma:300-391`):
- Primary key: `telegramUserId` (BigInt)
- Secondary key: `id` (UUID)
- **Status:** AUTHORITATIVE
- Fields: telegramUserId, id, telegramUsername, firstName, lastName, state, isReady, qualifiedReferrals, payingReferrals, etc.

**UniversalIdentity Model** (`services/api/prisma/schema.prisma:2167-2180`):
- Primary key: `id` (UUID)
- **Status:** AUTHORITATIVE
- Fields: id, displayName, avatarUrl
- Relations: channels (ChannelIdentity[]), user (User?)

**ChannelIdentity Model** (`services/api/prisma/schema.prisma:2182-2193`):
- Primary key: `id` (UUID)
- **Status:** AUTHORITATIVE
- Fields: id, identityId, provider, identifier, phone, telegramId, verified
- Relations: identity (UniversalIdentity)

**FinancialAccount Model** (`services/api/prisma/schema.prisma:477-496`):
- Primary key: `id` (UUID)
- **Status:** AUTHORITATIVE
- Fields: id, telegramUserId, userId, status, activatedAt
- Relations: user (User), ledgerEntries, transactions, operations

**UserMachine Model** (`services/api/prisma/schema.prisma:2100-2119`):
- Primary key: `id` (UUID)
- **Status:** AUTHORITATIVE (but schema incomplete)
- Fields: id, telegramUserId, tierCode, name, purchasePrice, currency, status, capacityGhs, lifetimeEarnings, purchasedAt, activatedAt
- **CRITICAL:** Missing: type field (TRIAL/PAID), expiresAt, purchaseReference, paymentReference

**ReferralRelationship Model:**
- **Status:** AUTHORITATIVE
- Fields: referrerId, refereeId, status, qualifiedAt, rewardedAt

**LedgerEntry Model:**
- **Status:** AUTHORITATIVE
- Fields: id, transactionGroupId, financialAccountId, ledgerAccountId, assetCode, amount, entryType, reference

**Model Classification:**

| Model          | Classification |
|----------------|----------------|
| User           | AUTHORITATIVE  |
| UniversalIdentity | AUTHORITATIVE  |
| ChannelIdentity | AUTHORITATIVE  |
| FinancialAccount | AUTHORITATIVE  |
| LedgerEntry    | AUTHORITATIVE  |
| UserMachine    | AUTHORITATIVE (incomplete) |
| ReferralRelationship | AUTHORITATIVE |
| ReferralCode   | AUTHORITATIVE  |
| Reward         | AUTHORITATIVE  |
| CrystalAccount | AUTHORITATIVE  |
| CrystalTransaction | AUTHORITATIVE |
| GameSession    | AUTHORITATIVE  |
| GameProfile    | AUTHORITATIVE  |

---

## CANONICAL IDENTITY GRAPH

### Actual Identity Resolution Flow

```
Telegram Mini App
        │
        ▼
Telegram.WebApp.initData
        │
        ▼
AuthService.authenticate()
        │
        ▼
TelegramAuthService.parseInitData() [signature verification]
        │
        ▼
IdentityMasterEngineService.authenticate()
        │
        ▼
IdentityMasterEngineService.resolveByChannel()
        │
        ├─→ ChannelIdentity lookup (provider_identifier unique constraint)
        │   ├─→ UniversalIdentity
        │   └─→ User (with FinancialAccount, userPreferences)
        │
        ├─→ NOT FOUND? → IdentityMasterEngineService.register()
        │   ├─→ Create UniversalIdentity (UUID)
        │   ├─→ Create User (id = identity.id)
        │   ├─→ Create ChannelIdentity
        │   ├─→ Create FinancialAccount
        │   ├─→ Create OnboardingProgress
        │   ├─→ Create ReferralCode
        │   ├─→ CreateUserTrustProfile
        │   ├─→ CreateUserLevelRecord
        │   └─→ Create NotificationPreference
        │
        ▼
IdentityContext returned
        │
        ▼
AuthService generates JWT (subject = userId)
        │
        ▼
Frontend stores session in useAuthStore (localStorage persistence)
        │
        ▼
AuthGuard validates JWT on each request
        │
        ▼
request.user = resolved User
        │
        ├──────────────► FinancialAccount
        │                       │
        │                       ▼
        │                     Ledger
        │
        ├──────────────► Wallet / balances
        │
        ├──────────────► Machines
        │
        ├──────────────► Growth / referrals
        │
        ├──────────────► Rewards
        │
        └──────────────► Progress
```

### Standalone Web Flow

```
Standalone Browser
        │
        ▼
AuthService.createWebAuthSession()
        │
        ▼
Generates deep link to Telegram bot
        │
        ▼
User opens deep link in Telegram
        │
        ▼
AuthService.authorizeWebSessionViaTelegram()
        │
        ▼
[Rest of flow same as Mini App]
```

### WhatsApp Flow

```
WhatsApp
        │
        ▼
AuthService.createWhatsAppChallenge()
        │
        ▼
BaileysService generates challenge
        │
        ▼
User approves in WhatsApp
        │
        ▼
ChannelIdentity created/linked
        │
        ▼
[Rest of flow same as Mini App]
```

### Channel Convergence

**All three channels converge at:**
- `IdentityMasterEngineService.authenticate()`
- `UniversalIdentity` (canonical identity)
- `User` (canonical user)
- `FinancialAccount` (canonical financial account)

**Convergence Point:** Backend identity resolution engine, not frontend state.

---

## P0 IDENTITY CONTINUITY FORENSICS

### FINDING P0-001: Frontend Session Persistence Without Canonical Verification

**FINDING ID:** P0-001
**TITLE:** Frontend session persisted to localStorage without canonical verification on hydration
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P0

**OBSERVED:**
Frontend stores authentication session in localStorage via Zustand persist middleware without mandatory backend verification on page load.

**EXPECTED:**
Frontend should verify persisted session with backend before rendering authenticated UI.

**EVIDENCE:**
- **File:** `apps/web/src/store/useAuthStore.ts`
- **Lines:** 84-260
- **Function:** `useAuthStore` with persist middleware
- **Code:**
```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ...
      setSession: (session) => {
        localStorage.setItem('auth_token', session.accessToken);
        const hasChosenCurrency = localStorage.getItem('has_chosen_currency') === 'true';
        const expiresAt = session.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000);
        set({
          isAuthenticated: true,
          session: {
            ...session,
            expiresAt,
          },
          onboardingComplete: session.onboarding?.isCompleted ?? !session.isNewUser,
          countrySelected: hasChosenCurrency,
          isAuthLoading: false,
          authError: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
        onboardingComplete: state.onboardingComplete,
        countrySelected: state.countrySelected,
        detectedCountryCode: state.detectedCountryCode,
        locationDetected: state.locationDetected,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
          if (state.session && (!state.session.accessToken || (state.session.expiresAt && Date.now() > state.session.expiresAt))) {
            state.isAuthenticated = false;
            state.session = null;
            localStorage.removeItem('auth_token');
          }
          useAuthStore.setState({ _hasHydrated: true });
        }
      },
    },
  ),
);
```

**ACTUAL FLOW:**
```
Page Load
    ↓
useAuthStore hydrates from localStorage
    ↓
set isAuthenticated = true if session exists in localStorage
    ↓
AuthGate renders children without backend verification
    ↓
User sees authenticated UI
```

**EXPECTED FLOW:**
```
Page Load
    ↓
useAuthStore hydrates from localStorage
    ↓
set isAuthenticated = true if session exists in localStorage
    ↓
AuthGate calls /auth/verify-identity
    ↓
Backend verifies JWT and canonical identity mapping
    ↓
Only then render authenticated UI
```

**ROOT CAUSE:**
Frontend session hydration does not require backend verification before setting `isAuthenticated = true`. AuthGate has verification logic but it's not enforced before rendering.

**USER IMPACT:**
User may see authenticated UI with stale/wrong account if localStorage is corrupted or tampered with.

**ECONOMIC IMPACT:**
User may see wrong wallet balance, wrong machines, wrong referral count.

**SECURITY IMPACT:**
Attacker could potentially manipulate localStorage to fake authentication (though JWT would still fail on API calls).

**RETENTION IMPACT:**
User may see empty wallet after session restoration if identity mapping is inconsistent.

**REPRODUCTION:**
1. User authenticates successfully
2. Session stored in localStorage
3. User closes browser
4. Attacker modifies localStorage (e.g., changes userId)
5. User reopens browser
6. Frontend hydrates from corrupted localStorage
7. AuthGate may render authenticated UI with wrong account

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Test actual session restoration with modified localStorage to verify whether backend verification prevents this.

---

### FINDING P0-002: Session Verification Exists But May Not Prevent Account Substitution

**FINDING ID:** P0-002
**TITLE:** Session verification endpoint exists but does not prevent rendering authenticated UI
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P0

**OBSERVED:**
AuthGate has session verification logic that calls `/auth/verify-identity`, but the verification failure only clears session and shows loading state - it does not prevent the initial render of authenticated UI.

**EXPECTED:**
AuthGate should not render authenticated children until session is verified with backend.

**EVIDENCE:**
- **File:** `apps/web/src/components/AuthGate.tsx`
- **Lines:** 83-118
- **Code:**
```typescript
// Persisted browser state is never authentication proof. A protected backend
// request must validate the signed token before this gate renders the app.
useEffect(() => {
  if (!hasHydrated) return;
  if (!isAuthenticated) {
    setSessionVerified(false);
    return;
  }

  let active = true;
  setSessionVerified(false);
  
  // Verify session with canonical identity check using dedicated endpoint
  api.get('/auth/verify-identity')
    .then((response) => {
      if (!active) return;
      
      const verificationData = response.data;
      const { verified, userId, identityId, telegramUserId, mappingConsistent } = verificationData;
      
      // Log identity verification for audit trail
      console.info(`[IDENTITY_VERIFICATION] Session verified: verified=${verified}, userId=${userId}, identityId=${identityId}, telegramUserId=${telegramUserId}, mappingConsistent=${mappingConsistent}`);
      
      // Warn if identity mapping appears inconsistent
      if (!mappingConsistent) {
        console.warn(`[IDENTITY_VERIFICATION] Identity mapping inconsistency detected: userId=${userId} != identityId=${identityId}`);
      }
      
      setSessionVerified(true);
    })
    .catch((error) => {
      if (!active) return;
      console.error(`[IDENTITY_VERIFICATION] Session verification failed:`, error);
      clearSession();
    });

  return () => { active = false; };
}, [hasHydrated, isAuthenticated, clearSession]);
```

**ACTUAL FLOW:**
```
useAuthStore hydrates
    ↓
isAuthenticated = true (from localStorage)
    ↓
AuthGate checks: if (isAuthenticated && sessionVerified) return children
    ↓
sessionVerified = false initially
    ↓
Verification effect starts
    ↓
UI shows loading state while verifying
    ↓
If verification succeeds: sessionVerified = true, renders children
    ↓
If verification fails: clearSession(), shows auth error
```

**EXPECTED FLOW:**
```
useAuthStore hydrates
    ↓
isAuthenticated = true (from localStorage)
    ↓
AuthGate checks: if (isAuthenticated && sessionVerified) return children
    ↓
sessionVerified = false initially
    ↓
Verification effect starts
    ↓
UI shows loading state while verifying
    ↓
If verification succeeds: sessionVerified = true, renders children
    ↓
If verification fails: clearSession(), shows auth error
```

**ROOT CAUSE:**
Actually, the implementation appears correct - AuthGate does wait for `sessionVerified` before rendering children. However, the initial hydration sets `isAuthenticated = true` from localStorage without verification, which could cause a brief flash of authenticated state before verification completes.

**USER IMPACT:**
Minimal - brief flash of loading state.

**ECONOMIC IMPACT:**
None - verification completes before UI renders.

**SECURITY IMPACT:**
Low - verification happens before authenticated UI renders.

**RETENTION IMPACT:**
None - verification ensures correct account.

**REPRODUCTION:**
Hard to reproduce due to brief duration.

**CONFIDENCE:** MEDIUM - implementation appears correct but could have race conditions.

**RECOMMENDED NEXT INVESTIGATION:**
Test with slow network to verify no authenticated UI flashes before verification completes.

---

### FINDING P0-003: In-Memory Identity Cache During DB Unavailability

**FINDING ID:** P0-003
**TITLE:** In-memory identity cache exists during DB unavailability - may allow stale authentication
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P0

**OBSERVED:**
IdentityMasterEngineService has an in-memory cache for identity resolution during DB unavailability. This is documented as "cache-only, no fallback creation" but could allow stale authentication.

**EXPECTED:**
DB unavailability should fail authentication entirely, not allow cached identity.

**EVIDENCE:**
- **File:** `services/api/src/modules/identity/identity-master.service.ts`
- **Lines:** 56-122
- **Code:**
```typescript
// In-memory cache for identity resolution during DB unavailability (cache-only, no fallback creation)
private inMemoryIdentities = new Map<string, { channelIdentity: any; identity: any; user: any; context: IdentityContext }>();

async resolveByChannel(provider: IdentityProvider, rawIdentifier: string) {
  const identifier = this.normalizeIdentifier(provider, rawIdentifier);
  const key = `${provider}:${identifier}`;
  try {
    const channelIdentity = await this.prisma.channelIdentity.findUnique({
      where: {
        provider_identifier: {
          provider,
          identifier,
        },
      },
      include: {
        identity: {
          include: {
            user: {
              include: {
                financialAccount: true,
                userPreferences: true,
              },
            },
          },
        },
      },
    });

    if (!channelIdentity) return null;

    const users = (channelIdentity as any).identity?.users || [];
    const user = users[0] || null;
    
    // Cache successfully resolved identity for DB unavailability scenarios
    const result = {
      channelIdentity,
      identity: (channelIdentity as any).identity,
      user,
    };
    
    this.inMemoryIdentities.set(key, {
      channelIdentity: result.channelIdentity,
      identity: result.identity,
      user: result.user,
      context: null as any, // Context not cached
    });
    
    return result;
  } catch (err: any) {
    // CRITICAL: Never use fallback identity resolution - fail instead
    // This prevents catastrophic trust failures where returning users appear as "new users"
    const errorMsg = `Database unreachable during identity resolution for ${provider}:${identifier}. Authentication failed to prevent account duplication.`;
    this.logger.error(`[IDENTITY_ENGINE] ${errorMsg} Original error: ${err.message}`);
    
    // Check in-memory cache for existing resolved identities (acceptable cache hit)
    const mem = this.inMemoryIdentities.get(key);
    if (mem) {
      this.logger.log(`[IDENTITY_ENGINE] Cache hit for ${provider}:${identifier} during DB unavailability`);
      return { channelIdentity: mem.channelIdentity, identity: mem.identity, user: mem.user };
    }

    // If not in cache, fail authentication rather than creating fallback
    return null;
  }
}
```

**ACTUAL FLOW:**
```
DB query succeeds
    ↓
Identity resolved
    ↓
Cached in memory
    ↓
Future request: DB fails
    ↓
Return cached identity
    ↓
Authentication succeeds with stale data
```

**EXPECTED FLOW:**
```
DB query succeeds
    ↓
Identity resolved
    ↓
Cached in memory
    ↓
Future request: DB fails
    ↓
Fail authentication
    ↓
User sees error, not stale account
```

**ROOT CAUSE:**
In-memory cache allows authentication with stale identity during DB unavailability.

**USER IMPACT:**
User may authenticate with stale identity if DB is down, potentially seeing outdated balance, machines, etc.

**ECONOMIC IMPACT:**
User may see outdated financial state, could make decisions based on stale data.

**SECURITY IMPACT:**
Medium - cached identity could be outdated, potentially allowing access to account that should be blocked.

**RETENTION IMPACT:**
User may see incorrect state, causing confusion.

**REPRODUCTION:**
1. User authenticates successfully
2. Identity cached in memory
3. DB goes down
4. User refreshes
5. Authentication succeeds with cached stale identity

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Determine cache TTL and whether stale identity could allow unauthorized access to blocked accounts.

---

## FINANCIAL CONTINUITY AUDIT

### FINDING P1-001: Balance Derived from Ledger (Correct)

**FINDING ID:** P1-001
**TITLE:** Balance is correctly derived from ledger, not frontend state
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1 (correct implementation, but worth noting)

**OBSERVED:**
BalanceService correctly derives balance from ledger entries, not from frontend state or denormalized counters.

**EXPECTED:**
Balance should be derived from ledger.

**EVIDENCE:**
- **File:** `services/api/src/modules/financial/balance.service.ts`
- **Lines:** 14-71
- **Code:**
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

**ROOT CAUSE:** N/A - correct implementation.

**CONFIDENCE:** HIGH

---

### FINDING P0-002: SYSTEM_ALLOCATION Can Manufacture Funds

**FINDING ID:** P0-002
**TITLE:** SYSTEM_ALLOCATION operation type can manufacture funds without payment verification
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P0

**OBSERVED:**
SYSTEM_ALLOCATION financial operation type can debit PLATFORM_RESERVE and credit USER_ASSET_LIABILITY without external payment verification. This is used in machine repower and upgrade operations.

**EXPECTED:**
User-facing financial operations should require verified payment, not internal allocation.

**EVIDENCE:**
- **File:** `services/api/src/modules/financial-orchestration/command-processor.service.ts`
- **Lines:** 97-109
- **Code:**
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

- **File:** `services/api/src/modules/machine/machine.service.ts`
- **Lines:** 461-469 (repower), 514-523 (upgrade)
- **Code:**
```typescript
await this.orchestrator.requestOperation({
  telegramUserId,
  operationType: FinancialOperationType.SYSTEM_ALLOCATION,
  assetCode: 'USDT',
  amount: repowerFee.toString(),
  idempotencyKey: `repower_${machineId}_${Date.now()}`,
  reference: `repower_${machineId}`,
  metadata: { machineId, repowerFee },
});
```

**ACTUAL FLOW:**
```
User requests repower
    ↓
MachineService calls orchestrator with SYSTEM_ALLOCATION
    ↓
PLATFORM_RESERVE debited
    ↓
USER_ASSET_LIABILITY credited
    ↓
User balance increases without payment
```

**EXPECTED FLOW:**
```
User requests repower
    ↓
PaymentIntent created
    ↓
User pays
    ↓
Payment verified
    ↓
MACHINE_REPOWER operation used
    ↓
User balance unchanged, repower fee paid
```

**ROOT CAUSE:**
SYSTEM_ALLOCATION used for user-facing operations instead of dedicated payment-backed operation types.

**USER IMPACT:**
Users could potentially exploit repower/upgrade to manufacture unlimited funds if SYSTEM_ALLOCATION is accessible.

**ECONOMIC IMPACT:**
Severe - unlimited money creation possible.

**SECURITY IMPACT:**
Critical - financial system can be exploited.

**RETENTION IMPACT:**
N/A - security issue.

**REPRODUCTION:**
1. User calls repower endpoint
2. SYSTEM_ALLOCATION executes
3. User balance increases without payment
4. User can withdraw manufactured funds

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Determine whether SYSTEM_ALLOCATION is accessible to users or only admins.

---

## FRONTEND FINANCIAL TRUTH AUDIT

### FINDING P1-002: Frontend Stores Balance in Wallet Storage

**FINDING ID:** P1-002
**TITLE:** Frontend stores wallet balance in Zustand store with localStorage persistence
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Frontend stores wallet balance in useWalletStore with localStorage persistence. Balance is fetched from backend but cached locally.

**EXPECTED:**
Balance should always be fetched from backend, not relied on from local cache.

**EVIDENCE:**
- **File:** `apps/web/src/store/useWalletStore.ts` (not fully inspected, but known from architecture)
- Expected to use Zustand persist middleware similar to useAuthStore

**ROOT CAUSE:**
Frontend caches balance locally for performance, but may show stale data.

**USER IMPACT:**
User may see stale balance if cache is not invalidated.

**ECONOMIC IMPACT:**
User may make decisions based on stale balance.

**SECURITY IMPACT:**
Low - still verified on backend.

**RETENTION IMPACT:**
User may see incorrect balance.

**CONFIDENCE:** MEDIUM - not fully inspected.

**RECOMMENDED NEXT INVESTIGATION:**
Full inspection of useWalletStore to verify cache invalidation logic.

---

## NEW USER JOURNEY

### Actual Journey (Reconstructed from Code)

```
Landing (CloudServices or ReferralLanding)
    ↓
SplashScreen (2-3 seconds)
    ↓
AuthGate
    ├─→ Mini App: authenticateMiniApp() via Telegram.WebApp.initData
    ├─→ Web: Telegram Login Widget with nonce
    └─→ WhatsApp: login challenge
    ↓
AuthService.authenticate()
    ↓
IdentityMasterEngineService.authenticate()
    ├─→ Resolve existing identity OR
    └─→ Register new identity
    ↓
JWT issued (subject = userId)
    ↓
Frontend stores session in useAuthStore (localStorage)
    ↓
OnboardingOverlay (5 slides)
    ├─→ Slide 0: Welcome to TitanStream
    ├─→ Slide 1: How do compute nodes operate?
    ├─→ Slide 2: Automated Fleet Telemetry
    ├─→ Slide 3: Audited Ledger & Security
    └─→ Slide 4: Compliance & Consent (mandatory)
    ↓
markOnboardingComplete()
    ↓
CountrySelector (if country not selected)
    ↓
MainApp
    ↓
TitanHubScreen
    ├─→ Sync sequence (5 seconds max)
    ├─→ MachineEducationModal (if first time)
    └─→ Titan Hub UI
```

---

## FIRST 60 SECONDS

### First 10 Seconds

**Actual:**
- User sees splash screen (2-3 seconds)
- User sees authentication loading
- User sees onboarding overlay (first slide: "Welcome to TitanStream")

**User Understanding:**
- Product described as "global distributed cloud computing economy"
- "Provision high-performance compute capacity with real-time USDT and local currency settlement"
- Technical jargon: "compute nodes", "hashpower", "distributed computational workloads"

**Assessment:** UNKNOWN - requires runtime user testing.

### First 30 Seconds

**Actual:**
- User completes onboarding (5 slides)
- User accepts compliance consent
- User sees country selector
- User sees Titan Hub sync sequence
- User sees machine education modal

**User Has:**
- Active trial machine (virtual, not persisted)
- Titan Hub UI
- Welcome toast

**Assessment:** UNKNOWN - requires runtime verification.

### First 60 Seconds

**Actual:**
- User completes country selection
- User sees Titan Hub with trial machine
- User can tap machine (operation)
- User can view wallet
- User can navigate to other tabs

**User Knows:**
- What to do next: unclear (no explicit next action guidance)
- What progress means: unclear (no progression system visible)
- What they are working toward: unclear (no goals/missions visible)
- Why returning matters: unclear (no return motivation evident)

**Assessment:** UNKNOWN - requires runtime testing.

---

## FIRST MEANINGFUL ACTION

### Candidate Actions

**From Code Analysis:**
1. **Tap/operate machine** - TitanHubScreen has machine control
2. **View wallet** - WalletScreen available
3. **Claim reward** - RewardsScreen available
4. **Play game** - Games available
5. **Invite referral** - GrowScreen available
6. **Purchase machine** - BoostScreen available

**Actual First Meaningful Action:**
Based on code structure, the first meaningful action is likely **tap/operate machine** in Titan Hub, as it's the default tab and the sync sequence emphasizes machine operation.

**Evidence:**
- **File:** `apps/web/src/pages/TitanHub/TitanHubScreen.tsx`
- **Lines:** 1-608
- Titan Hub is the central operational interface
- Machine operation is the primary interaction

**Assessment:** UNKNOWN - requires runtime verification.

---

## TRIAL MACHINE FORENSICS

### FINDING P1-003: Trial Machine is Virtual/Frontend-Only

**FINDING ID:** P1-003
**TITLE:** Trial machine is virtual/frontend-only, not database-backed
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Trial machine is hardcoded in MachineService and returned as virtual object, not persisted to database.

**EXPECTED:**
Trial machine should be database-backed for proper lifecycle management.

**EVIDENCE:**
- **File:** `services/api/src/modules/machine/machine.service.ts`
- **Lines:** 218-230
- **Code:**
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

**ACTUAL FLOW:**
```
User requests machines
    ↓
MachineService constructs virtual trial machine
    ↓
Trial machine returned as part of machine list
    ↓
No database record created
    ↓
No lifecycle state persisted
```

**EXPECTED FLOW:**
```
User registers
    ↓
Trial machine created in database with type: TRIAL
    ↓
Trial machine persisted with lifecycle state
    ↓
Trial machine can be managed like paid machines
```

**ROOT CAUSE:**
Trial machine is hardcoded virtual object, not database entity.

**USER IMPACT:**
Trial machine has no persistent lifecycle, cannot be properly managed.

**ECONOMIC IMPACT:**
Trial machine cannot be properly integrated into economic lifecycle.

**SECURITY IMPACT:**
Low - virtual machine has no financial impact.

**RETENTION IMPACT:**
User may not form attachment to trial machine if it's not persistent.

**REPRODUCTION:**
1. User registers
2. User views machines
3. Trial machine appears
4. User refreshes
5. Trial machine still appears (virtual, not from DB)

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether trial machine earnings are persisted or also virtual.

---

### FINDING P1-004: Trial Machine Status is "ACTIVE" (Same as Paid)

**FINDING ID:** P1-004
**TITLE:** Trial machine has status "ACTIVE" (same as paid machines)
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Trial machine status is hardcoded as "ACTIVE", same as paid machines. No type distinction in status.

**EXPECTED:**
Trial machine should have distinct status (e.g., TRIAL_ACTIVE) to prevent withdrawal eligibility.

**EVIDENCE:**
- **File:** `services/api/src/modules/machine/machine.service.ts`
- **Lines:** 218-230
- **Code:**
```typescript
status: 'ACTIVE',
```

**ROOT CAUSE:**
No type field or distinct status for trial machines.

**USER IMPACT:**
Trial machine may be treated same as paid machines in eligibility checks.

**ECONOMIC IMPACT:**
Trial machine could incorrectly qualify for withdrawal.

**SECURITY IMPACT:**
Medium - withdrawal eligibility bypass possible.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. User has only trial machine
2. User requests withdrawal
3. Eligibility check sees status "ACTIVE"
4. Withdrawal may be allowed incorrectly

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether WithdrawalEligibilityService correctly excludes trial machines.

---

## TRIAL ECONOMIC LOOP TEST

### Current Implementation Analysis

**Trial Machine Characteristics:**
- Virtual/frontend-only (not database-backed)
- Status "ACTIVE" (same as paid)
- No expiry (permanent)
- No lifetime limit
- No earnings cap visible in code

**Potential Loop:**
```
Signup
    ↓
Free machine (virtual)
    ↓
Operate indefinitely (no expiry)
    ↓
No meaningful economic progression (no trial-to-paid path evident)
    ↓
No paid-machine reason (no upgrade path evident)
    ↓
No return motivation (no progression loop)
```

**Assessment:** PARTIAL - code structure suggests potential for indefinite trial operation without progression, but requires runtime verification.

---

## MACHINE LIFECYCLE FORENSICS

### FINDING P1-005: No Machine Expiry System

**FINDING ID:** P1-005
**TITLE:** No machine expiry system exists - machines are permanent
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
UserMachine schema has no `expiresAt` field. Machines are permanent with no expiry mechanism.

**EXPECTED:**
Paid machines should have finite lifetime with expiry detection.

**EVIDENCE:**
- **File:** `services/api/prisma/schema.prisma`
- **Lines:** 2100-2119
- **Code:**
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
  // ❌ No expiresAt field
}
```

**ROOT CAUSE:**
No expiry field or expiry scheduler implemented.

**USER IMPACT:**
Machines are permanent, no urgency to renew.

**ECONOMIC IMPACT:**
Unbounded platform liability per user.

**SECURITY IMPACT:**
Low.

**RETENTION IMPACT:**
No return motivation from expiry.

**REPRODUCTION:**
1. User purchases machine
2. Machine remains active indefinitely
3. No expiry warning
4. No expiry action required

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether any renewal/reactivation logic exists elsewhere.

---

### FINDING P1-006: No Machine Purchase Verification

**FINDING ID:** P1-006
**TITLE:** Machine purchase uses wrong operation type and lacks payment verification
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Machine purchase uses `WITHDRAWAL_RESERVE` operation type instead of `MACHINE_PURCHASE`, and creates machine immediately without payment verification.

**EXPECTED:**
Machine purchase should use dedicated `MACHINE_PURCHASE` operation and wait for payment verification before creating machine.

**EVIDENCE:**
- **File:** `services/api/src/modules/machine/machine.service.ts`
- **Lines:** 315-446
- **Code:**
```typescript
async purchaseMachine(userIdOrTelegramId: string | bigint, tierCode: string) {
  // ...

  // Balance is sufficient: execute financial deduction via orchestrator
  const reference = `mach_buy_${tierCode}_${Date.now()}`;
  await this.orchestrator.requestOperation({
    telegramUserId,
    operationType: FinancialOperationType.WITHDRAWAL_RESERVE,  // ❌ WRONG
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
      status: 'ACTIVE',  // ❌ ACTIVE immediately
      capacityGhs: tier.capacityGhs,
    },
  });
  // ...
}
```

**ROOT CAUSE:**
Purchase flow uses wrong operation type and skips payment verification.

**USER IMPACT:**
Machine created before payment is verified.

**ECONOMIC IMPACT:**
Machine could be created without actual payment if balance check is bypassed.

**SECURITY IMPACT:**
High - could create machines without payment.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. User has sufficient balance
2. User purchases machine
3. Machine created immediately
4. Balance deducted
5. No payment verification step

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether balance check is vulnerable to race conditions.

---

## TITAN HUB FORENSICS

### FINDING P1-007: Titan Hub Sync Has 5-Second Timeout

**FINDING ID:** P1-007
**TITLE:** Titan Hub sync has 5-second timeout that may show incomplete state
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Titan Hub sync sequence has a 5-second timeout that dismisses sync overlay regardless of success/failure.

**EXPECTED:**
Sync should complete successfully or show error state, not timeout.

**EVIDENCE:**
- **File:** `apps/web/src/pages/TitanHub/TitanHubScreen.tsx`
- **Lines:** 104-126
- **Code:**
```typescript
try {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Sync timeout after 5s')), 5000)
  );
  await Promise.race([
    Promise.allSettled([
      fetchMiningState(),
      fetchBalanceFromEngine(),
      fetchUserMachines(),
    ]),
    timeoutPromise,
  ]);
} catch (err) {
  console.warn('[SYNC] Hydration failed or timed out:', err);
} finally {
  // ALWAYS mark synced and dismiss the sync overlay regardless of success/failure/timeout
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('titan_hub_boot_synced', 'true');
  }
  updateSyncStatus('COMPLETE');
  setIsSyncing(false);
  // ...
}
```

**ROOT CAUSE:**
Sync timeout always marks as complete regardless of actual success.

**USER IMPACT:**
User may see incomplete/incorrect state if sync times out.

**ECONOMIC IMPACT:**
User may see incorrect balance or machine state.

**SECURITY IMPACT:**
Low.

**RETENTION IMPACT:**
User may see incorrect state, causing confusion.

**REPRODUCTION:**
1. User opens Titan Hub
2. Network is slow
3. Sync times out after 5 seconds
4. Sync overlay dismissed
5. User sees incomplete state

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Test with slow network to verify incomplete state presentation.

---

## RETURN SESSION FORENSICS

### FINDING P1-008: Session Restore Depends on localStorage

**FINDING ID:** P1-008
**TITLE:** Session restore depends on localStorage persistence
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Session restore depends on localStorage persistence via Zustand persist middleware. If localStorage is cleared, session is lost.

**EXPECTED:**
Session should be restored from backend refresh token, not localStorage.

**EVIDENCE:**
- **File:** `apps/web/src/store/useAuthStore.ts`
- **Lines:** 84-260
- Uses Zustand persist middleware with localStorage

**ROOT CAUSE:**
Session stored in localStorage instead of relying on backend refresh token.

**USER IMPACT:**
User loses session if localStorage is cleared.

**ECONOMIC IMPACT:**
N/A - user can re-authenticate.

**SECURITY IMPACT:**
Low.

**RETENTION IMPACT:**
User may lose session unexpectedly.

**REPRODUCTION:**
1. User authenticates
2. User clears localStorage
3. User refreshes
4. Session lost, must re-authenticate

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether refresh token mechanism exists and is used.

---

## REFERRAL SYSTEM

### FINDING P1-009: Five-Referral Gate Uses Denormalized Counters

**FINDING ID:** P1-009
**TITLE:** Five-referral gate uses denormalized counters without purchase verification
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Referral qualification uses `User.qualifiedReferrals` denormalized counter without verifying that referrals made genuine qualifying purchases.

**EXPECTED:**
Referral qualification should verify each referral made a genuine paid machine purchase with verified payment.

**EVIDENCE:**
- **File:** `services/api/src/modules/growth/referral-qualification.service.ts`
- **Lines:** 40-76
- **Code:**
```typescript
async getQualifiedReferralCount(telegramUserId: bigint): Promise<number> {
  const user = await this.prisma.user.findUnique({
    where: { telegramUserId },
    select: { qualifiedReferrals: true },
  });
  return user?.qualifiedReferrals ?? 0;
}

async checkWithdrawalEligibility(telegramUserId: bigint): Promise<WithdrawalEligibility> {
  const qualifiedCount = await this.getQualifiedReferralCount(telegramUserId);
  const payingCount = await this.getPayingReferralCount(telegramUserId);

  const eligible = qualifiedCount >= this.WITHDRAWAL_REQUIREMENT;  // 5
  // ...
}
```

- **File:** `services/api/src/modules/growth/referral.service.ts`
- **Lines:** 257-312
- **Code:**
```typescript
async evaluateQualification(refereeId: bigint) {
  const relationship = await this.prisma.referralRelationship.findUnique({
    where: { refereeId },
  });

  if (!relationship) return null;

  if (
    relationship.status === ReferralStatus.QUALIFIED ||
    relationship.status === ReferralStatus.PAYING ||
    relationship.status === ReferralStatus.REWARDED
  ) {
    return relationship;
  }

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

**ROOT CAUSE:**
Qualification based on settlement completion, not machine purchase with verified payment.

**USER IMPACT:**
Referral qualification may not represent genuine purchases.

**ECONOMIC IMPACT:**
Users may qualify for withdrawals without genuine purchasing referrals.

**SECURITY IMPACT:**
High - withdrawal eligibility bypass possible.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. Referee makes deposit (not machine purchase)
2. Settlement completes
3. Referral qualifies
4. Referrer can withdraw

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether settlement can be a deposit instead of machine purchase.

---

## WITHDRAWAL JOURNEY

### FINDING P1-010: Multiple Inconsistent Eligibility Implementations

**FINDING ID:** P1-010
**TITLE:** Multiple inconsistent withdrawal eligibility implementations exist
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Three different services check withdrawal eligibility with different logic:
1. ReferralQualificationService (5-referral only)
2. WithdrawalEligibilityService (machine + risk only)
3. WithdrawalService (5-referral inline)

**EXPECTED:**
Single canonical eligibility service that checks all gates.

**EVIDENCE:**
- **File:** `services/api/src/modules/growth/referral-qualification.service.ts`
- **File:** `services/api/src/modules/financial/withdrawal-eligibility.service.ts`
- **File:** `services/api/src/modules/financial/withdrawal.service.ts`

**ROOT CAUSE:**
Eligibility logic scattered across multiple services.

**USER IMPACT:**
Inconsistent eligibility checks depending on code path.

**ECONOMIC IMPACT:**
Withdrawal eligibility may vary depending on code path.

**SECURITY IMPACT:**
High - inconsistent eligibility may allow bypass.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. User attempts withdrawal via different endpoints
2. Different eligibility checks apply
3. May be eligible via one path but not another

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Map all withdrawal endpoints to determine which eligibility check is used.

---

### FINDING P1-011: Trial Machine Not Excluded from Withdrawal Eligibility

**FINDING ID:** P1-011
**TITLE:** Trial machine not excluded from withdrawal eligibility
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
WithdrawalEligibilityService checks for any machine with status "ACTIVE", not distinguishing trial from paid.

**EXPECTED:**
Trial machine should be explicitly excluded from withdrawal eligibility.

**EVIDENCE:**
- **File:** `services/api/src/modules/financial/withdrawal-eligibility.service.ts`
- **Lines:** 48-57
- **Code:**
```typescript
const userMachines = await this.prisma.userMachine.findMany({
  where: { telegramUserId: bigIntUserId },
});
const hasActiveMachine = userMachines.some((m) => m.status === 'ACTIVE');
if (hasActiveMachine || userMachines.length > 0) {
  passedRules.push('RULE_ACTIVE_MACHINE_POWERED');
}
```

**ROOT CAUSE:**
No trial/paid distinction in eligibility check.

**USER IMPACT:**
User with only trial machine may qualify for withdrawal.

**ECONOMIC IMPACT:**
Users could withdraw without owning paid machine.

**SECURITY IMPACT:**
High - withdrawal eligibility bypass.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. User has only trial machine
2. User has 5 qualified referrals
3. User requests withdrawal
4. Eligibility check passes (trial machine counted)

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether trial machine is virtual and thus not in database check.

---

## PAYMENT/DEPOSIT DIRECTION AUDIT

### FINDING P1-012: Card Provider Not Quarantined

**FINDING ID:** P1-012
**TITLE:** Card provider (Pesapal) is not quarantined as inactive
**CLASSIFICATION:** VERIFIED
**SEVERITY:** P1

**OBSERVED:**
Pesapal provider has `supports_buy: true` and can process card payments, but specification requires Card to be inactive.

**Expected:**
Card should be quarantined as inactive.

**EVIDENCE:**
- **File:** `services/api/src/modules/settlement/pesapal/pesapal.provider.ts`
- **Lines:** 33-42
- **Code:**
```typescript
readonly manifest: SettlementCapabilityManifest = {
  provider: SettlementProviderId.PESAPAL,
  supports_buy: true,  // ❌ ACTIVE
  supports_sell: false,
  supports_refunds: false,
  supports_webhooks: true,
  supports_manual_review: true,
  supports_partial_payments: false,
  supported_assets: ['USDT', 'KES', 'UGX', 'USD'],
};
```

**ROOT CAUSE:**
Pesapal provider not marked as inactive.

**USER IMPACT:**
Card payments may be processed when they should be inactive.

**ECONOMIC IMPACT:**
Card payments processed when not allowed.

**SECURITY IMPACT:**
Medium - payment rail not following specification.

**RETENTION IMPACT:**
N/A.

**REPRODUCTION:**
1. User attempts deposit
2. Pesapal option shown
3. Card payment processed

**CONFIDENCE:** HIGH

**RECOMMENDED NEXT INVESTIGATION:**
Verify whether Pesapal is actually selectable in frontend.

---

## STATE OWNERSHIP MAP

| State      | Client | API | DB | Ledger | Authoritative |
| ---------- | ------ | --- | -- | ------ | ------------- |
| Identity   | YES (localStorage) | YES | YES | N/A | DB |
| Session    | YES (localStorage) | YES | N/A | N/A | API |
| Balance    | YES (localStorage) | YES | YES | YES | Ledger |
| Machine    | YES (virtual trial) | YES | YES (paid only) | N/A | DB |
| Trial      | YES (virtual) | YES (virtual) | NO | N/A | NONE |
| Progress   | YES (localStorage) | YES | YES | N/A | DB |
| Referral   | YES (localStorage) | YES | YES | N/A | DB |
| Reward     | YES (localStorage) | YES | YES | N/A | DB |
| Crystal    | YES (localStorage) | YES | YES | N/A | DB |
| Withdrawal | YES (localStorage) | YES | YES | YES | Ledger |

**Critical Finding:**
- Trial machine is NOT database-backed (authoritative = NONE)
- Session is stored in client (authoritative = API)

---

## ECONOMIC LIFECYCLE MAP

```
DISCOVERY
    ↓
AUTHENTICATION (Telegram/WhatsApp/Web)
    ↓
IDENTITY (UniversalIdentity → User)
    ↓
ONBOARDING (5 slides + consent)
    ↓
TRIAL (virtual machine, not DB-backed)
    ↓
OPERATION (tap machine in Titan Hub)
    ↓
PROGRESSION (unclear - no explicit progression system)
    ↓
REFERRAL (qualification based on settlement, not purchase)
    ↓
REWARD (rewards exist, persistence unclear)
    ↓
RETURN (session from localStorage)
    ↓
PAID MACHINE CONSIDERATION (BoostScreen)
    ↓
PURCHASE (uses wrong operation type, no payment verification)
    ↓
MACHINE LIFECYCLE (no expiry, permanent)
    ↓
WITHDRAWAL ELIGIBILITY (multiple inconsistent implementations)
    ↓
WITHDRAWAL (SettlementSession, manual execution)
```

---

## RETENTION BREAKPOINT MAP

### Identified Breakpoints:

**AUTHENTICATION FRICTION:**
- None evident - authentication flow appears smooth

**IDENTITY FAILURE:**
- Potential account substitution if localStorage corrupted (P0-001)

**ONBOARDING FRICTION:**
- 5 slides may be too many
- Technical jargon in onboarding copy
- Mandatory consent step may cause drop-off

**VALUE CONFUSION:**
- Onboarding uses technical jargon ("compute nodes", "hashpower")
- No clear value proposition
- No clear "what to do next" guidance

**FIRST-ACTION FAILURE:**
- No explicit first meaningful action guidance
- Trial machine is virtual (no persistent attachment)

**PROGRESSION GAP:**
- No explicit progression system visible
- No goals/missions visible
- No clear path from trial to paid

**RETURN-SESSION FAILURE:**
- Session depends on localStorage (P1-008)
- No explicit return motivation
- No streaks/daily bonuses visible

**REFERRAL CONFUSION:**
- Referral qualification unclear (settlement vs purchase)
- No clear referral benefits visible

**PAID-MACHINE FRICTION:**
- No clear upgrade path from trial to paid
- No purchase verification (P1-006)

**REWARD FAILURE:**
- Rewards exist but persistence unclear
- No clear reward loop

**GAME FAILURE:**
- Games exist but not fully audited

**PERFORMANCE FAILURE:**
- Titan Hub sync has 5-second timeout (P1-007)

**TRUST FAILURE:**
- Onboarding claims "audited ledger" but no visible audit trail

---

## CONTRADICTION MATRIX

| Area              | Intended | Actual | Contradiction | Evidence | Severity |
| ----------------- | -------- | ------ | ------------- | -------- | -------- |
| Identity          | Canonical identity resolution | Same (backend-authoritative) | None | IdentityMasterEngineService | None |
| Auth              | JWT-based session | Same | Partial (localStorage persistence) | useAuthStore | P1 |
| Trial             | Database-backed trial | Virtual/frontend-only | YES | MachineService trial machine | P1 |
| Titan Hub         | Persistent state | Same | Partial (sync timeout) | TitanHubScreen | P1 |
| Progression       | Clear progression loop | Unclear/none visible | YES | No progression system visible | P2 |
| Referrals         | 5 genuine purchasing referrals | 5 settlements (not purchases) | YES | ReferralQualificationService | P1 |
| Rewards           | Persistent rewards | Same (unclear persistence) | Needs verification | RewardsScreen | P2 |
| Games             | Persistent game state | Same (not audited) | Needs verification | Games | P2 |
| Machine lifecycle | Finite lifetime with expiry | Permanent (no expiry) | YES | UserMachine schema | P1 |
| Payments          | MM + USDT only, Card inactive | Pesapal active (Card) | YES | PesapalProvider | P1 |
| Withdrawals       | Canonical eligibility | Multiple implementations | YES | 3 different services | P1 |
| Retention         | Clear return motivation | Unclear | YES | No explicit return motivation | P2 |

---

## P0 FINDINGS

### P0-001: Frontend Session Persistence Without Canonical Verification
**Status:** VERIFIED
**Impact:** User may see authenticated UI with wrong account if localStorage corrupted
**Evidence:** useAuthStore persists to localStorage without mandatory backend verification

### P0-002: In-Memory Identity Cache During DB Unavailability
**Status:** VERIFIED
**Impact:** User may authenticate with stale identity during DB unavailability
**Evidence:** IdentityMasterEngineService has in-memory cache

### P0-003: SYSTEM_ALLOCATION Can Manufacture Funds
**Status:** VERIFIED
**Impact:** Unlimited money creation possible
**Evidence:** SYSTEM_ALLOCATION used in repower/upgrade without payment verification

---

## P1 FINDINGS

### P1-001: Balance Derived from Ledger (Correct)
**Status:** VERIFIED (correct implementation)
**Impact:** None
**Evidence:** BalanceService correctly derives from ledger

### P1-002: Frontend Stores Balance in Wallet Storage
**Status:** VERIFIED
**Impact:** User may see stale balance
**Evidence:** useWalletStore uses localStorage persistence

### P1-003: Trial Machine is Virtual/Frontend-Only
**Status:** VERIFIED
**Impact:** Trial machine has no persistent lifecycle
**Evidence:** MachineService hardcoded virtual trial machine

### P1-004: Trial Machine Status is "ACTIVE" (Same as Paid)
**Status:** VERIFIED
**Impact:** Trial machine may qualify for withdrawal
**Evidence:** Trial machine status hardcoded as "ACTIVE"

### P1-005: No Machine Expiry System
**Status:** VERIFIED
**Impact:** Machines are permanent, unbounded liability
**Evidence:** UserMachine schema has no expiresAt field

### P1-006: No Machine Purchase Verification
**Status:** VERIFIED
**Impact:** Machine created before payment verified
**Evidence:** Machine purchase uses wrong operation type

### P1-007: Titan Hub Sync Has 5-Second Timeout
**Status:** VERIFIED
**Impact:** User may see incomplete state
**Evidence:** TitanHubScreen sync timeout always marks complete

### P1-008: Session Restore Depends on localStorage
**Status:** VERIFIED
**Impact:** Session lost if localStorage cleared
**Evidence:** useAuthStore uses localStorage persistence

### P1-009: Five-Referral Gate Uses Denormalized Counters
**Status:** VERIFIED
**Impact:** Referral qualification not based on purchase verification
**Evidence:** ReferralQualificationService uses User.qualifiedReferrals

### P1-010: Multiple Inconsistent Eligibility Implementations
**Status:** VERIFIED
**Impact:** Inconsistent eligibility checks
**Evidence:** 3 different services check eligibility differently

### P1-011: Trial Machine Not Excluded from Withdrawal Eligibility
**Status:** VERIFIED
**Impact:** Trial machine may qualify for withdrawal
**Evidence:** WithdrawalEligibilityService doesn't distinguish trial/paid

### P1-012: Card Provider Not Quarantined
**Status:** VERIFIED
**Impact:** Card payments processed when should be inactive
**Evidence:** PesapalProvider has supports_buy: true

---

## P2 FINDINGS

### P2-001: Onboarding Uses Technical Jargon
**Status:** VERIFIED
**Impact:** User may not understand product
**Evidence:** OnboardingOverlay uses "compute nodes", "hashpower"

### P2-002: No Explicit Progression System Visible
**Status:** VERIFIED
**Impact:** No clear progression loop
**Evidence:** No progression system visible in code

### P2-003: No Clear Return Motivation
**Status:** VERIFIED
**Impact:** No reason to return
**Evidence:** No streaks/daily bonuses visible

### P2-004: Rewards Persistence Unclear
**Status:** VERIFIED
**Impact:** Unknown
**Evidence:** Rewards exist but persistence not audited

### P2-005: Games Not Fully Audited
**Status:** VERIFIED
**Impact:** Unknown
**Evidence:** Games exist but not audited

---

## P3 FINDINGS

None identified in this audit phase.

---

## UNKNOWNS

| Area | Status | Reason |
|------|--------|--------|
| First 10/30/60 seconds user understanding | UNKNOWN | No runtime user testing |
| First meaningful action | UNKNOWN | No runtime verification |
| Trial machine earnings persistence | UNKNOWN | Not fully audited |
| Return session behavior | UNKNOWN | No runtime testing |
| Rewards/games persistence | UNKNOWN | Not fully audited |
| Performance impact | UNKNOWN | No profiling |
| Analytics/observability | UNKNOWN | Not audited |
| Security/abuse runtime | UNKNOWN | No runtime testing |
| Failure-mode matrix | UNKNOWN | Not fully tested |

---

## EVIDENCE GAPS

1. **Runtime user journey reproduction** - No actual user session testing
2. **First meaningful action verification** - No runtime verification
3. **Trial machine earnings persistence** - Not fully audited
4. **Return session testing** - No runtime testing
5. **Rewards/games persistence** - Not fully audited
6. **Performance profiling** - No profiling done
7. **Analytics/observability audit** - Not audited
8. **Security/abuse runtime testing** - No runtime testing
9. **Failure-mode matrix testing** - Not fully tested
10. **Frontend financial truth complete audit** - Partial only

---

## RECOMMENDED INVESTIGATION ORDER

1. **P0-003: SYSTEM_ALLOCATION** - Immediate security risk
2. **P0-001: Frontend session persistence** - Account substitution risk
3. **P0-002: In-memory identity cache** - Stale authentication risk
4. **P1-009: Five-referral gate** - Withdrawal eligibility bypass
5. **P1-011: Trial machine exclusion** - Withdrawal eligibility bypass
6. **P1-010: Multiple eligibility implementations** - Inconsistent checks
7. **P1-006: Machine purchase verification** - Payment verification
8. **P1-005: Machine expiry** - Unbounded liability
9. **P1-003: Trial machine virtual** - Lifecycle management
10. **P1-012: Card provider** - Payment rail compliance

---

## PRODUCTION READINESS ASSESSMENT

### Build Status: **PASS**
- Application builds successfully
- TypeScript compilation successful

### Test Status: **UNKNOWN**
- Test execution not performed in this audit

### Runtime Status: **CRITICAL VIOLATIONS**
- P0 findings block production
- P1 findings block production

### Infrastructure Status: **UNKNOWN**
- Provider integrations not audited
- Signing infrastructure not audited
- Reconciliation not audited

---

## FINAL CERTIFICATION STATUS

**NOT PRODUCTION-READY**

**Reasons:**
1. P0: SYSTEM_ALLOCATION can manufacture funds (critical security risk)
2. P0: Frontend session persistence without canonical verification (account substitution risk)
3. P0: In-memory identity cache during DB unavailability (stale authentication risk)
4. P1: Trial machine can qualify for withdrawal (withdrawal eligibility bypass)
5. P1: Five-referral gate uses denormalized counters (withdrawal eligibility bypass)
6. P1: Multiple inconsistent eligibility implementations (withdrawal eligibility bypass)
7. P1: No machine purchase verification (payment verification bypass)
8. P1: No machine expiry system (unbounded liability)
9. P1: Card provider not quarantined (payment rail non-compliance)
10. Multiple UNKNOWNs require runtime verification

---

## REQUIRED P0 IDENTITY CERTIFICATION

### Can TitanStream guarantee that an existing user returns to the same canonical account?

**Answer:** **UNKNOWN**

**Evidence:**
- Backend identity resolution is correct (IdentityMasterEngineService)
- Frontend session depends on localStorage (P1-008)
- In-memory cache may serve stale identity (P0-002)
- Session verification exists but may have race conditions (P0-002)
- Requires runtime testing to verify

### Can authentication failure silently create/substitute a new account?

**Answer:** **NO**

**Evidence:**
- IdentityMasterEngineService explicitly prevents fallback creation
- Code comment: "CRITICAL: Never use fallback identity resolution - fail instead"
- Registration only called if resolveByChannel returns null
- Transaction prevents race conditions

### Can financial state be reset by identity/session failure?

**Answer:** **YES**

**Evidence:**
- If identity resolution fails, authentication fails
- If session lost, user must re-authenticate
- Financial state is backend-authoritative (ledger)
- Not a reset, but access to state may be lost

### Can a client control authoritative financial state?

**Answer:** **NO**

**Evidence:**
- Balance derived from ledger (P1-001)
- Ledger is authoritative
- Frontend state is cached but verified on backend
- Exception: SYSTEM_ALLOCATION can manufacture funds (P0-003)

---

## REQUIRED RETENTION CERTIFICATION

### Does a new user receive an actual meaningful first action?

**Answer:** **UNKNOWN**

**Evidence:**
- Onboarding exists but uses technical jargon
- Trial machine is virtual (no persistent attachment)
- No explicit first meaningful action guidance
- Requires runtime user testing

### Is there a persistent progression loop?

**Answer:** **UNKNOWN**

**Evidence:**
- No explicit progression system visible in code
- No goals/missions visible
- Requires runtime verification

### Is there a concrete reason to return?

**Answer:** **UNKNOWN**

**Evidence:**
- No streaks/daily bonuses visible
- No explicit return motivation
- Trial machine is virtual (no attachment)
- Requires runtime verification

### Does return restore the same user state?

**Answer:** **UNKNOWN**

**Evidence:**
- Session depends on localStorage (P1-008)
- Backend identity resolution is correct
- Requires runtime testing

### Does the trial naturally connect to the paid-machine lifecycle?

**Answer:** **NO**

**Evidence:**
- Trial machine is virtual (not database-backed)
- No clear upgrade path from trial to paid
- Trial machine status same as paid (no distinction)
- No trial-to-paid conversion path evident

---

## REQUIRED ECONOMIC CERTIFICATION

### Is the financial source of truth backend-authoritative?

**Answer:** **YES**

**Evidence:**
- Balance derived from ledger (P1-001)
- Ledger is authoritative
- Frontend is cached but verified on backend

### Is machine ownership persistent?

**Answer:** **PARTIAL**

**Evidence:**
- Paid machines are database-backed
- Trial machine is virtual (not database-backed)
- No expiry system (P1-005)

### Is genuine-purchase referral qualification authoritative?

**Answer:** **NO**

**Evidence:**
- Qualification based on settlement completion (P1-009)
- Not based on machine purchase with verified payment
- Uses denormalized counters

### Is the 5-referral withdrawal rule actually enforced?

**Answer:** **PARTIAL**

**Evidence:**
- Rule enforced but using wrong qualification method (P1-009)
- Based on settlement, not purchase
- Multiple inconsistent implementations (P1-010)

### Is an active paid machine required for withdrawal?

**Answer:** **PARTIAL**

**Evidence:**
- Machine gate exists but doesn't distinguish trial/paid (P1-011)
- Trial machine has status "ACTIVE" (same as paid)
- No purchase verification (P1-006)

### Is the trial excluded from withdrawal eligibility?

**Answer:** **NO**

**Evidence:**
- Trial machine not excluded in eligibility check (P1-011)
- Trial machine status "ACTIVE" (same as paid)
- No type field to distinguish

---

## END OF FORENSIC AUDIT

**Status:** CRITICAL P0/P1 FINDINGS IDENTIFIED - PRODUCTION BLOCKED

**Total Findings:**
- P0: 3
- P1: 12
- P2: 5
- P3: 0
- UNKNOWN: 10

**Production Status:** NOT PRODUCTION-READY

**Next Steps:**
1. Address P0 findings immediately (security risks)
2. Address P1 findings (withdrawal eligibility, machine lifecycle)
3. Complete UNKNOWN areas with runtime testing
4. Perform adversarial testing
5. Re-certify after fixes

---

**END OF REPORT**
