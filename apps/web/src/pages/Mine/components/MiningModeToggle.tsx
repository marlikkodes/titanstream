import type React from 'react';
import { useMiningStore } from '../../../store/useMiningStore';
import { useWalletStore } from '../../../store/useWalletStore';
import { Lock } from 'lucide-react';
import { showToast } from '../../../components/Toast';
import { useCountryStore } from '../../../store/useCountryStore';

export const MiningModeToggle: React.FC = () => {
  const { activeCurrency, toggleCurrency, btcUnlocked, btcPrice, unlockBTC } = useMiningStore();
  const { usdtBalance, updateBalance } = useWalletStore();
  const { getLocalAmount } = useCountryStore();

  return (
    <div className="flex items-center justify-center my-3">
      <div className="bg-control-bg p-1 rounded-full flex items-center gap-1 border border-border/40">
        <button
          onClick={() => toggleCurrency('USDT')}
          className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold press-feedback transition-all
            ${activeCurrency === 'USDT'
              ? 'bg-usdt-green text-app-bg shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
            }
          `}
        >
          <span className="w-4 h-4 rounded-full bg-app-bg/20 flex items-center justify-center font-bold text-[10px]">₮</span>
          USDT
        </button>

        <button
          onClick={() => {
            if (!btcUnlocked) {
              if (usdtBalance >= btcPrice) {
                updateBalance({ usdtBalance: usdtBalance - btcPrice });
                unlockBTC();
                toggleCurrency('BTC');
                showToast('BTC mode unlocked! You can now earn in BTC.', 'success');
              } else {
                showToast(`Not enough money in wallet. ${getLocalAmount(btcPrice)} needed to unlock BTC mode.`, 'error');
              }
            } else {
              toggleCurrency('BTC');
            }
          }}
          className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold press-feedback transition-all relative
            ${activeCurrency === 'BTC'
              ? 'bg-gradient-to-r from-gold to-amber-500 text-white shadow-sm'
              : btcUnlocked
              ? 'text-text-secondary hover:text-text-primary'
              : 'text-text-tertiary'
            }
          `}
        >
          {!btcUnlocked && (
            <div className="absolute -top-1 -right-1">
              <Lock size={10} className="text-gold" />
            </div>
          )}
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
            {btcUnlocked ? '₿' : <Lock size={10} />}
          </span>
          {btcUnlocked ? 'BTC' : (
            <span className="flex flex-col items-center leading-none">
              <span>PREMIUM</span>
              <span className="text-[8px] font-normal text-gold">{getLocalAmount(btcPrice)}</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
