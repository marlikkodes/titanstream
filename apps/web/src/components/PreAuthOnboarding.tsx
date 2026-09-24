import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, Cpu, LockKeyhole, MessageSquare, Send, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';
import { useLegalModalStore } from '../store/useLegalModalStore';
import { completePreAuthOnboarding } from '../utils/preAuthOnboarding';
import { MACHINE_CATALOG } from '../data/machines';

type Slide = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  icon: typeof Cpu;
  accent: string;
  fleet?: boolean;
  ticker?: boolean;
  auth?: boolean;
  referral?: boolean;
};

// Live GPU fleet preview, synced with the machine catalog (single source of truth).
const FLEET_PREVIEW = (['TS_TRIAL', 'TS_P250', 'TS_X1000'] as const).map((tierCode, idx) => {
  const machine = MACHINE_CATALOG.find((item) => item.tierCode === tierCode);
  return {
    name: machine?.name ?? tierCode,
    price: machine?.priceUsdt ?? 0,
    hashRate: machine?.capacityGhs ?? 0,
    dailyUsdt: machine?.dailyYieldUsdt ?? 0,
    tag: ['Starter', 'Popular', 'Pro'][idx] as string,
  };
});

const slides: Slide[] = [
  {
    eyebrow: 'REAL GPU COMPUTE',
    title: 'Real GPU Compute Power.',
    description: 'TitanStream provisions high density NVIDIA GPU clusters. Your capital fuels real AI workloads and earns daily yield. Every new operator receives a free Titan Core starter rig on sign in.',
    highlights: ['Free Titan Core starter rig', 'Tap a tier to preview daily yield'],
    icon: TrendingUp,
    accent: 'from-emerald-400 to-cyan-300',
    fleet: true,
    referral: true,
  },
  {
    eyebrow: 'EARN IN YOUR CURRENCY',
    title: 'Payouts every second.',
    description: 'Earnings accumulate every second. Watch your balance grow live in USDT or your local currency with one tap conversion.',
    highlights: ['Live accumulation ticker', 'One tap currency switch'],
    icon: Sparkles,
    accent: 'from-sky-400 to-indigo-400',
    ticker: true,
  },
  {
    eyebrow: 'SIGN IN SECURELY',
    title: 'No passwords needed.',
    description: 'Sign in with WhatsApp or Telegram. Cash out to Mobile Money, including M-Pesa, MTN and Airtel, or crypto. Every sign in is confirmed through your channel.',
    highlights: ['Access confirmed through your channel', 'Terms shown before activation'],
    icon: ShieldCheck,
    accent: 'from-violet-400 to-fuchsia-400',
    auth: true,
  },
];

const currencyRates = {
  USDT: { symbol: '₮', rate: 1, label: 'USDT' },
  KES: { symbol: 'KSh', rate: 130, label: 'KES' },
  UGX: { symbol: 'UGX', rate: 3700, label: 'UGX' },
  NGN: { symbol: '₦', rate: 1480, label: 'NGN' },
};

interface PreAuthOnboardingProps {
  onComplete: () => void;
}

/**
 * A deliberately small first-visit introduction. It only persists after an
 * explicit user action, so a reload never hides the product from a visitor.
 */
export function PreAuthOnboarding({ onComplete }: PreAuthOnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [currency, setCurrency] = useState<'USDT' | 'KES' | 'UGX' | 'NGN'>('USDT');
  const [liveCounter, setLiveCounter] = useState(19.026);
  const [authChannel, setAuthChannel] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [invitedFriends, setInvitedFriends] = useState(5);
  const prefersReducedMotion = useReducedMotion();
  const openLegalModal = useLegalModalStore((state) => state.openLegalModal);
  const slide = slides[step];
  const Icon = slide.icon;
  const isLastStep = step === slides.length - 1;

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCounter((prev) => prev + 0.003);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' && !isLastStep) setStep((value) => value + 1);
      if (event.key === 'ArrowLeft' && step > 0) setStep((value) => value - 1);
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
    <div className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#06070b] p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pre-auth-title">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-[100px]" />
        <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative my-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#10131c]/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-7"
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-usdt-green to-emerald-300 text-base font-black text-[#07110e] shadow-lg shadow-emerald-500/20">₮</span>
            <span className="text-sm font-black tracking-tight text-white">TitanStream</span>
          </div>
          <button type="button" onClick={complete} className="rounded-lg px-2 py-1 text-xs font-semibold text-text-tertiary transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-gold">
            Skip intro
          </button>
        </header>

        <div className="mt-8 min-h-[320px] sm:min-h-[332px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.eyebrow}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -18 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            >
              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${slide.accent} text-[#080b12] shadow-lg`}>
                <Icon size={27} strokeWidth={2.4} />
              </div>
              <p className="text-[11px] font-extrabold tracking-[0.16em] text-usdt-green">{slide.eyebrow}</p>
              <h1 id="pre-auth-title" className="mt-2 text-[28px] font-black leading-[1.08] tracking-tight text-white sm:text-[32px]">{slide.title}</h1>
              <p className="mt-4 max-w-[36ch] text-sm font-medium leading-relaxed text-text-secondary">{slide.description}</p>
              <ul className="mt-6 space-y-3" aria-label="What you can expect">
                {slide.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2.5 text-sm font-semibold text-gray-200">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-usdt-green/15 text-usdt-green"><Check size={13} strokeWidth={3} /></span>
                    {highlight}
                  </li>
                ))}
              </ul>
              {slide.fleet && (
                <div className="mt-6 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    {FLEET_PREVIEW.map((tier, idx) => (
                      <button
                        key={tier.name}
                        type="button"
                        onClick={() => setSelectedTierIndex(idx)}
                        className={`rounded-xl border p-2 text-left transition-all ${
                          selectedTierIndex === idx
                            ? 'border-usdt-green bg-usdt-green/15 text-white shadow-md'
                            : 'border-white/5 bg-white/5 text-text-tertiary hover:border-white/20'
                        }`}
                      >
                        <div className="truncate text-[10px] font-bold">{tier.name}</div>
                        <div className="mt-1 text-xs font-black text-white">${tier.price}</div>
                        <div className="mt-0.5 text-[9px] font-semibold text-usdt-green">{tier.hashRate} GH/s</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-usdt-green/20 bg-usdt-green/10 p-3">
                    <div>
                      <div className="text-[10px] font-medium text-text-tertiary">Estimated Daily Yield</div>
                      <div className="text-base font-black text-usdt-green">
                        +${FLEET_PREVIEW[selectedTierIndex].dailyUsdt.toFixed(2)} USDT / day
                      </div>
                    </div>
                    <span className="rounded-full border border-usdt-green/20 bg-usdt-green/10 px-2 py-1 text-[10px] font-bold text-usdt-green">
                      {FLEET_PREVIEW[selectedTierIndex].tag}
                    </span>
                  </div>
                </div>
              )}
              {slide.referral && (
                <div className="mt-2.5 space-y-3 rounded-2xl border border-white/10 bg-[#161a26] p-4">
                  <div className="flex items-center justify-between text-[11px] font-bold text-text-tertiary">
                    <span>REFERRAL BOOST SIMULATOR</span>
                    <span className="font-mono text-gold">{invitedFriends} Friends</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={invitedFriends}
                    onChange={(e) => setInvitedFriends(parseInt(e.target.value, 10))}
                    className="h-2 w-full cursor-pointer rounded-lg bg-black/40 accent-gold"
                    aria-label="Invited friends"
                  />
                  <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0b0e17] p-3">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-gold" />
                      <div>
                        <div className="text-[10px] font-medium text-text-tertiary">Est. Network Daily Bonus</div>
                        <div className="text-sm font-black text-gold">
                          +${(invitedFriends * 1.5).toFixed(2)} USDT / day
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[10px] font-bold text-gold">
                      Network Bonus
                    </span>
                  </div>
                </div>
              )}
              {slide.ticker && (
                <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#161a26] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-tertiary">LIVE ACCUMULATION TICKER</span>
                    <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                      {(['USDT', 'KES', 'UGX', 'NGN'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={`rounded px-2 py-0.5 text-[10px] font-black transition-colors ${
                            currency === c ? 'bg-usdt-green text-black' : 'text-text-tertiary hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0b0e17] p-4 text-center">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary">Ready to Collect</div>
                    <div className="mt-1 font-mono text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {currInfo.symbol} {convertedLive} <span className="text-xs font-bold text-usdt-green">{currInfo.label}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                      <span>Live yield active around the clock</span>
                    </div>
                  </div>
                </div>
              )}
              {slide.auth && (
                <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#161a26] p-3.5">
                  <div className="text-[11px] font-bold text-text-tertiary">CHOOSE YOUR PREFERRED AUTH CHANNEL</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAuthChannel('whatsapp')}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                        authChannel === 'whatsapp'
                          ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-lg'
                          : 'border-white/5 bg-white/5 text-text-tertiary hover:border-white/20'
                      }`}
                    >
                      <MessageSquare className="h-6 w-6 text-emerald-400" />
                      <div className="text-xs font-black">WhatsApp Auth</div>
                      <span className="text-[9px] font-semibold text-emerald-400">One Tap Verification</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthChannel('telegram')}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                        authChannel === 'telegram'
                          ? 'border-sky-500 bg-sky-500/15 text-white shadow-lg'
                          : 'border-white/5 bg-white/5 text-text-tertiary hover:border-white/20'
                      }`}
                    >
                      <Send className="h-6 w-6 text-sky-400" />
                      <div className="text-xs font-black">Telegram Bot</div>
                      <span className="text-[9px] font-semibold text-sky-400">Instant Mini App</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#0b0e17] p-2.5 text-[11px] text-text-secondary">
                    <Wallet size={16} className="shrink-0 text-gold" />
                    <span>Instant local settlement with M-Pesa, Airtel Money or USDT wallet.</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-bold text-text-tertiary transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-0 focus-visible:ring-2 focus-visible:ring-gold">
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${slides.length}`}>
            {slides.map((item, index) => <span key={item.eyebrow} className={`h-1.5 rounded-full transition-all ${index === step ? 'w-6 bg-usdt-green' : 'w-1.5 bg-white/20'}`} />)}
          </div>
          <span className="w-[54px]" aria-hidden="true" />
        </div>

        <button type="button" onClick={isLastStep ? complete : () => setStep((value) => value + 1)} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-usdt-green to-emerald-300 px-5 text-sm font-black text-[#06110d] shadow-xl shadow-emerald-500/20 transition-transform hover:brightness-110 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-gold">
          {isLastStep ? <><LockKeyhole size={17} /> Continue to secure sign in</> : <>Continue <ArrowRight size={17} /></>}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-text-tertiary">
          By continuing, you acknowledge our{' '}
          <button type="button" onClick={() => openLegalModal('terms')} className="font-semibold text-gray-300 underline underline-offset-2 hover:text-white">Terms</button>{' '}
          and{' '}
          <button type="button" onClick={() => openLegalModal('privacy')} className="font-semibold text-gray-300 underline underline-offset-2 hover:text-white">Privacy Policy</button>.
        </p>
      </motion.section>
    </div>
  );
}
