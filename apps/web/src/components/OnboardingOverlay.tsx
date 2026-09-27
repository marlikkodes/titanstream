import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useTelegram } from '../context/TelegramContext';
import { useLegalModalStore } from '../store/useLegalModalStore';
import {
  Server,
  TrendingUp,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  ExternalLink
} from 'lucide-react';
import { AccountPersonalizationStep } from './AccountPersonalizationStep';
import { getAccountSetup, type AccountSetupState } from '../services/accountSetupService';

interface OnboardingOverlayProps {
  onComplete?: () => void;
  /** Start directly at the Personalization step (returning user with incomplete setup). */
  startAtPersonalization?: boolean;
  /** Authoritative setup snapshot from the app shell — avoids a duplicate GET on login. */
  initialSetup?: AccountSetupState | null;
}

interface Slide {
  id: number;
  title: string;
  copy: string;
  icon: React.ReactNode;
  gradient: string;
  bgGlow: string;
}

// Step indices: 0-3 product intro, 4 account personalization, 5 compliance consent.
const PERSONALIZATION_STEP = 4;
const CONSENT_STEP = 5;
const TOTAL_STEPS = 6;

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete, startAtPersonalization, initialSetup }) => {
  const [currentStep, setCurrentStep] = useState(() => (startAtPersonalization ? PERSONALIZATION_STEP : 0));
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedRisk, setAgreedRisk] = useState(false);
  const [agreedEligibility, setAgreedEligibility] = useState(false);

  const [setup, setSetup] = useState<AccountSetupState | null>(initialSetup ?? null);
  const [setupLoading, setSetupLoading] = useState(!initialSetup);
  const [setupError, setSetupError] = useState<string | null>(null);

  const { markOnboardingComplete } = useAuthStore();
  const { hapticFeedback } = useTelegram();
  const openLegalModal = useLegalModalStore((s) => s.openLegalModal);

  const slides: Slide[] = [
    {
      id: 0,
      title: "Welcome to TitanStream 👋",
      copy: "Access the global distributed cloud computing economy.\n\nProvision high-performance compute capacity with real-time USDT and local currency settlement.",
      icon: <Server size={28} />,
      gradient: "from-emerald-400 to-cyan-400",
      bgGlow: "bg-emerald-500/15",
    },
    {
      id: 1,
      title: "How do compute nodes operate?",
      copy: "Your provisioned machines perform distributed computational workloads around the clock.\n\nCollect settled compute yields directly into your internal wallet whenever you want.",
      icon: <TrendingUp size={28} />,
      gradient: "from-purple-400 to-indigo-400",
      bgGlow: "bg-purple-500/15",
    },
    {
      id: 2,
      title: "Automated Fleet Telemetry",
      copy: "Monitor real-time hashpower, hardware health, and network difficulty.\n\nManage cooling, optimize hash performance, or scale your node fleet with ease.",
      icon: <Cpu size={28} />,
      gradient: "from-rose-400 to-pink-400",
      bgGlow: "bg-rose-500/15",
    },
    {
      id: 3,
      title: "Audited Ledger & Security",
      copy: "Your assets are protected with enterprise-grade safeguards:\n\n• Verified double-entry accounting ledger\n• Transparent payouts via Mobile Money or on-chain USDT\n• Cryptographic session protection & zero ad tracking",
      icon: <ShieldCheck size={28} />,
      gradient: "from-amber-400 to-orange-400",
      bgGlow: "bg-amber-500/15",
    },
  ];

  const consentMeta = {
    title: "Compliance & Consent",
    gradient: "from-usdt-green to-emerald-400",
    bgGlow: "bg-usdt-green/15",
  };

  const isPersonalizationStep = currentStep === PERSONALIZATION_STEP;
  const isConsentStep = currentStep === CONSENT_STEP;
  const isConsentValid = agreedTerms && agreedRisk && agreedEligibility;

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const state = await getAccountSetup();
      setSetup(state);
    } catch {
      // Fail-open: personalization still renders with empty defaults so
      // onboarding is never hard-blocked by a transient fetch failure.
      // The backend remains authoritative on save.
      setSetupError('LOAD_FAILED');
    } finally {
      setSetupLoading(false);
    }
  }, []);

  useEffect(() => {
    // The app shell already fetched the authoritative snapshot on login;
    // only fetch here when it is absent (fresh mount race) or on retry.
    if (initialSetup) return;
    loadSetup();
  }, [loadSetup, initialSetup]);

  // Users whose canonical setup is already complete never see the step again.
  useEffect(() => {
    if (setup?.completed && currentStep === PERSONALIZATION_STEP) {
      setCurrentStep(CONSENT_STEP);
    }
  }, [setup, currentStep]);

  const goToStep = (step: number) => {
    // Never land on Personalization when the backend already reports completion.
    if (step === PERSONALIZATION_STEP && setup?.completed) {
      setCurrentStep(CONSENT_STEP);
      return;
    }
    setCurrentStep(step);
  };

  const handleNext = () => {
    hapticFeedback.impactOccurred('medium');
    if (!isConsentStep) {
      goToStep(currentStep + 1);
    } else {
      if (!isConsentValid) return;
      markOnboardingComplete();
      if (onComplete) onComplete();
    }
  };

  const handleSkipIntro = () => {
    hapticFeedback.impactOccurred('light');
    // Skip the product intro, but never the required personalization or consent.
    goToStep(setup?.completed ? CONSENT_STEP : PERSONALIZATION_STEP);
  };

  const handlePersonalizationSaved = (state: AccountSetupState) => {
    hapticFeedback.notificationOccurred('success');
    setSetup(state);
    // Advance only after the backend confirms the save. If the backend still
    // reports incomplete (e.g. edge validation), stay on this step.
    if (state.completed) {
      goToStep(CONSENT_STEP);
    }
  };

  const activeGradient = isConsentStep
    ? consentMeta.gradient
    : isPersonalizationStep
      ? 'from-gold to-amber-400'
      : slides[currentStep].gradient;
  const activeGlow = isConsentStep
    ? consentMeta.bgGlow
    : isPersonalizationStep
      ? 'bg-gold/15'
      : slides[currentStep].bgGlow;

  return (
    <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col select-none overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          key={`glow-${currentStep}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] ${activeGlow} rounded-full blur-[120px]`}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center font-black text-xs">₮</span>
          <span className="text-sm font-extrabold text-text-primary tracking-tight font-sans">TitanStream</span>
        </div>

        {!isConsentStep && !isPersonalizationStep && (
          <button
            onClick={handleSkipIntro}
            className="text-[11px] font-semibold text-text-tertiary hover:text-text-secondary px-3 py-1.5 rounded-full bg-white/5 border border-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Skip to account setup"
          >
            Review & Accept
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-8 max-w-sm mx-auto w-full overflow-y-auto py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center w-full"
          >
            {isPersonalizationStep ? (
              <AccountPersonalizationStep
                initial={setup}
                loading={setupLoading}
                loadError={setupError}
                onRetry={loadSetup}
                onSaved={handlePersonalizationSaved}
              />
            ) : (
              <>
                {/* Icon */}
                <div className="relative mb-6">
                  <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${activeGradient} blur-2xl opacity-30 scale-125`} />
                  <div className={`relative w-[64px] h-[64px] rounded-3xl bg-gradient-to-br ${activeGradient} text-white flex items-center justify-center shadow-2xl border border-white/20`}>
                    {isConsentStep ? <CheckCircle2 size={28} /> : slides[currentStep].icon}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-[20px] font-black text-text-primary tracking-tight font-sans leading-tight mb-3">
                  {isConsentStep ? consentMeta.title : slides[currentStep].title}
                </h2>

                {/* Copy */}
                {!isConsentStep ? (
                  <div className="space-y-2">
                    {slides[currentStep].copy.split('\n\n').map((paragraph, i) => (
                      <p key={i} className="text-[13px] text-text-secondary leading-relaxed font-medium font-sans">
                        {paragraph.startsWith('•') ? (
                          <span className="text-left block">{paragraph}</span>
                        ) : paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  /* Mandatory Consent & Compliance Checklist */
                  <div className="w-full space-y-3 text-left">
                    <p className="text-[11px] text-text-tertiary text-center mb-1">
                      Please acknowledge each statement to activate your node terminal:
                    </p>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 cursor-pointer transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="accent-gold w-4 h-4 mt-0.5 shrink-0 rounded"
                      />
                      <span className="text-[11px] text-text-secondary leading-snug">
                        I accept the{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); openLegalModal('terms'); }}
                          className="text-gold font-bold underline hover:text-gold-bright"
                        >
                          Terms of Service
                        </button>
                        {', '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); openLegalModal('privacy'); }}
                          className="text-gold font-bold underline hover:text-gold-bright"
                        >
                          Privacy Policy
                        </button>
                        {', and '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); openLegalModal('refund'); }}
                          className="text-gold font-bold underline hover:text-gold-bright"
                        >
                          Refund Policy
                        </button>
                        .
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 cursor-pointer transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={agreedRisk}
                        onChange={(e) => setAgreedRisk(e.target.checked)}
                        className="accent-gold w-4 h-4 mt-0.5 shrink-0 rounded"
                      />
                      <span className="text-[11px] text-text-secondary leading-snug">
                        I understand that TitanStream is a distributed compute provider and <strong className="text-white">not a bank or investment fund</strong>. Compute yields are dynamic and not guaranteed.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 cursor-pointer transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={agreedEligibility}
                        onChange={(e) => setAgreedEligibility(e.target.checked)}
                        className="accent-gold w-4 h-4 mt-0.5 shrink-0 rounded"
                      />
                      <span className="text-[11px] text-text-secondary leading-snug">
                        I confirm I am <strong className="text-white">at least 18 years of age</strong> and not a resident of an OFAC-sanctioned or legally prohibited jurisdiction.
                      </span>
                    </label>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => openLegalModal('business')}
                        className="text-[10px] text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1"
                      >
                        <span>View Corporate Details & Licenses</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 max-w-sm mx-auto w-full px-6 sm:px-8 pb-8 space-y-4">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <motion.div
              key={idx}
              animate={{
                width: idx === currentStep ? 24 : 6,
                opacity: idx === currentStep ? 1 : 0.25,
              }}
              transition={{ duration: 0.3 }}
              className={`h-[6px] rounded-full ${
                idx === currentStep
                  ? `bg-gradient-to-r ${activeGradient}`
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* CTA Button (personalization owns its own Continue CTA) */}
        {!isPersonalizationStep && (
          <button
            onClick={handleNext}
            disabled={isConsentStep && !isConsentValid}
            className={`w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg press-feedback transition-all focus-visible:ring-2 focus-visible:ring-gold ${
              isConsentStep
                ? isConsentValid
                  ? 'bg-gold text-app-bg shadow-gold/25 hover:brightness-110'
                  : 'bg-white/5 text-text-tertiary border border-white/5 cursor-not-allowed'
                : 'bg-white/10 text-text-primary border border-white/10 hover:bg-white/15'
            }`}
            aria-label={isConsentStep ? 'Confirm compliance consent and start' : 'Proceed to next onboarding step'}
          >
            {isConsentStep ? (
              <>
                <Lock size={15} />
                <span>Confirm & Activate Terminal</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
