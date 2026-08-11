import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, ExternalLink, ShieldCheck, Clock, CheckCircle2, AlertCircle, ArrowLeft, XCircle, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';
import { settlementService, type SettlementSessionView } from '../../services/settlementService';
import { useTelegram } from '../../context/TelegramContext';

interface PesapalFundingProps {
  paymentMethod?: 'MOBILE_MONEY' | 'CARD';
  onCancel: () => void;
}

export const PesapalFunding: React.FC<PesapalFundingProps> = ({ paymentMethod = 'MOBILE_MONEY', onCancel }) => {
  const [amountUsdt, setAmountUsdt] = useState<string>('50');
  const [country, setCountry] = useState<string>('UG');
  const [paymentNetwork, setPaymentNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [session, setSession] = useState<SettlementSessionView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { hapticFeedback } = useTelegram();

  const handleCreateSession = async () => {
    if (isLoading) return;

    const amountNum = parseFloat(amountUsdt);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid deposit amount.');
      return;
    }

    if (paymentMethod === 'MOBILE_MONEY' && !phoneNumber.trim()) {
      setError('Please enter your mobile money phone number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    hapticFeedback.impactOccurred('medium');

    try {
      const res = await settlementService.createSession({
        paymentMethod,
        asset: 'USDT',
        requestedAmount: amountUsdt,
        expectedCryptoAmount: amountUsdt,
        exchangeRate: '1.0',
        country,
        mobileMoneyNetwork: paymentMethod === 'CARD' ? 'CARD' : paymentNetwork,
        paymentNetwork: paymentMethod === 'CARD' ? 'CARD' : paymentNetwork,
        phoneNumber,
      });

      setSession(res);
      hapticFeedback.notificationOccurred('success');
    } catch (err: any) {
      console.error('Failed to create payment session:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to initialize payment session');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.settlementId) return;

    const terminalStates = ['COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'];
    if (terminalStates.includes(session.status)) return;

    let polls = 0;
    const maxPolls = 36;

    const interval = setInterval(async () => {
      polls++;
      if (polls > maxPolls) {
        clearInterval(interval);
        return;
      }
      try {
        const updated = await settlementService.getSession(session.settlementId);
        setSession(updated);

        if (terminalStates.includes(updated.status)) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.settlementId]);

  const isPendingApproval = session?.status === 'CREATED' && (session as any)?.requiresAdminApproval;

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
          {paymentMethod === 'CARD' ? (
            <>
              <CreditCard size={12} /> Card Payment
            </>
          ) : (
            <>
              <Smartphone size={12} /> Mobile Money
            </>
          )}
        </span>
      </div>

      {!session ? (
        /* Form View */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-3">
            <label className="text-xs font-extrabold text-text-primary block">
              Deposit Amount (USDT)
            </label>
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

            <div className="grid grid-cols-3 gap-2 pt-1">
              {['25', '50', '100', '250', '500'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    setAmountUsdt(val);
                  }}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    amountUsdt === val
                      ? 'bg-usdt-green/20 text-usdt-green border-usdt-green/40'
                      : 'bg-white/5 text-text-tertiary border-white/5 hover:border-white/10'
                  }`}
                >
                  ${val}
                </button>
              ))}
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
            {paymentMethod === 'CARD' ? (
              <>
                <CreditCard size={16} className="text-purple-400 shrink-0" />
                <span>Pay securely with Visa or Mastercard</span>
              </>
            ) : (
              <>
                <Smartphone size={16} className="text-usdt-green shrink-0" />
                <span>Pay securely with Mobile Money ({paymentNetwork === 'MTN' ? 'MTN Mobile Money' : 'Airtel Money'})</span>
              </>
            )}
          </div>

          {/* Threshold Policy Info */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>
              Transactions over $500 require Admin authorization prior to payment submission.
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleCreateSession}
            disabled={isLoading}
            className="press-feedback w-full py-3.5 rounded-2xl bg-usdt-green text-black font-extrabold text-sm shadow-lg shadow-usdt-green/20 flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <span>Initializing payment...</span>
            ) : paymentMethod === 'CARD' ? (
              <>
                <CreditCard size={18} /> Make Payment
              </>
            ) : (
              <>
                <Smartphone size={18} /> Make Payment
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Session View */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {isPendingApproval ? (
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Clock size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Awaiting Admin Authorization</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Your deposit of ${session.expectedAssetAmount || session.requestedAmount} USDT requires routine admin authorization before submission.
                </p>
              </div>
              <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full inline-block">
                Reference: {session.reference || session.referenceCode}
              </div>
            </div>
          ) : session.status === 'COMPLETED' ? (
            <div className="p-5 rounded-3xl bg-usdt-green/10 border border-usdt-green/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment Complete!</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Your wallet has been credited with ${session.expectedAssetAmount} USDT via double-entry ledger.
                </p>
              </div>
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-xl bg-usdt-green text-black font-extrabold text-xs"
              >
                Done
              </button>
            </div>
          ) : session.status === 'FAILED' ? (
            <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <XCircle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment Failed</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  There was an issue processing your payment.
                </p>
              </div>
              <button
                onClick={() => setSession(null)}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary font-extrabold text-xs transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : session.status === 'REJECTED' ? (
            <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment Rejected</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  This transaction was rejected by an administrator.
                </p>
              </div>
              <button
                onClick={() => setSession(null)}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary font-extrabold text-xs transition-colors"
              >
                Dismiss
              </button>
            </div>
          ) : session.status === 'CANCELLED' ? (
            <div className="p-5 rounded-3xl bg-gray-500/10 border border-gray-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-500/20 text-gray-400 flex items-center justify-center mx-auto">
                <XCircle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment Cancelled</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  The payment session was cancelled.
                </p>
              </div>
              <button
                onClick={() => setSession(null)}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary font-extrabold text-xs transition-colors"
              >
                New Session
              </button>
            </div>
          ) : session.status === 'EXPIRED' ? (
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Session Expired</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  This payment session has expired.
                </p>
              </div>
              <button
                onClick={() => setSession(null)}
                className="w-full py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-extrabold text-xs transition-colors"
              >
                Create New Session
              </button>
            </div>
          ) : session.status === 'VERIFYING' ? (
            <div className="p-5 rounded-3xl glass-panel border border-white/10 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <ShieldCheck size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Verifying Payment</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Payment received. Verifying transaction details...
                </p>
              </div>
            </div>
          ) : session.status === 'WAITING_FOR_PAYMENT' ? (
            <div className="p-5 rounded-3xl glass-panel border border-white/10 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto relative">
                <RefreshCw size={24} className="animate-spin" />
                <span className="absolute top-0 right-0 w-3 h-3 bg-usdt-green rounded-full border-2 border-control-bg animate-pulse"></span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment in Progress</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Waiting for payment confirmation. Polling for updates...
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-3xl glass-panel border border-white/10 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Payment Checkout Ready</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Click below to complete your payment on the secure checkout page.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Amount:</span>
                  <span className="font-extrabold text-text-primary">${session.requestedAmount} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Reference:</span>
                  <span className="font-mono text-purple-400">{session.reference || session.referenceCode}</span>
                </div>
              </div>

              {(session.paymentUrl || (session as any).payUrl) && (
                <a
                  href={session.paymentUrl || (session as any).payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-feedback w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30"
                >
                  <ExternalLink size={16} /> Open Secure Checkout
                </a>
              )}
            </div>
          )
        </motion.div>
      )}
    </div>
  );
};
