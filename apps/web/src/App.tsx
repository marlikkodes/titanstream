import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/admin/AdminLayout';
import { BoostScreen } from './pages/Boost';
import { SplashScreen } from './pages/Splash';
import { WalletScreen } from './pages/Wallet/WalletScreen';
import { GrowScreen } from './pages/Grow/GrowScreen';
import { TitanHubScreen } from './pages/TitanHub/TitanHubScreen';
import { RewardsScreen } from './pages/Rewards/RewardsScreen';
import { ProfileScreen } from './pages/Profile/ProfileScreen';
import { MachineOwnersManualModal } from './pages/TitanHub/components/MachineOwnersManualModal';
import { MachineCertificateModal } from './pages/TitanHub/components/MachineCertificateModal';
import { DestinationLoader } from './components/DestinationLoader';

// Resilient lazy loader with auto-retry and chunk recovery
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName?: string,
  retries = 2
) {
  return lazy(async () => {
    for (let i = 0; i <= retries; i++) {
      try {
        const module = await factory();
        const component = exportName ? (module[exportName] || module.default) : (module.default || Object.values(module)[0]);
        if (sessionStorage.getItem('retry-lazy-refreshed')) {
          sessionStorage.removeItem('retry-lazy-refreshed');
        }
        return { default: component };
      } catch (error: any) {
        if (i === retries) {
          const hasRefreshed = sessionStorage.getItem('retry-lazy-refreshed');
          if (!hasRefreshed) {
            sessionStorage.setItem('retry-lazy-refreshed', 'true');
            window.location.reload();
            return new Promise(() => {}); // prevent throw while reload starts
          }
          sessionStorage.removeItem('retry-lazy-refreshed');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
      }
    }
    return factory();
  });
}

// Lazy-loaded Admin Pages (Code-split with resilient chunk retry)
const OverviewPage = lazyWithRetry(() => import('./pages/admin/overview'), 'OverviewPage');
const OrdersPage = lazyWithRetry(() => import('./pages/admin/orders'), 'OrdersPage');
const OperationsPage = lazyWithRetry(() => import('./pages/admin/operations'), 'OperationsPage');
const OperationsHqPage = lazyWithRetry(() => import('./pages/admin/operations-hq'), 'OperationsHqPage');
const IntelligencePage = lazyWithRetry(() => import('./pages/admin/intelligence'), 'IntelligencePage');
const ReadinessPage = lazyWithRetry(() => import('./pages/admin/readiness'), 'ReadinessPage');
const LiquidityPage = lazyWithRetry(() => import('./pages/admin/liquidity'), 'LiquidityPage');
const TreasuryPage = lazyWithRetry(() => import('./pages/admin/treasury'), 'TreasuryPage');
const FinancialControlCenterPage = lazyWithRetry(() => import('./pages/admin/financial'), 'FinancialControlCenterPage');
const MachineControlCenterPage = lazyWithRetry(() => import('./pages/admin/machines'), 'MachineControlCenterPage');
const PaymentRailsPage = lazyWithRetry(() => import('./pages/admin/payment-rails'), 'PaymentRailsPage');
const WithdrawalsPage = lazyWithRetry(() => import('./pages/admin/withdrawals'), 'WithdrawalsPage');
const UsersPage = lazyWithRetry(() => import('./pages/admin/users'), 'UsersPage');
const AdminSupportPage = lazyWithRetry(() => import('./pages/admin/support'), 'AdminSupportPage');
const GamesAdminPage = lazyWithRetry(() => import('./pages/admin/games'), 'GamesAdminPage');
const RiskPage = lazyWithRetry(() => import('./pages/admin/risk'), 'RiskPage');
const AutomationPage = lazyWithRetry(() => import('./pages/admin/automation'), 'AutomationPage');
const RevenuePage = lazyWithRetry(() => import('./pages/admin/revenue'), 'RevenuePage');
const NotificationsPage = lazyWithRetry(() => import('./pages/admin/notifications'), 'NotificationsPage');
const AuditPage = lazyWithRetry(() => import('./pages/admin/audit'), 'AuditPage');
const HealthPage = lazyWithRetry(() => import('./pages/admin/health'), 'HealthPage');
const SettingsPage = lazyWithRetry(() => import('./pages/admin/settings'), 'SettingsPage');
const GrowthAdminPage = lazyWithRetry(() => import('./pages/admin/growth'), 'GrowthAdminPage');
const WhatsappAdminPage = lazyWithRetry(() => import('./pages/admin/whatsapp'), 'WhatsappAdminPage');
const MerchantsAdminPage = lazyWithRetry(() => import('./pages/admin/merchants'), 'MerchantsAdminPage');

import { useNavigationStore } from './store/useNavigationStore';
import { useMissionRunnerStore } from './store/useMissionRunnerStore';
import { useMiningStore } from './store/useMiningStore';
import { useWalletStore } from './store/useWalletStore';
import { useTreasuryStore } from './store/useTreasuryStore';
import { useOnboardingStore } from './store/useOnboardingStore';
import { MissionRunner } from './components/rewards/MissionRunner';
import { ClaimSuccessModal } from './components/rewards/ClaimSuccessModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import type { MissionItem } from './services/growthService';
import { useAuthStore, detectUserCountry } from './store/useAuthStore';
import { supportsLocalPaymentRails, useCountryStore, SUPPORTED_COUNTRIES } from './store/useCountryStore';
import { useSettingsStore } from './store/useSettingsStore';
import { AuthGate } from './components/AuthGate';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { CountrySelector } from './components/CountrySelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StepUpModal } from './components/StepUpModal';
import { ReferralLanding } from './pages/ReferralLanding';
import { CloudServices } from './pages/CloudServices';
import { LegalModal } from './components/legal/LegalModal';
import { CookieConsentBanner } from './components/legal/CookieConsentBanner';
import { PreAuthOnboarding } from './components/PreAuthOnboarding';
import { hasSeenPreAuthOnboarding } from './utils/preAuthOnboarding';
import { getAccountSetup } from './services/accountSetupService';
import type { AccountSetupState } from './services/accountSetupService';

// ─── Admin Routes (accessible without user auth) ─────────────────────────────

function AdminRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DestinationLoader destination="wallet" />}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="operations-hq" element={<OperationsHqPage />} />
            <Route path="intelligence" element={<IntelligencePage />} />
            <Route path="readiness" element={<ReadinessPage />} />
            <Route path="liquidity" element={<LiquidityPage />} />
            <Route path="treasury" element={<TreasuryPage />} />
            <Route path="financial" element={<FinancialControlCenterPage />} />
            <Route path="machines" element={<MachineControlCenterPage />} />
            <Route path="payment-rails" element={<PaymentRailsPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="games" element={<GamesAdminPage />} />
            <Route path="risk" element={<RiskPage />} />
            <Route path="automation" element={<AutomationPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="growth" element={<GrowthAdminPage />} />
            <Route path="whatsapp" element={<WhatsappAdminPage />} />
            <Route path="merchants" element={<MerchantsAdminPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// ─── Main App (fully authenticated + onboarded) ───────────────────────────────

function MainApp() {
  const { activeTab, isProfileDrawerOpen, closeProfileDrawer } = useNavigationStore();
  const { runningMission, closeRunner } = useMissionRunnerStore();
  const [runnerClaimed, setRunnerClaimed] = useState<MissionItem | null>(null);
  
  // Onboarding flow
  const { currentStep, hasMadeFirstDeposit, hasAddedToHomescreen, completeAddToHomescreen } = useOnboardingStore();
  const [showPWAInstall, setShowPWAInstall] = useState(false);

  // Single unified mining state synchronizer. The mining engine owns all
  // earnings; this loop only renders what the backend publishes.
  useEffect(() => {
    const syncState = async () => {
      try {
        await Promise.all([
          useWalletStore.getState().fetchBalanceFromEngine(),
          useMiningStore.getState().fetchMiningState(),
          useTreasuryStore.getState().fetchTreasuryState(),
        ]);
      } catch (err) {
        console.warn('[SYNC] Periodic background synchronization notice:', err);
      }
    };

    useMiningStore.getState().startDisplayTicker();
    syncState();

    const interval = setInterval(syncState, 30000);
    return () => {
      clearInterval(interval);
      useMiningStore.getState().stopDisplayTicker();
    };
  }, []);

  // Show PWA install prompt after first deposit
  useEffect(() => {
    if (hasMadeFirstDeposit && !hasAddedToHomescreen && currentStep === 'add_to_homescreen') {
      // Small delay to let the user see their deposit success first
      const timer = setTimeout(() => {
        setShowPWAInstall(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasMadeFirstDeposit, hasAddedToHomescreen, currentStep]);

  const handlePWAInstallComplete = () => {
    completeAddToHomescreen();
    setShowPWAInstall(false);
  };

  return (
    <MainLayout>
      <div className="w-full h-full relative">
        <div className={activeTab === 'wallet' ? 'block' : 'hidden'}>
          <WalletScreen />
        </div>
        <div className={activeTab === 'grow' ? 'block' : 'hidden'}>
          <GrowScreen />
        </div>
        <div className={activeTab === 'hub' ? 'block' : 'hidden'}>
          <TitanHubScreen />
        </div>
        <div className={activeTab === 'shop' ? 'block' : 'hidden'}>
          <BoostScreen />
        </div>
        <div className={activeTab === 'rewards' ? 'block' : 'hidden'}>
          <RewardsScreen />
        </div>
      </div>

      {/* Global Hardware & Security Modals */}
      <MachineOwnersManualModal />
      <MachineCertificateModal />
      <StepUpModal />

      {/* Profile Slide-Over Drawer */}
      <AnimatePresence>
        {isProfileDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: '0%' }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-[#090b10] shadow-2xl"
          >
            <ProfileScreen isDrawer={true} onClose={closeProfileDrawer} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mission Runner — floats above all tabs while escorting the user */}
      <MissionRunner
        mission={runningMission}
        isOpen={!!runningMission}
        onClose={closeRunner}
        onClaimed={(reward) => setRunnerClaimed(reward)}
      />
      <ClaimSuccessModal
        reward={runnerClaimed}
        isOpen={!!runnerClaimed}
        onClose={() => setRunnerClaimed(null)}
      />

      {/* PWA Install Prompt - 3rd onboarding step after first deposit */}
      <PWAInstallPrompt
        isOpen={showPWAInstall}
        onClose={() => setShowPWAInstall(false)}
        onInstall={handlePWAInstallComplete}
        isInstalled={hasAddedToHomescreen}
      />
    </MainLayout>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showPreAuthOnboarding, setShowPreAuthOnboarding] = useState(() => !hasSeenPreAuthOnboarding());

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const countrySelected = useAuthStore((s) => s.countrySelected);
  const setDetectedCountry = useAuthStore((s) => s.setDetectedCountry);
  const markCountrySelected = useAuthStore((s) => s.markCountrySelected);

  const { hasSelectedCountry, selectCountry } = useCountryStore();
  const { setCurrencyPreference } = useSettingsStore();

  const isCountrySet = countrySelected || hasSelectedCountry || localStorage.getItem('has_chosen_currency') === 'true';

  // Backend-authoritative Account Setup state. When the server reports setup
  // incomplete, the onboarding overlay resumes at Personalization — even for
  // users whose local onboarding flag is already true (existing users).
  // Fail-open (null): a transient fetch failure never blocks the product.
  // The snapshot is passed to the overlay so login costs a single GET.
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [setupSnapshot, setSetupSnapshot] = useState<AccountSetupState | null>(null);
  useEffect(() => {
    if (!isAuthenticated) {
      setSetupCompleted(null);
      setSetupSnapshot(null);
      return;
    }
    let cancelled = false;
    getAccountSetup()
      .then((state) => {
        if (cancelled) return;
        setSetupCompleted(state.completed);
        setSetupSnapshot(state);
      })
      .catch(() => {
        if (cancelled) return;
        setSetupCompleted(null);
        setSetupSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Fetch backend preferences & apply root styles
  useEffect(() => {
    useSettingsStore.getState().applyStyles();
    if (isAuthenticated) {
      useSettingsStore.getState().fetchPreferences();
    }
  }, [isAuthenticated]);

  // IP-based country detection on first auth
  useEffect(() => {
    if (isAuthenticated && !isCountrySet) {
      detectUserCountry().then((code) => {
        if (code) {
          setDetectedCountry(code);
          const match = SUPPORTED_COUNTRIES.find((c) => c.code === code || (code === 'EU' && c.code === 'EU'));
          if (match) {
            selectCountry(match.code);
            setCurrencyPreference(supportsLocalPaymentRails(match.code), match.name, match.currencyCode, match.currencySymbol, match.exchangeRate);
            markCountrySelected();
            localStorage.setItem('has_chosen_currency', 'true');
          }
        }
      });
    }
  }, [isAuthenticated, isCountrySet]);

  // 1. Splash screen (always first)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Public marketing landing page. The site root is public by default; the
  // explicit onboarding query is reserved for the login flow's CTA.
  const isLandingRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/' ||
    window.location.pathname === '/home' ||
    window.location.pathname === '/cloud-services'
  ) && new URLSearchParams(window.location.search).get('onboarding') !== 'true';
  if (isLandingRoute) {
    return (
      <ErrorBoundary>
        <CloudServices />
      </ErrorBoundary>
    );
  }

  // 1.6 Referral landing route (/ref/:code) - captured prior to auth gate
  const isRefRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/ref/');
  if (isRefRoute) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/ref/:code" element={<ReferralLanding />} />
          <Route path="*" element={<ReferralLanding />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  // 2. Admin routes bypass AuthGate entirely (operator access)
  const isAdminRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.includes('/admin') ||
    window.location.search.includes('admin=true')
  );
  if (isAdminRoute) {
    return (
      <ErrorBoundary>
        <AdminRoutes />
      </ErrorBoundary>
    );
  }

  // 3. AuthGate wraps the entire authenticated experience.
  //    It handles: loading, error, web widget, mini app auth.
  //    Only renders children when auth is confirmed.
  return (
    <ErrorBoundary>
      {!isAuthenticated && showPreAuthOnboarding && (
        <PreAuthOnboarding onComplete={() => setShowPreAuthOnboarding(false)} />
      )}
      <AuthGate>
        {/* 4. Onboarding overlay (new users) + Personalization resume (incomplete setup) */}
        {!onboardingComplete || setupCompleted === false ? (
          <OnboardingOverlay
            startAtPersonalization={onboardingComplete === true}
            initialSetup={setupSnapshot}
            onComplete={() => setSetupCompleted(true)}
          />
        ) : !isCountrySet ? (
          /* 5. Country selection (once after onboarding) */
          <CountrySelector
            onComplete={() => {
              markCountrySelected();
              localStorage.setItem('has_chosen_currency', 'true');
            }}
          />
        ) : (
          /* 6. Fully authenticated, onboarded, country set → full app */
          <Routes>
            <Route path="/admin/*" element={<AdminRoutes />} />
            <Route path="*" element={<MainApp />} />
          </Routes>
        )}
      </AuthGate>
      {/* Global Legal & Privacy Components */}
      <LegalModal />
      <CookieConsentBanner />
    </ErrorBoundary>
  );
}
