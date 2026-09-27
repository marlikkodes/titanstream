import { createHash, createHmac } from 'crypto';
import { TelegramAuthService } from './telegram-auth.service';

function signInitData(params: Record<string, string>, botToken = 'test_bot_token') {
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

function signWebLoginPayload(payload: Record<string, string | number>, botToken = 'test_bot_token') {
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return { ...payload, hash };
}

describe('TelegramAuthService', () => {
  const service = new TelegramAuthService('test_bot_token');

  it('validates and parses signed Telegram user payloads', () => {
    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({
        id: 123456789,
        first_name: 'Wendy',
        last_name: 'Doe',
        username: 'wendy',
        language_code: 'en',
        photo_url: 'https://example.test/avatar.jpg',
      }),
    });

    expect(service.verifyInitData(initData).isValid).toBe(true);
    expect(service.parseInitData(initData)).toEqual({
      telegramUserId: '123456789',
      firstName: 'Wendy',
      lastName: 'Doe',
      username: 'wendy',
      languageCode: 'en',
      photoUrl: 'https://example.test/avatar.jpg',
    });
  });

  it('rejects malformed and tampered payloads', () => {
    expect(service.verifyInitData('').isValid).toBe(false);

    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      id: '1',
      first_name: 'Original',
    });

    expect(service.verifyInitData(initData.replace('Original', 'Changed')).isValid).toBe(false);
    expect(() => service.parseInitData(initData.replace('Original', 'Changed'))).toThrow();
  });

  it('validates and parses Telegram Login Widget payloads', () => {
    const payload = signWebLoginPayload({
      id: 123456789,
      first_name: 'Wendy',
      last_name: 'Doe',
      username: 'wendy',
      auth_date: Math.floor(Date.now() / 1000),
    });

    expect(service.parseWebLoginPayload(payload as any)).toEqual({
      telegramUserId: '123456789',
      firstName: 'Wendy',
      lastName: 'Doe',
      username: 'wendy',
      languageCode: 'en',
      photoUrl: undefined,
    });
  });

  it('rejects tampered Telegram Login Widget payloads', () => {
    const payload = signWebLoginPayload({
      id: 123456789,
      first_name: 'Wendy',
      auth_date: Math.floor(Date.now() / 1000),
    });

    expect(() => service.parseWebLoginPayload({ ...payload, first_name: 'Mallory' } as any)).toThrow();
  });

  describe('standalone web Login Widget regression (POST /auth/telegram-login)', () => {
    const nowSec = () => Math.floor(Date.now() / 1000);

    it('accepts a valid payload even when nonce/referralCode control fields are present', () => {
      // Regression: frontend always sends { ...telegramPayload, nonce, referralCode }.
      // Control fields must be excluded from the HMAC base string or every
      // legitimate login 401s with INVALID_WEB_LOGIN_SIGNATURE.
      const signed = signWebLoginPayload({
        id: 123456789,
        first_name: 'Wendy',
        auth_date: nowSec(),
      });
      const withControls = {
        ...signed,
        nonce: 'tgn_regression_nonce',
        referralCode: 'TITAN_ABC123',
      };
      const parsed = service.parseWebLoginPayload(withControls as any);
      expect(parsed.telegramUserId).toBe('123456789');
      expect(parsed.firstName).toBe('Wendy');
    });

    it('rejects a tampered user id without a new hash (401 SIGNATURE_INVALID)', () => {
      const signed = signWebLoginPayload({
        id: 123456789,
        first_name: 'Wendy',
        auth_date: nowSec(),
      });
      try {
        service.parseWebLoginPayload({ ...signed, id: 987654321 } as any);
        fail('expected tampered id to throw');
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_SIGNATURE_INVALID');
      }
    });

    it('rejects a tampered username without a new hash (401 SIGNATURE_INVALID)', () => {
      const signed = signWebLoginPayload({
        id: 123456789,
        first_name: 'Wendy',
        username: 'wendy',
        auth_date: nowSec(),
      });
      try {
        service.parseWebLoginPayload({ ...signed, username: 'mallory' } as any);
        fail('expected tampered username to throw');
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_SIGNATURE_INVALID');
      }
    });

    it('rejects a payload signed with the wrong bot token (401 SIGNATURE_INVALID)', () => {
      const signed = signWebLoginPayload(
        { id: 123456789, first_name: 'Wendy', auth_date: nowSec() },
        'different_bot_token',
      );
      try {
        service.parseWebLoginPayload(signed as any);
        fail('expected wrong-token payload to throw');
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_SIGNATURE_INVALID');
      }
    });

    it('rejects missing hash / id / auth_date before crypto (400 PAYLOAD_INVALID)', () => {
      const base = signWebLoginPayload({ id: 1, first_name: 'A', auth_date: nowSec() });
      const { hash: _h, ...noHash } = base;
      const { id: _i, ...noId } = base as any;
      const { auth_date: _a, ...noAuthDate } = base as any;
      for (const bad of [noHash, noId, noAuthDate]) {
        try {
          service.parseWebLoginPayload(bad as any);
          fail('expected malformed payload to throw');
        } catch (err: any) {
          expect(err.status).toBe(400);
          expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_PAYLOAD_INVALID');
        }
      }
    });

    it('rejects expired and future auth_date (401 AUTH_DATE_EXPIRED)', () => {
      const expired = signWebLoginPayload({
        id: 123456789,
        first_name: 'Wendy',
        auth_date: nowSec() - 25 * 3600, // 25h > 24h tolerance
      });
      try {
        service.parseWebLoginPayload(expired as any);
        fail('expected expired auth_date to throw');
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_AUTH_DATE_EXPIRED');
      }

      const future = signWebLoginPayload({
        id: 123456789,
        first_name: 'Wendy',
        auth_date: nowSec() + 3600, // beyond 5min skew allowance
      });
      try {
        service.parseWebLoginPayload(future as any);
        fail('expected future auth_date to throw');
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(JSON.stringify(err.response)).toContain('TELEGRAM_WEB_LOGIN_AUTH_DATE_EXPIRED');
      }
    });

    it('accepts valid payloads without optional Telegram fields', () => {
      for (const optional of [{}, { last_name: 'Doe' }, { username: 'wendy' }, { photo_url: 'https://example.test/a.jpg' }]) {
        const signed = signWebLoginPayload({ id: 555, first_name: 'No', auth_date: nowSec(), ...(optional as Record<string, string | number>) });
        const parsed = service.parseWebLoginPayload(signed as any);
        expect(parsed.telegramUserId).toBe('555');
      }
      // first_name itself is optional at the verifier layer (defaults to User).
      const noFirst = signWebLoginPayload({ id: 556, auth_date: nowSec() });
      expect(service.parseWebLoginPayload(noFirst as any).firstName).toBe('User');
    });

    it('accepts auth_date as a numeric string (Telegram serialization variance)', () => {
      const signed = signWebLoginPayload({ id: 777, first_name: 'Str', auth_date: nowSec() });
      const asString = { ...signed, auth_date: String((signed as any).auth_date) };
      // Re-sign with the string form to mirror what Telegram would have signed.
      const resigned = signWebLoginPayload({ id: 777, first_name: 'Str', auth_date: String((signed as any).auth_date) });
      expect(service.parseWebLoginPayload(resigned as any).telegramUserId).toBe('777');
      expect(asString.auth_date).toEqual(String((signed as any).auth_date));
    });

    it('does not conflate Mini App (WebAppData) and Login Widget (sha256 token) algorithms', () => {
      // Same fields signed with the Mini App algorithm must FAIL widget verification.
      const fields = { id: '999', first_name: 'Algo', auth_date: String(nowSec()) };
      const webAppSecret = createHmac('sha256', 'WebAppData').update('test_bot_token').digest();
      const webAppHash = createHmac('sha256', webAppSecret)
        .update(Object.keys(fields).sort().map((k) => `${k}=${(fields as any)[k]}`).join('\n'))
        .digest('hex');
      try {
        service.parseWebLoginPayload({ ...fields, id: 999, auth_date: Number((fields as any).auth_date), hash: webAppHash } as any);
        fail('expected WebAppData-signed payload to fail widget verification');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });
  });
});
