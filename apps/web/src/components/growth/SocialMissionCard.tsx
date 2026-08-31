import type React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, 
  Send, 
  Copy, 
  CheckCircle2, 
  Gift, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  Unlock, 
  Users, 
  TrendingUp, 
  Loader2 
} from 'lucide-react';
import type { SocialMission } from '../../services/growthService';
import { showToast } from '../Toast';

interface SocialMissionCardProps {
  mission: SocialMission;
  onClaimVirtual: (id: string) => Promise<any>;
  onParticipate: (id: string) => Promise<any>;
}

export const SocialMissionCard: React.FC<SocialMissionCardProps> = ({
  mission,
  onClaimVirtual,
  onParticipate,
}) => {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const shareUrl = `${window.location.origin}/?ref=${mission.trackingCode}`;

  const handleCopyLink = async () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast('Mission tracking link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
    try {
      await onParticipate(mission.id);
    } catch {
      // best-effort
    }
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(`Join my Titan Stream network & start earning daily with mobile money settlements! 🚀\n${shareUrl}`);
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Join my Titan Stream network — earn daily with instant mobile money cashouts: ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleClaimVirtual = async () => {
    setIsProcessing(true);
    try {
      const res = await onClaimVirtual(mission.id);
      if (res.alreadyClaimed) {
        showToast('Virtual reward already claimed!', 'info');
      } else {
        showToast(`+${res.crystals || mission.virtualRewardCrystals} 💎 Crystals Claimed!`, 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to claim reward', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'ENGAGEMENT':
        return { label: 'Social Bonus', style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' };
      case 'DISTRIBUTION':
        return { label: 'Invite Bonus', style: 'bg-purple-500/10 text-purple-400 border-purple-500/25' };
      case 'ACQUISITION':
        return { label: 'Community Task', style: 'bg-amber-500/10 text-amber-400 border-amber-500/25' };
      case 'REVENUE':
        return { label: 'Cash Bonus', style: 'bg-usdt-green/10 text-usdt-green border-usdt-green/25' };
      default:
        return { label: 'Bonus Mission', style: 'bg-white/5 text-text-tertiary border-white/10' };
    }
  };

  const badge = getTierBadge(mission.tier);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-[#091520] border border-white/10 relative overflow-hidden space-y-3 shadow-lg"
    >
      {/* TOP ROW: TIER & VIRTUAL REWARD */}
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${badge.style}`}>
          {badge.label}
        </span>

        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {mission.virtualRewardCrystals > 0 && (
            <span className="text-[#a7ffeb] font-bold">
              +{mission.virtualRewardCrystals} 💎
            </span>
          )}
          {mission.maxRewardUsdt > 0 && (
            <span className="text-usdt-green font-bold bg-usdt-green/10 px-1.5 py-0.5 rounded-md border border-usdt-green/20">
              +${mission.maxRewardUsdt.toFixed(2)} USDT Bonus
            </span>
          )}
        </div>
      </div>

      {/* MISSION TITLE & DESCRIPTION */}
      <div>
        <h4 className="text-xs font-black text-text-primary">{mission.name}</h4>
        <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
          {mission.description}
        </p>
      </div>

      {/* OVER-SETTLEMENT PROGRESS (IF MONETARY REWARD ATTACHED) */}
      {mission.requiredContributionUsdt > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-text-tertiary">Mission Progress</span>
            <span className={mission.isOverSettled ? 'text-usdt-green font-bold' : 'text-cyan-400 font-bold'}>
              ${mission.verifiedContributionUsdt.toFixed(2)} / ${mission.requiredContributionUsdt.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
            <motion.div
              className={`h-full rounded-full ${mission.isOverSettled ? 'bg-usdt-green' : 'bg-cyan-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${mission.progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="text-[8px] text-text-tertiary font-mono mt-0.5">
            {mission.isOverSettled ? '✓ Over-settlement verified' : `$${Math.max(0, mission.requiredContributionUsdt - mission.verifiedContributionUsdt).toFixed(2)} more value needed to unlock USDT`}
          </div>
        </div>
      )}

      {/* ACTION CONTROLS */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
        {/* VIRTUAL REWARD CTA */}
        {mission.virtualRewardCrystals > 0 && (
          <button
            disabled={mission.virtualRewardsClaimed || isProcessing}
            onClick={handleClaimVirtual}
            className={`py-1.5 px-3 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
              mission.virtualRewardsClaimed
                ? 'bg-white/5 text-text-tertiary border border-white/10 cursor-default'
                : 'bg-[#a7ffeb]/15 border border-[#a7ffeb]/30 text-[#a7ffeb] hover:bg-[#a7ffeb]/25 press-feedback'
            }`}
          >
            {isProcessing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : mission.virtualRewardsClaimed ? (
              <>
                <CheckCircle2 size={11} className="text-usdt-green" /> 💎 Claimed
              </>
            ) : (
              <>
                <Sparkles size={11} /> Claim +{mission.virtualRewardCrystals} 💎
              </>
            )}
          </button>
        )}

        {/* SHARING CONTROLS */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={handleShareTelegram}
            className="p-1.5 rounded-xl bg-ton-blue/15 border border-ton-blue/30 text-ton-blue hover:bg-ton-blue/25 transition-colors press-feedback"
            title="Share on Telegram"
          >
            <Send size={13} />
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="p-1.5 rounded-xl bg-usdt-green/15 border border-usdt-green/30 text-usdt-green hover:bg-usdt-green/25 transition-colors press-feedback"
            title="Share on WhatsApp"
          >
            <Share2 size={13} />
          </button>
          <button
            onClick={handleCopyLink}
            className="py-1.5 px-2.5 rounded-xl bg-white/5 border border-white/10 text-text-primary text-[10px] font-mono font-bold hover:bg-white/10 transition-colors press-feedback flex items-center gap-1"
          >
            {copied ? <CheckCircle2 size={11} className="text-usdt-green" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Link'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
