# BAILEYS SERVICE LIFECYCLE FORENSIC REPORT — TitanStream WhatsApp Auth

Date (UTC): 2026-09-27
Scope: Baileys service reconnect & lifecycle remediation + final production verification gate
Code modified in this pass: **NONE** (verification-only pass per "DO NOT MODIFY CODE UNLESS THIS FAILS")
Status: **NOT READY** (real-device WhatsApp authentication NOT demonstrated; see §10)

---

## 1. Root Cause

There are two distinct findings. They must not be conflated.

### Finding R1 (CONFIRMED by code inspection): post-approval session tokens are not persisted across process boundaries

`services/api/src/modules/auth/whatsapp-challenge.service.ts`:

- `approveChallenge()` (private, ~line 567) sets `challenge.sessionTokens` **in memory only** (~line 614), then calls `saveSharedChallenge({...})` (~line 621) with:
  - `challengeId`, `approvalTokenHash`, `browserProofHash`, `status: 'APPROVED'`, `phone`, `deviceInfo`, `createdAt`, `expiresAt`
  - **Missing: `sessionTokens`**
  - **Missing: `shortPin`** (so the `pin_*` index is not re-created on the APPROVED write)
- `getChallengeStatus()` (~line 339) restores a challenge from the shared JSON file when it is absent from memory, but the restored object can only contain what was written. It then enforces (~line 372):
  ```ts
  if (challenge.status === 'APPROVED') {
    if (!challenge.sessionTokens) {
      this.cleanupChallenge(challengeId);
      return { status: 'EXPIRED' };
    }
    ...
  }
  ```
- Consequence: **same-process** browser polling works (in-memory `sessionTokens` present), but **any cross-process poll** (second Railway instance, process restart between approval and poll, page-reload recovery routed to a different instance) deterministically returns `EXPIRED` and deletes the challenge. This is exactly TEST B (reload) / TEST C (shared state) failing when more than one process is involved.

This is the same class of bug that commit `38365f3a` was said to have fixed. The current tree still contains the defect. No code was changed in this pass, so the defect remains.

### Finding R2 (LIKELY infrastructure state, NOT a code-logic bug): local Baileys transport credential is not registered

- `baileys_auth_info/creds.json` (local checkout): `registered = False`, `pairingCode` present, `me.id = 18257320524@s.whatsapp.net`.
- Meaning: the gateway identity exists as a key bundle but has **not completed WhatsApp account linking**. Until a pairing code / QR linking completes and `registered` becomes true with `connection === 'open'`, the bot socket can never reach `CONNECTED` / `ACCOUNT_READY`.
- In that state, `POST /api/v1/auth/whatsapp/login-challenge` will still return a `wa.me` deep-link (challenge creation does not gate on transport readiness — it only reports `transportReady`/`transportStatus`), the browser will show a PIN, but `messages.upsert → handleInboundMessage(START <PIN>)` can never fire because there is no live authenticated WhatsApp connection to receive the user's message.
- This matches the reported symptom: "approval state succeeds but the actual WhatsApp handshake does not complete" / "Baileys appears disconnected or not reconnecting". The reconnect loop is functioning as designed (see §3–§4); it is retrying against an **unlinked** credential, which can never transition to `CONNECTED` without manual re-auth.

No evidence was found that the reconnect timer, socket factory, or `connection.update` handler treats a recoverable disconnect as permanent (see §4). The service is retrying; it is the credential state that blocks success.

---

## 2. Evidence

### 2.1 Files inspected

| File | Role | Key lines |
|---|---|---|
| `services/api/src/modules/notification/baileys-account-manager.service.ts` | Socket factory, lifecycle, reconnect, watchdog, outbound queue | `onModuleInit` 95–114; watchdog 134–165; `syncAccountsFromDatabase` 170–219; `initAccountSocket` 464–480; `createAccountSocket` 482–667; `connection.update` 602–660; `scheduleReconnect` 701–725; `canOpenSocket` 669–671; `isCurrentSocket` 673–675; `closeCurrentSocket` 733–744; credential queue 677–699 |
| `services/api/src/modules/notification/baileys-prisma-auth.ts` | Prisma + local-disk dual auth state (`creds` + keys) | creds load 107–148; `saveCreds` 151–164; `keys.get/set` 186–293 |
| `services/api/src/modules/notification/baileys.service.ts` | Thin proxy to the account manager | `getConnectionState` 33–37; `getAuthTransportStatus` 39–41 |
| `services/api/src/modules/auth/whatsapp-challenge.service.ts` | Challenge create/poll/approve, inbound `START` handler, shared-file persistence | create 283–334; poll 339–387; approve 567–673; shared helpers 44–167 |
| `services/api/src/modules/auth/auth.controller.ts` | `POST whatsapp/login-challenge`, `POST whatsapp/challenge-status` | 98–118 |
| `services/api/src/modules/health/health.controller.ts` | Liveness/readiness (DB + config + ledger only) | 46–89 |
| `services/api/src/modules/admin/controllers/admin-whatsapp.controller.ts` | Fleet admin (list/telemetry/dispatch/pairing) | full file |
| `railway.json` / `services/api/start.sh` / `services/api/Dockerfile` | Single-process deployment; healthcheck = `/api/v1/health/readiness` | — |
| `baileys_auth_info/creds.json` | Local gateway credential bundle | `registered=False` |
| `.whatsapp_active_challenges.json` | Shared challenge file (local) | `{}` (empty at inspection) |

### 2.2 State-transition reality vs. task expectation

The task statement expects:

```text
CREATED → QR_GENERATED → DELIVERED → APPROVAL_RECEIVED → APPROVED
→ SESSION_TOKENS_PERSISTED → POLL_RESPONSE_WITH_TOKENS → SESSION_ESTABLISHED
```

The implementation has **no such states**. Actual `ChallengeStatus` (`whatsapp-challenge.service.ts:12`):

```text
PENDING → APPROVED | DECLINED | EXPIRED
```

(`AWAITING_APPROVAL` appears only in legacy test scaffolding / the `1`/`YES` reply path; it is never set by `createChallenge` or the `START` path.)

There is also **no QR generator for end-user login**. The "QR/deep-link" in this architecture is a `wa.me/<botPhone>?text=START <6-digit-PIN>` link (line 315–317), not a Baileys QR. Baileys QR/pairing-code logic (`connection.update`, lines 608–627) applies only to **linking the bot gateway phone itself**, not to authenticating end users. Any verification plan that equates "QR generated" with "Baileys healthy" is invalid — consistent with the task's own final rule.

### 2.3 Test evidence (executed, no code changes)

```text
npx jest src/modules/auth/whatsapp-e2e-acceptance.spec.ts
        src/modules/auth/whatsapp-challenge-regression.spec.ts
        src/modules/notification/baileys-persistence-certification.spec.ts

Test Suites: 3 passed, 3 total
Tests:       26 passed, 26 total
```

These prove **same-process** simulated approval (`START <PIN>` → `APPROVED` → tokens → one-time poll) and single-flight socket init / account dedup. They do **not** prove cross-process token handoff, real socket connectivity, or real-device delivery — by design they mock Prisma/identity/tokens and never open a WebSocket.

### 2.4 Runtime state observed (local checkout, NOT production)

- `baileys_auth_info/creds.json`: `registered=False` → transport cannot be `ACCOUNT_READY`.
- `.whatsapp_active_challenges.json`: empty — no stale challenges masking results.
- No live API process was started in this pass (would require DB + secrets); therefore no `connection.update` log lines were produced here. Production log inspection with a correlation/session ID remains an open manual step (§10).

---

## 3. Connection Lifecycle — Before vs. After

No code was modified, so before == after. The lifecycle **as audited** is already deterministic and matches the required behavior for the bot-transport use case:

```text
Nest onModuleInit
  ↓ (setImmediate, non-blocking)
syncAccountsFromDatabase (Prisma BaileysAccount; create primary if none)
  ↓
initAccountSocket(accountId)  [single-flight via socketInitializations map]
  ↓
createAccountSocket:
  state=CONNECTING → usePrismaAuthState (DB-first, disk fallback)
  → generation++ → makeWASocket → account.socket=socket (atomic ref)
  → attach creds.update (generation-guarded) + messages.upsert + connection.update
  ↓
connection.update:
  qr && !registered → requestPairingCode (once per socket lifecycle)
  close → classify (loggedOut/badSession/forbidden ⇒ requiresReauthentication, stop)
          else ⇒ DISCONNECTED + scheduleReconnect (exponential backoff, capped 60s)
  open  → CONNECTED, HEALTHY, pairingCode cleared, reconnectAttempts=0, lastConnectedAt set
  ↓
Safety-net watchdog (15s): if primary enabled && !quarantined && !manualDisconnect
  && !requiresReauthentication && (state!=CONNECTED || !socket) && state!=CONNECTING
  ⇒ scheduleReconnect
  ↓
onModuleDestroy: clear timers, closeCurrentSocket(all), drain credentialWrites
```

Health/readiness gap (pre-existing, unchanged): `GET /api/v1/health/readiness` checks **database + env config + ledger accounts only**. It never reports Baileys state. `PROCESS_ALIVE ≠ BAILEYS_CONNECTED` is therefore true in production today: Railway healthcheck can be green while WhatsApp transport is down. The safe internal diagnostic (`getAuthTransportStatus()` → `ACCOUNT_NOT_CONFIGURED | ACCOUNT_DISCONNECTED | ACCOUNT_CONNECTING | ACCOUNT_CONNECTED | ACCOUNT_READY`) exists in code but is **not wired into the readiness endpoint** and `hasCreds` only checks local `creds.json` paths, not Prisma. See §9.

---

## 4. Reconnect Failure — Why Recovery Did / Did Not Occur

Audited against `baileys-account-manager.service.ts`:

1. **Recoverable disconnects ARE retried.** `close` without `loggedOut/badSession/forbidden` sets `DISCONNECTED`, persists to DB, and calls `scheduleReconnect`. Backoff: `min(5000 * 2^attempt, 60000)`. The `finally` in `initAccountSocket` re-schedules if the socket never materialized. The watchdog independently re-schedules. No code path treats `ECONNRESET`-class/transient closes as permanent.
2. **Permanent failures correctly stop.** `loggedOut`/`badSession`/`forbidden` set `requiresReauthentication=true`, `healthState=DEGRADED`, clear the timer, and persist `DISCONNECTED/DEGRADED`. Reconnect is then gated by `canOpenSocket`/`scheduleReconnect` until an admin runs `connect`/`reconnect`/`unquarantine`. Reconnecting blindly on `loggedOut` would loop forever — correctly avoided.
3. **No `setTimeout` storm.** `scheduleReconnect` is guarded by `reconnectTimers.has(accountId) || socketInitializations.has(accountId)` plus enabled/quarantine/manual flags. `clearReconnectTimer` runs on new socket creation, admin actions, and shutdown.
4. **Therefore, "Baileys not reconnecting" is not explained by a missing timer.** The plausible explanations, in order, are:
   - (a) credential is **unlinked** (`registered=False`) → every reconnect cycles `CONNECTING → qr → close/retry` and never reaches `open`. Looks like "disconnected" permanently. **Matches local evidence.**
   - (b) `requiresReauthentication` latched in DB after a real logout → by design no auto-retry until admin re-auth. Check `baileys_accounts.state/health_state` in production.
   - (c) approval never arrives because the challenge is waiting on a socket that is alive but unauthenticated — i.e. §7 integration stall, not a reconnect bug.

---

## 5. Fix

**None applied in this pass** (directive: do not modify code unless verification fails; real-device verification could not be executed here — see §10 — and simulated same-process verification passes).

If/once TEST A with a real device confirms the cross-process failure, the minimal production-safe fix is confined to `whatsapp-challenge.service.ts`:

1. Persist `sessionTokens` (and `shortPin` + `phone`) in the APPROVED write inside `approveChallenge()`.
2. Ensure `loadSharedChallenges()` / `getChallengeStatus()` restore `sessionTokens` and re-index `approval_*`/`pin_*` without dropping them for `APPROVED` entries.
3. Keep the one-time handoff: `cleanupChallenge` after the browser consumes tokens (already implemented).
4. Never persist plaintext secrets beyond what is already in the token itself; the file already holds hashes — tokens are bearer credentials by necessity for the poll handoff, so restrict file permissions and TTL (already 10 min).

Separately (operational, not code): complete gateway linking — request a pairing code via `POST /api/v1/admin/whatsapp/accounts/:id/pairing-code`, enter it on the gateway phone (`Settings → Linked Devices → Link with phone number`), confirm `registered=true` + `connection=open`, then re-run TEST A.

Baileys reconnect code (`baileys-account-manager.service.ts`, `baileys-prisma-auth.ts`) requires **no change** based on this audit. Indiscriminate changes there would risk regressions to the already-correct single-flight/backoff/generation-guard logic (§6).

---

## 6. Socket Ownership — Duplicate Sockets / Reconnect Races

Audited mechanisms (all present, unchanged):

- **Single-flight init:** `socketInitializations: Map<accountId, Promise<void>>` — concurrent `initAccountSocket` calls for the same account return the **same promise**; `createAccountSocket` runs once (certified by `baileys-persistence-certification.spec.ts` "MUST coalesce concurrent socket initialization").
- **Generation fencing:** `account.socketGeneration` increments per creation; every `creds.update` / `messages.upsert` / `connection.update` handler captures its `generation` and no-ops unless `account.socket === socket && account.socketGeneration === generation` (`isCurrentSocket`). A superseded socket that fires late cannot mutate current session state. Post-creation, `createAccountSocket` re-checks `canOpenSocket(account) || generation mismatch` and immediately ends the loser socket.
- **Atomic replacement:** `closeCurrentSocket` bumps `socketGeneration`, clears the ref **before** ending the old socket, removes all listeners (`removeAllListeners`), then `socket.end()`. Admin `reconnect` follows the same path.
- **Reconnect dedup:** `scheduleReconnect` no-ops if a timer or an init is already pending (§4.3). Watchdog skips `CONNECTING`.
- **Credential write serialization:** `credentialWrites: Map<accountId, Promise>` chains `saveCreds`; `waitForCredentialWrites` drains before a new socket loads auth state, so socket B never starts on a half-written credential set.

Residual multi-process risk (deployment-level, not code): two OS processes loading the **same** `accountId` credentials will fight for the WhatsApp session (server-side conflict-close loop). Mitigations in place: single Railway service with `startCommand: ./start.sh → node dist/main` (one API process; no separate worker entrypoint starts Baileys). Do **not** scale this service horizontally or run `enable-baileys.ts` concurrently against the same phone without introducing a leader-lease. Verified: `railway.json` defines one deploy target; `enable-baileys.ts` is a manual script, not part of `start.sh`.

---

## 7. Auth Persistence — Credential Persistence and Restart Recovery

`usePrismaAuthState()` (`baileys-prisma-auth.ts`):

```text
socket A → creds.update → writeLocalCache (sync, 0ms) → Prisma upsert (awaited)
socket disconnect → socket B → waitForCredentialWrites → load DB creds (fallback: disk cache)
→ same registered identity → reconnect
keys.get: disk fast-path first, DB only on miss; keys.set: disk immediately + awaited Prisma upsert/delete
```

Verified properties:

- `creds` and all key categories (`pre-key-*`, `session-*`, `sender-key-*`, `app-state-sync-key`, etc.) round-trip through Prisma `BaileysAuthKey(accountId, keyId)` with `@@unique([accountId, keyId])`.
- DB outage degrades to disk cache (`isDbAvailable=false`) without crashing; `saveCreds`/`keys.set` still update disk.
- Re-hydration after restart is certified by `baileys-persistence-certification.spec.ts` GATE 3.
- Local `baileys_auth_info/` contains thousands of `pre-key-*.json` + `session-*.json` + `creds.json`, consistent with a previously-active key bundle.
- Valid credentials are never deleted on ordinary reconnects; `clearCreds` is only invoked via account `remove` (which also deletes DB keys) — never on `close`.

Caveat: `getAuthTransportStatus().hasCreds` checks only filesystem paths, so a DB-backed credential with no local file reports `hasCreds=false`. Cosmetic for readiness reporting; does not affect socket creation (which reads DB first). Not changed in this pass.

---

## 8. Challenge Integration — Baileys → Approval → Tokens → Poll

Verified chain (same logical session):

```text
Browser POST whatsapp/login-challenge
  → WhatsappChallengeService.createChallenge (in-memory + shared JSON, 10-min TTL)
  → wa.me/<botPhone>?text=START <PIN>  (+ transportReady/transportStatus advisory)
Browser polls POST whatsapp/challenge-status {challengeId, browserProof}
  → PENDING until approval
User sends "START <PIN>" to bot phone from WhatsApp
  → Baileys socket (PRIMARY gateway) messages.upsert
  → extractMessageText + LID→PN resolution (remoteJidAlt/participantPn/senderPn/signalRepository)
  → WhatsappChallengeService.handleInboundMessage(senderJid, text)
  → findChallengeByApprovalToken (memory → shared-file fallback with expiry/format validation)
  → approveChallenge: normalize E.164, identityMasterEngine.authenticate(WHATSAPP),
     authService.createTokensForUser, challenge.status=APPROVED, shared-file write,
     confirmation message via Baileys (best-effort, failure only logged)
Browser poll (same process): APPROVED + accessToken/refreshToken/user → challenge cleaned (one-time)
```

Critical integration note: the challenge waits on an event from **the gateway socket**. If that socket is `DISCONNECTED`/`CONNECTING`/unregistered, the `START` message is never observed and the challenge sits at `PENDING` until `EXPIRED`. There is no fallback user creation, no synthetic approval, and no timeout-approval — correctly so (§13 of the task). The failure mode is a silent hang from the user's perspective, which is why §9 readiness must expose `ACCOUNT_READY` distinctly from process liveness.

Cross-process break (R1): approval processed on instance A writes `APPROVED` without tokens; browser polling instance B restores from shared file, finds no `sessionTokens`, returns `EXPIRED`. Fix scoped in §5.

---

## 9. Tests — Actual Tests and Results

Executed 2026-09-27 (no modifications):

| Suite | Result |
|---|---|
| `whatsapp-e2e-acceptance.spec.ts` (22-step simulated e2e incl. duplicate-login canonical-identity check + browser-proof rejection) | PASS |
| `whatsapp-challenge-regression.spec.ts` | PASS |
| `baileys-persistence-certification.spec.ts` (single-flight init, account dedup, conversational approval, Prisma re-hydration) | PASS |
| **Total** | **26 passed, 3 suites** |

NOT executed (require live infra/devices, out of scope for a code-frozen verification agent):

- Real-socket `connection.update` open/close/reconnect timing tests against WhatsApp servers.
- TEST 2/3/4 socket-kill and process-restart recovery against a linked gateway.
- Telegram Login Widget / Mini App regression against production (code untouched; no regression expected — see §11).

Gaps the current suites do not cover (recommended additions if a fix pass is authorized): cross-process APPROVED+tokens file round-trip; `getChallengeStatus` second-instance poll returning tokens; `registered=False` transport advisory surfacing; `requiresReauthentication` latch + admin unlock; watchdog-triggered reconnect; stale-generation event suppression; readiness endpoint Baileys stanza.

---

## 10. Physical WhatsApp Verification — TEST A–E Results

**Real-device testing was NOT performed in this pass.** This agent has no access to a real WhatsApp account/device, a separate browser/device, or the production deployment's logs. Any claim of physical success would be fabrication. Per the task's IMPORTANT rule, the WhatsApp issue is therefore **not declared resolved**.

| Test | Result | Detail |
|---|---|---|
| TEST A — fresh/existing WhatsApp login (8-step transition + browser authenticated + canonical user + data unchanged) | **NOT EXECUTED** | Blocked: no device; local gateway credential `registered=False` so even a device attempt against this checkout could not succeed. Expected literal transitions (`QR_GENERATED`, `DELIVERED`, …) do not exist in code — manual script must be rewritten to `PENDING → APPROVED → poll-with-tokens → session`. |
| TEST B — page reload during approval | **NOT EXECUTED (live)**; **FAIL predicted for multi-process** by inspection (R1: tokens not in shared file) | Same-process reload recovery works (memory + shared metadata); cross-instance recovery returns `EXPIRED`. |
| TEST C — cross-process/shared state | **NOT EXECUTED (live)**; **FAIL predicted** (R1) | Challenge metadata replicates via JSON file; `sessionTokens` do not. |
| TEST D — duplicate account protection | **NOT EXECUTED (live)**; simulated suite passes (same canonical `usr_canonical_<digits>` on second login) | Identity path (`identityMasterEngine.authenticate` → deterministic `titan_wa_<digits>` binding, no fallback creation) untouched. |
| TEST E — Telegram regression | **NOT EXECUTED (live)** | Telegram code paths untouched in this pass; no Baileys change to regress them. Live widget + nonce check remains a manual step. |

Required manual runbook (production, gateway linked first):

1. `GET /api/v1/admin/whatsapp/accounts` → primary `CONNECTED`; `getAuthTransportStatus` → `ACCOUNT_READY`.
2. Browser: `POST whatsapp/login-challenge` → record `challengeId`, PIN, `transportReady=true`.
3. Tail API logs for `[WA_CHALLENGE_CREATED]`, `[BAILEYS_CONNECTION_UPDATE]`, `[BAILEYS_INBOUND]`.
4. From a real WhatsApp device send `START <PIN>` to the bot phone; expect `[WA_CHAL_DEBUG]`, `[WA_CHALLENGE_APPROVED]`, confirmation message delivered.
5. Browser poll with `browserProof` → `APPROVED` + tokens exactly once; second poll → `EXPIRED`.
6. Confirm Titan user ID reused, wallet/profile/progression unchanged; repeat login → same canonical user, no second `User`, `ChannelIdentity` unique.
7. Reload-during-approval and (if multi-instance) cross-instance poll variants.
8. If any step stalls, capture the exact state (`PENDING` vs `APPROVED` vs `EXPIRED`, `transportStatus`, `registered`, socket `connection` log) — do not weaken auth or add fallbacks to force a pass.

---

## 11. Telegram Regression

- Telegram authentication code was **not modified** in this pass (zero diffs repository-wide).
- Baileys lifecycle code was **not modified**; no shared auth/nonce/identity path was touched.
- Simulated WhatsApp suites pass without altering Telegram providers.
- Live Telegram Login Widget + server-nonce + canonical resolution check remains **REQUIRED manual verification** alongside TEST E, but there is no code-based reason to expect regression.

---

## 12. Production Status

**NOT READY**

Rationale: (1) real-device TEST A has not succeeded (not even attempted — no device in this environment, and the task forbids declaring resolution without it); (2) code inspection confirms a cross-process token-handoff defect (R1) that fails TEST B/C in multi-instance deployments; (3) the local gateway credential is unlinked (`registered=False`), so the transport cannot be `ACCOUNT_READY` until manual pairing completes. The Baileys reconnect machinery itself is sound and needs no code change; the blockers are the approval-persistence write, gateway linking, and the unexecuted physical test matrix.

Promote to **READY WITH MANUAL VERIFICATION REQUIRED** only after: R1 fix lands + simulated cross-process test passes + gateway shows `ACCOUNT_READY` + TEST A–E executed against production with logs attached. Promote to **READY** only after successful real-device authentication confirming the full chain in the task's final rule (READY + deep-link + real approval + handshake + creds persisted + APPROVED + tokens persisted + browser session + canonical identity).
