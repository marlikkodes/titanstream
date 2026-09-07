import { create } from 'zustand';

export type LegalTab = 'terms' | 'privacy' | 'refund' | 'cookies' | 'business';

interface LegalModalState {
  isOpen: boolean;
  activeTab: LegalTab;
  openLegalModal: (tab?: LegalTab) => void;
  closeLegalModal: () => void;
  setActiveTab: (tab: LegalTab) => void;
}

export const useLegalModalStore = create<LegalModalState>((set) => ({
  isOpen: false,
  activeTab: 'terms',
  openLegalModal: (tab = 'terms') => set({ isOpen: true, activeTab: tab }),
  closeLegalModal: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
