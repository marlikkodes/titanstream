import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/admin/AdminLayout';
import { MineScreen } from './pages/Mine';
import { FriendsScreen } from './pages/Friends';
import { BoostScreen } from './pages/Boost';
import { TreasuryScreen } from './pages/Treasury';
import { SplashScreen } from './pages/Splash';
import { WalletScreen } from './pages/Wallet/WalletScreen';
import { GrowthScreen } from './pages/Growth/GrowthScreen';
import { GrowScreen } from './pages/Grow/GrowScreen';
import { TitanHubScreen } from './pages/TitanHub/TitanHubScreen';
import { RewardsScreen } from './pages/Rewards/RewardsScreen';
import { ProfileScreen } from './pages/Profile/ProfileScreen';
import { MachineOwnersManualModal } from './pages/TitanHub/components/MachineOwnersManualModal';
import { MachineCertificateModal } from './pages/TitanHub/components/MachineCertificateModal';
import { DestinationLoader } from './components/DestinationLoader';

// Lazy-loaded Admin Pages (Code-split out of initial JS bundle)
const OverviewPage = lazy(() => import('./pages/admin/overview').then((m) => ({ default: m.OverviewPage })));
const OrdersPage = lazy(() => import('./pages/admin/orders').then((m) => ({ default: m.OrdersPage })));
const OperationsPage = lazy(() => import('./pages/admin/operations').then((m) => ({ default: m.OperationsPage })));
const OperationsHqPage = lazy(() => import('./pages/admin/operations-hq').then((m) => ({ default: m.OperationsHqPage })));
const IntelligencePage = lazy(() => import('./pages/admin/intelligence').then((m) => ({ default: m.IntelligencePage })));
const ReadinessPage = lazy(() => import('./pages/admin/readiness').then((m) => ({ default: m.ReadinessPage })));
const LiquidityPage = lazy(() => import('./pages/admin/liquidity').then((m) => ({ default: m.LiquidityPage })));
const TreasuryPage = lazy(() => import('./pages/admin/treasury').then((m) => ({ default: m.TreasuryPage })));
const FinancialControlCenterPage = lazy(() => import('./pages/admin/financial').then((m) => ({ default: m.FinancialControlCenterPage })));
const MachineControlCenterPage = lazy(() => import('./pages/admin/machines').then((m) => ({ default: m.MachineControlCenterPage })));
const PaymentRailsPage = lazy(() => import('./pages/admin/payment-rails').then((m) => ({ default: m.PaymentRailsPage })));
const WithdrawalsPage = lazy(() => import('./pages/admin/withdrawals').then((m) => ({ default: m.WithdrawalsPage })));
const UsersPage = lazy(() => import('./pages/admin/users').then((m) => ({ default: m.UsersPage })));
const AdminSupportPage = lazy(() => import('./pages/admin/support').then((m) => ({ default: m.AdminSupportPage })));
const GamesAdminPage = lazy(() => import('./pages/admin/games').then((m) => ({ default: m.GamesAdminPage })));
const RiskPage = lazy(() => import('./pages/admin/risk').then((m) => ({ default: m.RiskPage })));
const AutomationPage = lazy(() => import('./pages/admin/automation').then((m) => ({ default: m.AutomationPage })));
const RevenuePage = lazy(() => import('./pages/admin/revenue').then((m) => ({ default: m.RevenuePage })));
const NotificationsPage = lazy(() => import('./pages/admin/notifications').then((m) => ({ default: m.NotificationsPage })));
const AuditPage = lazy(() => import('./pages/admin/audit').then((m) => ({ default: m.AuditPage })));
const HealthPage = lazy(() => import('./pages/admin/health').then((m) => ({ default: m.HealthPage })));
const SettingsPage = lazy(() => import('./pages/admin/settings').then((m) => ({ default: m.SettingsPage })));
const GrowthAdminPage = lazy(() => import('./pages/admin/growth').then((m) => ({ default: m.GrowthAdminPage })));
const WhatsappAdminPage = lazy(() => import('./pages/admin/whatsapp').then((m) => ({ default: m.WhatsappAdminPage })));
const MerchantsAdminPage = lazy(() => import('./pages/admin/merchants').then((m) => ({ default: m.MerchantsAdminPage })));

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
import { useCountryStore, SUPPORTED_COUNTRIES } from './store/useCountryStore';
import { useSettingsStore } from './store/useSettingsStore';
import { AuthGate } from './components/AuthGate';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { CountrySelector } from './components/CountrySelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StepUpModal } from './components/StepUpModal';
import { ReferralLanding } from './pages/ReferralLanding';

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
        const { useQuestStore } = await import('./store/useQuestStore');
        useQuestStore.getState().checkDailyLoginStreak();
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

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const countrySelected = useAuthStore((s) => s.countrySelected);
  const setDetectedCountry = useAuthStore((s) => s.setDetectedCountry);
  const markCountrySelected = useAuthStore((s) => s.markCountrySelected);

  const { hasSelectedCountry, selectCountry } = useCountryStore();
  const { setCurrencyPreference } = useSettingsStore();

  const isCountrySet = countrySelected || hasSelectedCountry || localStorage.getItem('has_chosen_currency') === 'true';

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
            setCurrencyPreference(match.code !== 'US', match.name, match.currencyCode, match.currencySymbol, match.exchangeRate);
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

  // 1.5 Referral landing route (/ref/:code) - captured prior to auth gate
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
      <AuthGate>
        {/* 4. Onboarding overlay (new users) */}
        {!onboardingComplete ? (
          <OnboardingOverlay />
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
    </ErrorBoundary>
  );
}
