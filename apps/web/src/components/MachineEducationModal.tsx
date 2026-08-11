import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Cpu, Zap, HelpCircle, ChevronRight, X, Sparkles, ShoppingCart } from 'lucide-react';

interface MachineEducationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MachineEducationModal: React.FC<MachineEducationModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const cards = [
    {
      title: 'How Money Is Made',
      icon: <Server size={36} className="text-usdt-green" />,
      sentence: 'Global enterprises rent compute capacity to process workloads like AI training, data processing, and blockchain operations. Titan Stream routes these contracts directly to your assigned hardware. Your machine processes these tasks continuously, and you earn a share of the revenue generated from each completed workload.',
    },
    {
      title: 'Your Machine Engine',
      icon: <Cpu size={36} className="text-cyan-400" />,
      sentence: 'Your machine operates automatically 24/7 without any manual intervention. Yield continuously accumulates in real time based on your machine\'s hash power (GH/s) and current multiplier. You can tap the cooler to boost your speed up to 10x, but watch the temperature - if it overheats, a 5-second cooling period activates automatically.',
    },
    {
      title: 'Understanding Machine Tiers',
      icon: <Zap size={36} className="text-amber-400" />,
      sentence: 'Tier 0 (Free Trial) gives you 5 GH/s to start earning instantly. Higher tiers offer exponentially more power: Tier 1 (Ripple X14) provides 50 GH/s, Tier 2 (Quantum Core) delivers 200 GH/s, up to Tier 5 (StreamTitan 2028) with 5,000 GH/s. Each tier upgrade significantly increases your daily earnings potential.',
    },
    {
      title: 'Daily Earnings & Collection',
      icon: <Sparkles size={36} className="text-purple-400" />,
      sentence: 'Your daily earnings are calculated as: (Base Hash Rate × Multiplier × Rate Per GH/s). For example, a 200 GH/s machine at 2x multiplier earns approximately $0.40-$0.80 daily. Tap "Collect Now" on your Hub balance anytime to transfer accrued yield directly to your wallet balance for withdrawal.',
    },
    {
      title: 'How to Purchase a Machine',
      icon: <ShoppingCart size={36} className="text-gold" />,
      sentence: '1. Go to the Machine Shop in Titan Hub\n2. Select your desired machine tier\n3. Pay the one-time USDT price using your wallet balance or add funds\n4. Your machine activates instantly and starts earning immediately\n5. No subscription fees - you own the machine forever',
    },
    {
      title: 'Payment Methods & Funding',
      icon: <HelpCircle size={36} className="text-green-400" />,
      sentence: 'Add funds via Mobile Money, Card, or USDT directly in the Wallet tab. All transactions are secure and processed instantly. Once funded, you can purchase any machine tier immediately. Withdrawals are available anytime to your USDT wallet.',
    },
  ];

  if (!isOpen) return null;

  const currentCard = cards[currentStep];

  const handleNext = () => {
    if (currentStep < cards.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      localStorage.setItem('has_seen_machine_education_v2', 'true');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm glass-panel p-5 rounded-3xl border border-usdt-green/40 bg-[#0c0e15] shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-usdt-green" />
              <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                How Machines Work ({currentStep + 1}/6)
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {/* Card Body */}
          <div className="flex flex-col items-center text-center space-y-3 py-1">
            <div className="w-14 h-14 rounded-2xl bg-usdt-green/10 border border-usdt-green/30 flex items-center justify-center shadow-lg shadow-usdt-green/10 shrink-0">
              {currentCard.icon}
            </div>

            <h3 className="text-base font-black text-text-primary tracking-tight">{currentCard.title}</h3>

            <p className="text-xs font-medium text-text-secondary leading-relaxed px-1 whitespace-pre-line">
              {currentCard.sentence}
            </p>
          </div>

          {/* Step Indicators & Action Button */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              {cards.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-usdt-green' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-usdt-green/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <span>{currentStep === cards.length - 1 ? 'Got It!' : 'Next'}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
