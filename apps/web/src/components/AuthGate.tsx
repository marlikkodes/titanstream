import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, ShieldCheck, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useAuthStore, type SessionData } from '../store/useAuthStore';
import { useTelegram } from '../context/TelegramContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_TIMEOUT_MS = 12_000;
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || 'titanstream_bot';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSession(data: any, platform: 'telegram' | 'web'): SessionData {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    onboarding: data.onboarding,
    isNewUser: data.isNewUser,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    platform,
  };
}

// ─── AuthGate ─────────────────────────────────────────────────────────────────

/**
 * AuthGate — single component that owns the complete authentication lifecycle.
 *
 * Platform routing:
 *   Mini App  →  POST /auth/telegram (initData HMAC)
 *   Web       →  Telegram Login Widget → POST /auth/telegram-login
 *
 * The gate renders:
 *   - Nothing (transparent) when authentication succeeds — the parent renders the app
 *   - A loading screen while authentication is in progress
 *   - A clear error screen with retry when authentication fails
 *   - The Telegram Login Widget when running in a browser
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady, isMiniApp, webApp } = useTelegram();

  // Fix 4: Individual selectors prevent unnecessary re-renders from unrelated store changes
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isAuthLoading);
  const authError = useAuthStore((s) => s.authError);
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const setAuthLoading = useAuthStore((s) => s.setAuthLoading);
  const setAuthError = useAuthStore((s) => s.setAuthError);
  const clearSession = useAuthStore((s) => s.clearSession);

  const authAttempted = useRef(false);

  // ── Modern Telegram Login Library authentication with server Nonce ────────
  const handleTelegramLoginLibrary = useCallback(async () => {
    const traceId = `tg_web_${Date.now().toString(36)}`;
    console.info(`[AUTH_GATE:${traceId}] web.login_library_triggered`);
    setAuthLoading(true);
    setAuthError(null);

    try {
      // 1. Fetch server-generated random nonce
      const nonceRes = await api.post('/auth/telegram-nonce');
      const nonce = nonceRes.data?.data?.nonce;
      if (!nonce) throw new Error('Failed to generate authentication nonce.');

      // 2. Ensure Telegram Login JS Library is loaded
      if (!(window as any).Telegram?.Login) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://telegram.org/js/telegram-login.js?1';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Telegram Login JS Library'));
          document.head.appendChild(script);
        });
      }

      const tgLogin = (window as any).Telegram?.Login;
      if (!tgLogin) throw new Error('Telegram Login JS library unavailable');

      // 3. Trigger interactive Telegram Login popup authorization
      tgLogin.auth(
        {
          bot_id: BOT_USERNAME,
          request_access: 'write',
          nonce: nonce,
        },
        async (user: any) => {
          if (!user) {
            setAuthLoading(false);
            console.warn(`[AUTH_GATE:${traceId}] web.login_cancelled_by_user`);
            return;
          }

          console.info(`[AUTH_GATE:${traceId}] web.login_callback_received id=${user.id}`);
          try {
            const res = await api.post('/auth/telegram-login', { ...user, nonce });
            const body = res.data;

            if (!body.success || !body.data) throw new Error(body.error?.message || 'Authentication failed');
            console.info(`[AUTH_GATE:${traceId}] web.auth.success userId=${body.data.user.telegramUserId}`);
            setSession(buildSession(body.data, 'web'));
          } catch (backendErr: any) {
            const msg = backendErr.response?.data?.error?.message || backendErr.message || 'Telegram verification failed';
            console.error(`[AUTH_GATE:${traceId}] web.auth.failed reason=${msg}`);
            setAuthLoading(false);
            setAuthError(msg);
          }
        },
      );
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Telegram login initialization failed';
      console.error(`[AUTH_GATE:${traceId}] web.init.failed reason=${msg}`);
      setAuthLoading(false);
      setAuthError(msg);
    }
  }, [setSession, setAuthLoading, setAuthError]);

  const [webDeepLink, setWebDeepLink] = useState<string | null>(null);
  const [webSessionCode, setWebSessionCode] = useState<string | null>(null);
  const [isWaitingForTelegramAuth, setIsWaitingForTelegramAuth] = useState(false);

  // ── Create Web Auth Session on Web mount ─────────────────────────────────
  useEffect(() => {
    if (!isReady || isMiniApp || isAuthenticated) return;

    let isMounted = true;
    const initWebSession = async () => {
      try {
        const res = await api.post('/auth/web-session/create');
        if (isMounted && res.data?.success && res.data?.data) {
          setWebDeepLink(res.data.data.deepLink);
          setWebSessionCode(res.data.data.sessionCode);
        }
      } catch (err) {
        console.error('[AUTH_GATE] web_session_create_failed', err);
      }
    };

    initWebSession();
    return () => { isMounted = false; };
  }, [isReady, isMiniApp, isAuthenticated]);

  // ── Poll Web Auth Session status ──────────────────────────────────────────
  useEffect(() => {
    if (!webSessionCode || isAuthenticated || isMiniApp) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.post('/auth/web-session/poll', { sessionCode: webSessionCode });
        const body = res.data;
        if (body?.success && body?.data?.status === 'AUTHENTICATED') {
          console.info(`[AUTH_GATE] web_deep_link.auth_success userId=${body.data.user.telegramUserId}`);
          clearInterval(interval);
          setSession(buildSession(body.data, 'web'));
        }
      } catch (err) {
        // Silently retry polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [webSessionCode, isAuthenticated, isMiniApp, setSession]);

  // ── Main auth orchestration effect ────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return; // Wait for Telegram SDK to initialize

    // If the user is already authenticated, do nothing.
    // Token refresh is handled transparently by the API interceptor in api.ts.
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated && authState.session?.accessToken) {
      console.info(`[AUTH_GATE] session.active userId=${authState.session.user.telegramUserId}`);
      return;
    }

    if (authAttempted.current) return;
    authAttempted.current = true;

    if (isMiniApp) {
      authenticateMiniApp();
    }
  }, [isReady, isMiniApp, authenticateMiniApp]);

  // ── Retry handler ──────────────────────────────────────────────────────────
  const handleRetry = () => {
    authAttempted.current = false;
    setAuthError(null);
    if (isMiniApp) {
      authenticateMiniApp();
      authAttempted.current = true;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER DECISION TREE
  //
  //  Order matters. Each condition is mutually exclusive with those above it.
  //  The "Connecting…" screen ONLY appears during genuine initial bootstrap.
  //  Once isAuthenticated is true, children are ALWAYS rendered — the API
  //  interceptor handles token refresh transparently in the background.
  // ══════════════════════════════════════════════════════════════════════════

  // 1. Waiting for Zustand hydration or Telegram SDK — genuine initial bootstrap
  if (!hasHydrated || !isReady) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none">
        <Loader2 size={28} className="text-usdt-green animate-spin mb-4" />
        <p className="text-text-secondary text-sm">Connecting…</p>
      </div>
    );
  }

  // 2. Authenticated — render the app. Period.
  //    No isSessionExpired() check here. Token refresh is handled by api.ts interceptor.
  //    If the refresh fails (401), the interceptor calls clearSession() → isAuthenticated
  //    becomes false → next render will show login/error screen.
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 3. Loading — auth in progress
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none">
        <Loader2 size={32} className="text-usdt-green animate-spin mb-4" />
        <p className="text-text-secondary text-sm font-medium">
          {isMiniApp ? 'Signing you in…' : 'Signing you in…'}
        </p>
        <p className="text-text-tertiary text-xs mt-2 opacity-60">Powered by Telegram</p>
      </div>
    );
  }

  // 4. Error
  if (authError) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none px-8">
        <div className="flex items-center gap-3 text-red-400 mb-4">
          <AlertCircle size={22} />
          <p className="text-sm font-semibold">Please Sign In Again</p>
        </div>
        <p className="text-text-tertiary text-xs text-center max-w-xs mb-8 leading-relaxed">{authError}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 py-[14px] px-8 rounded-2xl bg-[#2AABEE] text-white font-extrabold text-[14px] hover:brightness-110 transition-all active:scale-[0.97]"
        >
          <RefreshCw size={15} />
          Try Again
        </button>
        {!isMiniApp && (
          <button
            onClick={() => setAuthError(null)}
            className="mt-4 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Back to Sign In
          </button>
        )}
      </div>
    );
  }

  const [authTab, setAuthTab] = useState<'telegram' | 'whatsapp'>('telegram');
  const [waPhone, setWaPhone] = useState('');
  const [waOtpCode, setWaOtpCode] = useState('');
  const [waStep, setWaStep] = useState<'phone' | 'otp'>('phone');
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waMessage, setWaMessage] = useState<string | null>(null);

  // ── WhatsApp OTP Handlers ───────────────────────────────────────────
  const handleRequestWaOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waPhone || waPhone.trim().length < 8) {
      setWaError('Please enter a valid phone number with country code.');
      return;
    }
    setWaLoading(true);
    setWaError(null);
    try {
      const res = await api.post('/auth/whatsapp/request-otp', { phone: waPhone });
      setWaMessage(res.data?.message || 'If eligible, a 6-digit code has been dispatched to your WhatsApp.');
      setWaStep('otp');
    } catch (err: any) {
      setWaError(err.response?.data?.error?.message || err.message || 'Failed to request OTP code.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleVerifyWaOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waOtpCode || waOtpCode.length < 6) {
      setWaError('Please enter the 6-digit verification code.');
      return;
    }
    setWaLoading(true);
    setWaError(null);
    try {
      const res = await api.post('/auth/whatsapp/verify-otp', { phone: waPhone, code: waOtpCode });
      const body = res.data;
      if (!body.success || !body.data) throw new Error(body.error?.message || 'Verification failed');
      setSession(buildSession(body.data, 'web'));
    } catch (err: any) {
      setWaError(err.response?.data?.error?.message || err.message || 'Invalid or expired OTP code.');
    } finally {
      setWaLoading(false);
    }
  };

  // 5. Web — not authenticated, show Multi-Rail (Telegram + WhatsApp) login screen
  if (!isMiniApp) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center select-none overflow-y-auto">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.11, 0.06] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-usdt-green/10 rounded-full blur-[120px]"
          />
        </div>

        <div className="flex-[0.8]" />

        {/* Logo + brand */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center text-center px-8 max-w-sm"
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-[28px] bg-usdt-green/20 blur-2xl scale-150" />
            <div className="relative w-[80px] h-[80px] rounded-[24px] bg-gradient-to-br from-usdt-green via-emerald-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-usdt-green/20 border border-white/20">
              <span className="text-[36px] font-black text-white drop-shadow-md">₮</span>
            </div>
          </div>
          <h1 className="text-[32px] font-black text-text-primary tracking-tight font-sans leading-none">TitanStream</h1>
          <p className="text-[14px] text-text-secondary mt-2 font-semibold font-sans leading-snug">
            Unified Multi-Rail Access
          </p>
        </motion.div>

        <div className="flex-1" />

        {/* Multi-Rail Channel Tabs & Form */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-sm px-6 pb-8 flex flex-col items-center"
        >
          {/* Tab Selector */}
          <div className="w-full p-1 rounded-2xl bg-white/5 border border-white/10 flex items-center mb-5">
            <button
              onClick={() => { setAuthTab('telegram'); setWaError(null); }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                authTab === 'telegram'
                  ? 'bg-[#2AABEE] text-white shadow-md'
                  : 'text-text-tertiary hover:text-white'
              }`}
            >
              Telegram
            </button>
            <button
              onClick={() => { setAuthTab('whatsapp'); setWaError(null); }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                authTab === 'whatsapp'
                  ? 'bg-[#25D366] text-white shadow-md'
                  : 'text-text-tertiary hover:text-white'
              }`}
            >
              WhatsApp
            </button>
          </div>

          {/* Telegram Rail */}
          {authTab === 'telegram' && (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Primary Telegram Login Library Button */}
              <button
                onClick={handleTelegramLoginLibrary}
                className="w-full py-4 px-6 rounded-2xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#2AABEE]/25 transition-all active:scale-[0.98]"
              >
                <Send size={18} className="fill-current" />
                <span>Continue with Telegram</span>
              </button>

              {/* Secondary Deep Link Fallback */}
              <button
                onClick={() => {
                  const targetUrl = webDeepLink || `https://t.me/${BOT_USERNAME}`;
                  window.open(targetUrl, '_blank');
                  setIsWaitingForTelegramAuth(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs text-text-tertiary hover:text-white transition-colors"
              >
                Open in Telegram App (Deep Link)
              </button>

              {isWaitingForTelegramAuth && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-[#2AABEE] text-xs font-semibold w-full text-center justify-center">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Waiting for Telegram sign in...</span>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp Rail */}
          {authTab === 'whatsapp' && (
            <div className="w-full flex flex-col items-center">
              {waError && (
                <div className="w-full p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                  {waError}
                </div>
              )}

              {waMessage && waStep === 'otp' && (
                <div className="w-full p-3 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                  {waMessage}
                </div>
              )}

              {waStep === 'phone' ? (
                <form onSubmit={handleRequestWaOtp} className="w-full space-y-3">
                  <input
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="+256 700 000 000"
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-center text-sm focus:outline-none focus:border-[#25D366] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={waLoading || !waPhone}
                    className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {waLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyWaOtp} className="w-full space-y-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={waOtpCode}
                    onChange={(e) => setWaOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP code"
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-center tracking-[0.3em] text-lg focus:outline-none focus:border-[#25D366] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={waLoading || waOtpCode.length < 6}
                    className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {waLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify Code & Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWaStep('phone'); setWaError(null); }}
                    className="w-full text-xs text-text-tertiary hover:text-white transition-colors"
                  >
                    Change Phone Number
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-[10px] text-text-tertiary font-medium mt-4">
            <ShieldCheck size={12} className="text-usdt-green/50" />
            <span>Safe & Secure • Passwordless Authentication</span>
          </div>
        </motion.div>

        <div className="flex-1 max-h-[30px]" />
      </div>
    );
  }

  // 6. Mini App — not authenticated, no loading, no error.
  //    This only happens on first launch before auth starts. Auto-trigger auth.
  if (!authAttempted.current) {
    authAttempted.current = true;
    authenticateMiniApp();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none">
      <Loader2 size={28} className="text-usdt-green animate-spin mb-4" />
      <p className="text-text-secondary text-sm">Verifying your identity…</p>
    </div>
  );
};
