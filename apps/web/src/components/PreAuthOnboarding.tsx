import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ChevronLeft,
  Cpu,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  MessageSquare,
  Send,
  Users,
} from 'lucide-react';
import { useLegalModalStore } from '../store/useLegalModalStore';
import { completePreAuthOnboarding } from '../utils/preAuthOnboarding';
import { MACHINE_CATALOG } from '../data/machines';

interface PreAuthOnboardingProps {
  onComplete: () => void;
}

export function PreAuthOnboarding({ onComplete }: PreAuthOnboardingProps) {
  const [step, setStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const openLegalModal = useLegalModalStore((state) => state.openLegalModal);

  // ─── Interactive State for Slide 0: Machine Selector ───
  // Synced with the live GPU fleet catalog (single source of truth).
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const machineTiers = (['TS_TRIAL', 'TS_P250', 'TS_X1000'] as const).map((tierCode, idx) => {
    const machine = MACHINE_CATALOG.find((item) => item.tierCode === tierCode);
    return {
      name: machine?.name ?? tierCode,
      price: machine?.priceUsdt ?? 0,
      hashRate: machine?.capacityGhs ?? 0,
      dailyUsdt: machine?.dailyYieldUsdt ?? 0,
      tag: ['Starter', 'Popular', 'Pro'][idx] as string,
    };
  });

  // ─── Interactive State for Slide 1: Dual-Currency & Live Yield Ticker ───
  const [currency, setCurrency] = useState<'USDT' | 'KES' | 'UGX' | 'NGN'>('USDT');
  const [liveCounter, setLiveCounter] = useState(19.026);

  const currencyRates = {
    USDT: { symbol: '₮', rate: 1, label: 'USDT' },
    KES: { symbol: 'KSh', rate: 130, label: 'KES' },
    UGX: { symbol: 'UGX', rate: 3700, label: 'UGX' },
    NGN: { symbol: '₦', rate: 1480, label: 'NGN' },
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCounter((prev) => prev + 0.003);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ─── Interactive State for Slide 2: Channel Auth Selector ───
  const [authChannel, setAuthChannel] = useState<'whatsapp' | 'telegram'>('whatsapp');

  // ─── Interactive State for Slide 3: Referral Simulator ───
  const [invitedFriends, setInvitedFriends] = useState(5);

  const totalSteps = 4;
  const isLastStep = step === totalSteps - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && !isLastStep) setStep((val) => val + 1);
      if (event.key === 'ArrowLeft' && step > 0) setStep((val) => val - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLastStep, step]);

  const complete = () => {
    completePreAuthOnboarding();
    onComplete();
  };

  const currInfo = currencyRates[currency];
  const convertedLive = (liveCounter * currInfo.rate).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#06070b]/95 p-4 sm:p-6 backdrop-blur-md select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-auth-title"
    >
      {/* Background Glow Orbs */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-usdt-green/15 blur-[120px]" />
        <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative my-auto w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#10131c]/95 p-5 shadow-2xl shadow-black/70 backdrop-blur-2xl sm:p-7"
      >
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-usdt-green to-emerald-300 text-base font-black text-[#07110e] shadow-lg shadow-emerald-500/20">
              ₮
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-white leading-none">TitanStream</span>
              <span className="text-[10px] text-text-tertiary font-medium">GPU Compute Network</span>
            </div>
          </div>
          <button
            type="button"
            onClick={complete}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-text-tertiary transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-gold"
          >
            Skip Intro
          </button>
        </header>

        {/* Slide Content */}
        <div className="mt-6 min-h-[350px] sm:min-h-[360px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="slide-0"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#080b12] shadow-lg shadow-emerald-500/20">
                  <Cpu size={24} strokeWidth={2.4} />
                </div>
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-usdt-green uppercase">Autonomous Compute Engine</p>
                <h1 id="pre-auth-title" className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                  Real GPU Compute Power
                </h1>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  TitanStream provisions high-density NVIDIA GPU clusters. Your capital fuels real AI workloads & earns daily yield.
                </p>

                {/* Interactive Machine Picker */}
                <div className="mt-4 bg-[#161a26] border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary font-semibold">
                    <span>INTERACTIVE FLEET PREVIEW</span>
                    <span className="text-usdt-green font-bold">Select a Tier ↓</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {machineTiers.map((tier, idx) => (
                      <button
                        key={tier.name}
                        type="button"
                        onClick={() => setSelectedTierIndex(idx)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          selectedTierIndex === idx
                            ? 'bg-usdt-green/15 border-usdt-green text-white shadow-md'
                            : 'bg-white/5 border-white/5 text-text-tertiary hover:border-white/20'
                        }`}
                      >
                        <div className="text-[10px] font-bold truncate">{tier.name}</div>
                        <div className="text-xs font-black text-white mt-1">${tier.price}</div>
                        <div className="text-[9px] text-usdt-green font-semibold mt-0.5">{tier.hashRate} GH/s</div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-[#0b0e17] rounded-xl p-3 flex items-center justify-between border border-white/5">
                    <div>
                      <div className="text-[10px] text-text-tertiary font-medium">Estimated Daily Yield</div>
                      <div className="text-base font-black text-usdt-green">
                        +${machineTiers[selectedTierIndex].dailyUsdt.toFixed(2)} USDT / day
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
                      {machineTiers[selectedTierIndex].tag}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="slide-1"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-400 text-[#080b12] shadow-lg shadow-sky-500/20">
                  <TrendingUp size={24} strokeWidth={2.4} />
                </div>
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-sky-400 uppercase">Live Dual Currency Ticker</p>
                <h1 id="pre-auth-title" className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                  Per-Second Payouts
                </h1>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  Earnings accumulate every second. View your real-time balance in USDT or your local currency with 1-tap conversion.
                </p>

                {/* Interactive Currency Ticker Widget */}
                <div className="mt-4 bg-[#161a26] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-tertiary">LIVE ACCUMULATION TICKER</span>
                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 gap-1">
                      {(['USDT', 'KES', 'UGX', 'NGN'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                            currency === c ? 'bg-usdt-green text-black' : 'text-text-tertiary hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0b0e17] rounded-xl p-4 text-center border border-white/5 relative overflow-hidden">
                    <div className="text-[10px] text-text-tertiary uppercase font-extrabold tracking-wider">Ready to Collect</div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono tracking-tight">
                      {currInfo.symbol} {convertedLive} <span className="text-xs font-bold text-usdt-green">{currInfo.label}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Live 24/7 Mining Yield Active</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="slide-2"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-400 text-[#080b12] shadow-lg shadow-violet-500/20">
                  <ShieldCheck size={24} strokeWidth={2.4} />
                </div>
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-violet-400 uppercase">Seamless Channel Authentication</p>
                <h1 id="pre-auth-title" className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                  No Passwords Needed
                </h1>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  Sign in securely using WhatsApp or Telegram. Cash out earnings directly to Mobile Money (M-Pesa, MTN, Airtel) or Crypto.
                </p>

                {/* Interactive Channel Auth Selection */}
                <div className="mt-4 bg-[#161a26] border border-white/10 rounded-2xl p-3.5 space-y-3">
                  <div className="text-[11px] font-bold text-text-tertiary">CHOOSE YOUR PREFERRED AUTH CHANNEL</div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAuthChannel('whatsapp')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        authChannel === 'whatsapp'
                          ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg'
                          : 'bg-white/5 border-white/5 text-text-tertiary hover:border-white/20'
                      }`}
                    >
                      <MessageSquare className="w-6 h-6 text-emerald-400" />
                      <div className="text-xs font-black">WhatsApp Auth</div>
                      <span className="text-[9px] text-emerald-400 font-semibold">1-Tap Verification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthChannel('telegram')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        authChannel === 'telegram'
                          ? 'bg-sky-500/15 border-sky-500 text-white shadow-lg'
                          : 'bg-white/5 border-white/5 text-text-tertiary hover:border-white/20'
                      }`}
                    >
                      <Send className="w-6 h-6 text-sky-400" />
                      <div className="text-xs font-black">Telegram Bot</div>
                      <span className="text-[9px] text-sky-400 font-semibold">Instant Mini App</span>
                    </button>
                  </div>

                  <div className="bg-[#0b0e17] rounded-xl p-2.5 text-[11px] text-text-secondary flex items-center gap-2 border border-white/5">
                    <Wallet size={16} className="text-gold shrink-0" />
                    <span>Instant Local Settlement via M-Pesa, Airtel Money, or USDT Wallet.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="slide-3"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-300 text-[#080b12] shadow-lg shadow-gold/20">
                  <Sparkles size={24} strokeWidth={2.4} />
                </div>
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-gold uppercase">Free Starter Rig & Referrals</p>
                <h1 id="pre-auth-title" className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                  Claim Your Starter Rig
                </h1>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  Every new operator receives a starter mining machine upon sign-in. Share your referral link to earn continuous commissions!
                </p>

                {/* Interactive Referral Yield Calculator */}
                <div className="mt-4 bg-[#161a26] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary font-bold">
                    <span>REFERRAL COMMISSION SIMULATOR</span>
                    <span className="text-gold font-mono">{invitedFriends} Friends</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={invitedFriends}
                    onChange={(e) => setInvitedFriends(parseInt(e.target.value, 10))}
                    className="w-full accent-gold bg-black/40 h-2 rounded-lg cursor-pointer"
                  />

                  <div className="bg-[#0b0e17] rounded-xl p-3 flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-gold" />
                      <div>
                        <div className="text-[10px] text-text-tertiary font-medium">Est. Network Daily Bonus</div>
                        <div className="text-sm font-black text-gold">
                          +${(invitedFriends * 1.5).toFixed(2)} USDT / day
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold rounded-full">
                      Lifetime Yield
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step Indicators & Controls */}
        <div className="mt-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep((val) => Math.max(0, val - 1))}
            disabled={step === 0}
            className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-bold text-text-tertiary transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-0 focus-visible:ring-2 focus-visible:ring-gold"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${totalSteps}`}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-usdt-green' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
          <span className="w-[54px]" aria-hidden="true" />
        </div>

        {/* Main Action Button */}
        <button
          type="button"
          onClick={isLastStep ? complete : () => setStep((val) => val + 1)}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-usdt-green to-emerald-300 px-5 text-sm font-black text-[#06110d] shadow-xl shadow-emerald-500/20 transition-transform hover:brightness-110 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-gold"
        >
          {isLastStep ? (
            <>
              <LockKeyhole size={17} /> Claim Free Rig & Sign In
            </>
          ) : (
            <>
              Next <ArrowRight size={17} />
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-text-tertiary">
          By continuing, you acknowledge our{' '}
          <button
            type="button"
            onClick={() => openLegalModal('terms')}
            className="font-semibold text-gray-300 underline underline-offset-2 hover:text-white"
          >
            Terms
          </button>{' '}
          and{' '}
          <button
            type="button"
            onClick={() => openLegalModal('privacy')}
            className="font-semibold text-gray-300 underline underline-offset-2 hover:text-white"
          >
            Privacy Policy
          </button>.
        </p>
      </motion.section>
    </div>
  );
}
