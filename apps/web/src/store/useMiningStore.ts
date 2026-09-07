import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { miningService, type MiningStateResponse } from '../services/mining.service';
import { machineService, type UserMachineAsset } from '../services/machineService';
import { useWalletStore } from './useWalletStore';
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
  applyServerSession: (session: MiningStateResponse, opts?: { snapDisplay?: boolean; isClaim?: boolean }) => void;
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
  getActiveHashSpeed: () => number;
  isPaused: boolean;
  activeSpeedGhs: number;
  machineStatusVersion: number;
  lastMiningUpdatedAt: number;
  syncMachineStatus: () => { isPaused: boolean; activeGhs: number };
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

// ── Performance: cached hash speed to avoid recomputing inside the 100ms ticker ──
let _cachedHashSpeed = 1.0;
let _cachedIsPaused = false;
let _hashSpeedDirty = true; // recompute on next read after ownership changes

// Lazy ref to avoid synchronous require() on every tick
let _ownershipStoreRef: any = null;
function getOwnershipStore() {
  if (!_ownershipStoreRef) {
    try {
      _ownershipStoreRef = require('./useMachineOwnershipStore').useMachineOwnershipStore;
    } catch { /* not yet loaded */ }
  }
  return _ownershipStoreRef;
}

// ── Performance: debounced localStorage to prevent 10×/sec writes from the ticker ──
const PERSIST_DEBOUNCE_MS = 3000;
let _pendingPersist: string | null = null;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    _pendingPersist = value;
    if (!_persistTimer) {
      _persistTimer = setTimeout(() => {
        if (_pendingPersist !== null) {
          localStorage.setItem(name, _pendingPersist);
          _pendingPersist = null;
        }
        _persistTimer = null;
      }, PERSIST_DEBOUNCE_MS);
    }
  },
  removeItem: (name: string) => {
    if (_persistTimer) {
      clearTimeout(_persistTimer);
      _persistTimer = null;
    }
    _pendingPersist = null;
    localStorage.removeItem(name);
  },
};

// Guarantee latest counter is persisted to localStorage on tab close/unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_pendingPersist !== null) {
      localStorage.setItem('mining-storage', _pendingPersist);
      _pendingPersist = null;
    }
  });
}

export const useMiningStore = create<MiningState>()(
  persist(
    (set, get) => {
  return {
    activeCurrency: 'USDT',
    baseSpeedGhs: 1.0,
    coolerMultiplier: 1.0,
    maxMultiplier: 10.1,
    unclaimedBalance: 0.0,
    lastMiningUpdatedAt: Date.now(),
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

    isPaused: false,
    activeSpeedGhs: 1.0,
    machineStatusVersion: Date.now(),

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
      const snap = opts?.snapDisplay || opts?.isClaim || !hydrated;
      hydrated = true;
      // Single authority: Server is the sole authority for claimable financial balance
      const serverUnclaimed = typeof session.unclaimedBalance === 'number' ? session.unclaimedBalance : 0.0;

      set({
        activeCurrency: session.activeCurrency,
        baseSpeedGhs: session.baseSpeedGhs || get().baseSpeedGhs || 1.0,
        coolerMultiplier: session.coolerMultiplier,
        unclaimedBalance: serverUnclaimed, // Strict single authority — never manufactured by client
        machineMode: session.machineMode,
        lifetimePromotionalOutput: session.lifetimePromotionalOutput,
        interactivePromotionalOutput: session.interactivePromotionalOutput,
        isOverheated: session.isOverheated,
        cooldownRemaining: session.cooldownRemaining,
        tapYieldPerTap: session.tapYieldPerTap,
        displayUnclaimed: snap ? serverUnclaimed : Math.max(serverUnclaimed, get().displayUnclaimed),
        displayMultiplier: snap || session.coolerMultiplier < get().displayMultiplier ? session.coolerMultiplier : get().displayMultiplier,
        displayPromoOutput: snap || session.lifetimePromotionalOutput < get().displayPromoOutput ? session.lifetimePromotionalOutput : get().displayPromoOutput,
        lastMiningUpdatedAt: Date.now(),
      });
    },

    fetchUserMachines: async () => {
      try {
        const machines = await machineService.getMyMachines();
        if (Array.isArray(machines)) {
          const serverOwnedTiers = machines
            .filter((m) => m.status === 'ACTIVE' || m.status === 'CREATED' || m.status === 'INITIALIZED')
            .map((m) => m.tierCode.toUpperCase());
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
          _hashSpeedDirty = true; // invalidate cached hash speed
          useWalletStore.getState().updateBalance({ activeMachines: activeCount });

          // Synchronize machine ownership store so only owned machines and certificates exist
          const { useMachineOwnershipStore } = await import('./useMachineOwnershipStore');
          useMachineOwnershipStore.getState().syncWithUserMachines(machines);

          return machines;
        }
      } catch (err) {
        console.warn('Failed to fetch user machines:', err);
      }
      return get().userMachines;
    },

    isMachineOwned: (tierCode: string) => {
      if (!tierCode) return false;
      const normTier = tierCode.trim().toUpperCase();
      if (normTier === 'TS_TRIAL') return true;

      const s = get();
      const inOwnedCodes = (s.ownedTierCodes || []).some((code) => (code || '').trim().toUpperCase() === normTier);
      if (inOwnedCodes) return true;

      return (s.userMachines || []).some((m) => {
        const mTier = (m.tierCode || '').trim().toUpperCase();
        const mStatus = (m.status || '').trim().toUpperCase();
        return mTier === normTier && (mStatus === 'ACTIVE' || mStatus === 'CREATED' || mStatus === 'INITIALIZED');
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
        const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `claim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const res = await miningService.claimRewards(idempotencyKey);
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
            get().applyServerSession(session, { snapDisplay: true, isClaim: true });
          } else {
            set({ unclaimedBalance: 0, displayUnclaimed: 0, lastMiningUpdatedAt: Date.now() });
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
      if (state.getActiveHashSpeed() <= 0) {
        import('../components/Toast').then(({ showToast }) => {
          showToast('⏸️ Machine is paused. Resume machine to start hashing!', 'warning');
        });
        return -1;
      }
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

    upgradeBaseSpeed: (amount, tierCode, newMachineAsset) => {
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

        return {
          baseSpeedGhs: finalSpeed,
          ownedTierCodes: nextOwnedTierCodes,
          userMachines: nextUserMachines,
          hasPurchasedMachine: true,
          activeMachinesCount: nextUserMachines.length,
        };
      });
      _hashSpeedDirty = true; // invalidate cached hash speed
    },
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

    syncMachineStatus: () => {
      const s = get();
      try {
        const ownershipStore = getOwnershipStore();
        const ownerships = ownershipStore?.getState().ownerships || {};
        const safeOwned = Array.isArray(s.ownedTierCodes) ? s.ownedTierCodes : ['TS_TRIAL'];
        let activeGhs = 0;

        for (const tierCode of safeOwned) {
          const rec = ownerships[tierCode.toUpperCase()];
          const status = rec?.status || 'RUNNING';
          if (status === 'RUNNING') {
            const catItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === tierCode.toUpperCase());
            activeGhs += catItem?.capacityGhs || (tierCode === 'TS_TRIAL' ? 1.0 : 0);
          }
        }

        const isPaused = activeGhs <= 0;
        _cachedHashSpeed = activeGhs;
        _cachedIsPaused = isPaused;
        if (s.isPaused !== isPaused || s.activeSpeedGhs !== activeGhs) {
          set({
            isPaused,
            activeSpeedGhs: activeGhs,
          });
        }

        return { isPaused, activeGhs };
      } catch (e) {
        return { isPaused: false, activeGhs: s.baseSpeedGhs || 1.0 };
      }
    },

    getActiveHashSpeed: () => {
      if (!_hashSpeedDirty) return _cachedHashSpeed;

      const s = get();
      try {
        const ownershipStore = getOwnershipStore();
        const ownerships = ownershipStore?.getState().ownerships || {};
        const safeOwned = Array.isArray(s.ownedTierCodes) ? s.ownedTierCodes : ['TS_TRIAL'];
        let activeGhs = 0;

        for (const tierCode of safeOwned) {
          const rec = ownerships[tierCode.toUpperCase()];
          const status = rec?.status || 'RUNNING';
          if (status === 'RUNNING') {
            const catItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === tierCode.toUpperCase());
            activeGhs += catItem?.capacityGhs || (tierCode === 'TS_TRIAL' ? 1.0 : 0);
          }
        }

        _cachedHashSpeed = activeGhs;
        _cachedIsPaused = activeGhs <= 0;
        _hashSpeedDirty = false;

        // Update state only if values actually changed (not on every tick)
        if (s.isPaused !== _cachedIsPaused || s.activeSpeedGhs !== _cachedHashSpeed) {
          set({ isPaused: _cachedIsPaused, activeSpeedGhs: _cachedHashSpeed });
        }

        return _cachedHashSpeed;
      } catch (e) {
        return s.baseSpeedGhs || 1.0;
      }
    },

    startDisplayTicker: () => {
      if (displayTicker) return;
      displayTicker = setInterval(() => {
        const s = get();

        // Real-time visual display projection for smooth 60fps odometer animation
        // NOTE: unclaimedBalance is strictly server-authoritative and is NEVER mutated by the ticker
        const activeSpeed = s.getActiveHashSpeed();
        let projectedDisplay = s.displayUnclaimed;
        if (activeSpeed > 0 && !s.isOverheated) {
          const ratePerSec = activeSpeed * s.coolerMultiplier * 0.001;
          const tickYield = ratePerSec * (TICK_MS / 1000);
          projectedDisplay = s.displayUnclaimed + tickYield;
        }

        const targetUnclaimed = Math.max(s.unclaimedBalance, projectedDisplay);
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

        // Single batched state update strictly for rendering/display values
        if (
          Math.abs(nextDisplayUnclaimed - s.displayUnclaimed) > 0.0000001 ||
          Math.abs(nextDisplayPromo - s.displayPromoOutput) > 0.0000001 ||
          Math.abs(nextDisplayMult - s.displayMultiplier) > 0.0001 ||
          nextCooldown !== s.cooldownRemaining ||
          nextOverheated !== s.isOverheated ||
          nextMultiplier !== s.coolerMultiplier
        ) {
          set({
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
      storage: debouncedStorage as any,
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrate displayUnclaimed safely from the authoritative server balance snapshot
          state.displayUnclaimed = state.unclaimedBalance || 0;
        }
      },
      partialize: (state) => ({
        activeCurrency: state.activeCurrency,
        baseSpeedGhs: state.baseSpeedGhs,
        unclaimedBalance: state.unclaimedBalance,
        displayUnclaimed: state.displayUnclaimed,
        lastMiningUpdatedAt: state.lastMiningUpdatedAt || Date.now(),
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
