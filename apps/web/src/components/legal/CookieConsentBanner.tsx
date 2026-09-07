import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { useLegalModalStore } from '../../store/useLegalModalStore';

const STORAGE_KEY = 'titan_cookie_consent_v1';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const openLegalModal = useLegalModalStore((s) => s.openLegalModal);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      // Short delay for smooth slide-up after initial app render
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(STORAGE_KEY, 'all');
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(STORAGE_KEY, 'essential');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 pointer-events-auto"
        role="region"
        aria-label="Cookie and local storage preferences"
      >
        <div className="web3-card bg-[#0b0e14]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center shrink-0">
                <Cookie size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                  Storage & Privacy Notice
                </h3>
                <span className="text-[10px] text-text-tertiary">GDPR & ePrivacy Compliant</span>
              </div>
            </div>
            <button
              onClick={handleEssentialOnly}
              className="p-1 rounded-lg text-text-tertiary hover:text-white transition-colors"
              aria-label="Dismiss cookie notice with essential settings"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed">
            We use essential local storage to keep you securely signed in and preserve your currency and theme preferences. We do not use invasive third-party ad tracking cookies.{' '}
            <button
              onClick={() => openLegalModal('cookies')}
              className="text-gold underline hover:text-gold-bright transition-colors font-semibold"
            >
              View Cookie Policy
            </button>
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcceptAll}
              className="flex-1 py-2 px-3 rounded-xl bg-gold hover:bg-gold-bright text-app-bg font-extrabold text-xs transition-colors shadow-md shadow-gold/20 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck size={14} />
              <span>Accept All</span>
            </button>
            <button
              onClick={handleEssentialOnly}
              className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-white font-bold text-xs transition-colors"
            >
              <span>Essential Only</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
