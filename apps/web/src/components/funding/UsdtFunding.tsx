import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Check, ShieldCheck, Clock, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, AlertTriangle, QrCode } from 'lucide-react';
import { settlementService, type SettlementSessionView } from '../../services/settlementService';
import { useTelegram } from '../../context/TelegramContext';

interface UsdtFundingProps {
  onCancel: () => void;
}

export const UsdtFunding: React.FC<UsdtFundingProps> = ({ onCancel }) => {
  const [amountUsdt, setAmountUsdt] = useState<string>('50');
  const [session, setSession] = useState<SettlementSessionView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const { hapticFeedback } = useTelegram();

  const receivingAddress =
    (session as any)?.receivingAddress || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
  const network = (session as any)?.network || 'TRON (TRC-20)';
  const requiredConfirmations = (session as any)?.requiredConfirmations || 19;

  const handleCreateSession = async () => {
    if (isLoading) return;

    const amountNum = parseFloat(amountUsdt);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid deposit amount.');
      return;
    }

    setIsLoading(true);
    setError(null);
    hapticFeedback.impactOccurred('medium');

    try {
      const res = await settlementService.createSession({
        provider: 'USDT',
        asset: 'USDT',
        requestedAmount: amountUsdt,
        expectedCryptoAmount: amountUsdt,
        exchangeRate: '1.0',
        country: 'GLOBAL',
        mobileMoneyNetwork: 'TRON_TRC20',
      });

      setSession(res);
      hapticFeedback.notificationOccurred('success');
    } catch (err: any) {
      console.error('Failed to create USDT session:', err);
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || '';

      if (errMsg.includes('ACTIVE_SETTLEMENT_EXISTS')) {
        try {
          const history = await settlementService.getHistory();
          const active = history.find((s) =>
            ['CREATED', 'WAITING_FOR_PAYMENT', 'WAITING_PAYMENT', 'VERIFYING'].includes(s.status)
          );
          if (active) {
            setSession(active);
            setError(null);
            hapticFeedback.notificationOccurred('success');
            return;
          }
        } catch {
          // fallback to display error
        }
      }

      setError(errMsg || 'Failed to initialize USDT deposit session');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    hapticFeedback.notificationOccurred('success');
    setTimeout(() => setCopied(false), 2500);
  };

  // Status Polling Loop
  useEffect(() => {
    if (!session?.settlementId) return;

    const terminalStates = ['COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'];
    if (terminalStates.includes(session.status)) return;

    let polls = 0;
    const maxPolls = 36; // 3 minutes

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
        console.error('USDT Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.settlementId]);

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

        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1 font-bold">
          <Sparkles size={12} /> TRON TRC-20 Network
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
              {['10', '25', '50', '100', '250'].map((val) => (
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

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
            <span className="text-text-tertiary">Selected Rail</span>
            <span className="font-extrabold text-sky-400 font-mono">TRC-20 (TRON)</span>
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
              <span>Generating Deposit Address...</span>
            ) : (
              <>
                <Sparkles size={18} /> Get Receiving Address
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Deposit Session View */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Address Display Box */}
          <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                Send Exact Amount to:
              </span>
              <span className="text-xs font-black text-usdt-green font-mono">
                {session.expectedCryptoAmount || amountUsdt} USDT
              </span>
            </div>

            <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-2">
              <div className="overflow-hidden text-ellipsis font-mono text-xs font-bold text-sky-400">
                {receivingAddress}
              </div>
              <button
                onClick={() => handleCopyAddress(receivingAddress)}
                className="shrink-0 p-2 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <p className="text-[11px] text-text-tertiary">
              Send only <b>USDT on the TRON (TRC-20)</b> network to this static address. Requires {requiredConfirmations} block confirmations.
            </p>
          </div>

          {/* Real Status Box */}
          {session.status === 'COMPLETED' ? (
            <div className="p-4 rounded-2xl bg-usdt-green/10 border border-usdt-green/30 text-usdt-green space-y-2 text-center">
              <CheckCircle2 size={32} className="mx-auto text-usdt-green" />
              <h4 className="text-sm font-black">Deposit Verified & Settled</h4>
              <p className="text-xs text-text-tertiary">
                Your wallet balance has been updated with {session.expectedCryptoAmount} USDT.
              </p>
            </div>
          ) : session.status === 'FAILED' || session.status === 'REJECTED' ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-2 text-center">
              <AlertCircle size={32} className="mx-auto text-rose-400" />
              <h4 className="text-sm font-black">Deposit Rejected</h4>
              <p className="text-xs text-text-tertiary">
                This deposit session was rejected or canceled. Contact support for assistance.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary flex items-center gap-1.5 font-bold">
                  <RefreshCw size={14} className="animate-spin text-sky-400" /> Monitoring Blockchain...
                </span>
                <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  {session.status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/20 text-xs text-text-tertiary flex items-start gap-2.5">
                <Clock size={16} className="shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Listening for your TRC-20 deposit on the TRON blockchain. Once detected, your deposit will be confirmed and credited automatically.
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
