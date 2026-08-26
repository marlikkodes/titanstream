import type React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
  children,
  width = 'sm:max-w-xl',
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
        {/* Mobile: full-screen overlay from bottom; Desktop: side drawer */}
        <motion.div
          initial={{ y: '100%', x: 0 }}
          animate={{ y: 0, x: 0 }}
          exit={{ y: '100%', x: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className={`
            fixed inset-x-0 bottom-0 top-0 sm:top-0 sm:right-0 sm:left-auto sm:bottom-0
            w-full sm:w-full ${width}
            z-50 bg-card-bg sm:border-l border-white/10 shadow-2xl
            flex flex-col
            sm:rounded-none rounded-t-2xl
          `}
        >
          {/* Mobile pull-down handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-text-tertiary/40" />
          </div>

          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-control-bg/40">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-text-primary truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-text-tertiary font-mono truncate mt-0.5">{subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer ml-auto"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable content with bottom safe area for mobile */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-12 sm:pb-6 space-y-6">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
