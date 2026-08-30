import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramContextType {
  /** Raw Telegram WebApp object, only available inside Mini App */
  webApp: any | null;
  /** Telegram user profile from initDataUnsafe */
  user: TelegramUser | null;
  /** Whether the Telegram SDK has been initialized */
  isReady: boolean;
  /** Detected platform */
  platform: 'telegram' | 'web';
  /** Whether app is running inside Telegram Mini App */
  isMiniApp: boolean;
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  /** Clears the session and logs the user out */
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  isReady: false,
  platform: 'web',
  isMiniApp: false,
  hapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {},
  },
  logout: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const TelegramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [webApp, setWebApp] = useState<any | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [platform, setPlatform] = useState<'telegram' | 'web'>('web');
  const clearSession = useAuthStore((s) => s.clearSession);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, [clearSession]);

  useEffect(() => {
    // Give the Telegram SDK a tick to mount on window
    const initialize = () => {
      const tg = (window as any).Telegram?.WebApp;
      const isTgApp = !!(tg && (tg.initData || tg.initDataUnsafe?.user));

      console.info(`[SDK_INIT] telegram.detected=${isTgApp} initData.length=${tg?.initData?.length ?? 0}`);

      if (isTgApp) {
        tg.ready?.();
        tg.expand?.();
        setWebApp(tg);
        setPlatform('telegram');
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser) setUser(tgUser);
      } else {
        setPlatform('web');
      }

      setIsReady(true);
    };

    // Small delay to ensure window.Telegram is populated after script load
    if ((window as any).Telegram?.WebApp) {
      initialize();
    } else {
      const timer = setTimeout(initialize, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const isMiniApp = platform === 'telegram';

  const hapticFeedback = useMemo(() => {
    const isSupported = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) return false;
      if (typeof tg.isVersionAtLeast === 'function') {
        return tg.isVersionAtLeast('6.1');
      }
      return false;
    };

    return {
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
        try {
          if (isSupported()) {
            (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
          }
        } catch (_) {}
      },
      notificationOccurred: (type: 'error' | 'success' | 'warning') => {
        try {
          if (isSupported()) {
            (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
          }
        } catch (_) {}
      },
      selectionChanged: () => {
        try {
          if (isSupported()) {
            (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged();
          }
        } catch (_) {}
      },
    };
  }, []);

  return (
    <TelegramContext.Provider value={{ webApp, user, isReady, platform, isMiniApp, hapticFeedback, logout }}>
      {children}
    </TelegramContext.Provider>
  );
};

export const useTelegram = () => useContext(TelegramContext);
