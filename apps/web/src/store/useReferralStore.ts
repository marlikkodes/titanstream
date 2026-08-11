import { create } from 'zustand';
import { growthService, type ReferralSummary } from '../services/growthService';
import { useAuthStore } from './useAuthStore';

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
  computeBoost: number;
  earnedUsdt: number;
  earnedTon: number;
  referralLink: string;
  referralCode: string;
  referredBy: ReferredByInfo | null;
  referrals: ReferralItem[];
  isLoading: boolean;
  error: string | null;

  fetchReferrals: () => Promise<void>;
  tickEarnings: (usdtDelta: number, tonDelta: number) => void;
}

const getFallbackReferralData = () => {
  const session = useAuthStore.getState().session;
  const userId = session?.user?.telegramUserId || (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id || '1001';
  const botUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || 'titanstream_bot';
  return {
    link: `https://t.me/${botUsername}?startapp=ref_${userId}`,
    code: `ref_${userId}`,
  };
};

export const useReferralStore = create<ReferralState>((set) => ({
  invitedCount: 0,
  computeBoost: 1.0,
  earnedUsdt: 0,
  earnedTon: 0,
  referralLink: getFallbackReferralData().link,
  referralCode: getFallbackReferralData().code,
  referredBy: null,
  referrals: [],
  isLoading: false,
  error: null,

  fetchReferrals: async () => {
    set({ isLoading: true, error: null });
    const fallback = getFallbackReferralData();

    try {
      const summary: ReferralSummary = await growthService.getReferrals();
      const boost = Number((1 + (summary.totalInvited || 0) * 0.02).toFixed(2));

      const count = summary.totalInvited || 0;
      try {
        const { useQuestStore } = await import('./useQuestStore');
        useQuestStore.getState().syncReferralProgress(count);
      } catch (e) {
        // ignore circular import guard
      }

      set({
        invitedCount: count,
        computeBoost: boost,
        earnedUsdt: summary.totalEarnedUSDT || 0,
        earnedTon: 0,
        referralLink: summary.referralLink || fallback.link,
        referralCode: summary.referralCode || fallback.code,
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
    } catch (err: any) {
      console.warn('Failed to load referral data, using fallback link:', err?.message);
      set({
        referralLink: fallback.link,
        referralCode: fallback.code,
        error: err?.message || 'Failed to load referral data',
        isLoading: false,
      });
    }
  },

  tickEarnings: (usdtDelta, tonDelta) =>
    set((state) => ({
      earnedUsdt: state.earnedUsdt + usdtDelta,
      earnedTon: state.earnedTon + tonDelta,
    })),
}));
