import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, ShieldCheck, Share2, Download, Copy, Check, Hash, Cpu, Zap, Coins } from 'lucide-react';
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
  const commissionDate = new Date(record.commissionedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const handleCopyLink = () => {
    const text = `OFFICIAL TITAN STREAM CERTIFICATE OF OWNERSHIP\n\nOwner: ${ownerName}\nMachine: ${record.nickname} (${catalogItem.name})\nSerial: ${record.serialNumber}\nCertificate ID: ${record.certificateId}\nCommissioned: ${commissionDate}\nCapacity: ${catalogItem.capacityGhs} GH/s\nDaily Yield: $${catalogItem.dailyYieldUsdt.toFixed(2)}\n\nThis certificate is verifiable on the Titan Stream blockchain registry.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="max-w-[520px] w-full rounded-3xl overflow-hidden relative"
        >
          {/* Premium Certificate Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23]" />
          
          {/* Holographic overlay effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-purple-500/5 opacity-50" />
          
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-gold/20 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-gold/20 to-transparent rounded-tr-full" />
          
          {/* Metallic border */}
          <div className="absolute inset-0 border-2 border-gold/30 rounded-3xl" />
          <div className="absolute inset-[2px] border border-gold/20 rounded-3xl" />

          {/* Close Button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={closeCertificate}
              className="w-10 h-10 rounded-full bg-black/40 border border-gold/30 flex items-center justify-center text-gold hover:bg-gold hover:text-black transition-all duration-300"
            >
              <X size={18} />
            </button>
          </div>

          {/* Certificate Content */}
          <div className="relative p-8 flex flex-col items-center">
            {/* Premium Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 px-4 py-1.5 rounded-full mb-4">
                <ShieldCheck size={14} className="text-gold" />
                <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Verified Blockchain Asset</span>
              </div>
              
              <div className="text-[9px] font-black uppercase tracking-[0.35em] text-gold/80 font-mono mb-2">
                Certificate of Ownership
              </div>
              <h1 className="text-sm font-black text-white uppercase tracking-widest mb-1">
                Titan Stream Registry
              </h1>
              <div className="text-[8px] text-text-tertiary uppercase tracking-wider">
                Official Digital Asset Certification
              </div>
            </div>

            {/* Gold Seal */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold via-amber-400 to-amber-600 border-4 border-gold-bright flex items-center justify-center text-app-bg shadow-2xl shadow-gold/40">
                <Award size={40} />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-gold/30 animate-pulse" />
            </div>

            {/* Certificate Details */}
            <div className="w-full bg-black/30 backdrop-blur-sm border border-gold/20 rounded-2xl p-5 space-y-4">
              {/* Owner Section */}
              <div className="flex items-start gap-3 pb-4 border-b border-gold/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center">
                  <Hash size={18} className="text-gold" />
                </div>
                <div className="flex-1">
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Registered Owner</div>
                  <div className="text-sm font-black text-white tracking-wide">{ownerName}</div>
                </div>
              </div>

              {/* Machine Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Machine Name</div>
                  <div className="text-xs font-extrabold text-gold mt-0.5">{record.nickname}</div>
                </div>
                <div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Class / Model</div>
                  <div className="text-xs font-extrabold text-white mt-0.5">{catalogItem.name}</div>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gold/20">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center mb-1">
                    <Cpu size={14} className="text-gold" />
                  </div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Capacity</div>
                  <div className="text-xs font-black text-white mt-0.5">{catalogItem.capacityGhs} GH/s</div>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center mb-1">
                    <Zap size={14} className="text-gold" />
                  </div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Daily Yield</div>
                  <div className="text-xs font-black text-white mt-0.5">${catalogItem.dailyYieldUsdt.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center mb-1">
                    <Coins size={14} className="text-gold" />
                  </div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Asset</div>
                  <div className="text-xs font-black text-white mt-0.5">USDT/BTC</div>
                </div>
              </div>

              {/* Serial Numbers */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gold/20">
                <div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Serial Number</div>
                  <div className="text-[10px] font-mono font-bold text-gold mt-0.5 bg-gold/5 px-2 py-1 rounded border border-gold/20">
                    {record.serialNumber}
                  </div>
                </div>
                <div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Certificate ID</div>
                  <div className="text-[10px] font-mono font-bold text-white mt-0.5 bg-white/5 px-2 py-1 rounded border border-white/10">
                    {record.certificateId}
                  </div>
                </div>
              </div>

              {/* Commission Info */}
              <div className="flex items-center justify-between pt-2 border-t border-gold/20">
                <div>
                  <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider">Commission Date</div>
                  <div className="text-[10px] font-mono text-text-secondary mt-0.5">{commissionDate}</div>
                </div>
                <div className="flex items-center gap-2 bg-usdt-green/10 border border-usdt-green/30 px-3 py-1.5 rounded-lg">
                  <ShieldCheck size={12} className="text-usdt-green" />
                  <span className="text-[9px] font-bold text-usdt-green font-mono uppercase">Chain Verified</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <div className="text-[7px] text-text-tertiary uppercase tracking-widest">
                This certificate is cryptographically verifiable on the Titan Stream blockchain
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-6 w-full">
              <button
                onClick={handleCopyLink}
                className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-white/10 transition-all duration-300"
              >
                {copied ? <Check size={16} className="text-usdt-green" /> : <Copy size={16} />}
                <span>{copied ? 'Copied!' : 'Copy Certificate'}</span>
              </button>
              <button
                onClick={closeCertificate}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-gold via-amber-400 to-gold text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-xl shadow-gold/30 hover:shadow-gold/50 transition-all duration-300"
              >
                <Share2 size={16} />
                <span>Share Ownership</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
