import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Monitor, Apple, X, Download, Sparkles } from 'lucide-react';
import { useTelegram } from '../context/TelegramContext';
import { showToast } from './Toast';

interface PWAInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  isInstalled?: boolean;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  isOpen,
  onClose,
  onInstall,
  isInstalled = false,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const { hapticFeedback } = useTelegram();

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    if (isIOS) {
      setDeviceType('ios');
    } else if (isAndroid) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Listen for beforeinstallprompt event (Chrome/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    hapticFeedback.impactOccurred('medium');

    if (deferredPrompt) {
      // Chrome/Android native install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        onInstall();
        showToast('App added to home screen successfully!', 'success');
      } else {
        showToast('Install cancelled', 'info');
      }
      
      setDeferredPrompt(null);
    } else {
      // Manual install instructions (iOS/Desktop)
      onInstall();
      showToast('Follow instructions to add to home screen.', 'info');
    }
  };

  const getDeviceIcon = () => {
    switch (deviceType) {
      case 'ios':
        return <Apple size={24} className="text-white" />;
      case 'android':
        return <Smartphone size={24} className="text-white" />;
      case 'desktop':
        return <Monitor size={24} className="text-white" />;
      default:
        return <Smartphone size={24} className="text-white" />;
    }
  };

  const getInstructions = () => {
    switch (deviceType) {
      case 'ios':
        return (
          <ol className="text-xs text-text-secondary space-y-2 list-decimal list-inside">
            <li>Tap the <strong>Share</strong> button (square with arrow) in Safari</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> in the top right corner</li>
            <li>The app icon will appear on your home screen</li>
          </ol>
        );
      case 'android':
        return deferredPrompt ? (
          <p className="text-xs text-text-secondary">
            Tap the button below to install the app directly to your home screen.
          </p>
        ) : (
          <ol className="text-xs text-text-secondary space-y-2 list-decimal list-inside">
            <li>Tap the <strong>Menu</strong> button (three dots) in Chrome</li>
            <li>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></li>
            <li>Confirm the installation</li>
            <li>The app icon will appear on your home screen</li>
          </ol>
        );
      case 'desktop':
        return (
          <ol className="text-xs text-text-secondary space-y-2 list-decimal list-inside">
            <li>Click the <strong>Install</strong> button in your browser's address bar</li>
            <li>Or go to browser menu and select <strong>"Install App"</strong></li>
            <li>Confirm the installation</li>
            <li>The app will be available on your computer</li>
          </ol>
        );
      default:
        return null;
    }
  };

  const getDeviceName = () => {
    switch (deviceType) {
      case 'ios':
        return 'iPhone/iPad';
      case 'android':
        return 'Android';
      case 'desktop':
        return 'Desktop';
      default:
        return 'Device';
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="w-full max-w-md bg-gradient-to-br from-[#1a1d2e] to-[#0f111a] border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-usdt-green to-emerald-500 flex items-center justify-center shadow-lg">
                  {getDeviceIcon()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-text-primary">Add to Home Screen</h3>
                  <p className="text-[11px] text-text-tertiary">{getDeviceName()} detected</p>
                </div>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.impactOccurred('light');
                  onClose();
                }}
                className="p-2 rounded-full bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 mb-6">
              {/* Reward Banner */}
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center">
                  <Sparkles size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-amber-400">🎁 Reward: 10 Crystals</p>
                  <p className="text-[10px] text-text-tertiary">Complete this step to earn rewards</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h4 className="text-xs font-extrabold text-text-primary mb-3 flex items-center gap-2">
                  <Download size={14} className="text-usdt-green" />
                  How to install:
                </h4>
                {getInstructions()}
              </div>

              {/* Benefits */}
              <div className="bg-control-bg/30 border border-white/5 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-text-tertiary uppercase">Benefits:</p>
                <ul className="text-[11px] text-text-secondary space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-usdt-green" />
                    Faster app access from home screen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-usdt-green" />
                    Works offline when needed
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-usdt-green" />
                    Better performance and experience
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleInstall}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-usdt-green to-emerald-500 text-app-bg font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 press-feedback"
              >
                <Download size={16} />
                <span>{deferredPrompt ? 'Install Now' : 'I\'ve Added It'}</span>
              </button>
              
              <button
                onClick={() => {
                  hapticFeedback.impactOccurred('light');
                  onClose();
                }}
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-text-secondary text-xs font-bold hover:bg-white/10 transition-colors press-feedback"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
