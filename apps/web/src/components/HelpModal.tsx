import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Server,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  Zap,
  Headphones,
  TrendingUp,
  Sparkles,
  Wallet,
  Users,
  Search,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers
} from 'lucide-react';
import { useTelegram } from '../context/TelegramContext';
import { useSupportStore } from '../store/useSupportStore';
import { useWalletStore } from '../store/useWalletStore';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type FAQCategory =
  | 'ALL'
  | 'Getting Started'
  | 'Machines'
  | 'Earnings'
  | 'Wallet'
  | 'Referrals'
  | 'Payments'
  | 'Trust & Security'
  | 'Growth'
  | 'Troubleshooting';

export interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  analogy?: string;
  paragraphs: string[];
  bulletPoints?: string[];
  nextTopicId?: string;
  nextTopicLabel?: string;
  icon: React.ReactNode;
}

export const LEARNING_CENTER_FAQS: FAQItem[] = [
  // 🚀 GETTING STARTED
  {
    id: 'gs_what_is',
    category: 'Getting Started',
    question: 'What is Titan Stream?',
    analogy: 'Imagine owning a small automated vending machine. You set it up, it works for you in the background, and whenever you want, you open it to collect your money.',
    paragraphs: [
      'Titan Stream is a simple platform that gives everyday people access to digital machines that generate daily income automatically.',
      'You do not need to own expensive physical equipment, understand complex technology, or stay logged in all day. Your machines operate continuously on safe cloud servers, and your earnings accumulate right inside your account.',
      'Everything is designed to be 100% beginner-friendly. You can start with a basic machine, watch your daily earnings grow, and move your money directly into your mobile money or wallet whenever you are ready.'
    ],
    nextTopicId: 'gs_how_begin',
    nextTopicLabel: 'How do I begin?',
    icon: <Server size={20} className="text-usdt-green" />
  },
  {
    id: 'gs_how_begin',
    category: 'Getting Started',
    question: 'How do I begin?',
    paragraphs: [
      'Getting started takes less than one minute! When you open Titan Stream, your first basic machine is automatically set up for you.',
      'Simply tap "Start Machine" on your dashboard. Your machine will begin earning money immediately every single second. You can check back anytime to see your balance grow, tap "Collect Earnings" to save your money into your wallet, and explore the Machine Shop if you want to upgrade to a faster machine.'
    ],
    bulletPoints: [
      'Step 1: Open the app & tap "Start Machine".',
      'Step 2: Watch your daily earnings counter grow in real time.',
      'Step 3: Tap "Collect Earnings" to move money into your wallet.',
      'Step 4: Take out your money to Mobile Money or your wallet anytime.'
    ],
    nextTopicId: 'gs_experience',
    nextTopicLabel: 'Do I need technical experience?',
    icon: <Sparkles size={20} className="text-amber-400" />
  },
  {
    id: 'gs_experience',
    category: 'Getting Started',
    question: 'Do I need any technical or financial experience?',
    paragraphs: [
      'Not at all! Titan Stream was specifically built for complete beginners who have never used digital earnings or online wallets before.',
      'If you know how to tap buttons on your mobile phone, you have all the skills you need. There are no technical setups, code, or complicated charts. Everything is written in clear, simple language.'
    ],
    nextTopicId: 'gs_why_trust',
    nextTopicLabel: 'Why should I trust this platform?',
    icon: <BookOpen size={20} className="text-cyan-400" />
  },
  {
    id: 'gs_why_trust',
    category: 'Getting Started',
    question: 'Why should I trust Titan Stream?',
    paragraphs: [
      'Trust and transparency are the foundational pillars of Titan Stream. You are always in total control of your money.',
      'Every single payment, deposit, referral reward, and machine earning is permanently recorded in your transparent transaction history. You can view your full activity timeline at any moment, and payouts to your Mobile Money or wallet are processed reliably.'
    ],
    bulletPoints: [
      '100% transparent live transaction history.',
      'Direct, fast payouts to local Mobile Money & wallets.',
      'Verified platform safety rating visible in your profile.',
      'Dedicated 24/7 Telegram support desk.'
    ],
    nextTopicId: 'mach_what_are',
    nextTopicLabel: 'Next: Learn all about Machines →',
    icon: <ShieldCheck size={20} className="text-emerald-400" />
  },

  // 🖥️ MACHINES
  {
    id: 'mach_what_are',
    category: 'Machines',
    question: 'What are machines and how do they work?',
    analogy: 'Think of a machine as an engine in a vehicle. A standard engine gets you down the road smoothly, but a supercharged turbo engine gets you there much faster. The stronger the engine, the more work it gets done.',
    paragraphs: [
      'In Titan Stream, a Machine is your primary digital asset that generates daily money.',
      'When your machine is active, it runs automatically on remote cloud servers 24 hours a day, 7 days a week. It processes automated tasks continuously in the background so you do not have to do any manual work yourself.'
    ],
    nextTopicId: 'mach_different',
    nextTopicLabel: 'Why do different machines earn different amounts?',
    icon: <Server size={20} className="text-indigo-400" />
  },
  {
    id: 'mach_different',
    category: 'Machines',
    question: 'Why do different machines earn different amounts?',
    paragraphs: [
      'Each machine model comes with a specific amount of Machine Power. Machine Power determines how fast your machine runs and how much money it generates per second.',
      'A basic starter machine (like Titan Core) provides steady entry-level daily earnings. Higher tier machines (like Titan Pro or Titan Ultra) have much stronger Machine Power and generate significantly higher daily earnings.'
    ],
    bulletPoints: [
      'Titan Core (10 Power) — Basic daily earnings starter.',
      'Titan Pulse (30 Power) — 3× faster daily earnings speed.',
      'Titan Shift (70 Power) — 7× boosted daily output.',
      'Titan Pro (150 Power) — High-capacity professional machine.',
      'Titan Ultra (350 Power) — Ultra-fast enterprise machine.'
    ],
    nextTopicId: 'mach_multiple',
    nextTopicLabel: 'Can I own more than one machine?',
    icon: <Zap size={20} className="text-amber-400" />
  },
  {
    id: 'mach_multiple',
    category: 'Machines',
    question: 'Can I own more than one machine?',
    paragraphs: [
      'Yes! You can own and run multiple machines simultaneously. All your active machines work together as a team.',
      'Their total Machine Power combines automatically to give you one grand total earning speed. The more machines you own, the higher your combined daily income will be.'
    ],
    nextTopicId: 'mach_stop',
    nextTopicLabel: 'Do machines ever stop working?',
    icon: <Layers size={20} className="text-purple-400" />
  },
  {
    id: 'mach_stop',
    category: 'Machines',
    question: 'Do machines ever stop working?',
    paragraphs: [
      'No, your machines operate continuously 24/7 on remote cloud servers. They never sleep, pause, or slow down when your phone is turned off or when you lose internet connection.',
      'The only thing you need to do is open the app once a day to tap "Start Machine" for your daily check-in cycle and collect your accumulated earnings.'
    ],
    nextTopicId: 'earn_how',
    nextTopicLabel: 'Next: Learn how Earnings work →',
    icon: <Clock size={20} className="text-sky-400" />
  },

  // 💰 EARNINGS
  {
    id: 'earn_how',
    category: 'Earnings',
    question: 'How do my machines generate earnings?',
    analogy: 'Imagine your machine as a digital clock that adds coins to your piggy bank with every tick of the second hand. As long as the clock is ticking, your bank keeps filling up.',
    paragraphs: [
      'Your machines generate earnings continuously every second. As soon as your machine is started, you will see your live earnings counter increasing in real time on your dashboard.',
      'These earnings accumulate in your "Ready to Collect" balance until you tap the "Collect Earnings" button to transfer them safely into your main wallet.'
    ],
    nextTopicId: 'earn_app_closed',
    nextTopicLabel: 'Do earnings continue when my phone is off?',
    icon: <DollarSign size={20} className="text-usdt-green" />
  },
  {
    id: 'earn_app_closed',
    category: 'Earnings',
    question: 'Do earnings continue when my app is closed or phone is off?',
    paragraphs: [
      'Yes! 100% of your earnings continue uninterrupted even when your phone is completely turned off, out of battery, or disconnected from the internet.',
      'Because your machines run on professional cloud servers in secure data centers around the world, your device status does not affect your earning speed. Whenever you reopen Titan Stream, your earnings will be waiting for you.'
    ],
    nextTopicId: 'earn_collect',
    nextTopicLabel: 'What happens when I collect my earnings?',
    icon: <Clock size={20} className="text-cyan-400" />
  },
  {
    id: 'earn_collect',
    category: 'Earnings',
    question: 'What happens when I tap "Collect Earnings"?',
    paragraphs: [
      'Tapping "Collect Earnings" takes all the money your machine has generated so far and moves it directly into your permanent Wallet Balance.',
      'Once money is in your Wallet Balance, it is 100% safe, verified, and available for you to use or take out to your Mobile Money account or personal crypto wallet anytime you choose.'
    ],
    bulletPoints: [
      'Your "Ready to Collect" counter resets to zero.',
      'The collected money is instantly added to your Wallet Balance.',
      'Your machine immediately continues earning fresh money every second.'
    ],
    nextTopicId: 'wall_what_is',
    nextTopicLabel: 'Next: Learn about your Wallet →',
    icon: <CheckCircle2 size={20} className="text-usdt-green" />
  },

  // 👛 WALLET
  {
    id: 'wall_what_is',
    category: 'Wallet',
    question: 'What is my wallet and how does it work?',
    analogy: 'Think of your wallet as your personal digital bank account inside Titan Stream. Money in your wallet belongs to you and is ready to be taken out whenever you wish.',
    paragraphs: [
      'Your Wallet is where all your verified funds are safely stored.',
      'It holds money you have collected from your machines, bonus rewards earned from inviting friends, and any funds you add to purchase new machines.'
    ],
    nextTopicId: 'wall_diff',
    nextTopicLabel: 'What is the difference between Wallet & Ready to Collect?',
    icon: <Wallet size={20} className="text-teal-400" />
  },
  {
    id: 'wall_diff',
    category: 'Wallet',
    question: 'What is the difference between "Wallet" and "Ready to Collect"?',
    paragraphs: [
      '"Ready to Collect" is money currently being generated by your running machines right now. It updates live every second on your dashboard.',
      '"Wallet Balance" is your finalized, permanent money that has already been collected or added. Only money in your Wallet Balance can be taken out to Mobile Money or used to buy machines.'
    ],
    nextTopicId: 'wall_add_take',
    nextTopicLabel: 'How do I add and take out money?',
    icon: <Layers size={20} className="text-amber-400" />
  },
  {
    id: 'wall_add_take',
    category: 'Wallet',
    question: 'How do I add money and take money out?',
    paragraphs: [
      'We support direct local Mobile Money options (Airtel Money, MTN Mobile Money), Card payments, and USDT wallet addresses.',
      'To add money: Go to your Wallet screen, tap "Add Money", choose Mobile Money, Card, or USDT, enter the amount, and follow the simple on-screen prompt.',
      'To take money out: Go to your Wallet or Withdraw screen, tap "Take Out Money", enter your USDT wallet address, and confirm. Payouts are processed fast.'
    ],
    nextTopicId: 'ref_why',
    nextTopicLabel: 'Next: Learn how Referrals work →',
    icon: <ArrowUpRight size={20} className="text-green-400" />
  },

  // 👥 REFERRALS
  {
    id: 'ref_why',
    category: 'Referrals',
    question: 'Why should I invite friends to Titan Stream?',
    analogy: 'Imagine a team relay race. Running by yourself is great, but running with a team of friends multiplies your overall speed and gives everyone a shared prize at the finish line.',
    paragraphs: [
      'Inviting friends is one of the fastest ways to boost your income on Titan Stream.',
      'For every friend who joins using your invite link and adds money for the first time, you receive a direct 5 USDT Cash Bonus in your wallet. In addition, every active friend permanently increases your Earning Speed!'
    ],
    bulletPoints: [
      '💰 5 USDT direct bonus for every active friend.',
      '⚡ Permanent Earning Speed multiplier boost.',
      '👑 Higher Safety Level & unlocked platform perks.',
      '🤝 Your friends lose nothing—they get full earnings too!'
    ],
    nextTopicId: 'pay_how_buy',
    nextTopicLabel: 'Next: Learn about Payments →',
    icon: <Users size={20} className="text-cyan-400" />
  },

  // 💳 PAYMENTS
  {
    id: 'pay_how_buy',
    category: 'Payments',
    question: 'How do I buy a machine?',
    paragraphs: [
      'Buying a machine is quick and simple.',
      'Go to the Machine Shop (Shop tab), browse the available machine catalog, and tap "Buy Machine" under your desired model. You can pay using your existing Wallet balance, Mobile Money, Card, or USDT.'
    ],
    nextTopicId: 'pay_failed',
    nextTopicLabel: 'What happens if a payment fails?',
    icon: <Zap size={20} className="text-gold" />
  },
  {
    id: 'pay_failed',
    category: 'Payments',
    question: 'What happens if a payment fails or is delayed?',
    paragraphs: [
      'Your money is never lost! If a Mobile Money transaction times out or fails due to network congestion, our automatic payment tracker will either re-verify your payment or refund it automatically.',
      'If your payment is pending for more than 5 minutes, simply tap "Refresh" on your payment tracker screen or message our 24/7 Telegram support team with your transaction reference.'
    ],
    nextTopicId: 'trust_safe',
    nextTopicLabel: 'Next: Learn about Security & Trust →',
    icon: <AlertTriangle size={20} className="text-rose-400" />
  },

  // 🛡️ TRUST & SECURITY
  {
    id: 'trust_safe',
    category: 'Trust & Security',
    question: 'Is my money 100% safe and secure?',
    paragraphs: [
      'Yes. Titan Stream uses enterprise-grade security protocols, encrypted connections, and verified double-entry ledger tracking for every single account.',
      'Your money is held in protected reserves, and withdrawal requests are executed reliably through automated payment rails directly to your personal Mobile Money account or wallet.'
    ],
    nextTopicId: 'grow_more',
    nextTopicLabel: 'Next: Learn how to grow your account →',
    icon: <ShieldCheck size={20} className="text-usdt-green" />
  },

  // 📈 GROWTH
  {
    id: 'grow_more',
    category: 'Growth',
    question: 'How do experienced users grow their earnings faster?',
    paragraphs: [
      'Experienced users maximize their daily income through a simple 3-step growth strategy:',
      '1. Upgrade Machines: Reinvest a portion of daily earnings to buy higher tier machines with stronger Machine Power.',
      '2. Invite Friends: Share their invite link on Telegram, WhatsApp, and social media to earn 5 USDT bonuses and permanent speed multipliers.',
      '3. Daily Check-ins: Log in daily to complete Quests and maintain a streak for extra Power rewards.'
    ],
    nextTopicId: 'trouble_not_changing',
    nextTopicLabel: 'Next: View Troubleshooting →',
    icon: <TrendingUp size={20} className="text-emerald-400" />
  },

  // ❓ TROUBLESHOOTING
  {
    id: 'trouble_not_changing',
    category: 'Troubleshooting',
    question: 'Why didn\'t my earnings change or counter stop?',
    paragraphs: [
      'If your earnings counter seems paused, make sure you have tapped "Start Machine" for today\'s daily cycle. Daily check-in activates your 24-hour earning cycle.',
      'If your counter is active but slow, consider upgrading your machine or inviting friends to boost your Machine Power speed.'
    ],
    icon: <Lock size={20} className="text-amber-400" />
  },
  {
    id: 'trouble_cant_collect',
    category: 'Troubleshooting',
    question: 'Why can\'t I collect earnings or take out money?',
    paragraphs: [
      'To collect earnings, your "Ready to Collect" balance must be greater than 0.0001 USDT. Simply wait a few moments for your machine to generate earnings.',
      'To take out money to your Mobile Money or wallet, ensure your requested amount is within your available Wallet Balance and meets the minimum unlock requirement shown on the Withdraw screen.'
    ],
    icon: <HelpCircle size={20} className="text-purple-400" />
  }
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { hapticFeedback } = useTelegram();
  const [activeCategory, setActiveCategory] = useState<FAQCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('gs_what_is');

  if (!isOpen) return null;

  const categories: FAQCategory[] = [
    'ALL',
    'Getting Started',
    'Machines',
    'Earnings',
    'Wallet',
    'Referrals',
    'Payments',
    'Trust & Security',
    'Growth',
    'Troubleshooting'
  ];

  const filteredFaqs = LEARNING_CENTER_FAQS.filter((item) => {
    const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
    const qLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      item.question.toLowerCase().includes(qLower) ||
      item.paragraphs.some((p) => p.toLowerCase().includes(qLower)) ||
      (item.analogy && item.analogy.toLowerCase().includes(qLower));

    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    hapticFeedback.selectionChanged();
    setExpandedId(expandedId === id ? null : id);
  };

  const handleNavigateTopic = (topicId: string) => {
    hapticFeedback.impactOccurred('medium');
    const target = LEARNING_CENTER_FAQS.find((f) => f.id === topicId);
    if (target) {
      setActiveCategory('ALL');
      setExpandedId(topicId);
      setTimeout(() => {
        const el = document.getElementById(`faq-${topicId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="w-full max-w-lg bg-app-bg border border-white/10 rounded-3xl p-4 sm:p-5 shadow-2xl max-h-[90vh] flex flex-col my-auto"
        >
          {/* Top Bar / Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-usdt-green/15 border border-usdt-green/30 text-usdt-green flex items-center justify-center shadow-md">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-text-primary tracking-tight">Learning Center & Guide</h2>
                <p className="text-[11px] text-text-tertiary font-medium">Master Titan Stream in simple steps</p>
              </div>
            </div>

            <button
              onClick={() => {
                hapticFeedback.impactOccurred('light');
                onClose();
              }}
              className="press-feedback p-2 rounded-full bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="mt-3 relative shrink-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics (e.g., wallet, machine, earnings)..."
              className="w-full bg-control-bg/60 text-text-primary text-xs rounded-2xl pl-9 pr-4 py-2.5 border border-white/10 focus:border-usdt-green/50 focus:outline-none placeholder:text-text-tertiary font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-3 shrink-0 no-scrollbar">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    hapticFeedback.selectionChanged();
                    setActiveCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold whitespace-nowrap press-feedback transition-all shrink-0 ${
                    isActive
                      ? 'bg-usdt-green text-app-bg shadow-md shadow-usdt-green/15'
                      : 'bg-control-bg/60 text-text-secondary hover:text-text-primary border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* FAQ Accordion List (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[300px]">
            {filteredFaqs.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-tertiary space-y-2">
                <HelpCircle size={32} className="mx-auto text-text-tertiary/40" />
                <p className="font-semibold text-text-secondary">No matching guide topics found</p>
                <p className="text-[11px]">Try adjusting your search terms or selecting another category.</p>
              </div>
            ) : (
              filteredFaqs.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    id={`faq-${item.id}`}
                    className={`glass-panel rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'border-usdt-green/40 bg-gradient-to-b from-card-bg to-usdt-green/5 shadow-lg'
                        : 'border-white/10 hover:border-white/20 bg-card-bg/40'
                    }`}
                  >
                    {/* Accordion Trigger Header */}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="w-full p-4 flex items-center justify-between text-left gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-control-bg border border-white/10 flex items-center justify-center shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-extrabold text-usdt-green uppercase tracking-wider block font-mono">
                            {item.category}
                          </span>
                          <h3 className="text-xs sm:text-sm font-extrabold text-text-primary truncate mt-0.5">
                            {item.question}
                          </h3>
                        </div>
                      </div>

                      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-text-secondary shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {/* Accordion Content Body */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-white/5 text-xs">
                            {/* Real-World Analogy Highlight Card if present */}
                            {item.analogy && (
                              <div className="p-3.5 rounded-2xl bg-usdt-green/10 border border-usdt-green/25 space-y-1">
                                <span className="text-[10px] font-extrabold text-usdt-green uppercase tracking-wider flex items-center gap-1">
                                  💡 Simple Analogy
                                </span>
                                <p className="text-xs text-text-primary font-medium leading-relaxed italic">
                                  "{item.analogy}"
                                </p>
                              </div>
                            )}

                            {/* Detailed Explanation Paragraphs */}
                            <div className="space-y-2 text-text-secondary leading-relaxed font-normal">
                              {item.paragraphs.map((p, pIdx) => (
                                <p key={pIdx}>{p}</p>
                              ))}
                            </div>

                            {/* Bullet points if present */}
                            {item.bulletPoints && item.bulletPoints.length > 0 && (
                              <div className="p-3 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1.5">
                                {item.bulletPoints.map((bp, bpIdx) => (
                                  <div key={bpIdx} className="flex items-start gap-2 text-text-primary font-medium text-[11px]">
                                    <span className="text-usdt-green shrink-0 mt-0.5">•</span>
                                    <span>{bp}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Guided Cross-Topic Link */}
                            {item.nextTopicId && (
                              <div className="pt-2">
                                <button
                                  onClick={() => handleNavigateTopic(item.nextTopicId!)}
                                  className="press-feedback w-full p-2.5 rounded-xl bg-usdt-green/15 border border-usdt-green/30 text-usdt-green font-extrabold text-xs flex items-center justify-between hover:bg-usdt-green/25 transition-all"
                                >
                                  <span>{item.nextTopicLabel || 'Next Topic'}</span>
                                  <ArrowRight size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer CTA & Support Operator Action */}
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2 shrink-0 text-center">
            <button
              onClick={() => {
                hapticFeedback.impactOccurred('medium');
                const subject = prompt('Brief description of your question:', 'Help with my account');
                if (!subject) return;
                const details = prompt('Details for support:');
                if (!details) return;

                const user = useTelegram().user;
                useSupportStore.getState().createTicket(
                  {
                    userTelegramId: user?.id?.toString() || '74829103',
                    userName: user?.first_name || 'Titan Stream User',
                    userUsername: user?.username ? `@${user.username}` : '@user',
                    userCountry: 'Uganda',
                    userBalanceUsdt: useWalletStore.getState().usdtBalance,
                    category: 'Funding',
                    priority: 'Normal',
                    status: 'Waiting for Admin',
                    subject,
                    runningMachinesCount: 1,
                  },
                  details
                );
                alert('Support request sent! We will reply directly to your Telegram chat.');
                onClose();
              }}
              className="press-feedback w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-usdt-green/20"
            >
              <Headphones size={14} /> Need Help? Contact 24/7 Support Desk
            </button>
            <p className="text-[10px] text-text-tertiary">
              Official Titan Stream Learning Center • Replies sync directly to your Telegram chat
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
