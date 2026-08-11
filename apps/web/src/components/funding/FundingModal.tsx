import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, CreditCard, ChevronRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { settlementService } from '../../services/settlementService';
import { PesapalFunding } from './PesapalFunding';
import { UsdtFunding } from './UsdtFunding';
import { useTelegram } from '../../context/TelegramContext';

interface FundingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FundingOption {
  id: 'MOBILE_MONEY' | 'CARD' | 'USDT';
  name: string;
  displayName: string;
  description: string;
  provider: string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD' | 'USDT';
  icon: React.ReactNode;
  badge: string;
}

const FUNDING_OPTIONS: FundingOption[] = [
  {
    id: 'MOBILE_MONEY',
    name: 'Mobile Money',
    displayName: 'Mobile Money',
    description: 'Pay securely with Airtel Money or MTN Mobile Money',
    provider: 'INTERNAL',
    paymentMethod: 'MOBILE_MONEY',
    icon: <Smartphone size={22} className="text-usdt-green" />,
    badge: 'Airtel / MTN',
  },
  {
    id: 'CARD',
    name: 'Card',
    displayName: 'Card',
    description: 'Pay securely with Visa or Mastercard',
    provider: 'INTERNAL',
    paymentMethod: 'CARD',
    icon: <CreditCard size={22} className="text-purple-400" />,
    badge: 'Visa / Mastercard',
  },
  {
    id: 'USDT',
    name: 'USDT',
    displayName: 'USDT',
    description: 'Pay directly using USDT on TRON (TRC-20) receiving address',
    provider: 'USDT',
    paymentMethod: 'USDT',
    icon: <Sparkles size={22} className="text-sky-400" />,
    badge: 'TRC-20 (TRON)',
  },
];

export const FundingModal: React.FC<FundingModalProps> = ({ isOpen, onClose }) => {
  const [selectedOption, setSelectedOption] = useState<FundingOption | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { hapticFeedback } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      loadCapabilities();
    } else {
      setSelectedOption(null);
    }
  }, [isOpen]);

  const loadCapabilities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Probes backend providers health/capabilities
      await settlementService.getProviders({ asset: 'USDT' });
    } catch (err: any) {
      console.warn('API provider capabilities load warning:', err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 select-none overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="w-full max-w-md bg-app-bg border border-white/10 rounded-3xl p-5 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto my-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-usdt-green/20 text-usdt-green flex items-center justify-center text-sm font-black">
                ₮
              </div>
              <h2 className="text-base font-extrabold text-text-primary">
                {selectedOption ? selectedOption.displayName : 'Fund Titan Stream'}
              </h2>
            </div>

            <button
              onClick={() => {
                hapticFeedback.impactOccurred('light');
                onClose();
              }}
              className="press-feedback p-1.5 rounded-full bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          {selectedOption ? (
            <div>
              {/* Back navigation button */}
              <button
                onClick={() => {
                  hapticFeedback.selectionChanged();
                  setSelectedOption(null);
                }}
                className="mb-4 text-xs font-bold text-usdt-green flex items-center gap-1 hover:underline"
              >
                ← Choose Different Payment Method
              </button>

              {/* Render Selected Method Workflow */}
              {selectedOption.id === 'MOBILE_MONEY' ? (
                <PesapalFunding paymentMethod="MOBILE_MONEY" onCancel={onClose} />
              ) : selectedOption.id === 'CARD' ? (
                <PesapalFunding paymentMethod="CARD" onCancel={onClose} />
              ) : (
                <UsdtFunding onCancel={onClose} />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-text-tertiary">
                Choose how you want to fund your account.
              </p>

              {/* Loading State */}
              {isLoading ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-usdt-green" />
                  <span className="text-xs text-text-tertiary">Loading payment options...</span>
                </div>
              ) : error ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                /* Funding Options List */
                <div className="space-y-3">
                  {FUNDING_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        hapticFeedback.impactOccurred('medium');
                        setSelectedOption(item);
                      }}
                      className="press-feedback w-full p-4 rounded-2xl glass-panel border border-white/10 hover:border-usdt-green/40 flex items-center justify-between transition-all group text-left"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-control-bg border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                          {item.icon}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-text-primary group-hover:text-usdt-green transition-colors">
                              {item.displayName}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-usdt-green/10 text-usdt-green border border-usdt-green/20">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs text-text-tertiary mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <ChevronRight size={18} className="text-text-tertiary group-hover:text-usdt-green group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}

                  {/* Operational Footer Info */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center gap-2.5 text-xs text-text-tertiary">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span>All deposits processed securely with real-time audit trail.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
