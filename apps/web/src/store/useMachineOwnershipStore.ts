import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MACHINE_CATALOG, type FrontendMachineModel } from '../data/machines';
import { machineService } from '../services/machineService';

export type LifecycleStage =
  | 'AVAILABLE'
  | 'PURCHASED'
  | 'DELIVERED'
  | 'INSTALLING'
  | 'INITIALIZING'
  | 'SYNCHRONIZING'
  | 'AWAITING_ACTIVATION'
  | 'RUNNING'
  | 'PAUSED'
  | 'RESTARTING'
  | 'UPDATING'
  | 'OFFLINE';

export interface OwnershipRecord {
  machineId: string;
  tierCode: string;
  nickname: string;
  serialNumber: string;
  status: 'RUNNING' | 'PAUSED' | 'MAINTENANCE';
  lifecycleStage: LifecycleStage;
  commissionedAt: string;
  activatedAt: string;
  lastSyncAt: string;
  runtimeSeconds: number;
  totalYieldEarned: number;
  certificateId: string;
  memoryTimeline: Array<{
    timestamp: string;
    event: string;
    description: string;
  }>;
}

interface MachineOwnershipState {
  ownerships: Record<string, OwnershipRecord>; // keyed by tierCode or machineId
  selectedMachineId: string | null;
  activeCeremonyTier: string | null; // tierCode currently undergoing unboxing/activation ceremony
  activeManualTier: string | null; // tierCode currently being viewed in Owner's Manual
  activeCertificateId: string | null; // machineId for certificate viewer
  
  // Actions
  initializeDefaultCore: () => void;
  getRecordByTier: (tierCode: string) => OwnershipRecord | null;
  setMachineNickname: (tierCode: string, nickname: string) => void;
  setMachineStatus: (tierCode: string, status: 'RUNNING' | 'PAUSED') => void;
  setLifecycleStage: (tierCode: string, stage: LifecycleStage) => void;
  startActivationCeremony: (tierCode: string) => void;
  closeActivationCeremony: () => void;
  completeActivation: (tierCode: string) => void;
  openOwnersManual: (tierCode: string) => void;
  closeOwnersManual: () => void;
  openCertificate: (machineId: string) => void;
  closeCertificate: () => void;
  addTimelineEvent: (tierCode: string, event: string, description: string) => void;
  syncWithUserMachines: (machines: any[]) => void;
  clearUnownedMachines: (ownedTierCodes: string[]) => void;
}

// Generate serial number based on tierCode and timestamp hash
const generateSerialNumber = (tierCode: string) => {
  const code = tierCode.replace('TS_', '');
  const randHex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `SN-TT-${code}-${randHex}`;
};

// Default Titan Core setup for baseline trial core
const DEFAULT_CORE_RECORD: OwnershipRecord = {
  machineId: 'core-trial-001',
  tierCode: 'TS_TRIAL',
  nickname: 'Titan Core Prime',
  serialNumber: 'SN-TT-TRIAL-0001',
  status: 'RUNNING',
  lifecycleStage: 'RUNNING',
  commissionedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  activatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  lastSyncAt: new Date().toISOString(),
  runtimeSeconds: 604800,
  totalYieldEarned: 14.0,
  certificateId: 'CERT-TS-TRIAL-0001',
  memoryTimeline: [
    {
      timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
      event: 'Commissioned',
      description: 'Titan Core baseline hashing node provisioned.',
    },
  ],
};

export const useMachineOwnershipStore = create<MachineOwnershipState>()(
  persist(
    (set, get) => ({
      ownerships: {
        TS_TRIAL: DEFAULT_CORE_RECORD,
      },
      selectedMachineId: 'core-trial-001',
      activeCeremonyTier: null,
      activeManualTier: null,
      activeCertificateId: null,

      initializeDefaultCore: () => {
        const { ownerships } = get();
        if (!ownerships['TS_TRIAL']) {
          set({
            ownerships: {
              ...ownerships,
              TS_TRIAL: DEFAULT_CORE_RECORD,
            },
          });
        }
      },

      syncWithUserMachines: (machines: any[]) => {
        if (!Array.isArray(machines)) return;
        const currentOwnerships = { ...get().ownerships };
        const newOwnerships: Record<string, OwnershipRecord> = {
          TS_TRIAL: currentOwnerships['TS_TRIAL'] || DEFAULT_CORE_RECORD,
        };

        for (const m of machines) {
          const norm = (m.tierCode || '').trim().toUpperCase();
          if (!norm) continue;

          if (currentOwnerships[norm]) {
            newOwnerships[norm] = {
              ...currentOwnerships[norm],
              status: m.status === 'PAUSED' ? 'PAUSED' : 'RUNNING',
              totalYieldEarned: m.lifetimeEarnings ?? currentOwnerships[norm].totalYieldEarned,
            };
          } else {
            const catalogItem = MACHINE_CATALOG.find((c) => c.tierCode.toUpperCase() === norm);
            newOwnerships[norm] = {
              machineId: m.id || `mch-${norm.toLowerCase()}-${Date.now()}`,
              tierCode: norm,
              nickname: m.name || catalogItem?.name || norm,
              serialNumber: generateSerialNumber(norm),
              status: m.status === 'PAUSED' ? 'PAUSED' : 'RUNNING',
              lifecycleStage: 'RUNNING',
              commissionedAt: m.purchasedAt || new Date().toISOString(),
              activatedAt: m.activatedAt || new Date().toISOString(),
              lastSyncAt: new Date().toISOString(),
              runtimeSeconds: 3600,
              totalYieldEarned: m.lifetimeEarnings || 0,
              certificateId: `CERT-${norm}-${Math.floor(1000 + Math.random() * 9000)}`,
              memoryTimeline: [
                {
                  timestamp: m.purchasedAt || new Date().toISOString(),
                  event: 'Commissioned',
                  description: `${m.name || catalogItem?.name || norm} operational node provisioned.`,
                },
              ],
            };
          }
        }

        set({ ownerships: newOwnerships });
      },

      clearUnownedMachines: (ownedTierCodes: string[]) => {
        const upperCodes = new Set((ownedTierCodes || []).map((c) => (c || '').trim().toUpperCase()));
        const filtered: Record<string, OwnershipRecord> = {};
        for (const [tier, rec] of Object.entries(get().ownerships)) {
          if (upperCodes.has(tier.toUpperCase())) {
            filtered[tier] = rec;
          }
        }
        set({ ownerships: filtered });
      },

      getRecordByTier: (tierCode: string) => {
        if (!tierCode) return null;
        const norm = tierCode.trim().toUpperCase();
        const record = get().ownerships[norm];
        if (record) return record;

        // Fallback for trial
        if (norm === 'TS_TRIAL') {
          return DEFAULT_CORE_RECORD;
        }

        return null;
      },

      setMachineNickname: (tierCode: string, nickname: string) => {
        const norm = tierCode.trim().toUpperCase();
        const existing = get().getRecordByTier(norm);
        if (!existing) return;

        const updated: OwnershipRecord = {
          ...existing,
          nickname,
          memoryTimeline: [
            {
              timestamp: new Date().toISOString(),
              event: 'Renamed',
              description: `Machine designation updated to "${nickname}".`,
            },
            ...existing.memoryTimeline,
          ],
        };

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: updated,
          },
        }));

        // Fire & forget sync to API backend if online
        machineService.updateMachineNickname(existing.machineId, nickname).catch(() => {});
      },

      setMachineStatus: (tierCode: string, status: 'RUNNING' | 'PAUSED') => {
        const norm = tierCode.trim().toUpperCase();
        const existing = get().getRecordByTier(norm);
        if (!existing) return;

        const updated: OwnershipRecord = {
          ...existing,
          status,
          lifecycleStage: status === 'RUNNING' ? 'RUNNING' : 'PAUSED',
          memoryTimeline: [
            {
              timestamp: new Date().toISOString(),
              event: status === 'RUNNING' ? 'Resumed' : 'Paused',
              description: status === 'RUNNING' ? 'Hasher reactivated by operator.' : 'Hashing state paused by operator.',
            },
            ...existing.memoryTimeline,
          ],
        };

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: updated,
          },
        }));

        try {
          const { useMiningStore } = require('./useMiningStore');
          useMiningStore.getState().syncMachineStatus();
        } catch (e) {
          // ignore fallback
        }

        machineService.toggleMachineControl(existing.machineId, status.toLowerCase() as any).catch(() => {});
      },

      setLifecycleStage: (tierCode: string, stage: LifecycleStage) => {
        const norm = tierCode.trim().toUpperCase();
        const existing = get().getRecordByTier(norm);
        if (!existing) return;

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: {
              ...existing,
              lifecycleStage: stage,
            },
          },
        }));
      },

      startActivationCeremony: (tierCode: string) => set({ activeCeremonyTier: tierCode }),
      closeActivationCeremony: () => set({ activeCeremonyTier: null }),

      completeActivation: (tierCode: string) => {
        const norm = tierCode.trim().toUpperCase();
        const existing = get().getRecordByTier(norm);
        if (!existing) return;

        const updated: OwnershipRecord = {
          ...existing,
          status: 'RUNNING',
          lifecycleStage: 'RUNNING',
          activatedAt: new Date().toISOString(),
          memoryTimeline: [
            {
              timestamp: new Date().toISOString(),
              event: 'Commissioning Ceremony Completed',
              description: 'All system checks verified. Hash rate generation online.',
            },
            ...existing.memoryTimeline,
          ],
        };

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: updated,
          },
          activeCeremonyTier: null,
        }));
      },

      openOwnersManual: (tierCode: string) => set({ activeManualTier: tierCode }),
      closeOwnersManual: () => set({ activeManualTier: null }),

      openCertificate: (machineId: string) => set({ activeCertificateId: machineId }),
      closeCertificate: () => set({ activeCertificateId: null }),

      addTimelineEvent: (tierCode: string, event: string, description: string) => {
        const norm = tierCode.trim().toUpperCase();
        const existing = get().getRecordByTier(norm);
        if (!existing) return;

        const updated: OwnershipRecord = {
          ...existing,
          memoryTimeline: [
            {
              timestamp: new Date().toISOString(),
              event,
              description,
            },
            ...existing.memoryTimeline,
          ],
        };

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: updated,
          },
        }));
      },

      registerPurchasedMachine: (tierCode: string, machineId?: string) => {
        const norm = tierCode.trim().toUpperCase();
        const catalogItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === norm) || MACHINE_CATALOG[1];
        const mId = machineId || `mch-${norm.toLowerCase()}-${Date.now()}`;

        const newRecord: OwnershipRecord = {
          machineId: mId,
          tierCode: catalogItem.tierCode,
          nickname: catalogItem.name,
          serialNumber: generateSerialNumber(catalogItem.tierCode),
          status: 'RUNNING',
          lifecycleStage: 'AWAITING_ACTIVATION',
          commissionedAt: new Date().toISOString(),
          activatedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          runtimeSeconds: 0,
          totalYieldEarned: 0,
          certificateId: `CERT-${norm}-${Math.floor(1000 + Math.random() * 9000)}`,
          memoryTimeline: [
            {
              timestamp: new Date().toISOString(),
              event: 'Acquired',
              description: `Payment confirmed. ${catalogItem.name} hardware node provisioned.`,
            },
          ],
        };

        set((state) => ({
          ownerships: {
            ...state.ownerships,
            [norm]: newRecord,
          },
          activeCeremonyTier: catalogItem.tierCode,
        }));

        return newRecord;
      },
    }),
    {
      name: 'titan_machine_ownership_v3',
    }
  )
);
