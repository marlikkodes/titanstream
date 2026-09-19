import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, ShieldCheck, Send, Smartphone, Laptop, QrCode, MessageSquare, ArrowLeft, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useAuthStore, type SessionData } from '../store/useAuthStore';
import { useTelegram } from '../context/TelegramContext';
import { detectDeviceContext, type LoginDeviceContext } from '../utils/deviceDetector';
import { QRCodeDisplay } from './QRCodeDisplay';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOT_ID = (import.meta.env.VITE_TELEGRAM_BOT_ID as string) || '8496859322';
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

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. ALL HOOK DECLARATIONS AT TOP OF COMPONENT (Rules of Hooks Compliance)
  const { isReady, isMiniApp } = useTelegram();

  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isAuthLoading);
  const authError = useAuthStore((s) => s.authError);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setAuthLoading = useAuthStore((s) => s.setAuthLoading);
  const setAuthError = useAuthStore((s) => s.setAuthError);

  const authAttempted = useRef(false);

  // Local UI states
  const [webDeepLink, setWebDeepLink] = useState<string | null>(null);
  const [webSessionCode, setWebSessionCode] = useState<string | null>(null);
  const [isWaitingForTelegramAuth, setIsWaitingForTelegramAuth] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  const [authTab, setAuthTab] = useState<'telegram' | 'whatsapp'>('telegram');

  // WhatsApp Conversational Approval & Device-Aware States
  const [deviceContext, setDeviceContext] = useState<LoginDeviceContext>('unknown');
  const [waViewMode, setWaViewMode] = useState<'auto' | 'qr_pin' | 'deep_link' | 'otp'>('auto');
  
  const [waChallengeId, setWaChallengeId] = useState<string | null>(null);
  const [waBrowserProof, setWaBrowserProof] = useState<string | null>(null);
  const [waDeepLink, setWaDeepLink] = useState<string | null>(null);
  const [waTransportReady, setWaTransportReady] = useState<boolean | null>(null);
  const [waTransportStatus, setWaTransportStatus] = useState<string | null>(null);
  const [waExpiresAt, setWaExpiresAt] = useState<Date | null>(null);
  const [waTimeRemaining, setWaTimeRemaining] = useState<number>(120);
  const [waStatus, setWaStatus] = useState<'PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'DECLINED' | 'EXPIRED'>('PENDING');

  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waMessage, setWaMessage] = useState<string | null>(null);

  // Traditional OTP fallback states
  const [waStep, setWaStep] = useState<'phone' | 'otp'>('phone');
  const [waPhone, setWaPhone] = useState('');
  const [waOtpCode, setWaOtpCode] = useState('');

  // Detect device context on mount
  useEffect(() => {
    setDeviceContext(detectDeviceContext());
  }, []);

  // Persisted browser state is never authentication proof. A protected backend
  // request must validate the signed token before this gate renders the app.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      setSessionVerified(false);
      return;
    }

    let active = true;
    setSessionVerified(false);
    
    // Verify session with canonical identity check using dedicated endpoint
    api.get('/auth/verify-identity')
      .then((response) => {
        if (!active) return;
        
        // API responses are wrapped by TransformInterceptor as { success, data }.
        // Unwrap the envelope before validating the canonical identity mapping.
        const verificationData = response.data?.data ?? response.data;
        const { verified, userId, identityId, telegramUserId, mappingConsistent, hasChannels, channels } = verificationData;
        
        // Log identity verification for audit trail
        console.info(`[IDENTITY_VERIFICATION] Session verified: verified=${verified}, userId=${userId}, identityId=${identityId}, telegramUserId=${telegramUserId}, mappingConsistent=${mappingConsistent}, hasChannels=${hasChannels}`);
        
        // REJECT session if identity mapping is inconsistent - this prevents loading wrong user data
        if (!mappingConsistent) {
          console.error(`[IDENTITY_VERIFICATION] Identity mapping inconsistency detected: userId=${userId} != identityId=${identityId}. REJECTING SESSION.`);
          clearSession();
          return;
        }
        
        setSessionVerified(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error(`[IDENTITY_VERIFICATION] Session verification failed:`, error);
        clearSession();
      });

    return () => { active = false; };
  }, [hasHydrated, isAuthenticated, clearSession]);

  // ── Mini App authentication (initData HMAC) ────────────────────────────────
  const authenticateMiniApp = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        throw new Error('Telegram Mini App initData is not available. Please reopen Titan Stream from Telegram.');
      }
      console.info(`[SDK_INIT] telegram.detected=true initData.length=${initData.length}`);
      const res = await api.post('/auth/telegram', { initData });
      const body = res.data;
      if (!body.success || !body.data) {
        throw new Error(body.error?.message || 'Authentication failed');
      }
      console.info(`[AUTH_GATE] mini_app.auth.success userId=${body.data?.user?.telegramUserId || 'unknown'}`);
      setSession(buildSession(body.data, 'telegram'));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Authentication failed';
      console.error(`[AUTH_GATE] mini_app.auth.failed reason=${msg}`);
      setAuthLoading(false);
      setAuthError(msg);
    }
  }, [setSession, setAuthLoading, setAuthError]);

  // ── Manual fallback trigger for explicit deep-link choice ─────────────────
  const handleInitiateDeepLinkFallback = useCallback(async () => {
    setIsWaitingForTelegramAuth(true);
    try {
      const res = await api.post('/auth/web-session/create');
      if (res.data?.success && res.data?.data) {
        setWebDeepLink(res.data.data.deepLink);
        setWebSessionCode(res.data.data.sessionCode);
        window.open(res.data.data.deepLink, '_blank');
      } else {
        window.open(`https://t.me/${BOT_USERNAME}`, '_blank');
      }
    } catch {
      window.open(`https://t.me/${BOT_USERNAME}`, '_blank');
    }
  }, []);

  const [preFetchedNonce, setPreFetchedNonce] = useState<string | null>(null);

  // Pre-fetch nonce on mount for instant zero-delay popup authorization
  useEffect(() => {
    if (!isAuthenticated && !isMiniApp) {
      api.post('/auth/telegram-nonce')
        .then((res) => {
          if (res.data?.data?.nonce) setPreFetchedNonce(res.data.data.nonce);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, isMiniApp]);

  // ── Telegram Web Login with explicit Origin & Nonce ───────────────────────
  const handleTelegramLoginLibrary = useCallback(() => {
    const traceId = `tg_web_${Date.now().toString(36)}`;
    console.info(`[AUTH_GATE:${traceId}] web.login_triggered`);
    setIsWaitingForTelegramAuth(true);
    setAuthError(null);

    const nonce = preFetchedNonce || `tgn_m_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

    if (!preFetchedNonce) {
      api.post('/auth/telegram-nonce')
        .then((res) => { if (res.data?.data?.nonce) setPreFetchedNonce(res.data.data.nonce); })
        .catch(() => {});
    }

    const origin = window.location.origin;
    const authUrl = `https://oauth.telegram.org/auth?response_type=post_message&client_id=${encodeURIComponent(BOT_ID)}&origin=${encodeURIComponent(origin)}&request_access=write&nonce=${encodeURIComponent(nonce)}`;

    const width = 550;
    const height = 650;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    let popup: Window | null = null;
    try {
      popup = window.open(authUrl, 'telegram_oauth', `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0`);
    } catch (e) {
      console.warn(`[AUTH_GATE:${traceId}] window.open exception:`, e);
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!popup || popup.closed || popup.width === 0) {
      console.warn(`[AUTH_GATE:${traceId}] mobile.popup_blocked, initiating fallback`);
      setIsWaitingForTelegramAuth(false);
      if (isMobile) {
        window.location.href = authUrl;
      } else {
        handleInitiateDeepLinkFallback();
      }
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin || !event.origin.includes('telegram.org')) return;
      try {
        const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const userPayload = raw.result || raw.user || raw.data || (raw.event === 'auth_result' ? raw.result : null);
        if (!userPayload) return;

        window.removeEventListener('message', handleMessage);
        try { popup?.close(); } catch {}

        const userId = userPayload.id || userPayload.telegramUserId;
        console.info(`[AUTH_GATE:${traceId}] web.login_callback_received id=${userId}`);
        const pendingRef = localStorage.getItem('pending_referral_code') || sessionStorage.getItem('pending_referral_code');
        
        let sessionData: any = null;
        try {
          const res = await api.post('/auth/telegram-login', { ...userPayload, nonce, referralCode: pendingRef });
          if (res.data?.success && res.data?.data) {
            sessionData = res.data.data;
          }
        } catch (apiErr: any) {
          console.warn(`[AUTH_GATE:${traceId}] API telegram-login notice:`, apiErr?.message);
        }

        if (!sessionData) {
          throw new Error('Telegram verification failed. Invalid user payload.');
        }

        console.info(`[AUTH_GATE:${traceId}] web.auth.success userId=${sessionData?.user?.telegramUserId || 'unknown'}`);
        setIsWaitingForTelegramAuth(false);
        setSession(buildSession(sessionData, 'web'));
      } catch (backendErr: any) {
        const msg = backendErr.response?.data?.error?.message || backendErr.message || 'Telegram verification failed';
        console.error(`[AUTH_GATE:${traceId}] web.auth.failed reason=${msg}`);
        setIsWaitingForTelegramAuth(false);
        setAuthError(msg);
      }
    };

    window.addEventListener('message', handleMessage);
  }, [setSession, setAuthError, handleInitiateDeepLinkFallback, preFetchedNonce]);

  // ── Poll Web Auth Session status ──────────────────────────────────────────
  useEffect(() => {
    if (!webSessionCode || isAuthenticated || isMiniApp) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.post('/auth/web-session/poll', { sessionCode: webSessionCode });
        const body = res.data;
        if (body?.success && body?.data?.status === 'AUTHENTICATED') {
          console.info(`[AUTH_GATE] web_deep_link.auth_success userId=${body.data?.user?.telegramUserId || 'unknown'}`);
          clearInterval(interval);
          setSession(buildSession(body.data, 'web'));
        }
      } catch {
        // Silently retry polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [webSessionCode, isAuthenticated, isMiniApp, setSession]);

  // ── Main auth orchestration effect ────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;

    const authState = useAuthStore.getState();
    if (authState.isAuthenticated && authState.session?.accessToken) {
      const telegramUserId = authState.session.user?.telegramUserId || authState.session.user?.id || 'unknown';
      console.info(`[AUTH_GATE] session.active userId=${telegramUserId}`);
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
    setIsWaitingForTelegramAuth(false);
    if (isMiniApp) {
      authenticateMiniApp();
      authAttempted.current = true;
    }
  };

  // ── WhatsApp Login Challenge Handler ──────────────────────────────────────
  const createWhatsAppChallenge = useCallback(async () => {
    setWaLoading(true);
    setWaError(null);
    try {
      const deviceInfo = `${deviceContext.toUpperCase()} (${navigator.platform || 'Web'})`;
      const res = await api.post('/auth/whatsapp/login-challenge', { deviceInfo });
      const payload = res.data?.data || res.data;
      if (payload?.challengeId) {
        setWaChallengeId(payload.challengeId);
        setWaBrowserProof(payload.browserProof);
        setWaDeepLink(payload.waDeepLink);
        setWaTransportReady(payload.transportReady === true);
        setWaTransportStatus(payload.transportStatus || null);
        setWaExpiresAt(new Date(payload.expiresAt));
        setWaTimeRemaining(600);
        setWaStatus('PENDING');
        if (payload.transportReady === false) {
          setWaError('WhatsApp sign-in is temporarily unavailable. The secure gateway is offline or needs pairing. Please try again shortly.');
        }
      }
    } catch (err: any) {
      setWaError(err.response?.data?.error?.message || err.message || 'Failed to initialize WhatsApp sign-in request.');
    } finally {
      setWaLoading(false);
    }
  }, [deviceContext]);

  // Auto-initialize challenge when switching to WhatsApp tab
  useEffect(() => {
    if (authTab === 'whatsapp' && !waChallengeId && waViewMode !== 'otp') {
      createWhatsAppChallenge();
    }
  }, [authTab, waChallengeId, waViewMode, createWhatsAppChallenge]);

  // Challenge Polling & Timer Effect
  useEffect(() => {
    if (!waChallengeId || !waBrowserProof || waTransportReady !== true || isAuthenticated || authTab !== 'whatsapp') return;

    // Timer countdown
    const timerInterval = setInterval(() => {
      setWaTimeRemaining((prev) => {
        if (prev <= 1) {
          setWaStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll challenge status every 2s
    const pollInterval = setInterval(async () => {
      try {
        const res = await api.post('/auth/whatsapp/challenge-status', {
          challengeId: waChallengeId,
          browserProof: waBrowserProof,
        });
        const payload = res.data?.data || res.data;
        const status = String(payload?.status || '').toUpperCase();
        const accessToken = payload?.accessToken || payload?.sessionTokens?.accessToken || res.data?.accessToken;

        if (status === 'APPROVED') {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          setWaStatus('APPROVED');
          const refreshToken = payload?.refreshToken || payload?.sessionTokens?.refreshToken || res.data?.refreshToken;
          const user = payload?.user || payload?.sessionTokens?.user || res.data?.user;
          if (!accessToken || !refreshToken || !user) {
            setWaError('WhatsApp approval completed, but the secure browser session could not be issued. Please try again.');
            return;
          }
          const sessionPayload = {
            ...payload,
            accessToken,
            refreshToken,
            user,
            onboarding: { currentStep: 'COMPLETED', isCompleted: true },
            isNewUser: false,
          };
          setSession(buildSession(sessionPayload, 'web'));
        } else if (status === 'DECLINED') {
          clearInterval(pollInterval);
          clearInterval(timerInterval);
          setWaError('WhatsApp login declined. Access was not granted.');
        } else if (status) {
          setWaStatus(status as any);
        }
      } catch {
        // Silently retry polling
      }
    }, 2000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [waChallengeId, waBrowserProof, isAuthenticated, authTab, setSession]);

  // Traditional OTP Handlers
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
      const payload = res.data?.data || res.data;
      setWaMessage(payload?.message || 'If eligible, a 6-digit code has been dispatched to your WhatsApp.');
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
      const sessionPayload = body?.data || body;
      if (!sessionPayload?.accessToken) throw new Error(body?.error?.message || 'Verification failed');
      setSession(buildSession(sessionPayload, 'web'));
    } catch (err: any) {
      setWaError(err.response?.data?.error?.message || err.message || 'Invalid or expired OTP code.');
    } finally {
      setWaLoading(false);
    }
  };

  // Format timer MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER DECISION TREE
  // ══════════════════════════════════════════════════════════════════════════

  if (!hasHydrated || !isReady) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none">
        <Loader2 size={28} className="text-usdt-green animate-spin mb-4" />
        <p className="text-text-secondary text-sm">Connecting…</p>
      </div>
    );
  }

  if (isAuthenticated && sessionVerified) {
    return <>{children}</>;
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg text-text-secondary">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex flex-col items-center justify-center select-none">
        <Loader2 size={32} className="text-usdt-green animate-spin mb-4" />
        <p className="text-text-secondary text-sm font-medium">Signing you in…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06070b] flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-[#0f111a] border border-red-500/20 shadow-2xl flex flex-col items-center text-center">
          <div className="p-3.5 rounded-full bg-red-500/10 text-red-400 mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Authentication Error</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-6">{authError}</p>
          <button
            onClick={handleRetry}
            className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Calculate active UI mode for WhatsApp
  const isMobileContext = deviceContext === 'mobile';
  const showDesktopMode = waViewMode === 'qr_pin' || (!isMobileContext && waViewMode === 'auto');

  return (
    <div className="fixed inset-0 z-50 bg-[#06070b]/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-auto">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full p-6 md:p-8 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Header */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2AABEE] to-[#25D366] p-0.5 mb-5 shadow-lg shadow-[#25D366]/10 flex items-center justify-center">
            <div className="w-full h-full bg-[#0f111a] rounded-[14px] flex items-center justify-center">
              <span className="font-black text-xl text-white tracking-tighter">TS</span>
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">TitanStream</h1>
          <p className="text-xs text-gray-400 max-w-xs font-medium leading-relaxed mb-6">
            Access high-performance cloud compute capacity with instant settlements.
          </p>

          {/* Auth Rail Tabs */}
          <div className="w-full grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#141722] border border-white/5 mb-6">
            <button
              type="button"
              onClick={() => { setAuthTab('telegram'); setWaError(null); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                authTab === 'telegram'
                  ? 'bg-[#2AABEE] text-white shadow-md shadow-[#2AABEE]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Send size={14} className="fill-current" />
              <span>Telegram</span>
            </button>

            <button
              type="button"
              onClick={() => { setAuthTab('whatsapp'); setWaViewMode('auto'); setWaError(null); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                authTab === 'whatsapp'
                  ? 'bg-[#25D366] text-white shadow-md shadow-[#25D366]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare size={14} className="fill-current" />
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Telegram Rail */}
          {authTab === 'telegram' && (
            <div className="w-full flex flex-col items-center space-y-3">
              <button
                onClick={handleTelegramLoginLibrary}
                disabled={isWaitingForTelegramAuth}
                className="w-full py-4 px-5 rounded-2xl bg-[#2AABEE] hover:bg-[#2299d6] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-[#2AABEE]/25 transition-all active:scale-[0.98] disabled:opacity-50 border border-white/10"
              >
                {isWaitingForTelegramAuth ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Waiting for Telegram Sign In…</span>
                  </>
                ) : (
                  <>
                    <Send size={20} className="fill-current" />
                    <span>Continue with Telegram</span>
                  </>
                )}
              </button>

              <button
                onClick={handleInitiateDeepLinkFallback}
                className="w-full py-3 px-4 rounded-xl text-xs text-gray-400 hover:text-white transition-colors font-semibold"
              >
                Open in Telegram App (Deep Link)
              </button>

              {isWaitingForTelegramAuth && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-[#2AABEE] text-xs font-bold w-full text-center justify-center mt-1 animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Authorizing via Telegram popup…</span>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp Conversational Approval Rail */}
          {authTab === 'whatsapp' && (
            <div className="w-full flex flex-col items-center">
              {/* Error Alert */}
              {waError && (
                <div className="w-full p-4 mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center leading-relaxed space-y-3">
                  <p>{waError}</p>
                  <button
                    onClick={createWhatsAppChallenge}
                    className="py-2 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mx-auto border border-red-500/30"
                  >
                    <RefreshCw size={14} />
                    <span>Retry Sign-In Request</span>
                  </button>
                </div>
              )}

              {/* Status Indicator Banner */}
              {waStatus === 'AWAITING_APPROVAL' && (
                <div className="w-full p-3.5 mb-4 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-bold text-center leading-relaxed flex items-center justify-center gap-2 animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Request sent! Check WhatsApp to approve sign-in.</span>
                </div>
              )}

              {/* ── Mode A: Desktop / QR + PIN View ───────────────────────────────── */}
              {showDesktopMode && waViewMode !== 'otp' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  {waLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center">
                      <Loader2 size={28} className="text-[#25D366] animate-spin mb-3" />
                      <p className="text-xs text-gray-400 font-medium">Generating secure sign-in request…</p>
                    </div>
                  ) : waStatus === 'EXPIRED' ? (
                    <div className="w-full py-8 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-gray-400 font-semibold mb-4">Sign-in request expired after 10 minutes.</p>
                      <button
                        onClick={createWhatsAppChallenge}
                        className="py-3 px-6 rounded-2xl bg-[#25D366] text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#25D366]/20 active:scale-95 transition-all"
                      >
                        <RefreshCw size={14} />
                        <span>Generate Fresh Code</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-300">
                        <Laptop size={12} className="text-[#25D366]" />
                        <span>Desktop Cross-Device Sign In</span>
                      </div>

                      {waTransportReady === false ? (
                        <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs text-center leading-relaxed">
                          <p className="font-bold">WhatsApp gateway unavailable</p>
                          <p className="mt-1 text-amber-100/80">{waTransportStatus === 'ACCOUNT_CONNECTING' ? 'The gateway is reconnecting. Please wait, then retry.' : 'The gateway needs an administrator to reconnect or pair the WhatsApp account.'}</p>
                        </div>
                      ) : (
                        <>
                          {waDeepLink && <QRCodeDisplay value={waDeepLink} size={160} />}

                          <div className="text-[11px] text-gray-400 text-center leading-relaxed space-y-1">
                            <p>1. Scan QR code above with your phone camera or WhatsApp.</p>
                            <p>2. Send the pre-filled approval message from WhatsApp.</p>
                          </div>
                        </>
                      )}

                      {/* Countdown Timer */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                        <span>Expires in:</span>
                        <span className="font-bold text-white">{formatTimer(waTimeRemaining)}</span>
                      </div>

                      {/* Action buttons */}
                      {waDeepLink && waTransportReady === true && (
                        <a
                          href={waDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#25D366] via-[#20bd5a] to-[#128C7E] hover:brightness-110 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#25D366]/20 transition-all border border-white/20 active:scale-[0.98]"
                        >
                          <ExternalLink size={15} />
                          <span>Open WhatsApp Chat Directly</span>
                        </a>
                      )}

                      <button
                        onClick={() => setWaViewMode('deep_link')}
                        className="text-xs text-gray-400 hover:text-white transition-colors font-semibold"
                      >
                        Using WhatsApp on this mobile device?
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Mode B: Mobile / Direct Deep-Link View ───────────────────────── */}
              {(!showDesktopMode || waViewMode === 'deep_link') && waViewMode !== 'otp' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-300">
                    <Smartphone size={12} className="text-[#25D366]" />
                    <span>Mobile WhatsApp Sign In</span>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed font-medium">
                    {waTransportReady === false ? 'WhatsApp sign-in will be available after the gateway reconnects.' : 'Tap Open WhatsApp to dispatch your secure sign-in request directly.'}
                  </p>

                  {waLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <Loader2 size={24} className="text-[#25D366] animate-spin mb-2" />
                      <p className="text-xs text-gray-400">Initializing sign-in request…</p>
                    </div>
                  ) : (
                    <button
                      disabled={waTransportReady === false}
                      onClick={() => {
                        if (waTransportReady === false) return;
                        if (waDeepLink) {
                          window.location.href = waDeepLink;
                        } else {
                          createWhatsAppChallenge();
                        }
                      }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] via-[#20bd5a] to-[#128C7E] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#25D366]/25 transition-all border border-white/20 active:scale-[0.98]"
                    >
                      <MessageSquare size={18} className="fill-current" />
                      <span>Open WhatsApp</span>
                    </button>
                  )}

                  <button
                    onClick={() => setWaViewMode('qr_pin')}
                    className="text-xs text-gray-400 hover:text-white transition-colors font-semibold pt-1"
                  >
                    Using WhatsApp on another device? (Show QR Code)
                  </button>
                </div>
              )}

              {/* ── Mode C: Direct Phone & WhatsApp Sign-In View ───────────────────────── */}
              {waViewMode === 'otp' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-300">
                    <Smartphone size={12} className="text-[#25D366]" />
                    <span>Direct WhatsApp & Phone Sign In</span>
                  </div>

                  <p className="text-xs text-gray-400 font-medium leading-relaxed">
                    {waStep === 'phone'
                      ? 'Enter your WhatsApp or mobile number to authenticate your account.'
                      : 'Enter the 6-digit code sent to your number to complete sign in.'}
                  </p>

                  {waMessage && waStep === 'otp' && (
                    <div className="w-full p-3.5 mb-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center leading-relaxed">
                      {waMessage}
                    </div>
                  )}

                  {waStep === 'phone' ? (
                    <form onSubmit={handleRequestWaOtp} className="w-full space-y-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider pl-1">
                          Phone or WhatsApp Number
                        </label>
                        <input
                          type="tel"
                          value={waPhone}
                          onChange={(e) => setWaPhone(e.target.value)}
                          placeholder="+256 752 762 181"
                          className="w-full px-5 py-4 rounded-2xl bg-[#141722] border border-white/10 text-white font-mono text-center text-sm font-semibold placeholder:text-gray-500 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-all shadow-inner"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={waLoading || !waPhone}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] via-[#20bd5a] to-[#128C7E] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#25D366]/25 transition-all disabled:opacity-50 active:scale-[0.98] border border-white/20"
                      >
                        {waLoading ? <Loader2 size={18} className="animate-spin" /> : 'Continue with WhatsApp'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyWaOtp} className="w-full space-y-3">
                      <div className="space-y-1 text-left">
                        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider pl-1">
                          6-Digit Verification PIN
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={waOtpCode}
                          onChange={(e) => setWaOtpCode(e.target.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="w-full px-5 py-4 rounded-2xl bg-[#141722] border border-white/10 text-white font-mono text-center tracking-[0.4em] text-xl font-bold placeholder:text-gray-600 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-all shadow-inner"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={waLoading || waOtpCode.length < 6}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] via-[#20bd5a] to-[#128C7E] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#25D366]/25 transition-all disabled:opacity-50 active:scale-[0.98] border border-white/20"
                      >
                        {waLoading ? <Loader2 size={18} className="animate-spin" /> : 'Verify Code & Sign In'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWaStep('phone'); setWaError(null); }}
                        className="text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 font-semibold mx-auto pt-1"
                      >
                        <ArrowLeft size={12} />
                        <span>Change phone number</span>
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() => { setWaViewMode('auto'); setWaError(null); }}
                    className="text-xs text-gray-400 hover:text-[#25D366] transition-colors flex items-center gap-1.5 font-semibold pt-2"
                  >
                    <QrCode size={13} />
                    <span>Scan QR Code or Open WhatsApp App instead</span>
                  </button>
                </div>
              )}

              {/* Mode switch fallback trigger */}
              {waViewMode !== 'otp' && (
                <button
                  onClick={() => { setWaViewMode('otp'); setWaError(null); }}
                  className="text-xs text-gray-400 hover:text-[#25D366] transition-colors mt-4 font-semibold flex items-center gap-1.5"
                >
                  <Smartphone size={13} />
                  <span>Enter Phone / WhatsApp Number directly</span>
                </button>
              )}
            </div>
          )}

          {/* Security Badge */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Conversational Approval • Device-Bound • Multi-Rail</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
