import { api } from './api';
import { type PaymentOrderRecord } from './paymentOrderService';

export type DutyStatus = 'ACTIVE' | 'ON_CALL' | 'OFF_DUTY';

export interface TreasuryOperatorProfile {
  id: string;
  name: string;
  role: string;
  dutyStatus: DutyStatus;
  countryScope: string;
  verificationsCompletedCount: number;
  lastActiveAt: string;
}

export const treasuryOperatorService = {
  async getRoster(): Promise<TreasuryOperatorProfile[]> {
    try {
      const res = await api.get('/admin/treasury-operators/roster');
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      return [];
    } catch {
      return [];
    }
  },

  async setDutyStatus(dutyStatus: DutyStatus): Promise<TreasuryOperatorProfile> {
    const res = await api.post('/admin/treasury-operators/duty', { dutyStatus });
    return res.data?.data || res.data;
  },

  async getQueue(): Promise<PaymentOrderRecord[]> {
    try {
      const res = await api.get('/admin/treasury-operators/queue');
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      return [];
    } catch {
      return [];
    }
  },

  async verifyPaymentOrder(
    orderId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<PaymentOrderRecord> {
    const res = await api.post(`/admin/treasury-operators/verify/${orderId}`, { action, reason });
    return res.data?.data || res.data;
  },
};
