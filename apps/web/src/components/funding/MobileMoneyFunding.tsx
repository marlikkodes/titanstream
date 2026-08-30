import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone, ArrowRight, Zap, AlertCircle, PhoneCall,
  Copy, Check, Clock, Shield, Loader2, CheckCircle2, XCircle,
  RefreshCw, ChevronDown,
} from 'lucide-react';
import { useWalletStore } from '../../store/useWalletStore';
import { usePaymentOrderStore } from '../../store/usePaymentOrderStore';
import { useCountryStore } from '../../store/useCountryStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useUserNotificationStore } from '../../store/useUserNotificationStore';
import { paymentOrderService, type PaymentOrderRecord } from '../../services/paymentOrderService';
import { useTelegram } from '../../context/TelegramContext';
import { api } from '../../services/api';

// ─── Explicit Frontend State Machine ─────────────────────────────
type PaymentState =
  | 'IDLE'                    // Amount entry form
  | 'CREATING'                // API call in progress
  | 'READY_TO_PAY'            // Merchant assigned, showing payment instructions
  | 'USSD_OPENED'             // User tapped dialer, waiting for return
  | 'AWAITING_VERIFICATION'   // User submitted reference or returned from dialer
  | 'VERIFYING'               // Backend is actively matching
  | 'PAID'                    // Authoritative match confirmed by backend
  | 'FAILED'                  // Terminal failure
  | 'EXPIRED'                 // Session expired
  | 'CANCELLED';              // User cancelled

// Terminal states that stop polling
const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'DISPUTED']);

// ─── Session data from backend ───────────────────────────────────
interface MerchantSession {
  settlementId: string;
  referenceCode: string;
  status: string;
  network: string;
  merchantId: string;
  merchantName: string;
  merchantNumber: string;
  requestedAmount: string;       // UGX
  expectedCryptoAmount: string;  // USDT
  exchangeRate: string;
  asset: string;
  paymentCurrency: string;
  paymentAmount: string;
  submittedReference: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  instructions?: {
    title: string;
    network: string;
    merchantName: string;
    merchantNumber: string;
    amountUgx: string;
    ussdCode: string;
  };
}

// ─── Safe clipboard with fallback ────────────────────────────────
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }
  // Fallback: execCommand('copy') for WebViews without Clipboard API
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

// ─── Elapsed time formatter ──────────────────────────────────────
function formatElapsed(startIso: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

interface MobileMoneyFundingProps {
  providerId?: string;
  onSuccess?: (order: PaymentOrderRecord) => void;
  onCancel?: () => void;
}

export const MobileMoneyFunding: React.FC<MobileMoneyFundingProps> = ({
  onSuccess,
  onCancel,
}) => {
  // ─── State Machine ───────────────────────────────────────────
  const [paymentState, setPaymentState] = useState<PaymentState>('IDLE');
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [usdtAmount, setUsdtAmount] = useState<string>('10');
  const [network, setNetwork] = useState<string>('MTN');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedMerchantCode, setCopiedMerchantCode] = useState(false);
  const [copiedUssd, setCopiedUssd] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');
  const [showRefInput, setShowRefInput] = useState(false);
  const [elapsedDisplay, setElapsedDisplay] = useState('0s');
  const [activeMerchants, setActiveMerchants] = useState<any[]>([]);

  // Fetch registered active merchants dynamically from backend / admin config
  useEffect(() => {
    api.get('/settlement/merchants')
      .then((res) => {
        const list = res.data?.data || res.data;
        if (Array.isArray(list)) setActiveMerchants(list);
      })
      .catch(() => {});
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMobileDevice = React.useMemo(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || !!(window as any).Telegram?.WebApp?.platform;
  }, []);

  const { fetchBalanceFromEngine, fetchTransactions } = useWalletStore();
  const { hapticFeedback } = useTelegram();
  const { selectedCountry, getLocalAmount, getLocalAmountRaw } = useCountryStore();
  const { preferLocalCurrency } = useSettingsStore();
  const { completeFirstDeposit } = useOnboardingStore();

  const isLocalPreferred = preferLocalCurrency && !!selectedCountry && selectedCountry.code !== 'US';
  const currencySymbol = isLocalPreferred ? selectedCountry?.currencySymbol || '₮' : '₮';
  const currencyLabel = isLocalPreferred ? selectedCountry?.currencyCode || 'USDT' : 'USDT';
  const numericAmount = parseFloat(usdtAmount) || 0;

  // ─── Cleanup on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // ─── Visibility change: refetch when user returns from dialer ─
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        if (paymentState === 'USSD_OPENED') {
          // User returned from dialer — transition to awaiting
          setPaymentState('AWAITING_VERIFICATION');
        }
        fetchBalanceFromEngine();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, paymentState, fetchBalanceFromEngine]);

  // ─── 5-Second Polling Loop ───────────────────────────────────
  const startPolling = useCallback((settlementId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await api.get(`/settlement/session/${settlementId}`);
        const data = res.data?.data || res.data;
        if (!data) return;

        // Update session with latest data
        setSession((prev) => prev ? { ...prev, ...data, settlementId: prev.settlementId } : prev);

        const backendStatus = (data.status || '').toUpperCase();

        if (backendStatus === 'COMPLETED') {
          setPaymentState('PAID');
          if (pollRef.current) clearInterval(pollRef.current);
          hapticFeedback.notificationOccurred('success');
          fetchBalanceFromEngine();
          fetchTransactions();
          completeFirstDeposit();
          usePaymentOrderStore.getState().fetchMyOrders().catch(() => undefined);
          useUserNotificationStore.getState().addNotification({
            title: 'Payment Confirmed ✅',
            message: `Your mobile money deposit has been verified and credited to your wallet.`,
            category: 'Deposit',
            actionTab: 'wallet',
          });
        } else if (backendStatus === 'VERIFYING') {
          setPaymentState('VERIFYING');
        } else if (backendStatus === 'AWAITING_VERIFICATION') {
          if (paymentState !== 'AWAITING_VERIFICATION') {
            setPaymentState('AWAITING_VERIFICATION');
          }
        } else if (TERMINAL_STATES.has(backendStatus)) {
          if (backendStatus === 'EXPIRED') setPaymentState('EXPIRED');
          else if (backendStatus === 'CANCELLED') setPaymentState('CANCELLED');
          else setPaymentState('FAILED');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Silently continue polling on network errors
      }
    };

    // Initial poll immediately
    poll();
    pollRef.current = setInterval(poll, 5000);

    // Max polling duration: 15 minutes
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 15 * 60 * 1000);
  }, [paymentState, hapticFeedback, fetchBalanceFromEngine, fetchTransactions, completeFirstDeposit]);

  // ─── Elapsed time updater ────────────────────────────────────
  useEffect(() => {
    if (session?.createdAt && ['READY_TO_PAY', 'USSD_OPENED', 'AWAITING_VERIFICATION', 'VERIFYING'].includes(paymentState)) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setElapsedDisplay(formatElapsed(session.createdAt));
      }, 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [session?.createdAt, paymentState]);

  // ─── Create Session ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usdtAmountToSubmit = isLocalPreferred
      ? numericAmount / (selectedCountry?.exchangeRate || 1)
      : numericAmount;

    if (usdtAmountToSubmit < 1) {
      setErrorMessage(`Minimum deposit amount is ${isLocalPreferred ? getLocalAmount(1) : '1 USDT'}`);
      return;
    }

    setErrorMessage(null);
    setPaymentState('CREATING');
    hapticFeedback.impactOccurred('medium');

    try {
      const res = await api.post('/settlement/session', {
        paymentMethod: 'MOBILE_MONEY',
        mobileMoneyNetwork: network,
        requestedAmount: usdtAmountToSubmit.toString(),
        expectedCryptoAmount: usdtAmountToSubmit.toString(),
        asset: 'USDT',
        country: selectedCountry?.code || 'UG',
      });

      const sessionData = res.data?.data || res.data;
      if (sessionData?.settlementId) {
        // Resolve dynamic fallback from live registered merchants strictly by country and network
        const userCountry = (selectedCountry?.code || 'UG').toUpperCase();
        const matchedMerchant = activeMerchants.find((m: any) => {
          const mNet = (m.network || '').toUpperCase();
          const mCountry = (m.country || 'UG').toUpperCase();
          if (mCountry !== userCountry) return false;
          if (network === 'AIRTEL') return mNet.includes('AIRTEL');
          if (network === 'MTN') return mNet.includes('MTN');
          if (network === 'SAFARICOM_MPESA' || network === 'MPESA') return mNet.includes('SAFARICOM') || mNet.includes('MPESA');
          return false;
        });

        const isAirtel = network === 'AIRTEL';
        const isKenya = userCountry === 'KE' || network === 'SAFARICOM_MPESA' || network === 'MPESA';
        const defaultName = isKenya ? 'TetherStream Kenya Ops' : isAirtel ? 'TitanStream Escrow Airtel' : 'TitanStream Escrow MTN';
        const defaultNum = isKenya ? '445910' : isAirtel ? '7183443' : '234654';

        const fallbackMerchantName = matchedMerchant?.merchantName || defaultName;
        const fallbackMerchantNumber = matchedMerchant?.merchantNumber || defaultNum;

        // Guard against mismatched cross-border merchant metadata
        const rawMName = sessionData.merchantName;
        const cleanMerchantName = (!isKenya && rawMName && rawMName.toLowerCase().includes('kenya'))
          ? fallbackMerchantName
          : (rawMName || fallbackMerchantName);

        const rawMNum = sessionData.merchantNumber;
        const cleanMerchantNumber = (!isKenya && rawMNum === '445910')
          ? fallbackMerchantNumber
          : (rawMNum || fallbackMerchantNumber);

        const merchantSession: MerchantSession = {
          settlementId: sessionData.settlementId,
          referenceCode: sessionData.referenceCode || `MM-${sessionData.settlementId.substring(0, 6)}`,
          status: sessionData.status || 'WAITING_FOR_PAYMENT',
          network: sessionData.network || network,
          merchantId: sessionData.merchantId || matchedMerchant?.id || '',
          merchantName: cleanMerchantName,
          merchantNumber: cleanMerchantNumber,
          requestedAmount: sessionData.requestedAmount || '0',
          expectedCryptoAmount: sessionData.expectedCryptoAmount || usdtAmountToSubmit.toString(),
          exchangeRate: sessionData.exchangeRate || (selectedCountry?.exchangeRate || 3774.62).toString(),
          asset: sessionData.asset || 'USDT',
          paymentCurrency: sessionData.paymentCurrency || 'UGX',
          paymentAmount: sessionData.paymentAmount || sessionData.requestedAmount || '0',
          submittedReference: sessionData.submittedReference || null,
          expiresAt: sessionData.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          createdAt: sessionData.createdAt || new Date().toISOString(),
          completedAt: sessionData.completedAt || null,
          instructions: sessionData.instructions,
        };

        setSession(merchantSession);
        setPaymentState('READY_TO_PAY');
        startPolling(merchantSession.settlementId);

        // Also map for onSuccess callback
        if (onSuccess) {
          const rate = selectedCountry?.exchangeRate || 3774.62;
          const localAmt = Number(merchantSession.requestedAmount);
          const mNum = merchantSession.merchantNumber;
          const uCode = merchantSession.instructions?.ussdCode || (network === 'AIRTEL' ? `*185*9*${mNum}*${localAmt}#` : `*165*1*1*${mNum}*${localAmt}#`);
          onSuccess({
            id: merchantSession.settlementId,
            reference: merchantSession.referenceCode,
            telegramUserId: '',
            type: 'DEPOSIT',
            amount: Number(merchantSession.expectedCryptoAmount),
            localAmount: localAmt,
            currency: 'UGX',
            asset: 'USDT',
            paymentMethod: 'MOBILE_MONEY',
            network: merchantSession.network,
            country: selectedCountry?.code || 'UG',
            status: 'AWAITING_PAYMENT' as any,
            receivingNumber: mNum,
            receivingName: merchantSession.merchantName,
            ussdCode: uCode,
            telUri: `tel:${uCode.replace(/#/g, '%23')}`,
            expiresAt: merchantSession.expiresAt,
            createdAt: merchantSession.createdAt,
            updatedAt: merchantSession.createdAt,
          });
        }
        return;
      }

      throw new Error('Failed to create payment session');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to initialize payment order';
      setErrorMessage(message);
      setPaymentState('IDLE');
      hapticFeedback.notificationOccurred('error');
    }
  };

  // ─── Copy Merchant Code ──────────────────────────────────────
  const handleCopyMerchantCode = async () => {
    if (!session) return;
    const success = await copyToClipboard(session.merchantNumber);
    if (success) {
      hapticFeedback.notificationOccurred('success');
      setCopiedMerchantCode(true);
      setTimeout(() => setCopiedMerchantCode(false), 2500);
    }
  };

  // ─── Copy USSD Code ─────────────────────────────────────────
  const handleCopyUssd = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      hapticFeedback.notificationOccurred('success');
      setCopiedUssd(true);
      setTimeout(() => setCopiedUssd(false), 2000);
    }
  };

  // ─── Open USSD Dialer ───────────────────────────────────────
  const handleOpenDialer = () => {
    setPaymentState('USSD_OPENED');
    hapticFeedback.impactOccurred('heavy');
  };

  // ─── Submit Reference ────────────────────────────────────────
  const handleSubmitReference = async () => {
    if (!session) return;
    if (!submittedRef || submittedRef.trim().length < 3) {
      setErrorMessage('Please enter your Mobile Money transaction reference (e.g. CM123456)');
      return;
    }

    setErrorMessage(null);
    setPaymentState('VERIFYING');

    try {
      await api.post(`/settlement/session/${session.settlementId}/submit-reference`, {
        reference: submittedRef.trim(),
      });
      await paymentOrderService.submitForVerification(session.settlementId).catch(() => null);

      setPaymentState('AWAITING_VERIFICATION');
      hapticFeedback.notificationOccurred('success');
      setShowRefInput(false);

      useUserNotificationStore.getState().addNotification({
        title: 'Reference Submitted',
        message: `Your transaction reference (${submittedRef.trim().toUpperCase()}) is being verified against the merchant ledger.`,
        category: 'Deposit',
        actionTab: 'wallet',
      });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error?.message || err?.message || 'Failed to submit reference');
      setPaymentState('AWAITING_VERIFICATION');
    }
  };

  // ─── Cancel Order ────────────────────────────────────────────
  const handleCancelOrder = async () => {
    if (!session) return;
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await api.post(`/settlement/session/${session.settlementId}/cancel`).catch(() => null);
    } catch { /* ignore */ }
    setSession(null);
    setPaymentState('IDLE');
    setShowRefInput(false);
    setSubmittedRef('');
    setErrorMessage(null);
    hapticFeedback.impactOccurred('light');
  };

  // ─── Quick amount selection ──────────────────────────────────
  const handleQuickSelect = (val: number) => {
    hapticFeedback.selectionChanged();
    setUsdtAmount(val.toString());
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: PAID — Authoritative Success Confirmation
  // ═══════════════════════════════════════════════════════════════
  if (paymentState === 'PAID' && session) {
    return (
      <div className="space-y-4 text-center">
        <div className="glass-panel p-6 rounded-2xl border border-usdt-green/40 bg-usdt-green/10 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-usdt-green/20 flex items-center justify-center animate-pulse">
            <CheckCircle2 size={32} className="text-usdt-green" />
          </div>
          <div className="text-xl font-extrabold text-usdt-green">Payment Confirmed!</div>
          <div className="text-sm text-text-secondary">
            Your deposit of <strong className="text-text-primary">{session.paymentCurrency} {Number(session.requestedAmount).toLocaleString()}</strong> has
            been verified and credited to your wallet.
          </div>
          <div className="text-xs text-text-tertiary font-mono">
            ≈ {Number(session.expectedCryptoAmount).toFixed(2)} USDT
          </div>
          <div className="pt-2 text-xs text-text-tertiary">
            Reference: <span className="font-mono text-text-secondary">{session.referenceCode}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (onCancel) onCancel(); }}
          className="press-feedback w-full py-3 rounded-xl bg-usdt-green text-app-bg font-extrabold text-sm"
        >
          Done
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: EXPIRED / FAILED / CANCELLED — Terminal States
  // ═══════════════════════════════════════════════════════════════
  if (['EXPIRED', 'FAILED', 'CANCELLED'].includes(paymentState)) {
    const isExpired = paymentState === 'EXPIRED';
    return (
      <div className="space-y-4 text-center">
        <div className="glass-panel p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-3">
          <XCircle size={32} className="text-rose-400 mx-auto" />
          <div className="text-lg font-extrabold text-rose-400">
            {isExpired ? 'Session Expired' : paymentState === 'CANCELLED' ? 'Order Cancelled' : 'Payment Failed'}
          </div>
          <div className="text-xs text-text-tertiary">
            {isExpired
              ? 'This payment session has expired. Please start a new deposit.'
              : 'This order was cancelled or could not be processed.'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSession(null);
            setPaymentState('IDLE');
            setShowRefInput(false);
            setSubmittedRef('');
            setErrorMessage(null);
          }}
          className="press-feedback w-full py-3 rounded-xl bg-white/10 text-text-primary font-extrabold text-sm border border-white/10"
        >
          Start New Deposit
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: READY_TO_PAY / USSD_OPENED / AWAITING / VERIFYING
  // ═══════════════════════════════════════════════════════════════
  if (session && ['READY_TO_PAY', 'USSD_OPENED', 'AWAITING_VERIFICATION', 'VERIFYING', 'CREATING'].includes(paymentState)) {
    const localAmount = Number(session.requestedAmount);
    const rawLocalNumber = localAmount > 100 ? Math.round(localAmount) : Math.round(Number(session.expectedCryptoAmount) * (selectedCountry?.exchangeRate || 3774.62));
    const displayLocalAmount = rawLocalNumber.toLocaleString();
    const displayNetwork = session.network || network || 'MTN';
    const merchantNum = session.merchantNumber;
    const merchantName = session.merchantName;
    const ussdCode = session.instructions?.ussdCode || (displayNetwork === 'AIRTEL'
      ? `*185*9*${merchantNum}*${rawLocalNumber}#`
      : `*165*1*1*${merchantNum}*${rawLocalNumber}#`);
    const telUri = `tel:${ussdCode.replace(/#/g, '%23')}`;

    const isWaiting = ['USSD_OPENED', 'AWAITING_VERIFICATION', 'VERIFYING'].includes(paymentState);
    const isVerifying = paymentState === 'VERIFYING';

    return (
      <div className="space-y-3.5">
        {/* ── Card Title: Network-Specific ── */}
        <div className="flex items-center gap-2.5 px-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
            displayNetwork === 'AIRTEL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-400/20 text-amber-400'
          }`}>
            {displayNetwork === 'AIRTEL' ? 'A' : 'M'}
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-text-primary">
              Pay with {displayNetwork === 'AIRTEL' ? 'Airtel Money' : 'MTN Mobile Money'}
            </h3>
            <p className="text-[10px] text-text-tertiary">Merchant-assisted payment</p>
          </div>
        </div>

        {/* ── Amount Hero ── */}
        <div className="glass-panel p-4 rounded-2xl border border-usdt-green/25 bg-usdt-green/5 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-usdt-green text-[10px] font-black uppercase tracking-wider">
            <Clock size={12} /> Ref: {session.referenceCode}
            {isWaiting && <span className="text-text-tertiary">· {elapsedDisplay}</span>}
          </div>
          <div className="text-3xl font-extrabold font-mono text-text-primary">
            UGX {displayLocalAmount}
          </div>
          <div className="text-xs font-mono text-text-tertiary">
            ≈ {Number(session.expectedCryptoAmount).toFixed(2)} USDT
          </div>
        </div>

        {/* ── Verification Waiting Banner ── */}
        {isWaiting && (
          <div className={`p-3.5 rounded-xl border space-y-1.5 text-center ${
            isVerifying
              ? 'bg-amber-400/5 border-amber-400/30'
              : 'bg-usdt-green/5 border-usdt-green/20'
          }`}>
            <div className="flex items-center justify-center gap-2">
              {isVerifying ? (
                <Loader2 size={16} className="text-amber-400 animate-spin" />
              ) : (
                <RefreshCw size={14} className="text-usdt-green animate-spin" style={{ animationDuration: '3s' }} />
              )}
              <span className={`text-xs font-extrabold ${isVerifying ? 'text-amber-400' : 'text-usdt-green'}`}>
                {isVerifying ? 'Verifying Payment...' : 'Waiting for Payment Confirmation'}
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary">
              {isVerifying
                ? 'Matching your transaction reference against the merchant ledger.'
                : "We're checking your payment with the merchant. This updates automatically."}
            </p>
          </div>
        )}

        {/* ── Merchant Details & Merchant Code CTA ── */}
        <div className="glass-panel p-3.5 rounded-2xl border border-white/10 space-y-3">
          {/* Merchant Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-tertiary font-medium">Merchant</span>
              <div className="text-text-primary font-bold truncate">{merchantName}</div>
            </div>
            <div className="text-right">
              <span className="text-text-tertiary font-medium">Network</span>
              <div className={`font-bold ${displayNetwork === 'AIRTEL' ? 'text-rose-400' : 'text-amber-400'}`}>
                {displayNetwork}
              </div>
            </div>
          </div>

          {/* ── PRIMARY CTA: Copy Merchant Code ── */}
          <button
            type="button"
            onClick={handleCopyMerchantCode}
            className={`press-feedback w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all ${
              copiedMerchantCode
                ? 'bg-usdt-green/20 border border-usdt-green/50 text-usdt-green'
                : 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
            }`}
          >
            {copiedMerchantCode ? (
              <>
                <Check size={16} />
                <span>✓ Merchant Code Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Merchant Code: <span className="font-mono">{merchantNum}</span></span>
              </>
            )}
          </button>

          {/* ── USSD Code Display (Secondary) ── */}
          <div className="bg-control-bg p-2.5 rounded-xl border border-white/8 flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <div className="text-[10px] text-text-tertiary font-medium mb-0.5">USSD Code</div>
              <div className="font-mono text-xs text-usdt-green font-bold truncate select-all">{ussdCode}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopyUssd(ussdCode)}
              className="press-feedback p-2 rounded-lg bg-white/10 hover:bg-white/20 text-text-primary shrink-0"
              title="Copy USSD Code"
            >
              {copiedUssd ? <Check size={13} className="text-usdt-green" /> : <Copy size={13} />}
            </button>
          </div>

          {/* ── Open Mobile Money Dialer ── */}
          {isMobileDevice ? (
            <a
              href={telUri}
              onClick={handleOpenDialer}
              className={`press-feedback w-full py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 no-underline transition-colors ${
                displayNetwork === 'AIRTEL'
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 text-gray-900 shadow-lg'
              }`}
            >
              <PhoneCall size={15} />
              <span>Open {displayNetwork === 'AIRTEL' ? 'Airtel Money' : 'MTN Mobile Money'}</span>
            </a>
          ) : (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-1.5">
              <div className="font-bold">🖥️ Desktop Detected</div>
              <p className="text-[10px] text-text-tertiary">
                Copy the merchant code above and dial <span className="font-mono text-amber-300">{ussdCode}</span> on your phone.
              </p>
            </div>
          )}
        </div>

        {/* ── How to Pay — 6-Step Instructions ── */}
        <details className="group rounded-xl bg-white/5 border border-white/8">
          <summary className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer text-xs font-extrabold text-text-primary uppercase tracking-wider">
            <span>How to Pay</span>
            <ChevronDown size={14} className="text-text-tertiary group-open:rotate-180 transition-transform" />
          </summary>
          <ol className="list-decimal list-inside px-3.5 pb-3 space-y-1 text-[11px] text-text-secondary font-medium">
            <li>Copy the <strong className="text-usdt-green">merchant code</strong> above.</li>
            <li>Tap <strong>Open {displayNetwork === 'AIRTEL' ? 'Airtel Money' : 'MTN Mobile Money'}</strong>.</li>
            <li>When your network asks for the <strong>merchant number</strong>, paste the copied code.</li>
            <li>Enter the payment amount: <strong className="text-text-primary font-mono">UGX {displayLocalAmount}</strong>.</li>
            <li>Confirm the payment with your <strong>Mobile Money PIN</strong>.</li>
            <li>Return to Titan Stream — we verify automatically.</li>
          </ol>
        </details>

        {/* ── Manual Reference Fallback ── */}
        {!showRefInput ? (
          <button
            type="button"
            onClick={() => {
              setShowRefInput(true);
              hapticFeedback.selectionChanged();
            }}
            className="w-full text-center text-xs text-text-tertiary hover:text-usdt-green transition-colors py-1"
          >
            Already paid? <span className="underline font-bold">Submit your transaction reference</span>
          </button>
        ) : (
          <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-usdt-green/20">
            <label className="text-xs font-bold text-usdt-green uppercase tracking-wider">
              Transaction Reference
            </label>
            <input
              type="text"
              value={submittedRef}
              onChange={(e) => setSubmittedRef(e.target.value.toUpperCase())}
              placeholder="e.g. CM123456"
              className="w-full h-11 px-3 bg-control-bg border border-white/10 rounded-xl font-mono text-sm text-text-primary focus:outline-none focus:border-usdt-green uppercase"
            />
            <p className="text-[10px] text-text-tertiary">
              Enter the reference from your MTN/Airtel SMS confirmation. Do <strong>not</strong> enter your PIN.
            </p>
            <button
              type="button"
              onClick={handleSubmitReference}
              disabled={paymentState === 'VERIFYING' || submittedRef.trim().length < 3}
              className="press-feedback w-full py-3 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paymentState === 'VERIFYING' ? (
                <><Loader2 size={14} className="animate-spin" /> Verifying...</>
              ) : (
                <><Shield size={14} /> Submit for Verification</>
              )}
            </button>
          </div>
        )}

        {/* ── Error Display ── */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Cancel Order ── */}
        <button
          type="button"
          onClick={handleCancelOrder}
          className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-tertiary hover:text-text-primary font-bold text-[11px] border border-white/8 transition-colors"
        >
          Cancel Order & Start New Deposit
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: IDLE — Amount Entry Form
  // ═══════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-usdt-green/20 text-usdt-green flex items-center justify-center font-bold">
          <Smartphone size={20} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-text-primary">Add Money via Mobile Money</h3>
          <p className="text-xs text-text-tertiary">MTN Mobile Money or Airtel Money</p>
        </div>
      </div>

      {/* Network Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Choose your network</label>
        <div className="grid grid-cols-2 gap-2">
          {(['MTN', 'AIRTEL'] as const).map((net) => (
            <button
              key={net}
              type="button"
              onClick={() => {
                hapticFeedback.selectionChanged();
                setNetwork(net);
              }}
              className={`press-feedback py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-between transition-colors ${
                network === net
                  ? net === 'AIRTEL'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-sm'
                    : 'bg-amber-400/15 border-amber-400 text-amber-400 shadow-sm'
                  : 'bg-control-bg/60 border-white/10 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{net === 'MTN' ? 'MTN Mobile Money' : 'Airtel Money'}</span>
              {network === net && <Zap size={14} className={net === 'AIRTEL' ? 'fill-rose-400' : 'fill-amber-400'} />}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Amount to Deposit</label>
          <span className="text-[11px] font-semibold text-text-tertiary">Min: {isLocalPreferred ? getLocalAmount(1) : '1 USDT'}</span>
        </div>
        <div className="relative flex items-center">
          <input
            type="number"
            min={isLocalPreferred ? getLocalAmountRaw(1) : 1}
            max={isLocalPreferred ? getLocalAmountRaw(10000) : 10000}
            step="any"
            value={usdtAmount}
            onChange={(e) => setUsdtAmount(e.target.value)}
            placeholder="10"
            className="w-full h-12 pl-4 pr-16 bg-control-bg border border-white/10 rounded-xl text-lg font-mono font-extrabold text-text-primary focus:outline-none focus:border-usdt-green transition-colors"
          />
          <span className="absolute right-4 font-mono font-bold text-xs text-usdt-green bg-usdt-green/10 px-2 py-1 rounded">
            {currencyLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {[5, 10, 25, 50, 100].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleQuickSelect(isLocalPreferred ? getLocalAmountRaw(val) : val)}
              className="press-feedback flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-text-secondary hover:text-text-primary"
            >
              {currencySymbol}{isLocalPreferred ? Math.round(getLocalAmountRaw(val)).toLocaleString() : val}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={paymentState === 'CREATING' || numericAmount < 1}
        className="press-feedback w-full py-3.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 disabled:opacity-50"
      >
        {paymentState === 'CREATING' ? (
          <><Loader2 size={16} className="animate-spin" /> Creating Payment Session...</>
        ) : (
          <><span>Generate Deposit Order</span> <ArrowRight size={16} /></>
        )}
      </button>
    </form>
  );
};
