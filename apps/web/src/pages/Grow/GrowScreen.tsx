import type React from 'react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReferralStore } from '../../store/useReferralStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { showToast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { DestinationLoader } from '../../components/DestinationLoader';
import { NextBestActionCard } from '../../components/NextBestActionCard';
import { ReferralAssistanceModal } from '../../components/ReferralAssistanceModal';
import { ValueBankCard } from '../../components/growth/ValueBankCard';
import { SocialMissionCard } from '../../components/growth/SocialMissionCard';
import { useGrowthStore } from '../../store/useGrowthStore';
import { 
  Copy, 
  Share2, 
  Users, 
  Flame, 
  Star, 
  Award, 
  Gift, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Sparkles, 
  ChevronRight, 
  BarChart3,
  Unlock,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Send
} from 'lucide-react';
import { CurrencyDisplay } from '../../components/DualCurrencyDisplay';

const LIFECYCLE_STAGES = [
  { key: 'REGISTERED', label: 'Registered', step: 1, color: 'text-text-secondary', bg: 'bg-white/10' },
  { key: 'ONBOARDED', label: 'Onboarded', step: 2, color: 'text-ton-blue', bg: 'bg-ton-blue/15' },
  { key: 'QUALIFIED', label: 'Qualified', step: 3, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  { key: 'PAYING', label: 'Paying', step: 4, color: 'text-usdt-green', bg: 'bg-usdt-green/15' },
  { key: 'REWARDED', label: 'Rewarded', step: 5, color: 'text-gold', bg: 'bg-gold/15' },
];

const getStatusStep = (status: string): number => {
  switch (status) {
    case 'ONBOARDED': return 2;
    case 'QUALIFIED': return 3;
    case 'PAYING': return 4;
    case 'REWARDED': return 5;
    default: return 1;
  }
};

const getStatusHint = (status: string): string => {
  switch (status) {
    case 'REGISTERED': return 'Needs platform onboarding';
    case 'ONBOARDED': return 'Needs 1st settlement to qualify';
    case 'QUALIFIED': return 'Qualified • 1st settlement complete';
    case 'PAYING': return 'Active paying operator';
    case 'REWARDED': return 'Reward credited to wallet';
    default: return 'Pending activation';
  }
};

const getInitial = (name?: string) => (name || '?')[0].toUpperCase();

export const GrowScreen: React.FC = () => {
  const {
    invitedCount,
    qualifiedCount,
    payingCount,
    computeBoost,
    earnedUsdt,
    networkContributionUsdt,
    qualificationStatus,
    referralLink,
    webReferralLink,
    telegramReferralLink,
    referralCode,
    referrals,
    isLoading,
    error,
    fetchReferrals,
  } = useReferralStore();

  const {
    socialMissions,
    valueBank,
    fetchSocialMissions,
    fetchValueBank,
    participateInSocialMission,
    claimSocialVirtualReward,
  } = useGrowthStore();

  const { setActiveTab } = useNavigationStore();
  const [copied, setCopied] = useState(false);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals();
    fetchSocialMissions();
    fetchValueBank();
  }, [fetchReferrals, fetchSocialMissions, fetchValueBank]);

  if (isLoading && referrals.length === 0 && !error) {
    return <DestinationLoader destination="grow" />;
  }

  const linkToShare = referralLink || webReferralLink;
  const isWithdrawalUnlocked = qualificationStatus?.isWithdrawalUnlocked ?? (qualifiedCount >= 5);
  const remainingForWithdrawal = qualificationStatus?.withdrawalRemaining ?? Math.max(0, 5 - qualifiedCount);

  const handleCopy = () => {
    navigator.clipboard.writeText(linkToShare);
    setCopied(true);
    showToast('Web referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    const tg = window.Telegram?.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegramReferralLink || linkToShare)}&text=${encodeURIComponent('Join my Titan Stream network — earn money daily with instant mobile money payouts and cloud hash power! 🚀')}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    const text = `Join my Titan Stream network — earn money daily with instant mobile money payouts: ${linkToShare}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="p-4 flex flex-col gap-5 select-none relative pb-28 bg-[#050c12] min-h-full font-sans">
      {/* DESTINATION HEADER — Growth Network */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 font-mono flex items-center gap-1.5">
            <Zap size={12} className="text-cyan-400" /> Community & Referral Rewards
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">Invite & Earn</h1>
        </div>

        <button
          onClick={() => {
            fetchReferrals();
            fetchSocialMissions();
            fetchValueBank();
          }}
          className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold hover:bg-cyan-500/25 transition-colors press-feedback"
          title="Refresh Rewards & Stats"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchReferrals()}
            className="px-3 py-1 rounded-xl bg-rose-500/20 font-bold hover:bg-rose-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* NEXT BEST ACTION CARD */}
      <NextBestActionCard />

      {/* VALUE BANK — ECONOMIC IMPACT LEDGER */}
      <ValueBankCard valueBank={valueBank} isLoading={isLoading} />

      {/* SOCIAL MISSIONS SECTION — TIER A/B/C/D */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-cyan-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-text-primary font-mono">
              Bonus Missions & Tasks
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
            {socialMissions.length} Active Tasks
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {socialMissions.map((m) => (
            <SocialMissionCard
              key={m.id}
              mission={m}
              onClaimVirtual={claimSocialVirtualReward}
              onParticipate={participateInSocialMission}
            />
          ))}
        </div>
      </div>

      {/* HERO SECTION — Network Performance & Economic Progression */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 bg-gradient-to-br from-[#081825] via-card-bg to-[#050c12] border border-cyan-500/30 relative overflow-hidden shadow-2xl space-y-4"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 font-mono">
            Your Community Stats
          </span>
          <span className="text-[10px] font-mono font-bold text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded-full border border-usdt-green/20">
            {computeBoost > 1 ? `+${Math.round((computeBoost - 1) * 100)}% MINING BOOST` : 'ACTIVE TEAM'}
          </span>
        </div>

        {/* 4-GRID ECONOMIC METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Friends Invited</div>
            <div className="text-xl font-black text-text-primary font-mono mt-1">
              {invitedCount}
            </div>
            <div className="text-[9px] text-text-tertiary font-mono mt-0.5">Joined with your link</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Active Friends</div>
            <div className="text-xl font-black text-cyan-400 font-mono mt-1">
              {qualifiedCount}
            </div>
            <div className="text-[9px] text-cyan-400/80 font-mono mt-0.5">Completed 1st trade</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Machine Owners</div>
            <div className="text-xl font-black text-usdt-green font-mono mt-1">
              {payingCount}
            </div>
            <div className="text-[9px] text-usdt-green/80 font-mono mt-0.5">Mining capacity active</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="text-[9px] font-bold text-text-tertiary uppercase">Total Earned</div>
            <div className="text-xl font-black text-gold font-mono mt-1">
              <CurrencyDisplay amount={earnedUsdt} size="sm" />
            </div>
            <div className="text-[9px] text-gold/80 font-mono mt-0.5">In your wallet</div>
          </div>
        </div>

        {/* WITHDRAWAL GATE PROGRESS BAR */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-text-primary">
              {isWithdrawalUnlocked ? (
                <>
                  <Unlock size={14} className="text-usdt-green" />
                  <span className="text-usdt-green">Cash Withdrawals Unlocked</span>
                </>
              ) : (
                <>
                  <Lock size={14} className="text-amber-400" />
                  <span>Withdrawal Qualification Target</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-400">
              {qualifiedCount} / 5 Active Friends
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isWithdrawalUnlocked ? 'bg-usdt-green' : 'bg-gradient-to-r from-cyan-500 to-amber-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (qualifiedCount / 5) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          <div className="text-[10px] text-text-tertiary flex items-center justify-between">
            <span>
              {isWithdrawalUnlocked
                ? 'Your account is fully verified for instant mobile money cashouts.'
                : `${remainingForWithdrawal} more active ${remainingForWithdrawal === 1 ? 'friend' : 'friends'} needed to unlock direct cashout.`}
            </span>
            <button
              onClick={() => setActiveTab('rewards')}
              className="text-cyan-400 font-bold hover:underline ml-2 shrink-0"
            >
              View Rewards →
            </button>
          </div>
        </div>

        {/* PRIMARY SHARING ACTION */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleShareTelegram}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 text-app-bg font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 press-feedback"
          >
            <Share2 size={16} />
            <span>SHARE ON TELEGRAM</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 press-feedback"
          >
            <Share2 size={16} />
            <span>SHARE ON WHATSAPP</span>
          </button>
        </div>
      </motion.div>

      {/* SHARE CENTER CARD */}
      <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-text-tertiary uppercase tracking-wider">Your Referral Link & Code</span>
          <span className="font-mono text-cyan-400 font-bold">{referralCode || 'TITAN888'}</span>
        </div>

        <div className="flex items-center gap-2 bg-control-bg p-2 rounded-xl border border-white/5">
          <input
            type="text"
            readOnly
            value={linkToShare || 'Generating link...'}
            className="bg-transparent text-xs font-mono text-text-primary flex-1 focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors press-feedback shrink-0 flex items-center gap-1 text-xs font-bold font-mono"
          >
            {copied ? <CheckCircle size={14} className="text-usdt-green" /> : <Copy size={14} />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>
      </div>

      {/* ACTIVATION PATHWAYS CARD — Monetization & Retention Loop */}
      <div className="web3-card rounded-2xl p-4 border border-cyan-500/20 bg-gradient-to-r from-cyan-950/30 to-black/50 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-text-primary uppercase tracking-wider">
          <Sparkles size={16} className="text-cyan-400" />
          <span>How To Earn More With Friends</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <div className="font-extrabold text-text-primary flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono">1</span>
              <span>Help Friends Start Mining</span>
            </div>
            <p className="text-[11px] text-text-secondary">
              When your invited friend completes their first deposit, trade, or settlement, they become <strong className="text-cyan-400">Active</strong>, unlocking your bonus reward.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
            <div className="font-extrabold text-text-primary flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center text-[10px] font-mono">2</span>
              <span>Machine Commission Rewards</span>
            </div>
            <p className="text-[11px] text-text-secondary">
              When your friends activate cloud compute capacity, you receive recurring mining commission rewards deposited straight to your wallet.
            </p>
          </div>
        </div>
      </div>

      {/* SUPPORTING SECTION — Friends Roster & Lifecycle Progression */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <Users size={14} className="text-cyan-400" />
            Invited Friends & Progress
          </h2>
          <span className="text-[10px] font-mono text-text-tertiary">
            {referrals.length} Total Friends
          </span>
        </div>

        {referrals.length > 0 ? (
          <div className="web3-card rounded-2xl divide-y divide-white/5 border border-white/10 overflow-hidden">
            {referrals.map((item) => {
              const currentStep = getStatusStep(item.status);
              const hint = getStatusHint(item.status);
              const name = item.refereeName || 'Operator';
              const username = item.refereeUsername ? `@${item.refereeUsername}` : null;
              const isUnqualified = item.status === 'REGISTERED' || item.status === 'ONBOARDED';

              return (
                <div key={item.id} className="p-3.5 flex flex-col gap-2.5 text-xs hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-400 text-xs">
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

                    <div className="flex items-center gap-2">
                      {isUnqualified && (
                        <button
                          onClick={() => setSelectedRefereeId(item.refereeId)}
                          className="py-1 px-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold hover:bg-cyan-500/25 transition-colors press-feedback flex items-center gap-1 text-[10px] font-mono"
                          title="Send setup instructions"
                        >
                          <Send size={11} />
                          <span>Guide</span>
                        </button>
                      )}

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono border ${
                          item.status === 'PAYING' || item.status === 'REWARDED'
                            ? 'bg-usdt-green/15 text-usdt-green border-usdt-green/30'
                            : item.status === 'QUALIFIED'
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            : 'bg-white/10 text-text-secondary border-white/10'
                        }`}>
                          {item.status}
                        </span>
                        <div className="text-[10px] text-text-tertiary font-mono mt-1">
                          {hint}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5-STEP LIFECYCLE PROGRESSION BAR */}
                  <div className="flex items-center gap-1 pt-1">
                    {LIFECYCLE_STAGES.map((stage) => {
                      const isCompleted = currentStep >= stage.step;
                      const isCurrent = currentStep === stage.step;
                      return (
                        <div key={stage.key} className="flex-1 flex flex-col gap-1">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              isCompleted
                                ? stage.step >= 4
                                  ? 'bg-usdt-green'
                                  : stage.step === 3
                                  ? 'bg-cyan-400'
                                  : 'bg-ton-blue'
                                : 'bg-white/10'
                            }`}
                          />
                          <span
                            className={`text-[8px] font-mono font-bold uppercase truncate ${
                              isCurrent ? stage.color : isCompleted ? 'text-text-secondary' : 'text-text-tertiary/40'
                            }`}
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={24} />}
            title="Start Your Growth Network"
            description="Invite your friends to earn verified USDT bonuses when they join and complete their first settlement!"
            actionLabel="Invite Your First Friend"
            onAction={handleShareTelegram}
            accentColor="cyan"
          />
        )}
      </div>

      {/* REFERRAL ASSISTANCE MODAL */}
      <ReferralAssistanceModal
        refereeId={selectedRefereeId}
        onClose={() => setSelectedRefereeId(null)}
      />

      {/* DISCOVERY & CROSS-PAGE ACTION FOOTER */}
      <div className="p-4 rounded-2xl bg-card-bg border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-text-primary">Claim Milestone Rewards</h3>
            <p className="text-[10px] text-text-secondary">
              Review claimable referral and performance bonuses in Rewards.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('rewards')}
          className="px-3.5 py-2 rounded-xl bg-gold/15 border border-gold/30 text-gold font-bold text-xs hover:bg-gold/25 transition-colors press-feedback shrink-0 flex items-center gap-1"
        >
          <span>Rewards</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
