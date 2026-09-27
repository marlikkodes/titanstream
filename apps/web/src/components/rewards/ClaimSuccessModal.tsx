import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Copy, Check, Share2, Trophy, PartyPopper, Wallet } from 'lucide-react';
import type { MissionItem } from '../../services/growthService';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useTelegram } from '../../context/TelegramContext';
import { showToast } from '../Toast';
import Confetti from './Confetti';

interface ClaimSuccessModalProps {
  reward: MissionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const SHARE_BASE_URL = 'https://t.me/tetherstream_bot';

const useCountUp = (target: number, active: boolean, duration = 900) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
};

export const ClaimSuccessModal: React.FC<ClaimSuccessModalProps> = ({ reward, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback } = useTelegram();
  const amount = reward ? Number(reward.amount) || 0 : 0;
  const displayAmount = useCountUp(amount, isOpen && !!reward);

  useEffect(() => {
    if (isOpen && reward) {
      hapticFeedback.notificationOccurred('success');
    }
  }, [isOpen, reward, hapticFeedback]);

  if (!reward) return null;

  const shareText = `🎉 TITAN MOMENT 🎉\nI unlocked the ${reward.ruleName || 'Reward'} on Titan Stream — +${amount.toFixed(2)} ${reward.assetCode} awarded!\nJoin me & start building: ${SHARE_BASE_URL}`;

  const copyShareText = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    showToast('Titan moment copied — paste it anywhere!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const openAppScheme = (schemes: string[], webFallback: string) => {
    const started = Date.now();
    let launched = false;
    for (const scheme of schemes) {
      try {
        window.open(scheme, '_blank');
        launched = true;
      } catch {}
    }
    setTimeout(() => {
      if (launched && Date.now() - started > 1500) return;
      window.open(webFallback, '_blank');
    }, 1500);
  };

  const openSocialShare = (platform: string) => {
    let url = '';
    if (platform === 'telegram') {
      url = `https://t.me/share/url?url=${encodeURIComponent(SHARE_BASE_URL)}&text=${encodeURIComponent(shareText)}`;
    } else if (platform === 'whatsapp') {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    } else if (platform === 'x') {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    } else if (platform === 'tiktok') {
      copyShareText();
      openAppScheme(['snssdk1233://', 'tiktok://'], 'https://www.tiktok.com/');
      return;
    }
    if (url) window.open(url, '_blank');
  };

  const handleViewWallet = () => {
    hapticFeedback.impactOccurred('light');
    setActiveTab('wallet' as any);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {isOpen && <Confetti />}
          <div role="dialog" aria-modal="true" aria-label="Reward claimed" className="fixed inset-0 z-50 flex items-center justify-center rewards-modal-backdrop p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="w-full max-w-sm rewards-modal-surface border border-usdt-green/50 rounded-3xl p-6 space-y-4 text-text-primary my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto no-scrollbar"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PartyPopper size={18} className="text-gold" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-gold">Titan Moment</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Confirmation with count-up */}
              <div className="text-center py-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.25, 1] }}
                  transition={{ duration: 0.5, delay: 0.15, times: [0, 0.7, 1] }}
                  className="w-16 h-16 rounded-full bg-usdt-green/15 border border-usdt-green/40 flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(38,161,123,0.25)]"
                >
                  <Trophy size={28} className="text-usdt-green" />
                </motion.div>
                <div className="text-xs font-black text-text-primary">
                  🎉 I unlocked the {reward.ruleName || 'Reward'}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 bg-usdt-green/10 border border-usdt-green/30 rounded-full px-4 py-1.5">
                  <Wallet size={12} className="text-usdt-green" />
                  <span className="text-sm font-black font-mono text-usdt-green tabular-nums">
                    +{displayAmount.toFixed(2)} {reward.assetCode}
                  </span>
                </div>
                <div className="text-[10px] text-text-tertiary mt-2">
                  Credited to your wallet & recorded on the ledger.
                </div>
              </div>

              {/* Share actions */}
              <div className="space-y-2">
                <button
                  onClick={copyShareText}
                  className="w-full py-3 rounded-2xl bg-control-bg border border-white/10 text-xs font-bold text-text-primary flex items-center justify-center gap-1.5 press-feedback hover:border-usdt-green/30"
                >
                  {copied ? <Check size={14} className="text-usdt-green" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy My Moment'}</span>
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openSocialShare('telegram')}
                    className="py-2.5 rounded-xl bg-sky-500 text-white text-[10px] font-extrabold press-feedback"
                  >
                    Telegram
                  </button>
                  <button
                    onClick={() => openSocialShare('whatsapp')}
                    className="py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-extrabold press-feedback"
                  >
                    WhatsApp
                  </button>
                  <button
                    onClick={() => openSocialShare('x')}
                    className="py-2.5 rounded-xl bg-gray-800 text-white text-[10px] font-extrabold press-feedback"
                  >
                    X / Twitter
                  </button>
                </div>
                <button
                  onClick={() => openSocialShare('tiktok')}
                  className="w-full py-2.5 rounded-xl bg-black border border-white/20 text-white text-[10px] font-extrabold press-feedback flex items-center justify-center gap-1.5"
                >
                  <Share2 size={12} /> Share to TikTok
                </button>
              </div>

              <button
                onClick={handleViewWallet}
                className="w-full py-2 rounded-xl bg-usdt-green/10 border border-usdt-green/30 text-[11px] font-extrabold text-usdt-green press-feedback"
              >
                View Wallet
              </button>
              <button
                onClick={onClose}
                className="w-full py-1.5 rounded-xl text-[11px] font-bold text-text-secondary hover:text-text-primary"
              >
                Continue Building
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
