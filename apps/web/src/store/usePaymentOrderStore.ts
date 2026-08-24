import { create } from 'zustand';
import { paymentOrderService, type PaymentOrderRecord, type CreatePaymentOrderPayload } from '../services/paymentOrderService';

interface PaymentOrderState {
  activeOrder: PaymentOrderRecord | null;
  myOrders: PaymentOrderRecord[];
  isLoading: boolean;
  error: string | null;

  createOrder: (payload: CreatePaymentOrderPayload) => Promise<PaymentOrderRecord | null>;
  fetchMyOrders: () => Promise<void>;
  submitForVerification: (orderId: string) => Promise<boolean>;
  clearActiveOrder: () => void;
}

export const usePaymentOrderStore = create<PaymentOrderState>((set, get) => ({
  activeOrder: null,
  myOrders: [],
  isLoading: false,
  error: null,

  createOrder: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const order = await paymentOrderService.createOrder(payload);
      set({ activeOrder: order, isLoading: false });
      return order;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create payment order';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  fetchMyOrders: async () => {
    set({ isLoading: true });
    try {
      const res = await paymentOrderService.getMyOrders();
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
      set({ myOrders: list, isLoading: false });
    } catch (err) {
      set({ myOrders: [], isLoading: false });
    }
  },

  submitForVerification: async (orderId) => {
    set({ isLoading: true });
    try {
      const updated = await paymentOrderService.submitForVerification(orderId);
      set((state) => ({
        activeOrder: state.activeOrder?.id === orderId ? updated : state.activeOrder,
        myOrders: state.myOrders.map((o) => (o.id === orderId ? updated : o)),
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ isLoading: false });
      return false;
    }
  },

  clearActiveOrder: () => set({ activeOrder: null }),
}));
