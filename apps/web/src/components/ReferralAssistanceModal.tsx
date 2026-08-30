import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, CheckCircle, Copy, AlertCircle, Sparkles, Send } from 'lucide-react';
import { growthService, type ReferralAssistance } from '../services/growthService';
import { showToast } from './Toast';

interface ReferralAssistanceModalProps {
  refereeId: string | null;
  onClose: () => void;
}

export const ReferralAssistanceModal: React.FC<ReferralAssistanceModalProps> = ({
  refereeId,
  onClose,
}) => {
  const [data, setData] = useState<ReferralAssistance | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!refereeId) return;
    setLoading(true);
    growthService
      .getReferralAssistance(refereeId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load referral assistance:', err?.message);
        setLoading(false);
      });
  }, [refereeId]);

  if (!refereeId) return null;

  const handleCopyMessage = () => {
    if (data?.helperMessage) {
      navigator.clipboard.writeText(data.helperMessage);
      setCopied(true);
      showToast('Guide message copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    if (data?.helperMessage) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://tetherstream.io')}&text=${encodeURIComponent(data.helperMessage)}`;
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    }
  };

  const handleShareWhatsApp = () => {
    if (data?.helperMessage) {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(data.helperMessage)}`, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="web3-card w-full max-w-md rounded-3xl p-5 bg-[#081825] border border-cyan-500/30 shadow-2xl relative space-y-4"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-primary">Referral Activation Guide</h3>
                <p className="text-[10px] text-text-secondary">Help your friend complete their qualification</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-text-tertiary font-mono">Loading setup instructions...</span>
            </div>
          ) : data ? (
            <div className="space-y-3.5">
              {/* OPERATOR STATUS & MISSING STEP */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-text-primary">{data.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                    data.isQualified ? 'bg-usdt-green/15 text-usdt-green border-usdt-green/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {data.status}
                  </span>
                </div>

                <div className="text-[11px] text-text-secondary flex items-start gap-1.5">
                  <AlertCircle size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Missing Step: <strong className="text-cyan-400">{data.missingStep}</strong>
                  </span>
                </div>
              </div>

              {/* RECOMMENDED HELPER MESSAGE */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  Customized Guide Message
                </div>
                <div className="p-3 rounded-xl bg-control-bg border border-white/10 text-xs font-mono text-text-primary leading-relaxed">
                  {data.helperMessage}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleShareTelegram}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-app-bg font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 press-feedback"
                >
                  <Send size={14} />
                  <span>Telegram</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 press-feedback"
                >
                  <Share2 size={14} />
                  <span>WhatsApp</span>
                </button>
              </div>

              <button
                onClick={handleCopyMessage}
                className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-colors press-feedback font-mono"
              >
                {copied ? <CheckCircle size={14} className="text-usdt-green" /> : <Copy size={14} />}
                <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY INSTRUCTION TEXT'}</span>
              </button>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-text-tertiary">
              Unable to load activation guide. Please try again.
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
