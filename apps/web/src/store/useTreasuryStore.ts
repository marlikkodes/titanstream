import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { treasuryService } from '../services/treasuryService';

export type CycleStatus =
  | 'NEW_DAY'
  | 'SNAPSHOT_TAKEN'
  | 'OPPORTUNITIES_ACTIVE'
  | 'GROWTH_CALCULATED'
  | 'TOMORROW_UNLOCKED';

export interface MissionItem {
  id: string;
  type: 'DEPOSIT' | 'REFER' | 'WITHDRAW' | 'OPERATIONS' | 'STAY_ACTIVE';
  title: string;
  subtitle: string;
  rewardPower: number;
  progress: number;
  target: number;
  status: 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED';
  actionLabel: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'UPCOMING';
  badge?: string;
}

interface TreasuryState {
  // Reputation & Profile
  reputationPower: number;
  trustScore: number;
  reputationRank: 'Builder' | 'Guardian' | 'Architect' | 'Grandmaster';
  operatorAccess: 'Unlocked' | 'Locked';

  // Live Economy Stats
  treasuryToday: number;
  depositsToday: number;
  withdrawalsToday: number;
  operatorVolume: number;
  topGrowth: number;

  // Events
  events: CommunityEvent[];
  isLoading: boolean;

  // Actions
  fetchTreasuryState: () => Promise<void>;
}

const INITIAL_EVENTS: CommunityEvent[] = [
  {
    id: 'e1',
    title: 'P2P Operator Processing',
    description: 'Verified P2P operator orders active on settlement rails.',
    status: 'ACTIVE',
    badge: 'Live',
  },
  {
    id: 'e2',
    title: 'Treasury Liquidity League',
    description: 'Real-time liquidity verification and double-entry ledger audits active.',
    status: 'ACTIVE',
    badge: 'Verified',
  },
];

export const useTreasuryStore = create<TreasuryState>((set) => ({
  // Production values - Sourced live from Treasury & Balance Engine
  reputationPower: 0,
  trustScore: 20,
  reputationRank: 'Builder',
  operatorAccess: 'Locked',

  // Live Economy stats
  treasuryToday: 0.0,
  depositsToday: 0.0,
  withdrawalsToday: 0.0,
  operatorVolume: 0.0,
  topGrowth: 0.0,

  events: INITIAL_EVENTS,
  isLoading: false,

  fetchTreasuryState: async () => {
    set({ isLoading: true });
    try {
      const [metrics, trustProfile] = await Promise.all([
        treasuryService.getMetrics(),
        treasuryService.getUserTrustProfile(),
      ]);

      set({
        treasuryToday: metrics.totalLiquidity,
        depositsToday: metrics.settlementExposure,
        withdrawalsToday: metrics.projectedPayouts,
        trustScore: trustProfile.trustScore,
        reputationRank: trustProfile.reputationRank,
        operatorAccess: trustProfile.operatorAccess,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
