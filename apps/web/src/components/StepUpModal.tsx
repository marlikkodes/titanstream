import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, KeyRound, Loader2, CheckCircle2, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/auth.service';

export const StepUpModal: React.FC = () => {
  const isOpen = useAuthStore((s) => s.isStepUpModalOpen);
  const closeModal = useAuthStore((s) => s.closeStepUpModal);
  const setStepUpToken = useAuthStore((s) => s.setStepUpToken);

  const [otpCode, setOtpCode] = useState('');
  const [channelInfo, setChannelInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleRequestChallenge();
    } else {
      setOtpCode('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleRequestChallenge = async () => {
    setIsSendingCode(true);
    setError(null);
    try {
      const res = await authService.requestStepUpChallenge();
      setChannelInfo(res.channel || 'TELEGRAM');
      setSuccessMsg(`Verification code dispatched to your ${res.channel || 'Telegram'} account.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to request security code.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await authService.verifyStepUpChallenge(otpCode);
      setStepUpToken(res.stepUpToken);
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Verification failed. Please check code.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md rounded-3xl bg-[#0d1017] border border-white/10 p-6 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Security Re-Authentication</h2>
                <p className="text-xs text-text-tertiary">Step-Up authorization required</p>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="p-2 rounded-xl text-text-tertiary hover:text-white hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-text-secondary mb-6 leading-relaxed">
            To authorize high-risk financial operations (withdrawals or security changes), enter the 6-digit verification code sent to your trusted identity channel ({channelInfo || 'Telegram/WhatsApp'}).
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          {successMsg && !error && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit security code"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-center tracking-[0.3em] text-lg focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length < 6}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Authorize'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
            <button
              type="button"
              onClick={handleRequestChallenge}
              disabled={isSendingCode}
              className="hover:text-emerald-400 underline transition-colors"
            >
              {isSendingCode ? 'Sending new code...' : 'Resend Code'}
            </button>
            <span>Valid for 5 minutes</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
