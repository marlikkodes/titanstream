import { api } from './api';

export interface AdminWithdrawalRecord {
  id: string;
  telegramUserId: string;
  userId: string;
  sessionType: 'PAYOUT' | 'DEPOSIT';
  requestedAmount: string;
  expectedCryptoAmount: string;
  feeAmount: string;
  netPayoutAmount: string;
  fiatCurrency: string;
  status:
    | 'CREATED'
    | 'PAYOUT_CLAIMED'
    | 'PAYOUT_EXECUTED'
    | 'PAYOUT_PROOF_SUBMITTED'
    | 'SETTLED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'EXPIRED';
  assignedAdminId?: string;
  claimTimestamp?: string;
  executedTimestamp?: string;
  settledTimestamp?: string;
  operatorNotes?: string;
  rejectionReason?: string;
  networkTxId?: string;
  proofDocumentUrl?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    telegramUsername?: string;
    firstName?: string;
    phoneNumber?: string;
    verifiedUsdtAddress?: string;
  };
}

export interface AdminWithdrawalListResponse {
  items: AdminWithdrawalRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface PayoutInstructions {
  sessionId: string;
  telegramUserId: string;
  requestedAmountUsdt: number;
  feeAmountUsdt: number;
  netPayoutUsdt: number;
  fiatCurrency: string;
  paymentMethod: string;
  destinationAddress: string;
  phoneNumber?: string;
  ussdPushString?: string;
  qrCodeData?: string;
}

export const adminWithdrawalService = {
  async listWithdrawals(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminWithdrawalListResponse> {
    const res = await api.get('/admin/withdrawals', { params });
    return res.data;
  },

  async getPayoutInstructions(id: string): Promise<PayoutInstructions> {
    const res = await api.get(`/admin/withdrawals/${id}/payout-instructions`);
    return res.data?.data ?? res.data;
  },

  async claimWithdrawal(id: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/claim`);
    return res.data?.data ?? res.data;
  },

  async markExecuted(id: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/mark-executed`);
    return res.data?.data ?? res.data;
  },

  async submitProof(
    id: string,
    dto: {
      proofReference?: string;
      txHash?: string;
      actualAmountSent?: number;
      network?: string;
      destinationAddress?: string;
      notes?: string;
    },
  ): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/submit-proof`, dto);
    return res.data?.data ?? res.data;
  },

  async verifyAndSettle(id: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/verify-and-settle`);
    return res.data?.data ?? res.data;
  },

  async approveWithdrawal(id: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/approve`);
    return res.data?.data ?? res.data;
  },

  async rejectWithdrawal(id: string, reason?: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/reject`, { reason });
    return res.data?.data ?? res.data;
  },

  async retryPayout(id: string): Promise<AdminWithdrawalRecord> {
    const res = await api.post(`/admin/withdrawals/${id}/retry`);
    return res.data?.data ?? res.data;
  },
};
