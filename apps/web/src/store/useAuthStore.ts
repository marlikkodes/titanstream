import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerAuthFunctions } from '../services/api';
import type { PrimaryCurrency, AuthUser, AuthResponse, SessionData } from '../types/auth';

interface AuthState {
  _hasHydrated: boolean;
  isAuthenticated: boolean;
  session: SessionData | null;
  onboardingComplete: boolean;
  countrySelected: boolean;
  detectedCountryCode: string | null;
  locationDetected: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  stepUpToken: string | null;
  isStepUpModalOpen: boolean;
  isMirrorMode: boolean;
  mirrorTargetUser: AuthUser | null;

  setSession: (session: SessionData) => void;
  startMirrorSession: (
    user: AuthUser,
    metrics?: { balance?: number; crystalBalance?: number; speedGhs?: number }
  ) => void;
  exitMirrorSession: () => void;
  clearSession: () => void;
  isSessionExpired: () => boolean;
  refreshSession: (newExpiresAt: number) => void;
  updateTokens: (accessToken: string, refreshToken: string, expiresAt: number) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setStepUpToken: (token: string | null) => void;
  openStepUpModal: () => void;
  closeStepUpModal: () => void;
  markOnboardingComplete: () => void;
  markCountrySelected: () => void;
  setDetectedCountry: (code: string) => void;
  setLocationAndCurrency: (country: string, currency: PrimaryCurrency) => void;
}

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      isAuthenticated: false,
      session: null,
      onboardingComplete: false,
      countrySelected: false,
      detectedCountryCode: null,
      locationDetected: false,
      isAuthLoading: false,
      authError: null,
      stepUpToken: null,
      isStepUpModalOpen: false,
      isMirrorMode: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mirror_mode') === 'true',
      mirrorTargetUser: null,

      setSession: (session) => {
        localStorage.setItem('auth_token', session.accessToken);
        localStorage.setItem('refresh_token', session.refreshToken);
        const hasChosenCurrency = localStorage.getItem('has_chosen_currency') === 'true';
        const expiresAt = session.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000);
        set({
          isAuthenticated: true,
          session: {
            ...session,
            expiresAt,
          },
          onboardingComplete: session.onboarding?.isCompleted ?? !session.isNewUser,
          countrySelected: hasChosenCurrency,
          isAuthLoading: false,
          authError: null,
        });
      },

      startMirrorSession: (targetUser) => {
        // A client-side preview must never manufacture a user session or token.
        // Server-authorized impersonation, if introduced, needs its own audited API.
        set({
          isMirrorMode: false,
          mirrorTargetUser: null,
        });
      },

      exitMirrorSession: () => {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('mirror_mode');
          sessionStorage.removeItem('mirror_user');
        }
        set({
          isMirrorMode: false,
          mirrorTargetUser: null,
        });
      },

      clearSession: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('wallet-storage');
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('mirror_mode');
          sessionStorage.removeItem('mirror_user');
        }
        set({
          isAuthenticated: false,
          session: null,
          authError: null,
          stepUpToken: null,
          isStepUpModalOpen: false,
          isMirrorMode: false,
          mirrorTargetUser: null,
        });
      },

      isSessionExpired: () => {
        const { session } = get();
        if (!session || !session.accessToken) return true;
        if (!session.expiresAt || typeof session.expiresAt !== 'number') return false;
        return Date.now() > session.expiresAt;
      },

      refreshSession: (newExpiresAt) => {
        const { session } = get();
        if (session) {
          set({
            session: {
              ...session,
              expiresAt: newExpiresAt,
            },
          });
        }
      },

      updateTokens: (accessToken, refreshToken, expiresAt) => {
        const { session } = get();
        localStorage.setItem('auth_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        if (session) {
          set({
            isAuthenticated: true,
            session: {
              ...session,
              accessToken,
              refreshToken,
              expiresAt,
            },
          });
        }
      },

      setAuthLoading: (loading) => {
        set({ isAuthLoading: loading });
      },

      setAuthError: (error) => {
        set({ authError: error, isAuthLoading: false });
      },

      setStepUpToken: (token) => {
        set({ stepUpToken: token, isStepUpModalOpen: false });
      },

      openStepUpModal: () => {
        set({ isStepUpModalOpen: true });
      },

      closeStepUpModal: () => {
        set({ isStepUpModalOpen: false });
      },

      markOnboardingComplete: () => {
        set({ onboardingComplete: true });
      },

      markCountrySelected: () => {
        set({ countrySelected: true });
      },

      setDetectedCountry: (code: string) => {
        set({ detectedCountryCode: code, locationDetected: true });
      },

      setLocationAndCurrency: (country, currency) => {
        const { session } = get();
        if (session) {
          set({
            session: {
              ...session,
              country,
              currency,
            },
            locationDetected: true,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
        onboardingComplete: state.onboardingComplete,
        countrySelected: state.countrySelected,
        detectedCountryCode: state.detectedCountryCode,
        locationDetected: state.locationDetected,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
          if (state.session && (!state.session.accessToken || (state.session.expiresAt && Date.now() > state.session.expiresAt))) {
            state.isAuthenticated = false;
            state.session = null;
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
          }
          useAuthStore.setState({ _hasHydrated: true });
        }
      },
    },
  ),
);

// Register auth functions with the API client to break circular dependency
registerAuthFunctions({
  getAccessToken: () => localStorage.getItem('auth_token'),
  getAdminToken: () => localStorage.getItem('admin_auth_token'),
  getStepUpToken: () => useAuthStore.getState().stepUpToken,
  openStepUpModal: () => useAuthStore.getState().openStepUpModal(),
  updateTokens: (accessToken, refreshToken, expiresAt) => useAuthStore.getState().updateTokens(accessToken, refreshToken, expiresAt),
  clearSession: () => useAuthStore.getState().clearSession(),
});

export const handleSessionExpiry = () => {
  const authStore = useAuthStore.getState();
  if (authStore.isSessionExpired()) {
    authStore.clearSession();
    return true;
  }
  return false;
};

export const detectUserCountry = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('titan_cached_country_code');
    if (cached) return cached;
  }

  // Instant zero-network heuristic fallback based on Intl timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    let inferred = 'UG';
    if (tz.includes('Kampala') || tz.includes('Nairobi') || tz.includes('Africa/')) {
      inferred = tz.includes('Nairobi') ? 'KE' : 'UG';
      if (typeof window !== 'undefined') {
        localStorage.setItem('titan_cached_country_code', inferred);
      }
      return inferred;
    }
  } catch {}

  return 'UG';
};
