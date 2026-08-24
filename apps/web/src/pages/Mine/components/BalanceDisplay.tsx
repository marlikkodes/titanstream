import React from 'react';
import { useMiningStore } from '../../../store/useMiningStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useCountryStore } from '../../../store/useCountryStore';
import { formatAdaptiveCounter } from '../../../utils/format';

import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { MACHINE_CATALOG } from '../../../data/machines';

export const BalanceDisplay: React.FC = () => {
  const activeCurrency = useMiningStore((s) => s.activeCurrency);
  const displayMultiplier = useMiningStore((s) => s.displayMultiplier);
  const displayUnclaimed = useMiningStore((s) => s.displayUnclaimed);
  const ownedTierCodes = useMiningStore((s) => s.ownedTierCodes);
  const ownerships = useMachineOwnershipStore((s) => s.ownerships);

  const { preferLocalCurrency } = useSettingsStore();
  const { selectedCountry } = useCountryStore();

  const safeOwned = Array.isArray(ownedTierCodes) ? ownedTierCodes : ['TS_TRIAL'];
  let activeSpeed = 0;
  for (const code of safeOwned) {
    const norm = (code || '').toUpperCase();
    const rec = ownerships[norm] || (norm === 'TS_TRIAL' ? useMachineOwnershipStore.getState().getRecordByTier('TS_TRIAL') : null);
    if (rec?.status === 'RUNNING' || (!rec && norm === 'TS_TRIAL')) {
      const item = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === norm);
      activeSpeed += item?.capacityGhs || (norm === 'TS_TRIAL' ? 1.0 : 0);
    }
  }
  const isPaused = activeSpeed <= 0;

  const currentDisplay = Math.max(0, Number(displayUnclaimed) || 0);
  const isUsdt = activeCurrency === 'USDT';
  const showLocal = preferLocalCurrency && !!selectedCountry && selectedCountry.code !== 'US';

  // Format the balance display based on currency preference
  const formatBalance = () => {
    if (isUsdt && showLocal && selectedCountry) {
      const rate = Number(selectedCountry.exchangeRate) || 1;
      const localVal = currentDisplay * rate;
      return {
        value: formatAdaptiveCounter(localVal),
        label: selectedCountry.currencyCode,
      };
    }
    return {
      value: formatAdaptiveCounter(currentDisplay),
      label: activeCurrency,
    };
  };

  const bal = formatBalance();

  // Convert GH/s to CU — 1 GH/s = 10 units
  const computeUnits = ((Number(activeSpeed) || 0) * (Number(displayMultiplier) || 1) * 10).toFixed(0);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 my-2">
      {/* Label: Ready to Collect / Paused indicator */}
      <span className={`text-[11px] font-extrabold uppercase tracking-widest ${
        isPaused ? 'text-amber-400 font-mono flex items-center gap-1' : 'text-text-secondary/80'
      }`}>
        {isPaused ? '⏸️ HASHING PAUSED' : 'Ready to Collect'}
      </span>

      {/* Live Odometer Ticker Balance with Text Gradient */}
      <div className="flex items-baseline gap-2 font-mono tracking-tight">
        <span
          className={`text-4xl font-extrabold tracking-tight drop-shadow-md ${
            isPaused
              ? 'text-amber-400 opacity-90'
              : isUsdt
              ? 'text-gradient-usdt'
              : 'text-gradient-ton'
          }`}
        >
          {bal.value}
        </span>
        <span className="text-lg font-bold text-text-secondary">{bal.label}</span>
      </div>

      {/* Speed Indicator Pill */}
      {isPaused ? (
        <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/30 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-amber-400 flex items-center gap-2 shadow-lg">
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <span>0 Machine Power (PAUSED)</span>
        </div>
      ) : (
        <div className="bg-control-bg/80 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-usdt-green flex items-center gap-2 shadow-lg">
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="absolute w-3 h-3 rounded-full bg-usdt-green opacity-75 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-usdt-green" />
          </div>
          <span>{computeUnits} Machine Power</span>
        </div>
      )}
    </div>
  );
};
