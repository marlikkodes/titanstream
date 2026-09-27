import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, ArrowRight, Sparkles, UserCheck, CheckCircle2, Share2 } from 'lucide-react';
import { extractReferralCode, extractAttributionParams } from '../utils/referralUrl';
import { useReferralStore } from '../store/useReferralStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLegalModalStore } from '../store/useLegalModalStore';
import { LegalModal } from '../components/legal/LegalModal';

export const ReferralLanding: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [cleanedCode, setCleanedCode] = useState<string>('');
  const [status, setStatus] = useState<'capturing' | 'ready'>('capturing');
  const openLegalModal = useLegalModalStore((s) => s.openLegalModal);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const session = useAuthStore((s) => s.session);

  const isExistingUser = Boolean(isAuthenticated && session?.user);

  useEffect(() => {
    if (code) {
      const sanitized = extractReferralCode(code);
      setCleanedCode(sanitized);

      const attribution = extractAttributionParams();

      if (!isExistingUser) {
        // Persist in localStorage and sessionStorage ONLY for new/unauthenticated visitors
        localStorage.setItem('pending_referral_code', sanitized);
        sessionStorage.setItem('pending_referral_code', sanitized);
        localStorage.setItem('pending_attribution', JSON.stringify(attribution));
        sessionStorage.setItem('pending_attribution', JSON.stringify(attribution));
        console.info(`[REFERRAL_LANDING] New visitor captured code: ${sanitized} with attribution:`, attribution);
      } else {
        console.info(`[REFERRAL_LANDING] Existing user detected (${session?.user?.telegramUserId}). Ignoring new referral code.`);
      }

      // Auto-trigger attach attempt if already authenticated
      useReferralStore.getState().attachPendingReferral();

      const timer = setTimeout(() => {
        setStatus('ready');
      }, 800);

      return () => clearTimeout(timer);
    } else {
      window.location.href = '/';
    }
  }, [code, navigate, isExistingUser, session]);

  const handleContinue = () => {
    window.location.href = '/?onboarding=true';
  };

  const handleGoToGrow = () => {
    window.location.href = '/?tab=grow';
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-text-primary flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-usdt-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-72 h-72 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#121620]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center"
      >
        {isExistingUser ? (
          /* ─── EXISTING USER SMART UI ─── */
          <>
            {/* Header Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/10">
              <UserCheck className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mb-3">
              <CheckCircle2 size={12} />
              <span>Active Operator Account</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">
              Welcome Back, Operator!
            </h1>

            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              You are already an active member of Titan Stream. Your current computing node, balance, and referral link remain active.
            </p>

            {/* Inviter Info Card */}
            <div className="bg-[#1a202c] border border-white/10 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase text-text-tertiary font-extrabold tracking-wider">
                  Referral Link Opened
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  Existing Member
                </span>
              </div>
              <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-gold" />
                <span>Code: {cleanedCode || 'TS1001'}</span>
              </div>
              <div className="text-[11px] text-text-tertiary mt-2 pt-2 border-t border-white/5">
                First-touch referral protection active. Existing user relationships are preserved.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleContinue}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-usdt-green to-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <span>Return to App Console</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={handleGoToGrow}
                className="w-full py-3 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
              >
                <Share2 size={14} className="text-usdt-green" />
                <span>View My Referral Network</span>
              </button>
            </div>
          </>
        ) : (
          /* ─── NEW USER INVITATION UI ─── */
          <>
            {/* Brand Icon Header */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-usdt-green/20 to-gold/20 border border-usdt-green/30 flex items-center justify-center mb-5 shadow-lg shadow-usdt-green/10">
              <Zap className="w-8 h-8 text-usdt-green animate-pulse" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">
              Node Invitation Received
            </h1>

            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              You've been invited to join the <span className="text-usdt-green font-bold">Titan Stream</span> Machine Economy network.
            </p>

            {/* Code Badge */}
            <div className="bg-[#1a202c] border border-white/10 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-gold" />
                <div className="text-left">
                  <div className="text-[10px] uppercase text-text-tertiary font-extrabold tracking-wider">
                    Invited By Code
                  </div>
                  <div className="text-sm font-mono font-bold text-usdt-green">
                    {cleanedCode || 'VALIDATING…'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-usdt-green/10 text-usdt-green border border-usdt-green/30 rounded-full text-[10px] font-bold">
                +5.00 USDT Bonus
              </span>
            </div>

            {/* Features List */}
            <div className="space-y-2.5 text-left mb-6 text-xs text-text-secondary">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-usdt-green shrink-0" />
                <span>Standalone Web & Multi-channel Identity Safe</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Zap size={15} className="text-gold shrink-0" />
                <span>Instant +2% Mining Hashrate Boost</span>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleContinue}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-usdt-green to-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 hover:brightness-110 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Continue to Web App"
            >
              <span>Continue to Web App</span>
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </motion.div>

      {/* Legal & Regulatory Footer */}
      <footer className="mt-8 relative z-10 flex flex-col items-center gap-2 text-center text-xs text-text-tertiary">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openLegalModal('terms')} 
            className="hover:text-text-secondary hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-gold"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button 
            onClick={() => openLegalModal('privacy')} 
            className="hover:text-text-secondary hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-gold"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button 
            onClick={() => openLegalModal('refund')} 
            className="hover:text-text-secondary hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-gold"
          >
            Refund Policy
          </button>
          <span>•</span>
          <button 
            onClick={() => openLegalModal('business')} 
            className="hover:text-text-secondary hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-gold"
          >
            Licenses & Details
          </button>
        </div>
        <p className="text-[11px]">
          © {new Date().getFullYear()} TitanStream Cloud Computing Technologies Ltd. · All rights reserved.
        </p>
      </footer>

      <LegalModal />
    </div>
  );
};
