/**
 * Bridge to avoid circular imports between all Zustand stores.
 * Stores register their accessors here after they finish initializing;
 * none import others at module scope. This prevents TDZ errors during
 * module initialization.
 */

type StoreAccessor = () => { getState: () => any } | null;
type SyncFn = () => void;
type FetchBalanceFn = () => Promise<void>;
type UpdateBalanceFn = (updates: any) => void;

// Mining/Ownership bridge
let ownershipAccessor: StoreAccessor | null = null;
let miningSync: SyncFn | null = null;

// Wallet bridge
let walletFetchBalance: FetchBalanceFn | null = null;
let walletUpdateBalance: UpdateBalanceFn | null = null;

// Generic store bridge for all other cross-store calls
interface StoreRegistry {
  [key: string]: StoreAccessor;
}
const storeRegistry: StoreRegistry = {};

// Mining/Ownership functions
export function registerOwnershipAccessor(accessor: StoreAccessor) {
  ownershipAccessor = accessor;
}

export function getOwnershipStoreSafe() {
  try {
    return ownershipAccessor?.() ?? null;
  } catch {
    return null;
  }
}

export function registerMiningSync(fn: SyncFn) {
  miningSync = fn;
}

export function notifyMiningSync() {
  try {
    miningSync?.();
  } catch {
    // ownership actions can fire before mining has registered
  }
}

// Wallet functions
export function registerWalletAccessors(fetchFn: FetchBalanceFn, updateFn: UpdateBalanceFn) {
  walletFetchBalance = fetchFn;
  walletUpdateBalance = updateFn;
}

export async function fetchWalletBalanceSafe() {
  try {
    await walletFetchBalance?.();
  } catch {
    // wallet may not be registered yet
  }
}

export function updateWalletBalanceSafe(updates: any) {
  try {
    walletUpdateBalance?.(updates);
  } catch {
    // wallet may not be registered yet
  }
}

// Generic store functions
export function registerStoreAccessor(storeName: string, accessor: StoreAccessor) {
  storeRegistry[storeName] = accessor;
}

export function getStoreSafe(storeName: string) {
  try {
    return storeRegistry[storeName]?.() ?? null;
  } catch {
    return null;
  }
}

export function callStoreMethodSafe(storeName: string, methodName: string, ...args: any[]) {
  try {
    const store = getStoreSafe(storeName);
    if (store && typeof store.getState()[methodName] === 'function') {
      return store.getState()[methodName](...args);
    }
    return null;
  } catch {
    return null;
  }
}
