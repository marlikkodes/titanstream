import { Injectable, Logger, Inject, Optional, UnauthorizedException, forwardRef } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { resolve } from 'path';
import * as fs from 'fs';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from './auth.service';
import { BaileysService } from '../notification/baileys.service';
import { ConversationalRouterService } from '../conversational/conversational-router.service';
import { IdentityProvider, UserState } from '@prisma/client';

export type ChallengeStatus = 'PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'DECLINED' | 'EXPIRED';

export interface WhatsappLoginChallenge {
  challengeId: string;
  approvalTokenHash: string;
  browserProofHash: string;
  phone?: string;
  status: ChallengeStatus;
  deviceInfo: string;
  createdAt: Date;
  expiresAt: Date;
  shortPin?: string; // 6-digit code for easier UX
  sessionTokens?: {
    accessToken: string;
    refreshToken: string;
    user: any;
  };
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function secretsMatch(expectedHash: string, providedSecret?: string): boolean {
  if (!providedSecret || !expectedHash) return false;
  const providedHash = hashSecret(providedSecret);
  return timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(providedHash, 'hex'));
}

const SHARED_CHALLENGES_FILE = resolve(process.cwd(), '../../.whatsapp_active_challenges.json');
const ROOT_CHALLENGES_FILE = resolve('/home/wendy/Desktop/tetherstream/.whatsapp_active_challenges.json');

function getChallengesPath(): string {
  try {
    if (existsSync(ROOT_CHALLENGES_FILE)) return ROOT_CHALLENGES_FILE;
  } catch {}
  return SHARED_CHALLENGES_FILE;
}

function loadSharedChallenges(): Record<string, any> {
  try {
    const p = getChallengesPath();
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8'));
      const cleaned: Record<string, any> = {};
      const now = new Date();
      let cleanedCount = 0;

      // Filter out expired challenges and old format challenges
      for (const [key, value] of Object.entries(raw)) {
        // Skip helper entries (pin_*, approval_*) - they'll be recreated if needed
        if (key.startsWith('pin_') || key.startsWith('approval_')) {
          continue;
        }

        // Validate challenge format
        if (!value || typeof value !== 'object') continue;

        // Check if it's a valid challenge object
        const challenge = value as any;
        
        // Skip old format challenges (missing required hash fields)
        if (!challenge.approvalTokenHash || !challenge.browserProofHash) {
          cleanedCount++;
          continue;
        }

        // Skip expired challenges
        if (challenge.expiresAt) {
          const expiresAt = new Date(challenge.expiresAt);
          if (expiresAt < now) {
            cleanedCount++;
            continue;
          }
        }

        // Keep valid challenges
        cleaned[key] = challenge;
        // Recreate approval token index for valid challenges
        if (challenge.approvalTokenHash) {
          cleaned[`approval_${challenge.approvalTokenHash}`] = key;
        }
        // Recreate PIN index for 6-digit codes
        if (challenge.shortPin) {
          cleaned[`pin_${challenge.shortPin}`] = key;
        }
        // Recreate PIN index for 6-digit codes
        if (challenge.shortPin) {
          cleaned[`pin_${challenge.shortPin}`] = key;
        }
      }

      // If we cleaned anything, save the cleaned version
      if (cleanedCount > 0) {
        console.log(`[WA_CHAL_CLEAN] Removed ${cleanedCount} expired/invalid challenges from shared file`);
        try {
          const temporaryPath = `${p}.${process.pid}.${Date.now()}.tmp`;
          writeFileSync(temporaryPath, JSON.stringify(cleaned, null, 2), 'utf-8');
          renameSync(temporaryPath, p);
        } catch (saveErr: any) {
          console.error('[WA_CHAL_ERR] Failed to save cleaned challenges:', saveErr.message);
        }
      }

      return cleaned;
    }
  } catch (err: any) {
    console.error('[WA_CHAL_ERR] Failed to load shared challenges:', err.message);
  }
  return {};
}

function saveSharedChallenge(challenge: any) {
  let temporaryPath: string | undefined;
  try {
    const p = getChallengesPath();
    const all = loadSharedChallenges();
    all[challenge.challengeId] = challenge;
    all[`approval_${challenge.approvalTokenHash}`] = challenge.challengeId;
    // Also save PIN index for 6-digit codes
    if (challenge.shortPin) {
      all[`pin_${challenge.shortPin}`] = challenge.challengeId;
    }

    temporaryPath = `${p}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(all, null, 2), 'utf-8');
    renameSync(temporaryPath, p);
  } catch (err: any) {
    console.error('[WA_CHAL_ERR] Failed to save shared challenge:', err.message);
    if (temporaryPath) {
      try {
        unlinkSync(temporaryPath);
      } catch {}
    }
  }
}

function deleteSharedChallenge(challengeId: string, approvalTokenHash?: string) {
  let temporaryPath: string | undefined;
  try {
    const p = getChallengesPath();
    const all = loadSharedChallenges();
    delete all[challengeId];
    if (approvalTokenHash) delete all[`approval_${approvalTokenHash}`];
    temporaryPath = `${p}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(all, null, 2), 'utf-8');
    renameSync(temporaryPath, p);
  } catch (err: any) {
    console.error('[WA_CHAL_ERR] Failed to delete shared challenge:', err.message);
    if (temporaryPath) {
      try {
        unlinkSync(temporaryPath);
      } catch {}
    }
  }
}

function getRealisticNameForPhone(phone: string, pushName?: string): string {
  if (pushName && pushName.trim().length >= 2 && !pushName.toLowerCase().includes('null') && !pushName.toLowerCase().includes('operator') && !pushName.toLowerCase().includes('unknown')) {
    return pushName.trim();
  }

  const clean = phone.replace(/\D/g, '');
  const hash = clean.split('').reduce((acc, char) => acc + parseInt(char, 10), 0);

  if (clean.startsWith('256') || phone.startsWith('+256')) {
    const ugandanNames = [
      'Joshua Kigozi',
      'Grace Atuhaire',
      'Ronald Mukasa',
      'Brenda Akello',
      'Moses Ssebaggala',
      'Sarah Namubiru',
      'Ivan Okello',
      'David Mugisha',
      'Doreen Nabirye',
      'Patrick Ssemwogerere',
    ];
    return ugandanNames[hash % ugandanNames.length];
  }

  if (clean.startsWith('254') || phone.startsWith('+254')) {
    const kenyanNames = [
      'Brian Mwangi',
      'Faith Chebet',
      'Kevin Otieno',
      'Dennis Kiprop',
      'Mercy Achieng',
      'Samuel Kamau',
      'Beatrice Muthoni',
    ];
    return kenyanNames[hash % kenyanNames.length];
  }

  if (clean.startsWith('255') || phone.startsWith('+255')) {
    const tanzanianNames = [
      'Juma Salum',
      'Rehema Ally',
      'Emmanuel Mushi',
      'Fatuma Rashid',
    ];
    return tanzanianNames[hash % tanzanianNames.length];
  }

  const internationalNames = [
    'Jordan Hayes',
    'Morgan Reed',
    'Taylor Scott',
    'Alex Mercer',
    'Casey Bennett',
    'Sam Rivera',
  ];
  return internationalNames[hash % internationalNames.length];
}

@Injectable()
export class WhatsappChallengeService {
  private readonly logger = new Logger(WhatsappChallengeService.name);
  private readonly challenges = new Map<string, WhatsappLoginChallenge>();
  private readonly approvalTokenHashToChallengeId = new Map<string, string>();
  private readonly phoneToActiveChallengeId = new Map<string, string>();

  constructor(
    private readonly identityMasterEngine: IdentityMasterEngineService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => BaileysService))
    private readonly baileysService: BaileysService,
    @Optional()
    @Inject(forwardRef(() => ConversationalRouterService))
    private readonly conversationalRouterService?: ConversationalRouterService,
  ) {
    // Initialize cleanup on service start
    this.initializeCleanup();
  }

  /** Initialize cleanup of expired challenges on service startup */
  private initializeCleanup() {
    // Trigger cleanup of shared challenges file on load
    loadSharedChallenges();
    
    // Set up periodic cleanup of in-memory challenges (every 5 minutes)
    setInterval(() => {
      this.cleanupExpiredChallenges();
    }, 5 * 60 * 1000);
  }

  /** Clean up expired in-memory challenges */
  private cleanupExpiredChallenges() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(challengeId);
        if (challenge.approvalTokenHash) {
          this.approvalTokenHashToChallengeId.delete(challenge.approvalTokenHash);
        }
        if (challenge.phone) {
          this.phoneToActiveChallengeId.delete(challenge.phone);
        }
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`[WA_CHAL_CLEANUP] Cleaned ${cleanedCount} expired in-memory challenges`);
    }
  }

  /** Generates a 10-minute, server-verified WhatsApp login challenge. */
  createChallenge(deviceInfo?: string): { challengeId: string; browserProof: string; expiresAt: Date; waDeepLink: string; transportReady?: boolean; transportStatus?: string } {
    const challengeId = `wa_ch_${randomBytes(32).toString('base64url')}`;
    
    // Use 6-digit code instead of opaque token for better UX
    const approvalToken = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
    const browserProof = randomBytes(32).toString('base64url');

    const expiresAt = new Date(Date.now() + 600 * 1000); // 10 minutes TTL

    const challenge: WhatsappLoginChallenge = {
      challengeId,
      approvalTokenHash: hashSecret(approvalToken),
      browserProofHash: hashSecret(browserProof),
      status: 'PENDING',
      deviceInfo: deviceInfo || 'Browser Session',
      createdAt: new Date(),
      expiresAt,
    };

    this.challenges.set(challengeId, challenge);
    this.approvalTokenHashToChallengeId.set(challenge.approvalTokenHash, challengeId);
    saveSharedChallenge({
      challengeId,
      approvalTokenHash: challenge.approvalTokenHash,
      browserProofHash: challenge.browserProofHash,
      shortPin: approvalToken, // Include 6-digit code for backward compatibility
      status: 'PENDING',
      deviceInfo: challenge.deviceInfo,
      createdAt: challenge.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const botPhone = (process.env.WHATSAPP_BOT_PHONE || '+18257320524').replace(/\D/g, '');
    const messageText = `START ${approvalToken}`;
    const waDeepLink = `https://wa.me/${botPhone}?text=${encodeURIComponent(messageText)}`;
    const transportStatus = typeof this.baileysService?.getAuthTransportStatus === 'function'
      ? this.baileysService.getAuthTransportStatus()
      : { status: 'ACCOUNT_READY', hasCreds: true };
    const isReady = typeof this.baileysService?.isAuthTransportReady === 'function'
      ? this.baileysService.isAuthTransportReady()
      : true;

    this.logger.log(`[WA_CHALLENGE_CREATED] challengeId=${challengeId} code=${approvalToken} expiresAt=${expiresAt.toISOString()} transportReady=${isReady}`);
    return {
      challengeId,
      browserProof,
      expiresAt,
      waDeepLink,
      transportReady: isReady,
      transportStatus: transportStatus.status,
    };
  }

  /**
   * Checks current challenge status.
   */
  getChallengeStatus(challengeId: string, browserProof?: string) {
    let challenge = this.challenges.get(challengeId);
    if (!challenge) {
      const shared = loadSharedChallenges();
      const raw = shared[challengeId];
      if (raw) {
        const restored: WhatsappLoginChallenge = {
          ...raw,
          createdAt: new Date(raw.createdAt),
          expiresAt: new Date(raw.expiresAt),
        };
        challenge = restored;
        this.challenges.set(challengeId, restored);
        if (restored.approvalTokenHash) {
          this.approvalTokenHashToChallengeId.set(restored.approvalTokenHash, challengeId);
        }
      }
    }

    if (!challenge) {
      return { status: 'EXPIRED' as ChallengeStatus };
    }

    if (!secretsMatch(challenge.browserProofHash, browserProof)) {
      this.logger.warn(`[WA_CHALLENGE_REJECTED] Invalid browser proof for challengeId=${challengeId}`);
      throw new UnauthorizedException('WHATSAPP_CHALLENGE_BROWSER_PROOF_INVALID');
    }

    if (new Date() > challenge.expiresAt) {
      this.cleanupChallenge(challengeId);
      return { status: 'EXPIRED' as ChallengeStatus };
    }

    if (challenge.status === 'APPROVED') {
      if (!challenge.sessionTokens) {
        this.cleanupChallenge(challengeId);
        return { status: 'EXPIRED' as ChallengeStatus };
      }

      const sessionTokens = challenge.sessionTokens;
      this.cleanupChallenge(challengeId);
      return { status: challenge.status, ...sessionTokens };
    }

    return {
      status: challenge.status,
      expiresAt: challenge.expiresAt,
    };
  }

  /** Finds a challenge only from the opaque approval token sent by WhatsApp. */
  findChallengeByApprovalToken(approvalToken: string): WhatsappLoginChallenge | null {
    const approvalTokenHash = hashSecret(approvalToken);
    let targetChallengeId = this.approvalTokenHashToChallengeId.get(approvalTokenHash);

    if (!targetChallengeId) {
      const shared = loadSharedChallenges();
      const fromToken = shared[`approval_${approvalTokenHash}`];
      if (fromToken && shared[fromToken]) targetChallengeId = fromToken;

      if (targetChallengeId && shared[targetChallengeId]) {
        const raw = shared[targetChallengeId];
        
        // Validate challenge has required fields before restoring
        if (!raw.approvalTokenHash || !raw.browserProofHash) {
          this.logger.warn(`[WA_CHALLENGE_REJECTED] Invalid challenge format for ${targetChallengeId} - missing required hash fields`);
          return null;
        }

        const restored: WhatsappLoginChallenge = {
          ...raw,
          createdAt: new Date(raw.createdAt),
          expiresAt: new Date(raw.expiresAt),
        };
        
        // Check if expired
        if (new Date() > restored.expiresAt) {
          this.logger.warn(`[WA_CHALLENGE_REJECTED] Expired challenge ${targetChallengeId}`);
          return null;
        }

        this.challenges.set(targetChallengeId, restored);
        this.approvalTokenHashToChallengeId.set(restored.approvalTokenHash, targetChallengeId);
        return restored;
      }
    }

    if (!targetChallengeId) return null;
    
    const challenge = this.challenges.get(targetChallengeId);
    if (!challenge) return null;
    
    // Check if expired
    if (new Date() > challenge.expiresAt) {
      this.logger.warn(`[WA_CHALLENGE_REJECTED] Expired in-memory challenge ${targetChallengeId}`);
      return null;
    }
    
    return challenge;
  }

  /**
   * Finds active challenge for phone number.
   */
  findActiveChallengeForPhone(phone: string): WhatsappLoginChallenge | null {
    const cleanPhone = '+' + phone.replace(/\D/g, '');
    const challengeId = this.phoneToActiveChallengeId.get(cleanPhone);
    if (!challengeId) return null;
    const challenge = this.challenges.get(challengeId);
    if (!challenge || new Date() > challenge.expiresAt) return null;
    return challenge;
  }

  /**
   * Binds phone to active challenge.
   */
  bindPhoneToChallenge(phone: string, challengeId: string) {
    const cleanPhone = '+' + phone.replace(/\D/g, '');
    this.phoneToActiveChallengeId.set(cleanPhone, challengeId);
  }

  /**
   * Approves login challenge directly.
   */
  async approveChallengeDirect(challenge: WhatsappLoginChallenge, phone: string) {
    await this.approveChallenge(challenge, phone);
  }

  /**
   * Declines login challenge directly.
   */
  declineChallengeDirect(challenge: WhatsappLoginChallenge, phone: string) {
    this.declineChallenge(challenge, phone);
  }

  /**
   * Inbound WhatsApp message handler.
   */
  async handleInboundMessage(
    senderJid: string,
    textInput: string,
    metadata?: { rawJid?: string; pushName?: string }
  ): Promise<boolean> {
    if (!senderJid || !textInput) return false;

    // Clean JID to remove multi-device suffix (:12) and non-digit characters
    let cleanDigits = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    let cleanPhone = '+' + cleanDigits;
    const rawText = textInput.trim();
    const upperText = rawText.toUpperCase();

    this.logger.log(`[WA_CHAL_DEBUG] Received message from ${cleanPhone}: "${rawText}" (length: ${rawText.length})`);

    // 1. Check if user is replying 1/YES or 2/NO to an awaiting approval prompt
    const pendingChallengeId = this.phoneToActiveChallengeId.get(cleanPhone);
    if (pendingChallengeId) {
      const activeChallenge = this.challenges.get(pendingChallengeId);
      if (activeChallenge && (activeChallenge.status === 'AWAITING_APPROVAL' || activeChallenge.status === 'PENDING') && new Date() <= activeChallenge.expiresAt) {
        if (upperText === '1' || upperText === 'YES' || upperText === 'APPROVE') {
          await this.approveChallenge(activeChallenge, cleanPhone, metadata);
          return true;
        } else if (upperText === '2' || upperText === 'NO' || upperText === 'DECLINE') {
          this.declineChallenge(activeChallenge, cleanPhone);
          await this.baileysService.sendTextMessage(
            cleanPhone,
            `Titan Stream 🛑\n\nSign-in request declined. Access was not granted.`
          );
          return true;
        }
      }
    }

    // A QR approval contains an opaque, one-time token. The sender JID remains
    // authoritative; text content must never select the account being signed in.
    // Accept both 6-digit codes and longer opaque tokens
    const approvalMatch = rawText.match(/^START\s+([A-Za-z0-9_-]{6,})\s*$/i);
    if (approvalMatch) {
      const challenge = this.findChallengeByApprovalToken(approvalMatch[1]);

      if (!challenge || new Date() > challenge.expiresAt) {
        this.logger.warn(`[WA_CHALLENGE_REJECTED] Unknown or expired challenge submitted from ${cleanPhone}`);
        return false;
      }

      // Bind phone number and approve immediately
      challenge.phone = cleanPhone;
      this.phoneToActiveChallengeId.set(cleanPhone, challenge.challengeId);
      await this.approveChallenge(challenge, cleanPhone, metadata);
      return true;
    }

    // START is reserved for opaque browser-login approval. Do not pass malformed
    // or guessed values to any secondary command path.
    if (upperText.startsWith('START')) {
      this.logger.warn(`[WA_CHALLENGE_REJECTED] Malformed approval token submitted from ${cleanPhone}`);
      return false;
    }

    // 3. Delegate all non-authentication commands (BALANCE, MISSIONS, REWARDS, SIGNOUT, HELP) to ConversationalRouterService
    if (this.conversationalRouterService) {
      const res = await this.conversationalRouterService.routeInboundMessage({
        channel: 'WHATSAPP',
        channelUserId: senderJid,
        rawText: textInput,
      });
      if (res && res.handled) return true;
    }

    return true;
  }

  /**
   * Approves login challenge and issues session.
   */
  private async approveChallenge(
    challenge: WhatsappLoginChallenge,
    rawPhone: string,
    metadata?: { rawJid?: string; pushName?: string }
  ) {
    if (new Date() > challenge.expiresAt) {
      throw new UnauthorizedException('WHATSAPP_CHALLENGE_EXPIRED');
    }
    if (challenge.status !== 'PENDING' && challenge.status !== 'AWAITING_APPROVAL') {
      throw new UnauthorizedException('WHATSAPP_CHALLENGE_ALREADY_CONSUMED');
    }

    // 1. Strictly normalize phone number to E.164 format
    let cleanDigits = rawPhone.replace(/\D/g, '');
    let canonicalPhone = rawPhone.startsWith('+') ? rawPhone : `+${cleanDigits}`;
    if (!canonicalPhone.startsWith('+')) {
      canonicalPhone = `+${cleanDigits}`;
    }

    // Canonical Titanstream ID deterministically bound to the phone
    const canonicalTitanId = `titan_wa_${cleanDigits}`;

    // Resolve realistic display name from WhatsApp PushName or Regional Directory Generator
    const resolvedDisplayName = getRealisticNameForPhone(canonicalPhone, metadata?.pushName);
    const nameParts = resolvedDisplayName.split(' ');
    const firstName = nameParts[0] || resolvedDisplayName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const identityContext = await this.identityMasterEngine.authenticate({
      provider: IdentityProvider.WHATSAPP,
      identifier: canonicalPhone,
      displayName: resolvedDisplayName,
      metadata: { phone: canonicalPhone, approvedAt: new Date().toISOString(), deviceInfo: challenge.deviceInfo },
    });

    const userPayload = {
      id: identityContext.userId,
      identityId: identityContext.universalIdentityId,
      telegramUserId: identityContext?.telegramUserId ? Number(identityContext.telegramUserId) : undefined,
      firstName,
      lastName,
      state: UserState.READY,
      isReady: true,
      createdAt: new Date().toISOString(),
    };

    const tokens = await this.authService.createTokensForUser(userPayload);
    challenge.sessionTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user || userPayload,
    };
    challenge.status = 'APPROVED';

    saveSharedChallenge({
      challengeId: challenge.challengeId,
      approvalTokenHash: challenge.approvalTokenHash,
      browserProofHash: challenge.browserProofHash,
      status: 'APPROVED',
      phone: canonicalPhone,
      deviceInfo: challenge.deviceInfo,
      createdAt: challenge.createdAt ? challenge.createdAt.toISOString() : new Date().toISOString(),
      expiresAt: challenge.expiresAt ? challenge.expiresAt.toISOString() : new Date(Date.now() + 600000).toISOString(),
    });

    const primaryTarget = `${cleanDigits}@s.whatsapp.net`;
    const isNewUser = identityContext.assuranceLevel !== 'HIGH';
    const roleText = identityContext.role && identityContext.role !== 'USER' ? `\n• Role: *${identityContext.role}*` : '';

    const confirmation = isNewUser
      ? (
          `⚡ *TITAN STREAM* — *Welcome to Titan Stream!*\n\n` +
          `🎉 *Signup Approved & Account Created*\n` +
          `• Status: *Active & Verified*\n` +
          `• Phone: *${canonicalPhone}*\n` +
          `• Titan ID: *${canonicalTitanId}*${roleText}\n` +
          `• Account UUID: \`${identityContext.userId}\`\n` +
          `• Welcome Bonus: *+50 Energy Crystals Credited*\n\n` +
          `🌐 *Browser Authenticated*: Your browser window is now unlocked and ready to stream!\n\n` +
          `💬 *Commands you can use anytime in this chat:*\n` +
          `• *BALANCE* ➔ View your live USDT & Crystal balance\n` +
          `• *MINING* ➔ Manage your active compute nodes\n` +
          `• *REWARDS* ➔ Claim daily rewards\n` +
          `• *HELP* ➔ View complete command directory`
        )
      : (
          `⚡ *TITAN STREAM* — *Welcome Back!*\n\n` +
          `✅ *Login Approved*\n` +
          `• Status: *Active & Online*\n` +
          `• Phone: *${canonicalPhone}*\n` +
          `• Titan ID: *${canonicalTitanId}*${roleText}\n` +
          `• Account UUID: \`${identityContext.userId}\`\n` +
          `• Security: *Browser Session Authorized*\n\n` +
          `🌐 *Browser Authenticated*: Head back to your browser screen to continue using Titan Stream!\n\n` +
          `💬 *Commands you can use anytime in this chat:*\n` +
          `• *BALANCE* ➔ Check your live USDT & Crystal balance\n` +
          `• *MINING* ➔ Compute nodes status & yield\n` +
          `• *REWARDS* ➔ Claim daily rewards\n` +
          `• *HELP* ➔ View command directory`
        );

    await this.baileysService.sendTextMessage(primaryTarget, confirmation, 'CRITICAL').catch((err: any) => {
      this.logger.warn(`[WA_CONFIRMATION_FAILED] Failed to send approval confirmation: ${err.message}`);
    });

    this.logger.log(`[WA_CHALLENGE_APPROVED] challengeId=${challenge.challengeId} phone=${canonicalPhone} titanId=${canonicalTitanId} userId=${identityContext.userId}`);
  }

  /**
   * Declines login challenge.
   */
  private declineChallenge(challenge: WhatsappLoginChallenge, phone: string) {
    challenge.status = 'DECLINED';
    this.phoneToActiveChallengeId.delete(phone);
    this.approvalTokenHashToChallengeId.delete(challenge.approvalTokenHash);
    deleteSharedChallenge(challenge.challengeId, challenge.approvalTokenHash);
    this.logger.log(`[WA_CHALLENGE_DECLINED] challengeId=${challenge.challengeId} phone=${phone}`);
  }

  private cleanupChallenge(challengeId: string) {
    const challenge = this.challenges.get(challengeId);
    if (challenge) {
      this.approvalTokenHashToChallengeId.delete(challenge.approvalTokenHash);
      if (challenge.phone) {
        this.phoneToActiveChallengeId.delete(challenge.phone);
      }
      this.challenges.delete(challengeId);
      deleteSharedChallenge(challengeId, challenge.approvalTokenHash);
    }
  }
}
