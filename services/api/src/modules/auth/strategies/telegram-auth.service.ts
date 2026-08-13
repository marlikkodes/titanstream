import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, createPublicKey, timingSafeEqual, verify } from 'crypto';
import { get as httpGet } from 'https';

export interface TelegramInitDataUser {
  telegramUserId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
  startParam?: string;
}

export interface TelegramWebLoginPayload {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  nonce?: string;
  id_token?: string;
}

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);
  private readonly maxInitDataSize = 4096;
  private readonly authDateToleranceSeconds = 30 * 86400; // 30 days tolerance for cached Telegram webviews
  private readonly webAuthMaxAgeSeconds = 86400; // 24 hours max age for web browser login
  private jwksCache: { keys: any[]; expiresAt: number } | null = null;

  constructor(private readonly botToken: string) {}

  verifyInitData(initData: string): { isValid: boolean; error?: string } {
    try {
      this.assertValid(initData);
      return { isValid: true };
    } catch (error: any) {
      return { isValid: false, error: error?.message ?? 'INVALID_INIT_DATA' };
    }
  }

  parseInitData(initData: string): TelegramInitDataUser | null {
    this.assertValid(initData);
    try {
      const params = new URLSearchParams(initData);
      const rawUser = params.get('user');
      const startParam = params.get('start_param') || undefined;

      if (rawUser) {
        const user = JSON.parse(rawUser);
        return {
          telegramUserId: String(user.id),
          firstName: user.first_name || 'User',
          lastName: user.last_name,
          username: user.username,
          languageCode: user.language_code || 'en',
          photoUrl: user.photo_url,
          startParam,
        };
      }

      const id = params.get('id');
      if (!id) return null;

      return {
        telegramUserId: id,
        firstName: params.get('first_name') || 'User',
        lastName: params.get('last_name') || undefined,
        username: params.get('username') || undefined,
        languageCode: params.get('language_code') || 'en',
        photoUrl: params.get('photo_url') || undefined,
        startParam,
      };
    } catch {
      throw new BadRequestException('MALFORMED_INIT_DATA_USER');
    }
  }

  async parseWebLoginPayloadAsync(payload: TelegramWebLoginPayload): Promise<TelegramInitDataUser> {
    if (payload?.id_token) {
      return this.verifyIdTokenCryptographically(payload.id_token, payload.nonce);
    }
    return this.parseWebLoginPayload(payload);
  }

  parseWebLoginPayload(payload: TelegramWebLoginPayload): TelegramInitDataUser {
    if (payload?.id_token) {
      return this.verifyIdTokenSync(payload.id_token, payload.nonce);
    }

    if (!payload || !payload.id || !payload.hash || !payload.auth_date) {
      throw new BadRequestException('MALFORMED_WEB_LOGIN_PAYLOAD');
    }

    // Verify freshness of auth_date (prevent stale payload replay)
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (ageSeconds > this.webAuthMaxAgeSeconds || ageSeconds < -300) {
      throw new UnauthorizedException('TELEGRAM_AUTH_DATE_EXPIRED');
    }

    // Strict HMAC signature verification against Telegram bot token
    const isValid = this.verifyWebLoginSignature(payload);
    if (!isValid) {
      throw new UnauthorizedException('INVALID_WEB_LOGIN_SIGNATURE');
    }

    return {
      telegramUserId: String(payload.id),
      firstName: payload.first_name || 'User',
      lastName: payload.last_name,
      username: payload.username,
      languageCode: 'en',
      photoUrl: payload.photo_url,
    };
  }

  private async fetchTelegramJwks(): Promise<any[]> {
    if (this.jwksCache && Date.now() < this.jwksCache.expiresAt) {
      return this.jwksCache.keys;
    }

    return new Promise((resolve) => {
      httpGet('https://oauth.telegram.org/.well-known/jwks.json', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const keys = parsed.keys || [];
            this.jwksCache = { keys, expiresAt: Date.now() + 3600 * 1000 };
            resolve(keys);
          } catch {
            resolve([]);
          }
        });
      }).on('error', () => resolve([]));
    });
  }

  async verifyIdTokenCryptographically(idToken: string, expectedNonce?: string): Promise<TelegramInitDataUser> {
    if (!idToken) throw new BadRequestException('MISSING_TELEGRAM_ID_TOKEN');

    const parts = idToken.split('.');
    if (parts.length !== 3) throw new BadRequestException('MALFORMED_TELEGRAM_ID_TOKEN');

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('INVALID_TELEGRAM_ID_TOKEN_FORMAT');
    }

    // 1. Mandatory Header Verification (Fail Closed on alg = none or missing kid)
    if (!header.alg || header.alg === 'none' || header.alg !== 'RS256') {
      throw new UnauthorizedException('UNSUPPORTED_TELEGRAM_JWT_ALGORITHM');
    }
    if (!header.kid) {
      throw new UnauthorizedException('MISSING_TELEGRAM_JWKS_KEY_ID');
    }

    // 2. Fetch JWKS & match key by kid (Strict Fail-Closed)
    const jwksKeys = await this.fetchTelegramJwks();
    const matchingJwk = jwksKeys.find((k) => k.kid === header.kid);

    if (!matchingJwk) {
      throw new UnauthorizedException('UNKNOWN_TELEGRAM_JWKS_KEY_ID');
    }

    // Validate JWK attributes
    if (matchingJwk.kty !== 'RSA' || !matchingJwk.n || !matchingJwk.e) {
      throw new UnauthorizedException('INVALID_TELEGRAM_JWKS_KEY_STRUCTURE');
    }
    if (matchingJwk.alg && matchingJwk.alg !== 'RS256') {
      throw new UnauthorizedException('INCOMPATIBLE_TELEGRAM_JWKS_KEY_ALGORITHM');
    }
    if (matchingJwk.use && matchingJwk.use !== 'sig') {
      throw new UnauthorizedException('INCOMPATIBLE_TELEGRAM_JWKS_KEY_USE');
    }

    // Mandatory RSA-SHA256 signature verification
    try {
      const publicKey = createPublicKey({
        key: {
          kty: matchingJwk.kty,
          n: matchingJwk.n,
          e: matchingJwk.e,
        },
        format: 'jwk',
      });
      const signedData = Buffer.from(`${parts[0]}.${parts[1]}`);
      const signatureBuffer = Buffer.from(parts[2], 'base64url');
      const isSigValid = verify('RSA-SHA256', signedData, publicKey, signatureBuffer);
      if (!isSigValid) {
        throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_SIGNATURE');
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('TELEGRAM_SIGNATURE_VERIFICATION_FAILED');
    }

    // 3. Mandatory Issuer Check (Fail Closed: Strictly https://oauth.telegram.org)
    if (!payload.iss || payload.iss !== 'https://oauth.telegram.org') {
      throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_ISSUER');
    }

    // 4. Mandatory Audience Check (Fail Closed)
    if (!payload.aud) {
      throw new UnauthorizedException('MISSING_TELEGRAM_ID_TOKEN_AUDIENCE');
    }
    const expectedAudience = process.env.TELEGRAM_CLIENT_ID || this.botToken.split(':')[0];
    if (String(payload.aud) !== expectedAudience) {
      throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_AUDIENCE');
    }

    // 5. Mandatory Expiration Check (Fail Closed)
    if (!payload.exp) {
      throw new UnauthorizedException('MISSING_TELEGRAM_ID_TOKEN_EXPIRATION');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number(payload.exp) < nowSec) {
      throw new UnauthorizedException('TELEGRAM_ID_TOKEN_EXPIRED');
    }

    // 6. Mandatory Nonce Binding Check (Fail Closed)
    if (!expectedNonce) {
      throw new UnauthorizedException('MISSING_EXPECTED_NONCE');
    }
    if (!payload.nonce || payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('TELEGRAM_ID_TOKEN_NONCE_MISMATCH');
    }

    const telegramUserId = String(payload.sub || payload.id || '');
    if (!telegramUserId) throw new BadRequestException('INVALID_TELEGRAM_SUBJECT');

    return {
      telegramUserId,
      firstName: payload.name || payload.first_name || 'User',
      lastName: payload.last_name,
      username: payload.preferred_username || payload.username,
      languageCode: 'en',
      photoUrl: payload.picture || payload.photo_url,
    };
  }

  verifyIdTokenSync(idToken: string, expectedNonce?: string): TelegramInitDataUser {
    if (!idToken) throw new BadRequestException('MISSING_TELEGRAM_ID_TOKEN');

    const parts = idToken.split('.');
    if (parts.length !== 3) throw new BadRequestException('MALFORMED_TELEGRAM_ID_TOKEN');

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('INVALID_TELEGRAM_ID_TOKEN_PAYLOAD');
    }

    // 1. Mandatory Header & Alg Check
    if (!header.alg || header.alg === 'none' || header.alg !== 'RS256') {
      throw new UnauthorizedException('UNSUPPORTED_TELEGRAM_JWT_ALGORITHM');
    }
    if (!header.kid) {
      throw new UnauthorizedException('MISSING_TELEGRAM_JWKS_KEY_ID');
    }

    // 2. Cryptographic RSA Signature Verification via cached JWKS
    const jwksKeys = this.jwksCache?.keys || [];
    const matchingJwk = jwksKeys.find((k) => k.kid === header.kid);
    if (!matchingJwk) {
      throw new UnauthorizedException('UNKNOWN_TELEGRAM_JWKS_KEY_ID');
    }

    if (matchingJwk.kty !== 'RSA' || !matchingJwk.n || !matchingJwk.e) {
      throw new UnauthorizedException('INVALID_TELEGRAM_JWKS_KEY_STRUCTURE');
    }
    if (matchingJwk.alg && matchingJwk.alg !== 'RS256') {
      throw new UnauthorizedException('INCOMPATIBLE_TELEGRAM_JWKS_KEY_ALGORITHM');
    }
    if (matchingJwk.use && matchingJwk.use !== 'sig') {
      throw new UnauthorizedException('INCOMPATIBLE_TELEGRAM_JWKS_KEY_USE');
    }

    try {
      const publicKey = createPublicKey({
        key: {
          kty: matchingJwk.kty,
          n: matchingJwk.n,
          e: matchingJwk.e,
        },
        format: 'jwk',
      });
      const signedData = Buffer.from(`${parts[0]}.${parts[1]}`);
      const signatureBuffer = Buffer.from(parts[2], 'base64url');
      const isSigValid = verify('RSA-SHA256', signedData, publicKey, signatureBuffer);
      if (!isSigValid) {
        throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_SIGNATURE');
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('TELEGRAM_SIGNATURE_VERIFICATION_FAILED');
    }

    // 3. Mandatory Issuer Check (Fail Closed: Strictly https://oauth.telegram.org)
    if (!payload.iss || payload.iss !== 'https://oauth.telegram.org') {
      throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_ISSUER');
    }

    // 4. Mandatory Audience Check (Fail Closed)
    if (!payload.aud) {
      throw new UnauthorizedException('MISSING_TELEGRAM_ID_TOKEN_AUDIENCE');
    }
    const expectedAudience = process.env.TELEGRAM_CLIENT_ID || this.botToken.split(':')[0];
    if (String(payload.aud) !== expectedAudience) {
      throw new UnauthorizedException('INVALID_TELEGRAM_ID_TOKEN_AUDIENCE');
    }

    // 5. Mandatory Expiration Check (Fail Closed)
    if (!payload.exp) {
      throw new UnauthorizedException('MISSING_TELEGRAM_ID_TOKEN_EXPIRATION');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number(payload.exp) < nowSec) {
      throw new UnauthorizedException('TELEGRAM_ID_TOKEN_EXPIRED');
    }

    // 6. Mandatory Nonce Binding Check (Fail Closed)
    if (!expectedNonce || !payload.nonce || payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('TELEGRAM_ID_TOKEN_NONCE_MISMATCH');
    }

    const telegramUserId = String(payload.sub || payload.id || '');
    if (!telegramUserId) throw new BadRequestException('INVALID_TELEGRAM_SUBJECT');

    return {
      telegramUserId,
      firstName: payload.name || payload.first_name || 'User',
      lastName: payload.last_name,
      username: payload.preferred_username || payload.username,
      languageCode: 'en',
      photoUrl: payload.picture || payload.photo_url,
    };
  }

  private assertValid(initData: string) {
    if (!this.botToken) {
      throw new UnauthorizedException('TELEGRAM_BOT_TOKEN_NOT_CONFIGURED');
    }

    if (!initData || initData.length > this.maxInitDataSize) {
      throw new BadRequestException('MALFORMED_INIT_DATA');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date'));
    if (!hash || !authDate || Number.isNaN(authDate)) {
      throw new BadRequestException('MALFORMED_INIT_DATA');
    }

    // Verify cryptographic HMAC signature first
    if (!this.verifySignature(params, hash)) {
      throw new UnauthorizedException('INVALID_INIT_DATA');
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > this.authDateToleranceSeconds) {
      throw new UnauthorizedException('AUTH_DATE_EXPIRED');
    }
  }

  private verifySignature(params: URLSearchParams, hash: string): boolean {
    const dataCheckString = Array.from(params.keys())
      .filter((key) => key !== 'hash')
      .sort()
      .map((key) => `${key}=${params.get(key)}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(this.botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    try {
      return calculatedHash.length === hash.length && timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash));
    } catch {
      return false;
    }
  }

  private verifyWebLoginSignature(payload: TelegramWebLoginPayload): boolean {
    const { hash, ...data } = payload;
    const dataCheckString = Object.keys(data)
      .filter((key) => data[key as keyof typeof data] !== undefined && data[key as keyof typeof data] !== null)
      .sort()
      .map((key) => `${key}=${data[key as keyof typeof data]}`)
      .join('\n');

    const secretKey = createHash('sha256').update(this.botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    try {
      return calculatedHash.length === hash.length && timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash));
    } catch {
      return false;
    }
  }
}
