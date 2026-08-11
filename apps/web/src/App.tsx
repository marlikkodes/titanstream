import { useState, useEffect } from 'react';
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
import { OverviewPage } from './pages/admin/overview';
import { OrdersPage } from './pages/admin/orders';
import { OperationsPage } from './pages/admin/operations';
import { LiquidityPage } from './pages/admin/liquidity';
import { TreasuryPage } from './pages/admin/treasury';
import { PaymentRailsPage } from './pages/admin/payment-rails';
import { WithdrawalsPage } from './pages/admin/withdrawals';
import { UsersPage } from './pages/admin/users';
import { RiskPage } from './pages/admin/risk';
import { AutomationPage } from './pages/admin/automation';
import { RevenuePage } from './pages/admin/revenue';
import { NotificationsPage } from './pages/admin/notifications';
import { AuditPage } from './pages/admin/audit';
import { HealthPage } from './pages/admin/health';
import { SettingsPage } from './pages/admin/settings';
import { AdminSupportPage } from './pages/admin/support';
import { GamesAdminPage } from './pages/admin/games';
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
import { FinancialControlCenterPage } from './pages/admin/financial';
import { MachineControlCenterPage } from './pages/admin/machines';
import { OperationsHqPage } from './pages/admin/operations-hq';
import { IntelligencePage } from './pages/admin/intelligence';
import { ReadinessPage } from './pages/admin/readiness';

// ─── Admin Routes (accessible without user auth) ─────────────────────────────

function AdminRoutes() {
  return (
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
      </Route>
    </Routes>
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

      {/* Global Hardware Modals */}
      <MachineOwnersManualModal />
      <MachineCertificateModal />

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
  }, [isAuthenticated, isCountrySet, setDetectedCountry, selectCountry, setCurrencyPreference, markCountrySelected]);

  // 1. Splash screen (always first)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 2. Admin routes bypass AuthGate entirely (operator access)
  const isAdminRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.includes('/admin') ||
    window.location.search.includes('admin=true')
  );
  if (isAdminRoute) {
    return <AdminRoutes />;
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
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="liquidity" element={<LiquidityPage />} />
              <Route path="treasury" element={<TreasuryPage />} />
              <Route path="financial" element={<FinancialControlCenterPage />} />
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
            </Route>
            <Route path="*" element={<MainApp />} />
          </Routes>
        )}
      </AuthGate>
    </ErrorBoundary>
  );
}
