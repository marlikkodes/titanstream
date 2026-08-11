import React from 'react';
import { AlertCircle } from 'lucide-react';

interface CryptoBotFundingProps {
  providerId?: string;
  onSuccess?: (session: any) => void;
  onCancel?: () => void;
}

export const CryptoBotFunding: React.FC<CryptoBotFundingProps> = ({ onCancel }) => {
  return (
    <div className="p-5 rounded-2xl glass-panel border border-white/10 text-center space-y-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
        <AlertCircle size={20} />
      </div>
      <h3 className="text-sm font-extrabold text-text-primary">CryptoBot Payment Retired</h3>
      <p className="text-xs text-text-tertiary">
        CryptoBot payments have been decommissioned. Please use Mobile Money or Card funding.
      </p>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-text-primary hover:bg-white/20 transition-all"
        >
          Back
        </button>
      )}
    </div>
  );
};
