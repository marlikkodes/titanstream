 import { create } from 'zustand';
import { useSettingsStore } from './useSettingsStore';

type TabId = 'wallet' | 'grow' | 'hub' | 'shop' | 'rewards';
type DeprecatedTabId = 'friends' | 'boost' | 'growth' | 'mine' | 'treasury' | 'profile';

// Mapping from old tab IDs to new tab IDs
const TAB_REDIRECTS: Record<DeprecatedTabId, TabId> = {
  friends: 'grow',
  boost: 'shop',
  growth: 'grow',
  mine: 'hub',
  treasury: 'rewards',
  profile: 'hub',
};

const getInitialTab = (): TabId => {
  if (typeof window !== 'undefined') {
    const autoOpen = useSettingsStore.getState().autoOpenHub;
    return autoOpen === false ? 'wallet' : 'hub';
  }
  return 'hub';
};

interface NavigationState {
  activeTab: TabId;
  showGames: boolean;
  selectedGameId: string | null;
  showShop: boolean;
  isProfileDrawerOpen: boolean;
  setActiveTab: (tab: TabId | DeprecatedTabId) => void;
  openGames: (gameId?: string) => void;
  closeGames: () => void;
  openShop: () => void;
  closeShop: () => void;
  openProfileDrawer: () => void;
  closeProfileDrawer: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: getInitialTab(),
  showGames: false,
  selectedGameId: null,
  showShop: false,
  isProfileDrawerOpen: false,
  setActiveTab: (tab) => {
    if (tab === 'profile') {
      set({ isProfileDrawerOpen: true, showGames: false, showShop: false });
      return;
    }
    // Handle redirect from deprecated tab IDs
    const mappedTab = (tab in TAB_REDIRECTS) ? TAB_REDIRECTS[tab as DeprecatedTabId] : tab as TabId;
    set({ activeTab: mappedTab, showGames: false, showShop: false, isProfileDrawerOpen: false });
  },
  openGames: (gameId?: string) => set({ showGames: true, selectedGameId: gameId ?? null }),
  closeGames: () => set({ showGames: false, selectedGameId: null }),
  openShop: () => set({ activeTab: 'shop', showShop: true }),
  closeShop: () => set({ showShop: false }),
  openProfileDrawer: () => set({ isProfileDrawerOpen: true }),
  closeProfileDrawer: () => set({ isProfileDrawerOpen: false }),
}));
