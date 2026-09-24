/**
 * Titan Stream Channel-Aware Referral Link Utility
 * 
 * Provides canonical URL generation for Standalone Web and Telegram Mini App.
 */

export function getCanonicalAppOrigin(): string {
  if (import.meta.env.VITE_APP_URL) {
    return (import.meta.env.VITE_APP_URL as string).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://titanstream.cc';
}

export function generateReferralLink(rawCode: string, channel: 'web' | 'telegram' = 'web'): string {
  if (!rawCode) return getCanonicalAppOrigin();
  const cleanCode = rawCode.replace(/^ref_/, '').trim();
  
  if (channel === 'telegram') {
    const botUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || 'titanstream_bot';
    return `https://t.me/${botUsername}?startapp=ref_${cleanCode}`;
  }

  const origin = getCanonicalAppOrigin();
  return `${origin}/ref/${cleanCode}`;
}

export function extractReferralCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('ref_')) {
    return trimmed.replace('ref_', '');
  }
  return trimmed;
}

export interface AttributionParams {
  channel?: string;
  campaign?: string;
  medium?: string;
  source?: string;
  landingPage?: string;
}

export function extractAttributionParams(searchOrUrl?: string): AttributionParams {
  if (typeof window === 'undefined') return {};
  const queryStr = searchOrUrl || window.location.search || '';
  const params = new URLSearchParams(queryStr);

  const isTg = Boolean((window as any).Telegram?.WebApp?.initData);

  return {
    channel: isTg ? 'TELEGRAM' : params.get('channel') || 'WEB_DIRECT',
    campaign: params.get('utm_campaign') || params.get('campaign') || undefined,
    medium: params.get('utm_medium') || params.get('medium') || undefined,
    source: params.get('utm_source') || params.get('source') || undefined,
    landingPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };
}
