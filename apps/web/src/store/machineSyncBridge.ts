/**
 * Tiny bridge to avoid circular imports between useMiningStore,
 * useMachineOwnershipStore, and useWalletStore. Stores register here
 * after they finish initializing; none import others at module scope.
 */

type StoreAccessor = () => { getState: () => any } | null;
type SyncFn = () => void;
type FetchBalanceFn = () => Promise<void>;
type UpdateBalanceFn = (updates: any) => void;

let ownershipAccessor: StoreAccessor | null = null;
let miningSync: SyncFn | null = null;
let walletFetchBalance: FetchBalanceFn | null = null;
let walletUpdateBalance: UpdateBalanceFn | null = null;

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
