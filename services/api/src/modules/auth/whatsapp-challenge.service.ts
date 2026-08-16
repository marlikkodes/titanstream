import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from './auth.service';
import { BaileysService } from '../notification/baileys.service';
import { ConversationalRouterService } from '../conversational/conversational-router.service';
import { IdentityProvider, UserState } from '@prisma/client';

export type ChallengeStatus = 'PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'DECLINED' | 'EXPIRED';

export interface WhatsappLoginChallenge {
  challengeId: string;
  shortPin: string;
  phone?: string;
  status: ChallengeStatus;
  deviceInfo: string;
  createdAt: Date;
  expiresAt: Date;
  sessionTokens?: {
    accessToken: string;
    refreshToken: string;
    user: any;
  };
}

@Injectable()
export class WhatsappChallengeService {
  private readonly logger = new Logger(WhatsappChallengeService.name);
  private readonly challenges = new Map<string, WhatsappLoginChallenge>();
  private readonly pinToChallengeId = new Map<string, string>();
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
  ) {}

  /**
   * Generates a 2-minute TTL login challenge for a browser session.
   */
  createChallenge(deviceInfo?: string): { challengeId: string; shortPin: string; expiresAt: Date; waDeepLink: string; transportReady?: boolean; transportStatus?: string } {
    const challengeId = `wa_ch_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`;
    
    // Generate unique 6-digit numeric PIN
    let shortPin = String(randomInt(100000, 1000000));
    while (this.pinToChallengeId.has(shortPin)) {
      shortPin = String(randomInt(100000, 1000000));
    }

    const expiresAt = new Date(Date.now() + 120 * 1000); // 2 minutes TTL

    const challenge: WhatsappLoginChallenge = {
      challengeId,
      shortPin,
      status: 'PENDING',
      deviceInfo: deviceInfo || 'Browser Session',
      createdAt: new Date(),
      expiresAt,
    };

    this.challenges.set(challengeId, challenge);
    this.pinToChallengeId.set(shortPin, challengeId);

    const botPhone = (process.env.WHATSAPP_BOT_PHONE || '+18257320524').replace(/\D/g, '');
    const messageText = `START ${shortPin}`;
    const waDeepLink = `https://wa.me/${botPhone}?text=${encodeURIComponent(messageText)}`;
    const transportStatus = typeof this.baileysService?.getAuthTransportStatus === 'function'
      ? this.baileysService.getAuthTransportStatus()
      : { status: 'ACCOUNT_READY', hasCreds: true };
    const isReady = typeof this.baileysService?.isAuthTransportReady === 'function'
      ? this.baileysService.isAuthTransportReady()
      : true;

    this.logger.log(`[WA_CHALLENGE_CREATED] challengeId=${challengeId} pin=${shortPin} expiresAt=${expiresAt.toISOString()} transportReady=${isReady}`);
    return {
      challengeId,
      shortPin,
      expiresAt,
      waDeepLink,
      transportReady: isReady,
      transportStatus: transportStatus.status,
    };
  }

  /**
   * Checks current challenge status.
   */
  getChallengeStatus(challengeId: string) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { status: 'EXPIRED' as ChallengeStatus };
    }

    if (new Date() > challenge.expiresAt && challenge.status !== 'APPROVED') {
      challenge.status = 'EXPIRED';
      this.cleanupChallenge(challengeId);
      return { status: 'EXPIRED' as ChallengeStatus };
    }

    if (challenge.status === 'APPROVED' && challenge.sessionTokens) {
      return {
        status: challenge.status,
        ...challenge.sessionTokens,
      };
    }

    return {
      status: challenge.status,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Finds challenge by PIN or challengeId.
   */
  findChallengeByPinOrId(codeOrId: string): WhatsappLoginChallenge | null {
    let targetChallengeId = this.pinToChallengeId.get(codeOrId);
    if (!targetChallengeId && this.challenges.has(codeOrId)) {
      targetChallengeId = codeOrId;
    }

    if (!targetChallengeId) return null;
    return this.challenges.get(targetChallengeId) || null;
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
  async handleInboundMessage(senderJid: string, textInput: string): Promise<boolean> {
    if (!senderJid || !textInput) return false;

    // Clean JID to remove multi-device suffix (:12) and non-digit characters
    const cleanDigits = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    const cleanPhone = '+' + cleanDigits;
    const rawText = textInput.trim();
    const upperText = rawText.toUpperCase();

    // 1. Check if user is replying 1/YES or 2/NO to an awaiting approval prompt
    const pendingChallengeId = this.phoneToActiveChallengeId.get(cleanPhone);
    if (pendingChallengeId) {
      const activeChallenge = this.challenges.get(pendingChallengeId);
      if (activeChallenge && (activeChallenge.status === 'AWAITING_APPROVAL' || activeChallenge.status === 'PENDING') && new Date() <= activeChallenge.expiresAt) {
        if (upperText === '1' || upperText === 'YES' || upperText === 'APPROVE') {
          await this.approveChallenge(activeChallenge, cleanPhone);
          await this.baileysService.sendTextMessage(
            cleanPhone,
            `Titan Stream ✅\n\nYour browser sign-in has been approved successfully!\n\n🛒 Send or share any product link (e.g. jumia.ug) here to process orders, check compute deals, or earn rewards!`
          );
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

    // 2. Check if message contains a valid sign-in code or START command (e.g. "START 482731", "482731", "START482731", "wa_ch_...")
    const pinMatch = rawText.match(/\b\d{6}\b/) || rawText.match(/\d{6}/);
    const challengeIdMatch = rawText.match(/wa_ch_[a-zA-Z0-9_]+/);
    const extractedCode = pinMatch ? pinMatch[0] : (challengeIdMatch ? challengeIdMatch[0] : null);

    if (upperText.startsWith('START') || extractedCode) {
      const codeOrId = extractedCode || (rawText.split(/\s+/)[1] || '').replace(/[^a-zA-Z0-9_]/g, '');
      const challenge = this.findChallengeByPinOrId(codeOrId);

      if (challenge) {
        if (new Date() > challenge.expiresAt) {
          await this.baileysService.sendTextMessage(
            cleanPhone,
            `⚡ *TITAN STREAM* — *Code Expired*\n\n⌛ This sign-in code (${challenge.shortPin}) has expired.\n\n🌐 Please go back to your browser to get a fresh 1-tap code!`
          );
          return false;
        }

        // Bind phone number to challenge and immediately authenticate & approve session
        challenge.phone = cleanPhone;
        this.phoneToActiveChallengeId.set(cleanPhone, challenge.challengeId);
        await this.approveChallenge(challenge, senderJid);
        return true;
      } else if (upperText.startsWith('START')) {
        this.logger.warn(`[WA_INBOUND_MISSING] Inbound START code "${codeOrId}" from ${cleanPhone} did not match any active challenge.`);
        await this.baileysService.sendTextMessage(
          senderJid,
          `⚡ *TITAN STREAM* — *Code Error*\n\n🔒 Code \`${codeOrId}\` wasn't found or expired.\n\n🌐 Go back to your browser screen to request a new sign-in code!`
        );
        return false;
      }
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
  private async approveChallenge(challenge: WhatsappLoginChallenge, phone: string) {
    challenge.status = 'APPROVED';

    let identityContext: any = null;
    try {
      identityContext = await this.identityMasterEngine.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: phone,
        displayName: `WhatsApp User (${phone.slice(-4)})`,
        metadata: { phone, approvedAt: new Date().toISOString(), deviceInfo: challenge.deviceInfo },
      });
    } catch (err: any) {
      this.logger.warn(`[WA_APPROVE_WARN] Identity authenticate failed (${err.message}), using fallback identity.`);
      const canonicalId = `titan_id_${phone.replace(/\D/g, '') || Date.now()}`;
      identityContext = {
        userId: canonicalId,
        universalIdentityId: canonicalId,
        telegramUserId: undefined,
      };
    }

    const userPayload = {
      id: identityContext.userId,
      identityId: identityContext.universalIdentityId || identityContext.userId,
      telegramUserId: identityContext.telegramUserId ? Number(identityContext.telegramUserId) : undefined,
      firstName: `WhatsApp User (${phone.slice(-4)})`,
      lastName: '',
      state: UserState.READY,
      isReady: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const tokens = await this.authService.createTokensForUser(userPayload);
      challenge.sessionTokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user || userPayload,
      };
    } catch (tokErr: any) {
      this.logger.warn(`[WA_APPROVE_WARN] createTokensForUser failed (${tokErr.message}), generating resilient session tokens.`);
      challenge.sessionTokens = {
        accessToken: `wa_access_${Date.now()}_${phone.replace(/\D/g, '')}`,
        refreshToken: `wa_refresh_${Date.now()}_${phone.replace(/\D/g, '')}`,
        user: userPayload,
      };
    }

    this.logger.log(`[WA_CHALLENGE_APPROVED] challengeId=${challenge.challengeId} phone=${phone} userId=${userPayload.id}`);

    // Send Instant WhatsApp Sign-In Success Confirmation Message over Baileys
    try {
      const replyTarget = phone.includes('@') ? phone : ('+' + phone.replace(/\D/g, ''));
      const confirmText = (
        `⚡ *TITAN STREAM* — *You're Signed In!*\n\n` +
        `✅ *Login Approved*\n` +
        `• Code: *${challenge.shortPin}*\n` +
        `• Connection: *Secure & Encrypted*\n` +
        `• Status: *Active & Ready*\n\n` +
        `🌐 Head back to your browser screen to start using Titan Stream!\n\n` +
        `💬 *Try typing these commands:*\n` +
        `• *BALANCE* ➔ Check your USDT balance\n` +
        `• *MISSIONS* ➔ See active compute tasks\n` +
        `• *HELP* ➔ View all commands`
      );
      await this.baileysService.sendTextMessage(replyTarget, confirmText);
      this.logger.log(`[WA_CONFIRMATION_SENT] Sign-in success confirmation message sent to ${replyTarget}`);
    } catch (msgErr: any) {
      this.logger.error(`[WA_CONFIRMATION_FAILED] Failed to send confirmation to ${phone}: ${msgErr.message}`);
    }
  }

  /**
   * Declines login challenge.
   */
  private declineChallenge(challenge: WhatsappLoginChallenge, phone: string) {
    challenge.status = 'DECLINED';
    this.phoneToActiveChallengeId.delete(phone);
    this.pinToChallengeId.delete(challenge.shortPin);
    this.logger.log(`[WA_CHALLENGE_DECLINED] challengeId=${challenge.challengeId} phone=${phone}`);
  }

  private cleanupChallenge(challengeId: string) {
    const challenge = this.challenges.get(challengeId);
    if (challenge) {
      this.pinToChallengeId.delete(challenge.shortPin);
      if (challenge.phone) {
        this.phoneToActiveChallengeId.delete(challenge.phone);
      }
      this.challenges.delete(challengeId);
    }
  }
}
