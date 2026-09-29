export type PrimaryCurrency = 'USDT' | 'UGX';

export interface AuthUser {
  id?: string;
  identityId?: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string;
  state: string;
  isReady: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  onboarding: {
    currentStep: string;
    isCompleted: boolean;
  };
  readiness: any;
  isNewUser: boolean;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  onboarding: {
    currentStep: string;
    isCompleted: boolean;
  };
  isNewUser: boolean;
  expiresAt: number;
  platform: 'telegram' | 'web';
  provider?: 'TELEGRAM' | 'WHATSAPP';
}
