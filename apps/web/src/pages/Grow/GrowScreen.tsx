import type React from 'react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useReferralStore } from '../../store/useReferralStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { showToast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { DestinationLoader } from '../../components/DestinationLoader';
import { Copy, Share2, Users, Flame, Star, Award, Gift, CheckCircle, Clock, AlertCircle, TrendingUp, Sparkles, ChevronRight, BarChart3 } from 'lucide-react';
import { EducationCard } from '../../components/EducationCard';

import { CurrencyDisplay } from '../../components/DualCurrencyDisplay';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REGISTERED:  { label: 'Registered',  color: 'text-text-secondary',  icon: <Clock size={10} /> },
  ONBOARDED:   { label: 'Onboarded',   color: 'text-ton-blue',        icon: <CheckCircle size={10} /> },
  QUALIFIED:   { label: 'Qualified',   color: 'text-cyan-400',        icon: <CheckCircle size={10} /> },
  PAYING:      { label: 'Paying',      color: 'text-usdt-green',      icon: <CheckCircle size={10} /> },
  REWARDED:    { label: 'Rewarded',    color: 'text-gold',            icon: <CheckCircle size={10} /> },
  CREATED:     { label: 'Invited',     color: 'text-text-tertiary',   icon: <AlertCircle size={10} /> },
};

const getInitial = (name?: string) => (name || '?')[0].toUpperCase();

export const GrowScreen: React.FC = () => {
  const {
    invitedCount,
    computeBoost,
    earnedUsdt,
    referralLink,
    webReferralLink,
    telegramReferralLink,
    referralCode,
    referrals,
    isLoading,
    fetchReferrals,
  } = useReferralStore();

  const { setActiveTab } = useNavigationStore();

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  if (isLoading && referrals.length === 0) {
    return <DestinationLoader destination="grow" />;
  }

  const linkToShare = referralLink || webReferralLink;

  const handleCopy = () => {
    navigator.clipboard.writeText(linkToShare);
    showToast('Web referral link copied to clipboard!', 'success');
  };

  const handleShare = () => {
    const tg = window.Telegram?.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramReferralLink)}&text=${encodeURIComponent('Join my Titan Stream network — earn money daily with instant mobile money payouts! 🚀')}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const activeReferralsCount = referrals.filter((r) => r.status === 'QUALIFIED' || r.status === 'PAYING' || r.status === 'REWARDED').length;

  return (
    <div className="p-4 flex flex-col gap-5 select-none relative pb-28 bg-[#050c12] min-h-full">
      {/* DESTINATION HEADER — Friends & Network */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 font-mono">
            Grow Your Circle
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">Titan Friends</h1>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
          <Users size={22} />
        </div>
      </div>

      {/* HERO SECTION — Friends Network Momentum */}
      <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 bg-gradient-to-br from-[#081825] via-card-bg to-[#050c12] border border-cyan-500/30 relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 font-mono">
            Network Momentum
          </span>
          <span className="text-[10px] font-mono font-bold text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded-full border border-usdt-green/20">
            FRIENDS CIRCLE
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Friends Joined</div>
            <div className="text-xl font-black text-text-primary font-mono mt-1">
              {invitedCount}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Active Friends</div>
            <div className="text-xl font-black text-cyan-400 font-mono mt-1">
              {activeReferralsCount}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Referral Rewards</div>
            <div className="text-xl font-black text-usdt-green font-mono mt-1">
              <CurrencyDisplay amount={earnedUsdt} size="sm" />
            </div>
          </div>
        </div>

        {/* PRIMARY ACTION BUTTON */}
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 text-app-bg font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 press-feedback"
        >
          <Share2 size={16} />
          <span>INVITE FRIENDS</span>
        </button>
      </motion.div>

      {/* SHARE CENTER CARD */}
      <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-text-tertiary uppercase tracking-wider">Your Personal Invite Link</span>
          <span className="font-mono text-cyan-400 font-bold">{referralCode || 'GENERATING'}</span>
        </div>

        <div className="flex items-center gap-2 bg-control-bg p-2 rounded-xl border border-white/5">
          <input
            type="text"
            readOnly
            value={referralLink || 'Loading link...'}
            className="bg-transparent text-xs font-mono text-text-primary flex-1 focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors press-feedback shrink-0"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* CROSS-PAGE CONTINUITY BANNER */}
      {activeReferralsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveTab('rewards')}
          className="p-3.5 rounded-2xl bg-usdt-green/10 border border-usdt-green/30 flex items-center justify-between cursor-pointer hover:border-usdt-green/50 transition-colors press-feedback"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-usdt-green/20 text-usdt-green flex items-center justify-center shrink-0">
              <Gift size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-text-primary">
                {activeReferralsCount} Referral Milestones Active
              </div>
              <div className="text-[10px] text-text-secondary">
                Network progression yields claimable reward badges. Tap to view Rewards.
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-usdt-green" />
        </motion.div>
      )}

      {/* SUPPORTING SECTION — Friends Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <Users size={14} className="text-cyan-400" />
            Friends Roster
          </h2>
          <span className="text-[10px] font-mono text-text-tertiary">
            {referrals.length} Total Friends
          </span>
        </div>

        {referrals.length > 0 ? (
          <div className="web3-card rounded-2xl divide-y divide-white/5 border border-white/10 overflow-hidden">
            {referrals.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.REGISTERED;
              const name = item.refereeName || 'Operator';
              const username = item.refereeUsername ? `@${item.refereeUsername}` : null;
              return (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-400 text-xs">
                      {getInitial(name)}
                    </div>
                    <div>
                      <div className="font-extrabold text-text-primary">{name}</div>
                      {username && (
                        <div className="text-[10px] text-cyan-400 font-mono">
                          {username}
                        </div>
                      )}
                      <div className="text-[10px] text-text-tertiary font-mono">
                        Joined {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-1 text-[10px] font-extrabold uppercase font-mono px-2 py-0.5 rounded-full border border-white/10 ${cfg.color}`}>
                    {cfg.icon}
                    <span>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title="Your Circle is Getting Started"
            description="Invite your first friend to earn USDT bonuses when they join and complete their first setup!"
            actionLabel="Invite a Friend"
            onAction={handleShare}
            accentColor="cyan"
          />
        )}
      </div>

      {/* DISCOVERY SECTION — Growth Analytics & Qualification Rules (10%) */}
      <div className="web3-card rounded-2xl p-4 border border-cyan-500/20 bg-cyan-950/20 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-text-primary">How Referral Rewards Work</h3>
            <p className="text-[10px] text-text-secondary leading-relaxed">
              When a friend joins with your link, they start as <strong className="text-text-primary">Registered</strong>. Once they complete their first mobile money settlement or machine setup, they become <strong className="text-cyan-400">Qualified</strong> and release your referral reward!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
