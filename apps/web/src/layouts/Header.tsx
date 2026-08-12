import type React from 'react';
import { useState } from 'react';
import { Gamepad2, HelpCircle, LogOut, Bell } from 'lucide-react';
import { useWalletStore } from '../store/useWalletStore';
import { useNavigationStore } from '../store/useNavigationStore';
import { HelpModal } from '../components/HelpModal';
import { useUserNotificationStore } from '../store/useUserNotificationStore';
import { useTelegram } from '../context/TelegramContext';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCountryStore } from '../store/useCountryStore';
import { formatAdaptiveCounter } from '../utils/format';

export const Header: React.FC = () => {
  const { usdtBalance, crystalsBalance } = useWalletStore();
  const { openGames, setActiveTab, openProfileDrawer } = useNavigationStore();
  const { hapticFeedback, logout, user } = useTelegram();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const { unreadCount, setModalOpen } = useUserNotificationStore();
  const { preferLocalCurrency, setCurrencyPreference, selectedCryptoCurrency, setCryptoCurrency } = useSettingsStore();
  const { selectedCountry } = useCountryStore();

  const handleToggleCurrency = () => {
    hapticFeedback.impactOccurred('light');
    if (!selectedCountry || selectedCountry.code === 'US') return;

    if (preferLocalCurrency) {
      // Switch back to USDT
      setCurrencyPreference(false, 'United States', 'USDT', '₮', 1.0);
    } else {
      // Switch to local currency from country store
      setCurrencyPreference(
        true,
        selectedCountry.name,
        selectedCountry.currencyCode,
        selectedCountry.currencySymbol,
        selectedCountry.exchangeRate
      );
    }
  };

  const handleToggleCrypto = () => {
    hapticFeedback.impactOccurred('light');
    setCryptoCurrency(selectedCryptoCurrency === 'USDT' ? 'TON' : 'USDT');
  };

  // Format balance based on preference safely
  const displayBalance = () => {
    const safeUsdt = Number(usdtBalance) || 0;
    try {
      if (preferLocalCurrency && selectedCountry && selectedCountry.code !== 'US') {
        const rate = Number(selectedCountry.exchangeRate) || 1;
        const localVal = safeUsdt * rate;
        return {
          value: formatAdaptiveCounter(localVal),
          symbol: selectedCountry.currencySymbol || 'USh',
          flag: selectedCountry.flag || '🇺🇬',
        };
      }
    } catch (err) {
      console.warn('[HEADER] displayBalance formatting error:', err);
    }
    
    // Convert to TON if selected
    if (selectedCryptoCurrency === 'TON') {
      const tonValue = safeUsdt / 5.5; // TON exchange rate
      return {
        value: formatAdaptiveCounter(tonValue),
        symbol: 'TON',
        flag: '💎',
      };
    }
    
    return {
      value: formatAdaptiveCounter(safeUsdt),
      symbol: 'USDT',
      flag: '🇺🇸',
    };
  };

  const balance = displayBalance();

  return (
    <header className="h-[56px] px-4 flex items-center justify-between glass-header sticky top-0 z-30 select-none">
      {/* Balances container */}
      <div className="flex items-center gap-2">
        {/* Balance capsule - opens Wallet screen */}
        <button
          onClick={() => setActiveTab('wallet')}
          className="press-feedback flex items-center gap-1.5 bg-control-bg/70 border border-white/10 hover:border-usdt-green/40 rounded-full px-3 py-1.5 shadow-sm transition-colors"
          title="View Your Wallet"
        >
          <div className="w-5 h-5 rounded-full bg-usdt-green flex items-center justify-center font-extrabold text-[11px] text-app-bg shadow-sm">
            {preferLocalCurrency && selectedCountry ? selectedCountry.currencySymbol.charAt(0) : '₮'}
          </div>
          <span className="text-xs font-extrabold text-text-primary tracking-tight font-mono">
            {balance.value}
          </span>
          <span className="text-[9px] font-bold text-text-tertiary font-mono">
            {preferLocalCurrency && selectedCountry && selectedCountry.code !== 'US'
              ? selectedCountry.currencyCode
              : 'USDT'}
          </span>
        </button>

        {/* Crystals Balance capsule */}
        <div className="flex items-center gap-1.5 bg-control-bg/70 border border-white/10 rounded-full px-3 py-1.5 shadow-sm">
          <div className="w-4 h-4 flex items-center justify-center text-crystals-blue font-bold text-xs">
            💎
          </div>
          <span className="text-xs font-extrabold text-text-primary font-mono">
            {crystalsBalance}
          </span>
        </div>
      </div>

        {/* User Notification Bell button */}
        <button
          onClick={() => {
            hapticFeedback.impactOccurred('light');
            setModalOpen(true);
          }}
          className="press-feedback w-9 h-9 rounded-full bg-control-bg/70 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary shadow-sm relative"
          title="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white font-mono font-bold text-[9px] flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Games button */}
        <button
          onClick={openGames}
          className="press-feedback w-9 h-9 rounded-full bg-control-bg/70 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary shadow-sm"
          title="Games"
        >
          <Gamepad2 size={18} />
        </button>

        {/* Help button */}
        <button
          onClick={() => {
            hapticFeedback.impactOccurred('light');
            setIsHelpModalOpen(true);
          }}
          className="press-feedback w-9 h-9 rounded-full bg-control-bg/70 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary shadow-sm"
          title="Help"
        >
          <HelpCircle size={18} />
        </button>

        {/* Currency preference toggle — shows flag of active currency */}
        {selectedCountry && selectedCountry.code !== 'US' && (
          <button
            onClick={handleToggleCurrency}
            className={`press-feedback w-9 h-9 rounded-full border flex flex-col items-center justify-center text-sm shadow-sm font-bold font-mono relative group transition-all ${
              preferLocalCurrency
                ? 'bg-usdt-green/10 border-usdt-green/30'
                : 'bg-control-bg/70 border-white/10'
            }`}
            title={`Switch to ${preferLocalCurrency ? 'USDT' : selectedCountry.currencyCode}`}
          >
            <span className="text-[14px] leading-none">
              {preferLocalCurrency ? selectedCountry.flag : '🇺🇸'}
            </span>
            <span className={`text-[7px] font-extrabold leading-none -mt-0.5 ${
              preferLocalCurrency ? 'text-usdt-green' : 'text-text-tertiary'
            }`}>
              {preferLocalCurrency ? selectedCountry.currencyCode : 'USDT'}
            </span>
          </button>
        )}

        {/* Avatar Profile Drawer Button */}
        <button
          onClick={() => {
            hapticFeedback.impactOccurred('light');
            openProfileDrawer();
          }}
          className="press-feedback flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-gold/30 to-purple-500/30 border border-gold/40 text-gold font-black text-xs shadow-sm hover:border-gold transition-colors"
          title="Operator Profile"
        >
          {user?.first_name ? user.first_name[0].toUpperCase() : 'T'}
        </button>

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </header>
  );
};
