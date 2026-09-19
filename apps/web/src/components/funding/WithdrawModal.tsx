import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Wallet, ArrowDownToLine, CheckCircle2, AlertCircle, Zap, Clock, Users } from 'lucide-react';
import { useWalletStore } from '../../store/useWalletStore';
import { useTelegram } from '../../context/TelegramContext';
import { supportsLocalPaymentRails, useCountryStore } from '../../store/useCountryStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { withdrawalService, type WithdrawalSession } from '../../services/withdrawalService';
import { showToast } from '../Toast';
import { CurrencyDisplay } from '../DualCurrencyDisplay';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WithdrawMethod = 'MOBILE_MONEY' | 'USDT_ADDRESS';

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  const { usdtBalance, fetchBalanceFromEngine } = useWalletStore();
  const { hapticFeedback } = useTelegram();
  const { selectedCountry, getLocalAmountRaw } = useCountryStore();
  const hasLocalPaymentRails = supportsLocalPaymentRails(selectedCountry?.code);
  const { preferLocalCurrency } = useSettingsStore();
  const { qualification, fetchQualification } = useGrowthStore();

  useEffect(() => {
    if (isOpen) {
      fetchQualification();
    }
  }, [isOpen, fetchQualification]);

  const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null);
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<WithdrawalSession | null>(null);

  const isLocalPreferred = preferLocalCurrency && hasLocalPaymentRails;
  const currencyCode = isLocalPreferred ? (selectedCountry?.currencyCode || 'UGX') : 'USDT';
  const currencySymbol = isLocalPreferred ? (selectedCountry?.currencyCode || 'UGX') : 'USDT';
  const exchangeRate = selectedCountry?.exchangeRate || 3700;
  const minUsdtLimit = selectedCountry?.withdrawalLimits?.min || 2;
  const minLocalLimit = isLocalPreferred ? Math.round(minUsdtLimit * exchangeRate) : minUsdtLimit;

  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const calculatedUsdt = isLocalPreferred ? parsedAmount / exchangeRate : parsedAmount;
  const calculatedLocal = isLocalPreferred ? parsedAmount : Math.round(parsedAmount * exchangeRate);

  const isBelowMin = parsedAmount > 0 && (isLocalPreferred ? parsedAmount < minLocalLimit : parsedAmount < minUsdtLimit);
  const isExceedingBalance = calculatedUsdt > usdtBalance;
  const isZeroBalance = usdtBalance <= 0;
  const isMissingDestination = selectedMethod === 'USDT_ADDRESS'
    ? !walletAddress || walletAddress.trim().length < 10
    : false;
  const isReferralLocked = qualification?.withdrawal ? !qualification.withdrawal.canWithdraw : false;

  const getDisabledReason = (): string | null => {
    if (isReferralLocked && qualification?.withdrawal) {
      return qualification.withdrawal.reason || `Withdrawal locked: 5 qualified referrals required (${qualification.withdrawal.qualifiedCount || 0}/5).`;
    }
    if (isZeroBalance) {
      return `Your wallet balance is $0.00 USDT. Deposit or earn funds to enable withdrawals.`;
    }
    if (!withdrawAmount || parsedAmount <= 0) {
      return `Enter withdrawal amount in ${currencyCode}.`;
    }
    if (isBelowMin) {
      return `Minimum withdrawal is ${minUsdtLimit.toFixed(2)} USDT (≈ ${currencyCode} ${minLocalLimit.toLocaleString()}).`;
    }
    if (isExceedingBalance) {
      return `Amount exceeds your available wallet balance of ${isLocalPreferred ? `${currencyCode} ${getLocalAmountRaw(usdtBalance).toLocaleString()}` : `$${usdtBalance.toFixed(2)} USDT`}.`;
    }
    if (isMissingDestination) {
      return `Please enter a valid TRC-20 USDT wallet address.`;
    }
    return null;
  };

  const disabledReason = getDisabledReason();

  const withdrawMethods = [
    {
      id: 'MOBILE_MONEY' as WithdrawMethod,
      name: 'Mobile Money',
      displayName: 'Mobile Money (MTN / Airtel)',
      icon: <Smartphone size={22} className="text-usdt-green" />,
      description: 'Receive instant cash payout to your MTN or Airtel Money account',
      status: 'ENABLED',
    },
    {
      id: 'USDT_ADDRESS' as WithdrawMethod,
      name: 'USDT Address',
      displayName: 'USDT Wallet Address',
      icon: <Wallet size={22} className="text-usdt-green" />,
      description: 'Withdraw directly to your USDT (TRC-20) wallet address',
      status: 'ENABLED',
    },
  ].filter((method) => method.id === 'USDT_ADDRESS' || hasLocalPaymentRails);

  const handleWithdraw = async () => {
    if (isProcessing) return;

    const amountVal = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amountVal) || amountVal <= 0) {
      setErrorMsg('Please enter a valid withdrawal amount.');
      return;
    }

    const usdtAmount = isLocalPreferred
      ? amountVal / exchangeRate
      : amountVal;

    if (usdtAmount > usdtBalance) {
      setErrorMsg('Insufficient balance.');
      return;
    }

    let destination = '';
    let destinationType = 'MOBILE_MONEY';
    let net = 'TRC20';

    if (selectedMethod === 'USDT_ADDRESS') {
      if (!walletAddress || walletAddress.trim().length < 10) {
        setErrorMsg('Please enter a valid USDT address.');
        return;
      }
      destination = walletAddress.trim();
      destinationType = 'CRYPTO_WALLET';
      net = 'TRC20';
    } else {
      if (!phoneNumber || phoneNumber.trim().length < 8) {
        setErrorMsg('Please enter your phone number (e.g. 0771234567).');
        return;
      }
      destination = phoneNumber.trim();
      destinationType = 'MOBILE_MONEY';
      net = momoNetwork;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    hapticFeedback.impactOccurred('medium');

    try {
      const res = await withdrawalService.createWithdrawal({
        asset: 'USDT',
        amount: usdtAmount.toString(),
        destination,
        destinationType,
        network: net,
        country: selectedCountry?.code || 'UG',
        mobileMoneyNetwork: momoNetwork,
      });

      setCompletedSession(res);
      hapticFeedback.notificationOccurred('success');
      showToast('Withdrawal request submitted successfully!', 'success');
      await fetchBalanceFromEngine();
    } catch (err: any) {
      hapticFeedback.notificationOccurred('error');
      const apiErr = err?.response?.data?.error?.message || err?.message || 'Withdrawal failed. Try again.';
      setErrorMsg(apiErr);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetModal = () => {
    setSelectedMethod(null);
    setCompletedSession(null);
    setWithdrawAmount('');
    setWalletAddress('');
    setPhoneNumber('');
    setErrorMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 pb-24 sm:pb-8 select-none overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="w-full max-w-md bg-app-bg border border-white/10 rounded-3xl p-4 sm:p-5 pb-6 shadow-2xl max-h-[80vh] sm:max-h-[88vh] overflow-y-auto my-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center text-sm font-black">
                ₮
              </div>
              <h2 className="text-base font-extrabold text-text-primary">
                {completedSession
                  ? 'Withdrawal Submitted'
                  : selectedMethod
                  ? withdrawMethods.find((m) => m.id === selectedMethod)?.displayName
                  : 'Take Out Money'}
              </h2>
            </div>

            <button
              onClick={() => {
                hapticFeedback.impactOccurred('light');
                handleResetModal();
              }}
              className="press-feedback p-1.5 rounded-full bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>

          {/* Render Completed Session View */}
          {completedSession ? (
            <div className="space-y-4 text-center">
              <div className="glass-panel p-5 rounded-2xl border border-usdt-green/30 bg-usdt-green/10 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-usdt-green/20 flex items-center justify-center text-usdt-green">
                  <CheckCircle2 size={28} />
                </div>
                <div className="text-lg font-extrabold text-usdt-green">Payout Request Created</div>
                <div className="text-xs text-text-secondary">
                  Your request to withdraw <strong className="text-text-primary">{completedSession.amount} USDT</strong> has been submitted.
                </div>
                <div className="text-[11px] font-mono text-text-tertiary flex items-center justify-center gap-1">
                  <Clock size={12} /> Reference: {completedSession.reference || completedSession.withdrawalId}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary space-y-1 text-left">
                <div className="font-bold text-text-primary">Payout Details</div>
                <div>Destination: <strong className="text-text-primary font-mono">{completedSession.destination}</strong></div>
                <div>Status: <span className="text-usdt-green font-bold">{completedSession.status}</span></div>
              </div>

              <button
                type="button"
                onClick={handleResetModal}
                className="press-feedback w-full py-3 rounded-xl bg-usdt-green text-app-bg font-extrabold text-sm shadow-lg"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Balance Display */}
              <div className="bg-control-bg/30 border border-white/5 rounded-2xl p-4 mb-4">
                <div className="text-[10px] text-text-secondary font-bold uppercase mb-1">Money Ready</div>
                <div className="text-2xl font-black text-text-primary font-mono">
                  <CurrencyDisplay amount={usdtBalance} size="lg" />
                </div>
                <div className="text-[10px] text-usdt-green mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready to take out
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-error-red/10 border border-error-red/25 text-error-red text-[11px] font-bold flex items-center gap-2 animate-shake">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Body Content */}
              {!selectedMethod ? (
                <div className="space-y-4">
                  <p className="text-xs text-text-secondary">
                    Select how you would like to receive your money.
                  </p>

                  <div className="space-y-2.5">
                    {withdrawMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          hapticFeedback.impactOccurred('medium');
                          setSelectedMethod(method.id);
                          setErrorMsg(null);
                        }}
                        className="press-feedback w-full p-4 rounded-2xl glass-panel border border-white/10 hover:border-usdt-green/40 flex items-center justify-between transition-all group text-left"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-control-bg border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                            {method.icon}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-text-primary group-hover:text-usdt-green transition-colors">
                                {method.displayName}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-usdt-green/10 text-usdt-green border-usdt-green/20">
                                Active
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {method.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => {
                      hapticFeedback.selectionChanged();
                      setSelectedMethod(null);
                      setErrorMsg(null);
                    }}
                    className="mb-4 text-xs font-bold text-usdt-green flex items-center gap-1 hover:underline"
                  >
                    ← Choose Different Method
                  </button>

                  <div className="space-y-4">
                    {/* Network Selector for Mobile Money */}
                    {selectedMethod === 'MOBILE_MONEY' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-tertiary uppercase">Select Network</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['MTN', 'AIRTEL'] as const).map((net) => (
                            <button
                              key={net}
                              type="button"
                              onClick={() => {
                                hapticFeedback.selectionChanged();
                                setMomoNetwork(net);
                              }}
                              className={`press-feedback py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-between transition-colors ${
                                momoNetwork === net
                                  ? net === 'AIRTEL'
                                    ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-sm'
                                    : 'bg-amber-400/15 border-amber-400 text-amber-400 shadow-sm'
                                  : 'bg-control-bg/60 border-white/10 text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <span>{net === 'MTN' ? 'MTN Mobile Money' : 'Airtel Money'}</span>
                              {momoNetwork === net && <Zap size={14} className={net === 'AIRTEL' ? 'fill-rose-400' : 'fill-amber-400'} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Amount Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-text-tertiary uppercase">Amount ({currencyCode})</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-mono font-black text-usdt-green uppercase tracking-wide">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder={isLocalPreferred ? `${minLocalLimit}` : `${minUsdtLimit}.00`}
                          max={isLocalPreferred ? getLocalAmountRaw(usdtBalance) : usdtBalance}
                          className="w-full bg-control-bg text-text-primary text-sm font-mono font-bold rounded-xl pl-16 pr-3 py-3 border border-white/10 focus:border-usdt-green focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-tertiary">
                        <span className="flex items-center gap-1">
                          Available: <CurrencyDisplay amount={Number(usdtBalance) || 0} size="sm" />
                        </span>
                        <button
                          onClick={() => setWithdrawAmount((isLocalPreferred ? getLocalAmountRaw(usdtBalance) : usdtBalance).toString())}
                          className="text-usdt-green font-bold hover:underline"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    {/* Method-specific destination input */}
                    {selectedMethod === 'USDT_ADDRESS' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-text-tertiary uppercase">Wallet Address (TRC-20)</label>
                        <input
                          type="text"
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          placeholder="Enter your USDT (TRC-20) address"
                          className="w-full bg-control-bg text-text-primary text-sm font-mono rounded-xl px-3 py-3 border border-white/10 focus:border-usdt-green focus:outline-none"
                        />
                        <div className="text-[10px] text-text-tertiary flex items-center gap-1">
                          <AlertCircle size={10} /> Make sure the TRC-20 address is correct
                        </div>
                      </div>
                    )}

                    {selectedMethod === 'MOBILE_MONEY' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-text-tertiary uppercase">Mobile Money Withdrawal Number ({momoNetwork})</label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="e.g. 077 XXX XXXX"
                          className="w-full bg-control-bg text-text-primary text-sm font-mono rounded-xl px-3 py-3 border border-white/10 focus:border-usdt-green focus:outline-none"
                        />
                        <div className="p-2.5 rounded-xl bg-usdt-green/10 border border-usdt-green/20 text-[11px] text-text-secondary space-y-1">
                          <div className="font-bold text-usdt-green">
                            Withdrawal will be sent to: {phoneNumber || 'Default WhatsApp / Withdrawal Number'}
                          </div>
                          <div className="text-[10px] text-text-tertiary">
                            If you don't add a separate withdrawal number, your WhatsApp number will be used automatically.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payout Calculation Display */}
                    {selectedMethod === 'MOBILE_MONEY' && parsedAmount > 0 && (
                      <div className="bg-control-bg/30 border border-usdt-green/20 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-text-secondary font-bold">Estimated Payout</span>
                          <span className="font-mono font-extrabold text-usdt-green text-xs">
                            {currencyCode} {calculatedLocal.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-text-tertiary font-mono">
                          <span>Equivalent USDT Amount</span>
                          <span>${calculatedUsdt.toFixed(2)} USDT</span>
                        </div>
                      </div>
                    )}

                    {/* Qualification Network Gate Banner */}
                    {isReferralLocked ? (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-2.5">
                        <div className="flex items-center justify-between font-extrabold">
                          <div className="flex items-center gap-1.5">
                            <Users size={14} className="text-amber-400" />
                            <span>Withdrawal Network Gate</span>
                          </div>
                          <span className="font-mono text-xs bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                            {qualification?.withdrawal?.qualifiedCount || 0} / 5 Qualified
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                          To maintain platform liquidity integrity, withdrawals unlock after you have 5 qualified referrals who have completed their first settlement ({Math.max(0, 5 - (qualification?.withdrawal?.qualifiedCount || 0))} remaining).
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            handleResetModal();
                            useNavigationStore.getState().setActiveTab('grow');
                          }}
                          className="press-feedback w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-500/30 transition-colors"
                        >
                          <Users size={14} />
                          <span>Grow My Network (Invite Friends)</span>
                        </button>
                      </div>
                    ) : disabledReason ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-bold flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{disabledReason}</span>
                      </div>
                    ) : null}

                    {/* Submit Button */}
                    <button
                      onClick={handleWithdraw}
                      disabled={
                        isProcessing ||
                        isReferralLocked ||
                        !withdrawAmount ||
                        parsedAmount <= 0 ||
                        isBelowMin ||
                        isExceedingBalance ||
                        isZeroBalance ||
                        isMissingDestination
                      }
                      className="press-feedback bg-gradient-to-r from-usdt-green to-[#00c853] text-app-bg font-extrabold text-xs py-3.5 rounded-xl shadow-lg w-full flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,230,118,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-app-bg border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine size={14} /> Take Out Money ({selectedMethod === 'MOBILE_MONEY' ? momoNetwork : 'USDT'})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
