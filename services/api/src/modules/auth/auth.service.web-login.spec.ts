import { createHash, createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './strategies/telegram-auth.service';

const BOT_TOKEN = 'test_bot_token_for_auth_service_spec';

function signWidgetPayload(payload: Record<string, string | number>) {
  const dcs = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return { ...payload, hash };
}

function makeService(overrides: {
  identityAuthenticate?: jest.Mock;
  userRecord?: any;
  userLookup?: jest.Mock;
  referralCodeRecord?: any;
}) {
  const telegramAuth = new TelegramAuthService(BOT_TOKEN);

  const canonicalUser = overrides.userRecord ?? {
    id: 'identity-uuid-1',
    identityId: 'identity-uuid-1',
    telegramUserId: BigInt(123456789),
    telegramUsername: 'wendy',
    firstName: 'Wendy',
    lastName: 'Doe',
    photoUrl: null,
    languageCode: 'en',
    state: 'ACTIVE_USER',
    isReady: true,
    createdAt: new Date(),
    loginCount: 5,
    onboardingProgress: { currentStep: 'COMPLETED', isCompleted: true },
  };

  const userLookup =
    overrides.userLookup ??
    jest.fn().mockResolvedValue(canonicalUser);

  const prisma: any = {
    user: { findUnique: userLookup },
    referralCode: {
      findUnique: jest.fn().mockResolvedValue(overrides.referralCodeRecord ?? null),
    },
    referralRelationship: { upsert: jest.fn().mockResolvedValue({}) },
  };

  const identityAuthenticate: jest.Mock =
    overrides.identityAuthenticate ??
    jest.fn().mockResolvedValue({
      userId: 'identity-uuid-1',
      universalIdentityId: 'identity-uuid-1',
      channel: 'TELEGRAM',
      channelIdentityId: 'ch-1',
      providerSubject: '123456789',
      assuranceLevel: 'HIGH',
      role: 'USER',
      userState: 'ACTIVE_USER',
      telegramUserId: BigInt(123456789),
    });

  const jwtService: any = {
    sign: jest.fn((payload: any) => `jwt_${JSON.stringify(payload).length}_${Math.random()}`),
  };

  const service = new AuthService(
    prisma,
    jwtService,
    telegramAuth,
    {} as any,
    { authenticate: identityAuthenticate } as any,
    { create: jest.fn().mockResolvedValue({}) } as any,
    undefined,
  );

  return { service, prisma, identityAuthenticate, userLookup, jwtService, canonicalUser };
}

describe('AuthService.authenticateWebLogin (standalone web regression)', () => {
  it('authenticates a valid Login Widget payload with nonce and resolves the canonical user', async () => {
    const { service, canonicalUser } = makeService({});
    const nonce = (service as any).createTelegramNonce().nonce;
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });

    const result = await service.authenticateWebLogin({ ...signed, nonce }, '127.0.0.1', 'jest');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.telegramUserId).toBe(123456789);
    expect(result.user.id).toBe(canonicalUser.id);
    expect(result.user.identityId).toBe(canonicalUser.identityId);
    expect(result.onboarding).toBeDefined();
    expect(typeof result.isNewUser).toBe('boolean');
  });

  it('authenticates the SAME canonical user on repeat login (no duplicate account)', async () => {
    const { service } = makeService({});
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });

    const nonce1 = (service as any).createTelegramNonce().nonce;
    const first = await service.authenticateWebLogin({ ...signed, nonce: nonce1 }, '127.0.0.1', 'jest');
    const nonce2 = (service as any).createTelegramNonce().nonce;
    const second = await service.authenticateWebLogin({ ...signed, nonce: nonce2 }, '127.0.0.1', 'jest');

    expect(first.user.id).toBe(second.user.id);
    expect(first.user.identityId).toBe(second.user.identityId);
    expect(first.user.telegramUserId).toBe(second.user.telegramUserId);
    // No synthetic titan_tg_* identity may replace the canonical user.
    expect(String(first.user.id)).not.toMatch(/^titan_tg_/);
    expect(String(first.user.id)).not.toMatch(/^fb_/);
  });

  it('rejects tampered payloads and replays (no JWT issued)', async () => {
    const { service, jwtService } = makeService({});
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });
    const nonce = (service as any).createTelegramNonce().nonce;

    jwtService.sign.mockClear();
    await expect(
      service.authenticateWebLogin({ ...signed, id: 999999999, nonce }, '127.0.0.1', 'jest'),
    ).rejects.toThrow();
    // Tampered payload must fail before identity resolution issues tokens.
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rejects reused nonces (replay protection)', async () => {
    const { service } = makeService({});
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });
    const nonce = (service as any).createTelegramNonce().nonce;

    await service.authenticateWebLogin({ ...signed, nonce }, '127.0.0.1', 'jest');
    await expect(service.authenticateWebLogin({ ...signed, nonce }, '127.0.0.1', 'jest')).rejects.toThrow();
  });

  it('fails closed on identity/database failure: no JWT, no synthetic user', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('DB_UNREACHABLE'));
    const { service, jwtService } = makeService({ identityAuthenticate: failing });
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });
    const nonce = (service as any).createTelegramNonce().nonce;

    jwtService.sign.mockClear();
    await expect(service.authenticateWebLogin({ ...signed, nonce }, '127.0.0.1', 'jest')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('fails closed when the canonical user record is missing (no fake financial account)', async () => {
    const { service, jwtService } = makeService({ userLookup: jest.fn().mockResolvedValue(null) });
    const signed = signWidgetPayload({ id: 123456789, first_name: 'Wendy', auth_date: Math.floor(Date.now() / 1000) });
    const nonce = (service as any).createTelegramNonce().nonce;

    jwtService.sign.mockClear();
    await expect(service.authenticateWebLogin({ ...signed, nonce }, '127.0.0.1', 'jest')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
