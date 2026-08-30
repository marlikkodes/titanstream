import { create } from 'zustand';
import { growthService, type ReferralSummary } from '../services/growthService';
import { useAuthStore } from './useAuthStore';
import { generateReferralLink, extractReferralCode } from '../utils/referralUrl';

interface ReferralItem {
  id: string;
  refereeId: string;
  refereeName: string;
  refereeUsername?: string;
  status: string;
  createdAt: string;
}

interface ReferredByInfo {
  referrerId: string;
  name: string;
  username?: string;
  joinedAt: string;
  status: string;
}

interface ReferralState {
  invitedCount: number;
  qualifiedCount: number;
  payingCount: number;
  computeBoost: number;
  earnedUsdt: number;
  earnedTon: number;
  networkContributionUsdt: number;
  networkGrossVolumeUsdt: number;
  qualificationStatus: {
    qualifiedCount: number;
    payingCount: number;
    withdrawalRequired: number;
    withdrawalRemaining: number;
    isWithdrawalUnlocked: boolean;
  } | null;
  referralLink: string;
  webReferralLink: string;
  telegramReferralLink: string;
  referralCode: string;
  referredBy: ReferredByInfo | null;
  referrals: ReferralItem[];
  isLoading: boolean;
  error: string | null;

  fetchReferrals: () => Promise<void>;
  attachPendingReferral: () => Promise<void>;
}

const getFallbackReferralData = () => {
  const session = useAuthStore.getState().session;
  const rawId = session?.user?.telegramUserId || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id || '1001';
  const code = extractReferralCode(String(rawId));
  const isTgApp = Boolean((window as any).Telegram?.WebApp?.initData);

  const webLink = generateReferralLink(code, 'web');
  const tgLink = generateReferralLink(code, 'telegram');

  return {
    code,
    webLink,
    tgLink,
    primaryLink: isTgApp ? tgLink : webLink,
  };
};

export const useReferralStore = create<ReferralState>((set, get) => {
  const fallback = getFallbackReferralData();

  return {
    invitedCount: 0,
    qualifiedCount: 0,
    payingCount: 0,
    computeBoost: 1.0,
    earnedUsdt: 0,
    earnedTon: 0,
    networkContributionUsdt: 0,
    networkGrossVolumeUsdt: 0,
    qualificationStatus: null,
    referralLink: fallback.primaryLink,
    webReferralLink: fallback.webLink,
    telegramReferralLink: fallback.tgLink,
    referralCode: fallback.code,
    referredBy: null,
    referrals: [],
    isLoading: false,
    error: null,

    fetchReferrals: async () => {
      set({ isLoading: true, error: null });
      const currentFallback = getFallbackReferralData();

      try {
        const summary: ReferralSummary = await growthService.getReferrals();
        const boost = Number((1 + (summary.totalInvited || 0) * 0.02).toFixed(2));

        const count = summary.totalInvited || 0;
        const qualifiedCount = summary.qualifiedCount || 0;
        const payingCount = summary.payingCount || 0;
        const rawCode = summary.referralCode || currentFallback.code;
        const cleanCode = extractReferralCode(rawCode);
        const isTgApp = Boolean((window as any).Telegram?.WebApp?.initData);

        const webLink = generateReferralLink(cleanCode, 'web');
        const tgLink = generateReferralLink(cleanCode, 'telegram');
        const primaryLink = isTgApp ? tgLink : webLink;

        set({
          invitedCount: count,
          qualifiedCount,
          payingCount,
          computeBoost: boost,
          earnedUsdt: summary.totalEarnedUSDT || 0,
          earnedTon: 0,
          networkContributionUsdt: summary.networkContributionUsdt || 0,
          networkGrossVolumeUsdt: summary.networkGrossVolumeUsdt || 0,
          qualificationStatus: summary.qualificationStatus || {
            qualifiedCount,
            payingCount,
            withdrawalRequired: 5,
            withdrawalRemaining: Math.max(0, 5 - qualifiedCount),
            isWithdrawalUnlocked: qualifiedCount >= 5,
          },
          referralLink: primaryLink,
          webReferralLink: webLink,
          telegramReferralLink: tgLink,
          referralCode: cleanCode,
          referredBy: summary.referredBy || null,
          referrals: (summary.referrals || []).map((r) => ({
            id: r.id,
            refereeId: r.refereeId,
            refereeName: r.refereeName,
            refereeUsername: r.refereeUsername,
            status: r.status,
            createdAt: r.createdAt,
          })),
          isLoading: false,
        });

        // Also trigger attach check if a pending referral exists in localStorage
        get().attachPendingReferral();
      } catch (err: any) {
        console.warn('Failed to load referral data, using fallback link:', err?.message);
        set({
          referralLink: currentFallback.primaryLink,
          webReferralLink: currentFallback.webLink,
          telegramReferralLink: currentFallback.tgLink,
          referralCode: currentFallback.code,
          error: err?.message || 'Failed to load referral data',
          isLoading: false,
        });
      }
    },

    attachPendingReferral: async () => {
      if (typeof window === 'undefined') return;
      const pendingCode = localStorage.getItem('pending_referral_code') || sessionStorage.getItem('pending_referral_code');
      if (!pendingCode) return;

      let attribution: any = undefined;
      const rawAttribution = localStorage.getItem('pending_attribution') || sessionStorage.getItem('pending_attribution');
      if (rawAttribution) {
        try {
          attribution = JSON.parse(rawAttribution);
        } catch {
          // ignore parsing error
        }
      }

      try {
        const cleanCode = extractReferralCode(pendingCode);
        await growthService.attachReferral(cleanCode, attribution);
        localStorage.removeItem('pending_referral_code');
        sessionStorage.removeItem('pending_referral_code');
        localStorage.removeItem('pending_attribution');
        sessionStorage.removeItem('pending_attribution');
        console.info(`[REFERRAL_ATTRIBUTION] Successfully attached referral code ${cleanCode} with attribution:`, attribution);
      } catch (err: any) {
        console.warn('[REFERRAL_ATTRIBUTION] Referral attachment result:', err?.message || err);
        // If already attached or invalid, clean up local keys
        localStorage.removeItem('pending_referral_code');
        sessionStorage.removeItem('pending_referral_code');
        localStorage.removeItem('pending_attribution');
        sessionStorage.removeItem('pending_attribution');
      }
    },
  };
});
