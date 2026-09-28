# TITANSTREAM AUTHENTICATION STATE MACHINE

## WhatsApp Authentication Flow State Machine

| State | Producer | Consumer | Persistence | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| AUTH_INITIATED | AuthGate (user clicks WhatsApp) | Backend | N/A | ✅ | ✅ | WORKING |
| CHALLENGE_CREATED | Backend (createChallenge) | Shared file | ✅ JSON file | ✅ | ✅ | WORKING |
| BAILEYS_READY | BaileysAccountManager | Authentication flow | ✅ Database | ✅ | ✅ | WORKING |
| QR_GENERATED | Backend (createChallenge) | Frontend | ✅ In state | ✅ | ✅ | WORKING |
| CODE_RECEIVED | Baileys (messages.upsert) | handleInboundMessage | ✅ In-memory | ✅ | ✅ | WORKING |
| CODE_VALIDATED | handleInboundMessage | findChallengeByApprovalToken | ✅ In-memory | ✅ | ✅ | WORKING |
| ADMIN_MESSAGE_SENT | N/A (user sends directly) | Baileys | ✅ WhatsApp | ✅ | ✅ | WORKING |
| ADMIN_MESSAGE_RECEIVED | Baileys (messages.upsert) | handleInboundMessage | ✅ In-memory | ✅ | ✅ | WORKING |
| ADMIN_APPROVAL_RECEIVED | handleInboundMessage | approveChallenge | ✅ In-memory | ✅ | ✅ | WORKING |
| IDENTITY_RESOLVED | IdentityMasterEngine | approveChallenge | ✅ Database | ✅ | ✅ | WORKING |
| TOKENS_GENERATED | AuthService | approveChallenge | ✅ In-memory | ✅ | ✅ | WORKING |
| CHALLENGE_APPROVED | approveChallenge | Shared file | ✅ JSON file | ✅ | ✅ | WORKING |
| TOKENS_PERSISTED | saveSharedChallenge | Shared file | ✅ JSON file | ✅ | ❌ | **BROKEN** |
| USER_RESPONSE_SENT | baileysService.sendTextMessage | WhatsApp | ✅ WhatsApp | ✅ | ❌ | **BROKEN** |
| USER_RESPONSE_DELIVERED | WhatsApp network | User device | ✅ WhatsApp | ✅ | ❌ | **BROKEN** |
| BROWSER_POLL_SUCCESS | AuthGate (pollInterval) | Backend | ✅ HTTP | ✅ | ❌ | **BROKEN** |
| SESSION_ESTABLISHED | AuthGate (setSession) | useAuthStore | ✅ Memory | ✅ | ❌ | **BROKEN** |
| AUTH_STATE_UPDATED | setSession | Frontend | ✅ Memory | ✅ | ❌ | **BROKEN** |
| DASHBOARD_AUTHENTICATED | AuthGate render | User | ✅ UI | ✅ | ❌ | **BROKEN** |

## CRITICAL FINDING: THE BROKEN STATE

**First Broken State: TOKENS_PERSISTED**

In `whatsapp-challenge.service.ts` line 607-616, the `saveSharedChallenge` function is called AFTER tokens are generated, BUT it does NOT include the `sessionTokens` in the saved JSON:

```typescript
saveSharedChallenge({
  challengeId: challenge.challengeId,
  approvalTokenHash: challenge.approvalTokenHash,
  browserProofHash: challenge.browserProofHash,
  status: 'APPROVED',
  phone: canonicalPhone,
  deviceInfo: challenge.deviceInfo,
  createdAt: challenge.createdAt ? challenge.createdAt.toISOString() : new Date().toISOString(),
  expiresAt: challenge.expiresAt ? challenge.expiresAt.toISOString() : new Date(Date.now() + 600000).toISOString(),
  // ❌ MISSING: sessionTokens
});
```

This means:
1. Challenge status becomes APPROVED ✅
2. Session tokens are generated in memory ✅  
3. BUT tokens are NOT persisted to the shared JSON file ❌
4. Browser polling retrieves APPROVED status ✅
5. BUT polling cannot retrieve sessionTokens ❌
6. Authentication fails ❌

## SECOND BROKEN STATE: USER_RESPONSE_SENT

In `whatsapp-challenge.service.ts` line 654-656, the confirmation message is sent to the user with a catch block that only logs warnings:

```typescript
await this.baileysService.sendTextMessage(primaryTarget, confirmation, 'CRITICAL').catch((err: any) => {
  this.logger.warn(`[WA_CONFIRMATION_FAILED] Failed to send approval confirmation: ${err.message}`);
});
```

If the message send fails, the user never receives confirmation, but the challenge still becomes APPROVED. This could be failing silently.

## ROOT CAUSE ANALYSIS

The primary root cause is in the `saveSharedChallenge` function in `whatsapp-challenge.service.ts`. When a challenge is approved:

1. Tokens are generated and stored in the in-memory challenge object
2. The challenge status is set to APPROVED  
3. The challenge is saved to the shared JSON file
4. **BUT the sessionTokens are not included in the saved JSON**

When the browser polls for challenge status:
1. It loads the challenge from the shared JSON file
2. It sees status = APPROVED
3. It looks for sessionTokens in the loaded data
4. **They don't exist because they weren't persisted**
5. The code returns EXPIRED instead of APPROVED with tokens

## ARCHITECTURE ISSUES IDENTIFIED

1. **Token Persistence Gap**: sessionTokens are generated in memory but not persisted to the shared file
2. **Silent Message Failure**: User confirmation message send failure is only logged, not handled
3. **Stale Socket Risk**: Baileys socket lifecycle could cause message send failures
4. **Polling/Storage Mismatch**: In-memory tokens vs file-based storage inconsistency

## IMMEDIATE FIX REQUIRED

The `saveSharedChallenge` call in `approveChallenge` must include the sessionTokens:

```typescript
saveSharedChallenge({
  challengeId: challenge.challengeId,
  approvalTokenHash: challenge.approvalTokenHash,
  browserProofHash: challenge.browserProofHash,
  status: 'APPROVED',
  phone: canonicalPhone,
  deviceInfo: challenge.deviceInfo,
  createdAt: challenge.createdAt ? challenge.createdAt.toISOString() : new Date().toISOString(),
  expiresAt: challenge.expiresAt ? challenge.expiresAt.toISOString() : new Date(Date.now() + 600000).toISOString(),
  sessionTokens: challenge.sessionTokens, // ✅ ADD THIS LINE
});
```

This is the exact commit 38365f3a fix that was mentioned in the requirements - it appears to have been partially implemented or regressed.