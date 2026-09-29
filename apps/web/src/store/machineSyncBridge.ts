/**
 * Tiny bridge to avoid circular imports between useMiningStore and
 * useMachineOwnershipStore. Both stores register here after they finish
 * initializing; neither imports the other at module scope.
 */

type StoreAccessor = () => { getState: () => any } | null;
type SyncFn = () => void;

let ownershipAccessor: StoreAccessor | null = null;
let miningSync: SyncFn | null = null;

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
