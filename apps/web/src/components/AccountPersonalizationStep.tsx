import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Banknote, Check, Coins, Loader2, RefreshCw, UserRound } from 'lucide-react';
import {
  getAccountSetupErrorMessage,
  updateAccountSetup,
  type AccountSetupState,
  type TransactionMethod,
} from '../services/accountSetupService';

interface AccountPersonalizationStepProps {
  initial: AccountSetupState | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onSaved: (state: AccountSetupState) => void;
}

function isValidName(value: string): boolean {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length >= 1 && trimmed.length <= 60;
}

function isValidNumber(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value.trim().replace(/\s+/g, ''));
}

export function AccountPersonalizationStep({
  initial,
  loading,
  loadError,
  onRetry,
  onSaved,
}: AccountPersonalizationStepProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [method, setMethod] = useState<TransactionMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Prefill from canonical backend data — never overwrite user edits.
  useEffect(() => {
    if (initial && !hydrated) {
      setFirstName(initial.firstName ?? '');
      setLastName(initial.lastName ?? '');
      setMethod(initial.preferredTransactionMethod);
      setPhone(initial.withdrawalPhoneNumber ?? '');
      setHydrated(true);
    }
  }, [initial, hydrated]);

  if (loading && !hydrated) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="status" aria-label="Loading account details">
        <Loader2 size={22} className="animate-spin text-gold" />
        <p className="text-[12px] text-text-secondary font-medium">Loading your account details…</p>
      </div>
    );
  }

  if (loadError && !hydrated) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-[13px] text-text-secondary font-medium">
          We couldn&apos;t load your account details.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-[12px] font-extrabold text-text-primary hover:bg-white/15"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  const showPhone = method === 'MOBILE_MONEY';
  const nameOk = isValidName(firstName) && isValidName(lastName);
  const methodOk = method === 'MOBILE_MONEY' || method === 'CRYPTO';
  const phoneOk = !showPhone || isValidNumber(phone);
  const formValid = nameOk && methodOk && phoneOk;

  const handleSave = async () => {
    setTouched(true);
    setSaveError(null);
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const saved = await updateAccountSetup({
        firstName: firstName.trim().replace(/\s+/g, ' '),
        lastName: lastName.trim().replace(/\s+/g, ' '),
        preferredTransactionMethod: method as TransactionMethod,
        ...(showPhone ? { withdrawalPhoneNumber: phone.trim().replace(/\s+/g, '') } : {}),
      });
      onSaved(saved);
    } catch (err) {
      // Remain on this step — the backend stays authoritative, nothing is marked complete.
      setSaveError(getAccountSetupErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (invalid: boolean) =>
    `w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[13px] text-text-primary font-medium focus:outline-none transition-colors ${
      invalid ? 'border-red-400/70' : 'border-white/15 focus:border-gold'
    }`;

  return (
    <div className="w-full text-left">
      <div className="flex flex-col items-center text-center mb-5">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gold to-amber-400 blur-2xl opacity-30 scale-125" />
          <div className="relative w-[56px] h-[56px] rounded-3xl bg-gradient-to-br from-gold to-amber-400 text-app-bg flex items-center justify-center shadow-2xl border border-white/20">
            <UserRound size={26} />
          </div>
        </div>
        <h2 className="text-[20px] font-black text-text-primary tracking-tight font-sans leading-tight mb-2">
          Personalize your Titan account
        </h2>
        <p className="text-[13px] text-text-secondary leading-relaxed font-medium font-sans">
          Tell us where you&apos;ll receive withdrawals and we&apos;ll set up your account accordingly.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="titan-first-name" className="text-[11px] font-extrabold text-text-secondary uppercase tracking-wide block mb-1.5">
              First name
            </label>
            <input
              id="titan-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ama"
              maxLength={60}
              aria-invalid={touched && !isValidName(firstName)}
              aria-describedby="titan-name-error"
              className={inputClass(touched && !isValidName(firstName))}
            />
          </div>
          <div>
            <label htmlFor="titan-last-name" className="text-[11px] font-extrabold text-text-secondary uppercase tracking-wide block mb-1.5">
              Last name
            </label>
            <input
              id="titan-last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Mensah"
              maxLength={60}
              aria-invalid={touched && !isValidName(lastName)}
              aria-describedby="titan-name-error"
              className={inputClass(touched && !isValidName(lastName))}
            />
          </div>
        </div>
        {touched && !nameOk && (
          <p id="titan-name-error" role="alert" className="text-[11px] text-red-300 font-semibold -mt-2">Please enter your first and last name.</p>
        )}

        <div>
          <p className="text-[11px] font-extrabold text-text-secondary uppercase tracking-wide mb-1.5">
            How will you transact?
          </p>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="How will you transact?">
            {(
              [
                { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: <Banknote size={16} /> },
                { value: 'CRYPTO', label: 'Crypto', icon: <Coins size={16} /> },
              ] as const
            ).map((opt) => {
              const selected = method === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(opt.value)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-extrabold transition-all press-feedback ${
                    selected
                      ? 'bg-gold/15 border-gold text-gold'
                      : 'bg-white/[0.03] border-white/10 text-text-secondary hover:border-white/25 hover:text-text-primary'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
          </div>
          {touched && !methodOk && (
            <p role="alert" className="text-[11px] text-red-300 font-semibold mt-1.5">Please choose Mobile Money or Crypto.</p>
          )}
        </div>

        {showPhone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <label htmlFor="titan-withdrawal-number" className="text-[11px] font-extrabold text-text-secondary uppercase tracking-wide block mb-1.5">
              Mobile-money withdrawal number
            </label>
            <input
              id="titan-withdrawal-number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+256 772 123456"
              maxLength={32}
              aria-invalid={touched && !isValidNumber(phone)}
              aria-describedby="titan-number-error"
              className={`${inputClass(touched && !isValidNumber(phone))} font-mono`}
            />
            <p className="text-[11px] text-text-tertiary leading-snug mt-1.5">
              This number should be registered in the same name as your Titan account. If your mobile-money
              details do not match, use the crypto transaction option instead.
            </p>
            {touched && !isValidNumber(phone) && (
              <p id="titan-number-error" role="alert" className="text-[11px] text-red-300 font-semibold mt-1">Please enter a valid withdrawal number.</p>
            )}
          </motion.div>
        )}

        {saveError && (
          <p role="alert" className="text-[12px] text-red-300 font-semibold bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2">
            {saveError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (touched && !formValid)}
          className="w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg press-feedback transition-all bg-gold text-app-bg shadow-gold/25 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Save account details and continue"
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
