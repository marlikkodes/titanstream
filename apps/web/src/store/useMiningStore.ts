import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { miningService, type MiningStateResponse } from '../services/mining.service';
import { machineService, type UserMachineAsset } from '../services/machineService';
import { useWalletStore } from './useWalletStore';
import { useCapacityStore } from './useCapacityStore';
import { MACHINE_CATALOG } from '../data/machines';

type Currency = 'USDT' | 'TON';

export interface MiningState {
  // ── Authoritative engine state (backend session + optimistic taps) ──
  activeCurrency: Currency;
  baseSpeedGhs: number;
  coolerMultiplier: number;
  maxMultiplier: number;
  unclaimedBalance: number;
  machineMode: string;
  lifetimePromotionalOutput: number;
  interactivePromotionalOutput: number;
  isOverheated: boolean;
  cooldownRemaining: number;
  tapYieldPerTap: number;

  // ── Authoritative Machine Ownership ──
  userMachines: UserMachineAsset[];
  ownedTierCodes: string[];
  activeMachinesCount: number;

  // ── Eased display values (rendering only — never used for claims) ──
  displayUnclaimed: number;
  displayMultiplier: number;
  displayPromoOutput: number;

  // ── Client-only gameplay state ──
  isActive: boolean;
  tapsToday: number;
  tapsThisWeek: number;
  tapsThisMonth: number;
  dailyTapLimit: number;
  weeklyTapLimit: number;
  monthlyTapLimit: number;
  tonUnlocked: boolean;
  tonPrice: number;
  usdtSpinnerIdx: number;
  tonSpinnerIdx: number;
  hasPurchasedMachine: boolean;

  // ── Actions ──
  toggleCurrency: (currency: Currency) => Promise<void>;
  setUsdtSpinnerIdx: (idx: number) => void;
  setTonSpinnerIdx: (idx: number) => void;
  tap: () => number; // returns per-tap yield for particle feedback (-1 if tap failed)
  applyServerSession: (session: MiningStateResponse, opts?: { snapDisplay?: boolean }) => void;
  fetchMiningState: () => Promise<void>;
  fetchUserMachines: () => Promise<UserMachineAsset[]>;
  isMachineOwned: (tierCode: string) => boolean;
  claimMinedYield: () => Promise<{ success: boolean; error?: any }>;
  startDisplayTicker: () => void;
  stopDisplayTicker: () => void;
  upgradeBaseSpeed: (amount: number, tierCode?: string) => void;
  markMachinePurchased: () => void;
  upgradeLimits: () => void;
  resetTaps: (period: 'daily' | 'weekly' | 'monthly') => void;
  unlockTON: () => void;
  isMiningLocked: () => boolean;
}

const MIN_BOOST_USDT = [0, 5.0, 25.0, 130.0, 550.0, 1500.0];
const MIN_BOOST_TON = [0, 5.0, 25.0, 130.0, 550.0, 1500.0];

const TICK_MS = 100;
const EASE_UP = 0.3; // fast catch-up toward higher targets (taps)
const EASE_DOWN = 0.06; // slow settle toward lower targets (cooling / claim)
const EASE_FLAT = 0.15;
const DECAY_PER_TICK = 0.05; // mirrors backend multiplier decay (0.5x / second)

let displayTicker: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

export const useMiningStore = create<MiningState>()(
  persist(
    (set, get) => {
  return {
    activeCurrency: 'USDT',
    baseSpeedGhs: 1.0,
    coolerMultiplier: 1.0,
    maxMultiplier: 10.1,
    unclaimedBalance: 0.0,
    machineMode: 'PROMOTIONAL',
    lifetimePromotionalOutput: 0.0,
    interactivePromotionalOutput: 0.0,
    isOverheated: false,
    cooldownRemaining: 0,
    tapYieldPerTap: 0.02,

    userMachines: [],
    ownedTierCodes: ['TS_TRIAL'],
    activeMachinesCount: 1,

    displayUnclaimed: 0.0,
    displayMultiplier: 1.0,
    displayPromoOutput: 0.0,

    isActive: true,
    tapsToday: 0,
    tapsThisWeek: 0,
    tapsThisMonth: 0,
    dailyTapLimit: 200,
    weeklyTapLimit: 1000,
    monthlyTapLimit: 4000,
    tonUnlocked: localStorage.getItem('ton_unlocked') !== 'false',
    tonPrice: 110.00,
    usdtSpinnerIdx: 0,
    tonSpinnerIdx: 0,
    hasPurchasedMachine: false,

    /**
     * The single entry point for backend state. Every visual element renders
     * from these fields. Between server responses the display ticker eases
     * toward them so the UI never freezes or jumps. Display values snap on the
     * first fetch (session restore) and after claims (wallet already updated).
     */
    applyServerSession: (session, opts) => {
      const currentUnclaimed = get().unclaimedBalance;
      const currentDisplay = get().displayUnclaimed;

      // Preserve highest balance between persistent local store and backend session
      const targetUnclaimed = Math.max(session.unclaimedBalance, currentUnclaimed, currentDisplay);
      const snap = opts?.snapDisplay || !hydrated;
      hydrated = true;

      set({
        activeCurrency: session.activeCurrency,
        baseSpeedGhs: session.baseSpeedGhs || get().baseSpeedGhs || 1.0,
        coolerMultiplier: session.coolerMultiplier,
        unclaimedBalance: targetUnclaimed,
        machineMode: session.machineMode,
        lifetimePromotionalOutput: session.lifetimePromotionalOutput,
        interactivePromotionalOutput: session.interactivePromotionalOutput,
        isOverheated: session.isOverheated,
        cooldownRemaining: session.cooldownRemaining,
        tapYieldPerTap: session.tapYieldPerTap,
        displayUnclaimed: snap ? targetUnclaimed : Math.max(currentDisplay, targetUnclaimed),
        displayMultiplier: snap || session.coolerMultiplier < get().displayMultiplier ? session.coolerMultiplier : get().displayMultiplier,
        displayPromoOutput: snap || session.lifetimePromotionalOutput < get().displayPromoOutput ? session.lifetimePromotionalOutput : get().displayPromoOutput,
      });
    },

    fetchUserMachines: async () => {
      try {
        const machines = await machineService.getMyMachines();
        if (Array.isArray(machines)) {
          const serverOwnedTiers = machines.map((m) => m.tierCode);
          const ownedTierCodes = Array.from(new Set(['TS_TRIAL', ...serverOwnedTiers]));
          const hasPurchased = machines.some((m) => m.tierCode !== 'TS_TRIAL' && (m.status === 'ACTIVE' || m.status === 'CREATED'));
          const activeCount = machines.filter((m) => m.status === 'ACTIVE' || m.status === 'CREATED').length;
          
          const totalCapacity = machines
            .filter((m) => m.status === 'ACTIVE' || m.status === 'CREATED')
            .reduce((sum, m) => sum + (Number(m.capacityGhs) || 0), 0);
          
          const baseSpeedGhs = totalCapacity > 0 ? totalCapacity : 1.0;

          set({
            userMachines: machines,
            ownedTierCodes,
            hasPurchasedMachine: hasPurchased,
            activeMachinesCount: activeCount,
            baseSpeedGhs,
          });
          useWalletStore.getState().updateBalance({ activeMachines: activeCount });

          try {
            const { useQuestStore } = await import('./useQuestStore');
            useQuestStore.getState().syncMachinePowerProgress(baseSpeedGhs);
          } catch (e) {
            // ignore circular import
          }

          return machines;
        }
      } catch (err) {
        console.warn('Failed to fetch user machines:', err);
      }
      return get().userMachines;
    },

    isMachineOwned: (tierCode: string) => {
      if (!tierCode || tierCode.toUpperCase() === 'TS_TRIAL') return true;
      const s = get();
      const normTier = tierCode.trim().toUpperCase();

      const inOwnedCodes = s.ownedTierCodes.some((code) => (code || '').trim().toUpperCase() === normTier);
      if (inOwnedCodes) return true;

      return s.userMachines.some((m) => {
        const mTier = (m.tierCode || '').trim().toUpperCase();
        const mStatus = (m.status || '').trim().toUpperCase();
        return mTier === normTier && (mStatus === 'ACTIVE' || mStatus === 'CREATED' || mStatus === 'INITIALIZED' || mStatus === '');
      });
    },

    fetchMiningState: async () => {
      try {
        const res = await miningService.getMiningState();
        if (res.success && res.data) {
          get().applyServerSession(res.data);
        }
        await get().fetchUserMachines();
      } catch (err) {
        console.warn('Failed to fetch backend mining state:', err);
      }
    },

    claimMinedYield: async () => {
      const state = get();
      const MIN_CLAIM_USD = 3.0;
      const currentBal = Number(state.unclaimedBalance) || 0;

      const { formatCurrencyWithLocalFallback } = await import('./useCountryStore');
      const minStr = formatCurrencyWithLocalFallback(MIN_CLAIM_USD);
      const curStr = formatCurrencyWithLocalFallback(currentBal);

      if (currentBal < MIN_CLAIM_USD) {
        const msg = `Minimum collection amount is ${minStr} (Current balance: ${curStr}). Keep mining to reach ${minStr}!`;
        import('../components/Toast').then(({ showToast }) => {
          showToast(`⚠️ ${msg}`, 'warning');
        });
        return { success: false, error: new Error(msg) };
      }

      try {
        const res = await miningService.claimRewards();
        const isSuccess = Boolean(
          res &&
          (res.success !== false) &&
          (res.data?.success !== false) &&
          (res.success || res.data?.success || res.data?.session || (res as any).session)
        );

        if (isSuccess) {
          const session = res.data?.session || (res.data as any) || (res as any).session;
          const claimedAmountStr = formatCurrencyWithLocalFallback(currentBal);
          await useWalletStore.getState().fetchBalanceFromEngine();
          if (session && typeof session === 'object' && 'unclaimedBalance' in session) {
            get().applyServerSession(session, { snapDisplay: true });
          } else {
            await get().fetchMiningState();
          }

          import('../components/Toast').then(({ showToast }) => {
            showToast(`🎉 Collected ${claimedAmountStr} successfully! Added to your wallet.`, 'success');
          });
          return { success: true };
        }
        const errorMsg = (res as any)?.error?.message || res?.message || `Minimum collection amount is ${minStr}.`;
        import('../components/Toast').then(({ showToast }) => {
          showToast(`⚠️ ${errorMsg}`, 'warning');
        });
        return { success: false, error: new Error(errorMsg) };
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message || 'Collection failed.';
        import('../components/Toast').then(({ showToast }) => {
          showToast(`⚠️ ${msg}`, 'warning');
        });
        console.error('Failed to claim mining yield:', err);
        return { success: false, error: err };
      }
    },

    toggleCurrency: async (currency) => {
      set({ activeCurrency: currency });
      try {
        const res = await miningService.toggleCurrency(currency);
        if (res.success && res.data) {
          get().applyServerSession(res.data);
        }
      } catch (err) {
        console.warn('Failed to sync currency toggle to backend:', err);
      }
    },

    setUsdtSpinnerIdx: (idx) => set({ usdtSpinnerIdx: idx }),
    setTonSpinnerIdx: (idx) => set({ tonSpinnerIdx: idx }),

    /**
     * Tap flow: optimistic multiplier bump for instant progress feedback, then
     * the backend computes and credits the yield. The server response is the
     * authoritative state — no yield is calculated or stored client-side.
     * Returns the per-tap yield estimate for particle feedback, or -1 on failure.
     */
    tap: () => {
      const state = get();
      if (state.isMiningLocked()) {
        return -1;
      }
      if (state.isOverheated) {
        return -1;
      }
      if (state.tapsToday >= state.dailyTapLimit || state.tapsThisWeek >= state.weeklyTapLimit || state.tapsThisMonth >= state.monthlyTapLimit) {
        return -1;
      }

      const nextMultiplier = Math.min(state.coolerMultiplier + 0.15, state.maxMultiplier);
      const willOverheat = nextMultiplier >= state.maxMultiplier;

      set({
        coolerMultiplier: nextMultiplier,
        isOverheated: willOverheat,
        cooldownRemaining: willOverheat ? 5 : state.cooldownRemaining,
        tapsToday: state.tapsToday + 1,
        tapsThisWeek: state.tapsThisWeek + 1,
        tapsThisMonth: state.tapsThisMonth + 1,
      });

      if (willOverheat) {
        setTimeout(() => {
          set({
            isOverheated: false,
            cooldownRemaining: 0,
          });
        }, 5000);
      }

      miningService.tapCooler().then((res) => {
        if (res.success && res.data) {
          get().applyServerSession(res.data);
        }
      }).catch((err) => {
        console.warn('Failed to sync tap to backend:', err);
      });

      return state.tapYieldPerTap;
    },

    upgradeBaseSpeed: (amount, tierCode, newMachineAsset) =>
      set((state) => {
        const safeOwned = Array.isArray(state.ownedTierCodes) ? state.ownedTierCodes : ['TS_TRIAL'];
        const safeUserMachines = Array.isArray(state.userMachines) ? state.userMachines : [];

        const nextOwnedTierCodes = tierCode && !safeOwned.includes(tierCode)
          ? [...safeOwned, tierCode]
          : safeOwned;
        
        let nextUserMachines = [...safeUserMachines];
        const catItem = MACHINE_CATALOG.find((c) => c.tierCode === tierCode);
        if (newMachineAsset) {
          if (!nextUserMachines.some((m) => m.id === newMachineAsset.id)) {
            nextUserMachines.push(newMachineAsset);
          }
        } else if (tierCode && !nextUserMachines.some((m) => m.tierCode === tierCode)) {
          nextUserMachines.push({
            id: `mach_${tierCode}_${Date.now()}`,
            telegramUserId: '',
            tierCode,
            name: catItem?.name || tierCode,
            purchasePrice: catItem?.priceUsdt || 0,
            currency: 'USDT',
            status: 'ACTIVE',
            capacityGhs: catItem?.capacityGhs || amount,
            lifetimeEarnings: 0,
            purchasedAt: new Date().toISOString(),
            activatedAt: new Date().toISOString(),
          });
        }

        const totalCapacity = nextUserMachines
          .filter((m) => m.status === 'ACTIVE' || m.status === 'CREATED')
          .reduce((sum, m) => sum + (Number(m.capacityGhs) || 0), 0);

        const finalSpeed = totalCapacity > 0 ? totalCapacity : Math.max(state.baseSpeedGhs, amount);

        // Sync with capacity engine
        try {
          useCapacityStore.getState().addCapacity('PREMIUM_PURCHASE', Math.round((catItem?.capacityGhs || amount) * 10), `Purchased ${catItem?.name || tierCode}`);
        } catch (e) {
          console.warn('Failed to add capacity:', e);
        }

        return {
          baseSpeedGhs: finalSpeed,
          ownedTierCodes: nextOwnedTierCodes,
          userMachines: nextUserMachines,
          hasPurchasedMachine: true,
          activeMachinesCount: nextUserMachines.length,
        };
      }),
    markMachinePurchased: () => {
      set({ hasPurchasedMachine: true });
    },
    upgradeLimits: () =>
      set((state) => ({
        dailyTapLimit: state.dailyTapLimit + 200,
        weeklyTapLimit: state.weeklyTapLimit + 1000,
        monthlyTapLimit: state.monthlyTapLimit + 4000,
        tapsToday: 0,
        tapsThisWeek: 0,
        tapsThisMonth: 0,
      })),
    resetTaps: (period) =>
      set((state) => ({
        tapsToday: period === 'daily' ? 0 : state.tapsToday,
        tapsThisWeek: period === 'weekly' ? 0 : state.tapsThisWeek,
        tapsThisMonth: period === 'monthly' ? 0 : state.tapsThisMonth,
      })),
    unlockTON: () => {
      localStorage.setItem('ton_unlocked', 'true');
      set({ tonUnlocked: true });
    },
    isMiningLocked: (tierCode?: string) => {
      const s = get();
      if (s.activeCurrency === 'TON' && !s.tonUnlocked) {
        return true;
      }

      const isUsdt = s.activeCurrency === 'USDT';
      const spinnerIdx = isUsdt ? s.usdtSpinnerIdx : s.tonSpinnerIdx;
      const targetTier = tierCode || MACHINE_CATALOG[spinnerIdx]?.tierCode;

      if (!targetTier || targetTier.toUpperCase() === 'TS_TRIAL') {
        return false;
      }

      return !s.isMachineOwned(targetTier);
    },

    startDisplayTicker: () => {
      if (displayTicker) return;
      displayTicker = setInterval(() => {
        const s = get();

        // Real-time continuous yield tick accumulation while active machines are running
        let activeUnclaimed = s.unclaimedBalance;
        if (s.baseSpeedGhs > 0 && !s.isOverheated) {
          const ratePerSec = s.baseSpeedGhs * s.coolerMultiplier * 0.0001;
          const tickYield = ratePerSec * (TICK_MS / 1000);
          activeUnclaimed = s.unclaimedBalance + tickYield;
        }

        const targetUnclaimed = Math.max(s.unclaimedBalance, activeUnclaimed);
        const unclDir = targetUnclaimed >= s.displayUnclaimed ? EASE_FLAT : 1.0;
        const promoDir = s.lifetimePromotionalOutput >= s.displayPromoOutput ? EASE_FLAT : 1.0;

        const nextDisplayUnclaimed = targetUnclaimed < s.displayUnclaimed ? targetUnclaimed : s.displayUnclaimed + (targetUnclaimed - s.displayUnclaimed) * unclDir;
        const nextDisplayPromo = s.lifetimePromotionalOutput < s.displayPromoOutput ? s.lifetimePromotionalOutput : s.displayPromoOutput + (s.lifetimePromotionalOutput - s.displayPromoOutput) * promoDir;

        // Cooldown countdown rendering (recalibrated by every server response).
        let nextCooldown = s.cooldownRemaining;
        let nextOverheated = s.isOverheated;
        let nextMultiplier = s.coolerMultiplier;
        if (s.isOverheated && nextCooldown > 0) {
          nextCooldown = Math.max(0, nextCooldown - TICK_MS / 1000);
          if (nextCooldown <= 0) {
            nextOverheated = false;
          }
        }

        // Mirrors backend decay so cooling looks smooth between syncs
        if (!nextOverheated && nextMultiplier > 1.0) {
          nextMultiplier = Math.max(1.0, nextMultiplier - DECAY_PER_TICK);
        }
        const multDir = nextMultiplier >= s.displayMultiplier ? EASE_UP : EASE_DOWN;
        const nextDisplayMult = s.displayMultiplier + (nextMultiplier - s.displayMultiplier) * multDir;

        // Single batched state update strictly when values have changed
        if (
          Math.abs(nextDisplayUnclaimed - s.displayUnclaimed) > 0.0000001 ||
          Math.abs(nextDisplayPromo - s.displayPromoOutput) > 0.0000001 ||
          Math.abs(nextDisplayMult - s.displayMultiplier) > 0.0001 ||
          nextCooldown !== s.cooldownRemaining ||
          nextOverheated !== s.isOverheated ||
          nextMultiplier !== s.coolerMultiplier
        ) {
          set({
            unclaimedBalance: activeUnclaimed,
            displayUnclaimed: nextDisplayUnclaimed,
            displayPromoOutput: nextDisplayPromo,
            displayMultiplier: nextDisplayMult,
            cooldownRemaining: nextCooldown,
            isOverheated: nextOverheated,
            coolerMultiplier: nextMultiplier,
          });
        }
      }, TICK_MS);
    },

    stopDisplayTicker: () => {
      if (displayTicker) {
        clearInterval(displayTicker);
        displayTicker = null;
      }
    },
  };
},
    {
      name: 'mining-storage',
      partialize: (state) => ({
        activeCurrency: state.activeCurrency,
        baseSpeedGhs: state.baseSpeedGhs,
        coolerMultiplier: state.coolerMultiplier,
        unclaimedBalance: state.unclaimedBalance,
        displayUnclaimed: state.displayUnclaimed,
        machineMode: state.machineMode,
        lifetimePromotionalOutput: state.lifetimePromotionalOutput,
        interactivePromotionalOutput: state.interactivePromotionalOutput,
        userMachines: state.userMachines,
        ownedTierCodes: state.ownedTierCodes,
        hasPurchasedMachine: state.hasPurchasedMachine,
        tapsToday: state.tapsToday,
        tapsThisWeek: state.tapsThisWeek,
        tapsThisMonth: state.tapsThisMonth,
        usdtSpinnerIdx: state.usdtSpinnerIdx,
        tonSpinnerIdx: state.tonSpinnerIdx,
      }),
    }
  )
);
