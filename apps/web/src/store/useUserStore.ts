import { create } from 'zustand';

interface UserState {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  languageCode: string;
  role: 'USER' | 'ADMIN';
  isAuthenticated: boolean;
  setUser: (user: Partial<UserState>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  id: '',
  username: '',
  firstName: '',
  lastName: '',
  languageCode: 'en',
  role: 'USER',
  isAuthenticated: false,
  setUser: (user) => set((state) => ({ ...state, ...user })),
}));
