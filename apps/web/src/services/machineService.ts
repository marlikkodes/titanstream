import { api } from './api';

export interface MachineTier {
  tierCode: string;
  name: string;
  priceUsdt: number;
  capacityGhs: number;
  powerRatingW: number;
  description: string;
  dailyYieldEstimateUsdt: number;
  isPopular?: boolean;
}

export interface UserMachineAsset {
  id: string;
  telegramUserId: string;
  tierCode: string;
  name: string;
  purchasePrice: number;
  currency: string;
  status: 'CREATED' | 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'MAINTENANCE' | 'RETIRED';
  capacityGhs: number;
  lifetimeEarnings: number;
  purchasedAt: string;
  activatedAt: string;
}

export interface PurchaseMachineResult {
  success: boolean;
  requiresFunding: boolean;
  missingAmountUsdt?: number;
  paymentOrder?: any;
  machine?: UserMachineAsset;
  message: string;
}

export const machineService = {
  async getCatalog(): Promise<MachineTier[]> {
    try {
      const res = await api.get('/machines/catalog');
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async getMyMachines(): Promise<UserMachineAsset[]> {
    try {
      const res = await api.get('/machines/my');
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async purchaseMachine(tierCode: string): Promise<PurchaseMachineResult> {
    const idempotencyKey = crypto.randomUUID();
    const res = await api.post('/machines/purchase', { tierCode }, { headers: { 'x-idempotency-key': idempotencyKey } });
    return res.data.data;
  },

  async updateMachineNickname(machineId: string, nickname: string): Promise<any> {
    try {
      const res = await api.post(`/machines/${machineId}/nickname`, { nickname });
      return res.data.data;
    } catch {
      return { success: true, localOnly: true };
    }
  },

  async toggleMachineControl(machineId: string, action: 'start' | 'pause' | 'restart'): Promise<any> {
    try {
      const res = await api.post(`/machines/${machineId}/control`, { action });
      return res.data.data;
    } catch {
      return { success: true, localOnly: true };
    }
  },

  async getOwnershipCertificate(machineId: string): Promise<any> {
    try {
      const res = await api.get(`/machines/${machineId}/certificate`);
      return res.data.data;
    } catch {
      return null;
    }
  },
};
