import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { fundingService, type SettlementSession } from '../../services/fundingService';
import { exchangeRateService } from '../../services/exchangeRateService';
import { useCountryStore } from '../../store/useCountryStore';

interface PesapalFundingProps {
  paymentMethod?: 'CARD' | 'MOBILE_MONEY';
  onCancel: () => void;
}

const hapticFeedback = {
  impactOccurred: (_style: string) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(_style as any);
    }
  },
};

// Currency code/symbol lookup for formatting — NO financial exchange rates
const CURRENCY_FORMAT: Record<string, { code: string; symbol: string }> = {
  UG: { code: 'UGX', symbol: 'UGX' },
  KE: { code: 'KES', symbol: 'KSh' },
  US: { code: 'USD', symbol: '$' },
};

export const PesapalFunding: React.FC<PesapalFundingProps> = ({
  paymentMethod: initialPaymentMethod,
  onCancel,
}) => {
  const { userCountry } = useCountryStore();
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'MOBILE_MONEY'>(
    initialPaymentMethod || (userCountry === 'US' ? 'CARD' : 'MOBILE_MONEY')
  );

  // Sync initialPaymentMethod prop changes (e.g. user toggling CARD <-> MOBILE_MONEY in parent)
  useEffect(() => {
    if (initialPaymentMethod) {
      setPaymentMethod(initialPaymentMethod);
    }
  }, [initialPaymentMethod]);
  const [amountUsdt, setAmountUsdt] = useState<string>('50');
  const [paymentNetwork, setPaymentNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [country, setCountry] = useState<string>(userCountry || 'UG');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SettlementSession | null>(null);

  // Live exchange rate from backend (display-only estimate prior to session creation)
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const currFormat = CURRENCY_FORMAT[country] || CURRENCY_FORMAT.US;

  // Sync country when changed from selector
  useEffect(() => {
    if (userCountry) {
      setCountry(userCountry);
      if (userCountry === 'US') {
        setPaymentMethod('CARD');
      }
    }
  }, [userCountry]);

  // Fetch live backend rate for display estimate (pre-session creation)
  useEffect(() => {
    let isMounted = true;
    const fetchRate = async () => {
      const code = currFormat.code;
      if (code === 'USD') {
        setLiveRate(1.0);
        return;
      }
      setRateLoading(true);
      try {
        const rateObj = await exchangeRateService.getRate(code);
        if (isMounted && rateObj?.userRate) {
          setLiveRate(rateObj.userRate);
        }
      } catch (err) {
        console.warn('[PesapalFunding] Failed to fetch live rate estimate:', err);
      } finally {
        if (isMounted) setRateLoading(false);
      }
    };

    fetchRate();
    return () => {
      isMounted = false;
    };
  }, [country, currFormat.code]);

  // Session status polling hook
  useEffect(() => {
    if (!session?.settlementId || session.status === 'COMPLETED' || session.status === 'FAILED' || session.status === 'REJECTED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updatedSession = await fundingService.getSessionStatus(session.settlementId);
        setSession(updatedSession);
      } catch (err) {
        console.warn('Failed to poll settlement status:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.settlementId, session?.status]);

  const handleCreateSession = async () => {
    const numAmount = parseFloat(amountUsdt);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    if (paymentMethod === 'MOBILE_MONEY' && !phoneNumber.trim()) {
      setError('Please enter your mobile money phone number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      hapticFeedback.impactOccurred('medium');
      const response = await fundingService.createPesapalSession({
        amountUsdt: numAmount,
        country: country || 'UG',
        paymentMethod,
        mobileMoneyNetwork: paymentMethod === 'MOBILE_MONEY' ? paymentNetwork : undefined,
        phoneNumber: paymentMethod === 'MOBILE_MONEY' ? phoneNumber : undefined,
      });

      setSession(response.session);
    } catch (err: any) {
      console.error('Failed to create payment session:', err);
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || '';

      if (errMsg.includes('ACTIVE_SETTLEMENT_EXISTS')) {
        try {
          const history = await fundingService.getHistory();
          const active = history.find((s) =>
            ['CREATED', 'WAITING_FOR_PAYMENT', 'WAITING_PAYMENT', 'VERIFYING'].includes(s.status)
          );
          if (active) {
            setSession(active as any);
            setError(null);
            return;
          }
        } catch {
          // fallback to error display
        }
      }

      setError(errMsg || 'Failed to initialize payment session');
    } finally {
      setIsLoading(false);
    }
  };

  const [showEmbeddedIframe, setShowEmbeddedIframe] = useState(true);

  const isPendingApproval = session?.status === 'CREATED' && (session as any)?.requiresAdminApproval;

  // Canonical payment method & network source of truth (session metadata overrides local state)
  const activePaymentMethod: 'CARD' | 'MOBILE_MONEY' =
    ((session as any)?.paymentMethod as 'CARD' | 'MOBILE_MONEY') || paymentMethod;
  const activeNetwork: 'MTN' | 'AIRTEL' =
    ((session as any)?.mobileMoneyNetwork as 'MTN' | 'AIRTEL') || paymentNetwork;

  // Pre-session estimate calculations (display only)
  const numInputUsdt = Number(amountUsdt) || 0;
  const estimatedRate = liveRate || (currFormat.code === 'USD' ? 1.0 : null);
  const estimatedFiatAmount = estimatedRate ? Math.round(numInputUsdt * estimatedRate) : null;

  // Post-session locked values (authoritative backend financial snapshot)
  const sessionPayCurrency = (session as any)?.paymentCurrency || currFormat.code;
  const sessionPaySymbol = (session as any)?.currencySymbol || currFormat.symbol;
  const rawSessionPayAmount = (session as any)?.paymentAmount != null ? Number((session as any).paymentAmount) : 0;
  const sessionExchangeRate = (session as any)?.exchangeRate ? Number((session as any).exchangeRate).toLocaleString() : null;

  // Safe display fallbacks for session card
  const displayUsdtAmount = session?.requestedAmount ? session.requestedAmount.toString() : (session as any)?.expectedCryptoAmount ? (session as any).expectedCryptoAmount.toString() : amountUsdt || '50';
  
  const numericUsdt = Number(displayUsdtAmount) || 50;
  const lockedRateNum = (session as any)?.exchangeRate ? Number((session as any).exchangeRate) : (estimatedRate || 3782);

  // If rawSessionPayAmount is set and reasonably matches numericUsdt * rate, use it; otherwise compute exact product
  const computedPayAmount = Math.round(numericUsdt * lockedRateNum);
  const displayPayAmount = (rawSessionPayAmount > 100 && sessionPayCurrency !== 'USD')
    ? rawSessionPayAmount
    : (sessionPayCurrency === 'USD' ? numericUsdt : computedPayAmount);

  const displayReference = session?.reference || session?.referenceCode || (session as any)?.settlementId || (session as any)?.id || '—';

  const displayRate = sessionPayCurrency === 'USD'
    ? '1'
    : lockedRateNum.toLocaleString();

  const checkoutUrl = session?.paymentUrl || (session as any)?.payUrl;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            hapticFeedback.impactOccurred('light');
            if (session) setSession(null);
            else onCancel();
          }}
          className="text-xs font-semibold text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
          {activePaymentMethod === 'CARD' ? (
            <>
              <CreditCard size={12} /> Card Payment
            </>
          ) : (
            <>
              <Smartphone size={12} /> Mobile Money ({activeNetwork === 'AIRTEL' ? 'Airtel' : 'MTN'})
            </>
          )}
        </span>
      </div>

      {!session ? (
        /* Form View */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-text-primary block">
                Deposit Amount
              </label>
              {estimatedRate && currFormat.code !== 'USD' && (
                <span className="text-[10px] font-mono text-usdt-green font-bold">
                  1 USDT = {currFormat.symbol} {estimatedRate.toLocaleString()}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={amountUsdt}
                onChange={(e) => setAmountUsdt(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-control-bg border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-usdt-green transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-usdt-green">
                USDT
              </span>
            </div>

            {/* Clear Direction: You Pay vs You Receive */}
            {currFormat.code !== 'USD' && (
              <div className="p-3 rounded-xl bg-usdt-green/10 border border-usdt-green/20 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary">You Pay:</span>
                  <span className="font-extrabold text-usdt-green font-mono text-sm">
                    {rateLoading
                      ? 'Updating rate...'
                      : estimatedFiatAmount != null
                      ? `${currFormat.symbol} ${estimatedFiatAmount.toLocaleString()}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-tertiary">You Receive:</span>
                  <span className="font-mono text-text-primary font-bold">{numInputUsdt} USDT</span>
                </div>
              </div>
            )}

            {/* Presets (25, 50, 100, 250, 500 USDT) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['25', '50', '100', '250', '500'].map((val) => {
                const presetFiat = estimatedRate ? Math.round(Number(val) * estimatedRate) : null;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      hapticFeedback.impactOccurred('light');
                      setAmountUsdt(val);
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center ${
                      amountUsdt === val
                        ? 'bg-usdt-green/20 text-usdt-green border-usdt-green/40'
                        : 'bg-white/5 text-text-tertiary border-white/5 hover:border-white/10'
                    }`}
                  >
                    <span>{val} USDT</span>
                    {currFormat.code !== 'USD' && (
                      <span className="text-[9px] font-normal opacity-75 font-mono mt-0.5">
                        {presetFiat ? `${currFormat.symbol} ${presetFiat.toLocaleString()}` : '—'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Money Network Selection */}
          {paymentMethod === 'MOBILE_MONEY' && (
            <div className="space-y-3">
              <label className="text-xs font-extrabold text-text-primary block">
                Select Network
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    setPaymentNetwork('MTN');
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    paymentNetwork === 'MTN'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-extrabold'
                      : 'bg-white/5 border-white/10 text-text-tertiary hover:border-white/20'
                  }`}
                >
                  <span className="text-xs">MTN Mobile Money</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">MTN</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    setPaymentNetwork('AIRTEL');
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    paymentNetwork === 'AIRTEL'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-extrabold'
                      : 'bg-white/5 border-white/10 text-text-tertiary hover:border-white/20'
                  }`}
                >
                  <span className="text-xs">Airtel Money</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">AIRTEL</span>
                </button>
              </div>

              {/* Phone Number Input */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-extrabold text-text-secondary block">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+256 770 000 000"
                  className="w-full bg-control-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary focus:outline-none focus:border-usdt-green transition-colors"
                />
              </div>
            </div>
          )}

          {/* Country Selection */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-text-secondary">Country / Region</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-control-bg border border-white/10 rounded-lg px-3 py-1 text-xs font-extrabold text-text-primary focus:outline-none"
            >
              <option value="UG">Uganda (UGX)</option>
              <option value="KE">Kenya (KES)</option>
              <option value="US">International (USD)</option>
            </select>
          </div>

          {/* Method Info */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2.5 text-xs text-text-tertiary">
            {activePaymentMethod === 'CARD' ? (
              <>
                <CreditCard size={16} className="text-purple-400 shrink-0" />
                <span>Pay securely with Visa or Mastercard</span>
              </>
            ) : (
              <>
                <Smartphone size={16} className="text-usdt-green shrink-0" />
                <span>Pay securely with Mobile Money ({activeNetwork === 'AIRTEL' ? 'Airtel Money' : 'MTN Mobile Money'})</span>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleCreateSession}
            disabled={isLoading || !amountUsdt || parseFloat(amountUsdt) <= 0}
            className="press-feedback bg-gradient-to-r from-usdt-green to-[#00c853] text-app-bg font-extrabold text-sm py-3.5 rounded-2xl shadow-lg w-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-app-bg border-t-transparent rounded-full animate-spin" />
                <span>Creating Session...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>Proceed to Checkout</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Session View / Checkout Ready */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {(() => {
            const currentStatus = String(session?.status || '').toUpperCase();
            const isCompleted = ['COMPLETED', 'POSTED', 'USDT_SENT', 'SUCCESS', 'PAID'].includes(currentStatus);
            const isFailed = ['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(currentStatus);

            if (isCompleted) {
              return (
                /* Success Celebration Card */
                <div className="p-5 rounded-3xl glass-panel border border-usdt-green/30 space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-text-primary">Deposit Successful!</h3>
                    <p className="text-xs text-text-tertiary mt-1">
                      Your account has been credited with <span className="font-extrabold text-usdt-green font-mono">{displayUsdtAmount} USDT</span>.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Reference:</span>
                      <span className="text-usdt-green font-bold">{displayReference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Amount Credited:</span>
                      <span className="text-text-primary font-bold">{displayUsdtAmount} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Status:</span>
                      <span className="text-usdt-green font-bold">COMPLETED</span>
                    </div>
                  </div>
                  <button
                    onClick={onCancel}
                    className="w-full py-3.5 rounded-2xl bg-usdt-green hover:bg-usdt-green/90 text-app-bg font-extrabold text-sm transition-all"
                  >
                    Done
                  </button>
                </div>
              );
            }

            if (isFailed) {
              return (
                /* Failed / Cancelled Card */
                <div className="p-5 rounded-3xl glass-panel border border-rose-500/30 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <XCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-text-primary">
                      {currentStatus === 'EXPIRED' ? 'Session Expired' : 'Payment Failed'}
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1">
                      {currentStatus === 'EXPIRED'
                        ? 'This deposit session has expired. Please create a new session.'
                        : 'The payment could not be processed or was rejected.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSession(null)}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary font-extrabold text-xs transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              );
            }

            if (isPendingApproval) {
              return (
                /* Admin Authorization Card */
                <div className="p-5 rounded-3xl glass-panel border border-amber-500/30 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <Clock size={24} className="animate-pulse" />
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-text-primary">Admin Authorization Required</h3>
                    <p className="text-xs text-text-tertiary mt-1">
                      Deposits exceeding security threshold require manual authorization before provider dispatch.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Amount:</span>
                      <span className="font-extrabold text-text-primary font-mono">{displayUsdtAmount} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Reference:</span>
                      <span className="font-mono text-amber-400">{displayReference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Status:</span>
                      <span className="font-extrabold text-amber-400">PENDING_APPROVAL</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSession(null)}
                    className="w-full py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-extrabold text-xs transition-colors"
                  >
                    Create New Session
                  </button>
                </div>
              );
            }

            return (
              /* Active Checkout & Polling View (WAITING_FOR_PAYMENT / VERIFYING / CREATED) */
              <div className="p-5 rounded-3xl glass-panel border border-white/10 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto relative">
                {session.status === 'VERIFYING' ? (
                  <ShieldCheck size={24} className="animate-pulse" />
                ) : activePaymentMethod === 'CARD' ? (
                  <>
                    <CreditCard size={24} className="text-purple-400" />
                    <span className="absolute top-0 right-0 w-3 h-3 bg-usdt-green rounded-full border-2 border-control-bg animate-ping"></span>
                  </>
                ) : (
                  <>
                    <Smartphone size={24} className="text-usdt-green" />
                    <span className="absolute top-0 right-0 w-3 h-3 bg-usdt-green rounded-full border-2 border-control-bg animate-ping"></span>
                  </>
                )}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">
                  {session.status === 'VERIFYING'
                    ? 'Verifying Payment'
                    : activePaymentMethod === 'CARD'
                    ? 'Secure Card Checkout'
                    : 'Mobile Money Payment'}
                </h3>
                <p className="text-xs text-text-tertiary mt-1">
                  {session.status === 'VERIFYING'
                    ? 'Payment received. Verifying transaction details...'
                    : activePaymentMethod === 'CARD'
                    ? 'Enter your Visa or Mastercard credentials below on the secure checkout.'
                    : 'Complete your payment on your mobile phone or using the secure checkout below.'}
                </p>
              </div>

              {/* Authoritative Session Snapshot Rendering */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary">You Pay:</span>
                  <span className="font-extrabold text-usdt-green font-mono text-sm">
                    {sessionPayCurrency === 'USD'
                      ? `$${displayUsdtAmount}`
                      : `${sessionPaySymbol} ${displayPayAmount.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-tertiary">You Receive:</span>
                  <span className="font-mono text-text-primary font-bold">{displayUsdtAmount} USDT</span>
                </div>
                {sessionPayCurrency !== 'USD' && (
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                    <span className="text-text-tertiary">Locked Rate:</span>
                    <span className="font-mono text-text-secondary">1 USDT = {sessionPaySymbol} {displayRate}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                  <span className="text-text-tertiary">Reference:</span>
                  <span className="font-mono text-purple-400 font-bold">{displayReference}</span>
                </div>
              </div>

              {/* SECURE CHECKOUT FRAME CONTROL */}
              {checkoutUrl && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.impactOccurred('medium');
                        const tg = (window as any).Telegram?.WebApp;
                        if (tg?.openLink) {
                          tg.openLink(checkoutUrl);
                        } else {
                          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="press-feedback flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30"
                    >
                      <ExternalLink size={16} /> Open Checkout in New Tab
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmbeddedIframe(!showEmbeddedIframe)}
                      className="ml-2 px-3 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-text-primary text-xs font-bold transition-all"
                    >
                      {showEmbeddedIframe ? 'Hide Frame' : 'Show Frame'}
                    </button>
                  </div>

                  {/* SECURE EMBEDDED CHECKOUT IFRAME */}
                  {showEmbeddedIframe && (
                    <div className="rounded-2xl overflow-hidden border border-purple-500/30 bg-white shadow-2xl">
                      <iframe
                        src={checkoutUrl}
                        title="Secure Card Checkout"
                        className="w-full h-[480px] border-0"
                        allow="payment"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* SANDBOX DEVELOPER INSTANT PAYMENT SIMULATOR */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="pt-2 space-y-2 border-t border-white/5">
                  <div className="text-[10px] text-text-tertiary text-left font-mono">
                    Developer Sandbox Tool: Tests internal pipeline
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const sid = (session as any)?.settlementId || (session as any)?.id || session?.referenceCode || session?.reference || '';
                      if (!sid) return;
                      setIsLoading(true);
                      setError(null);
                      try {
                        hapticFeedback.impactOccurred('medium');
                        const updated = await fundingService.simulatePesapalPayment(sid);
                        setSession(updated);
                        try {
                          const walletStore = (await import('../../store/useWalletStore')).useWalletStore;
                          walletStore.getState().fetchWalletBalances();
                        } catch {
                          // safe fallback
                        }
                      } catch (err: any) {
                        console.error('Simulation failed:', err);
                        setError(err?.response?.data?.message || err?.message || 'Sandbox simulation failed');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="press-feedback w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-text-tertiary border border-white/10 font-bold text-[11px] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>Developer: Simulate Internal Pipeline Test</span>
                  </button>
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-text-tertiary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-usdt-green animate-ping"></span>
                  Listening for payment completion...
                </span>
                <button
                  onClick={() => setSession(null)}
                  className="text-text-secondary hover:text-text-primary font-bold hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}
        </motion.div>
      )}
    </div>
  );
};
