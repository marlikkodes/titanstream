import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, ShieldCheck, Share2, Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { MACHINE_CATALOG } from '../../../data/machines';
import { useAuthStore } from '../../../store/useAuthStore';

export const MachineCertificateModal: React.FC = () => {
  const { activeCertificateId, closeCertificate, ownerships } = useMachineOwnershipStore();
  const user = useAuthStore((s) => s.user);

  const [copied, setCopied] = useState(false);

  if (!activeCertificateId) return null;

  // Find record matching certificate machineId or active certificate ID
  const record = Object.values(ownerships).find(
    (r) => r.machineId === activeCertificateId || r.certificateId === activeCertificateId || r.tierCode === activeCertificateId
  );

  if (!record) return null;

  const catalogItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === record.tierCode.toUpperCase()) || MACHINE_CATALOG[0];

  const ownerName = user?.username ? `@${user.username}` : user?.firstName ? user.firstName : 'Titan Stream User';

  const handleCopyLink = () => {
    const text = `Official Titan Stream Ownership Certificate\nOwner: ${ownerName}\nMachine: ${record.nickname} (${catalogItem.name})\nSerial: ${record.serialNumber}\nCertificate ID: ${record.certificateId}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="web3-card max-w-[460px] w-full rounded-3xl p-5 border border-gold/40 flex flex-col relative overflow-hidden shadow-2xl bg-[#0d0f16]"
        >
          {/* Gold Decorative Corner Mesh & Glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-usdt-green/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={closeCertificate}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Certificate Frame Card */}
          <div className="web3-card-gold rounded-2xl p-5 border-2 border-gold/40 relative overflow-hidden flex flex-col items-center text-center">
            {/* Header Seal */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold via-amber-400 to-amber-600 border-2 border-gold-bright flex items-center justify-center text-app-bg shadow-lg shadow-gold/30 mb-3">
              <Award size={32} />
            </div>

            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gold font-mono mb-1">
              Certificate of Ownership
            </div>
            <h2 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-4">
              Titan Stream Machine Registry
            </h2>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent mb-4" />

            <div className="space-y-3 w-full text-left">
              <div>
                <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Registered Owner</div>
                <div className="text-sm font-black text-text-primary tracking-wide mt-0.5">{ownerName}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Machine Name</div>
                  <div className="text-xs font-extrabold text-usdt-green mt-0.5">{record.nickname}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Class / Model</div>
                  <div className="text-xs font-extrabold text-text-primary mt-0.5">{catalogItem.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gold/20">
                <div>
                  <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Serial Number</div>
                  <div className="text-xs font-mono font-bold text-text-primary mt-0.5">{record.serialNumber}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Certificate Ref</div>
                  <div className="text-xs font-mono font-bold text-gold mt-0.5">{record.certificateId}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-gold/20 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Commission Date</div>
                  <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                    {new Date(record.commissionedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-usdt-green/10 border border-usdt-green/30 px-2 py-1 rounded-lg">
                  <ShieldCheck size={14} className="text-usdt-green" />
                  <span className="text-[10px] font-bold text-usdt-green font-mono uppercase">Verified Asset</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl bg-white/10 border border-white/20 text-text-primary font-extrabold text-xs flex items-center justify-center gap-2 press-feedback"
            >
              {copied ? <Check size={14} className="text-usdt-green" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={closeCertificate}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-gold to-gold-bright text-app-bg font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-gold/20 press-feedback"
            >
              <Share2 size={14} />
              <span>Share Ownership</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
