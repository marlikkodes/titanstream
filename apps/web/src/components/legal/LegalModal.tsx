import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  RotateCcw, 
  Cookie, 
  Building2, 
  AlertTriangle,
  ExternalLink,
  Mail,
  CheckCircle
} from 'lucide-react';
import { useLegalModalStore, type LegalTab } from '../../store/useLegalModalStore';

export const LegalModal: React.FC = () => {
  const { isOpen, activeTab, closeLegalModal, setActiveTab } = useLegalModalStore();

  if (!isOpen) return null;

  const tabs: { id: LegalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'terms', label: 'Terms of Service', icon: <FileText size={14} /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck size={14} /> },
    { id: 'refund', label: 'Refund Policy', icon: <RotateCcw size={14} /> },
    { id: 'cookies', label: 'Cookies & Storage', icon: <Cookie size={14} /> },
    { id: 'business', label: 'Business & Disclaimers', icon: <Building2 size={14} /> },
  ];

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="web3-card w-full max-w-2xl bg-[#0d1017] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 id="legal-modal-title" className="text-base font-black text-white tracking-tight">
                  Legal & Compliance Center
                </h2>
                <p className="text-[11px] text-text-tertiary">
                  TitanStream Cloud Computing Technologies Ltd.
                </p>
              </div>
            </div>
            <button
              onClick={closeLegalModal}
              className="p-2 rounded-xl text-text-secondary hover:text-white hover:bg-white/5 border border-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Close legal documents modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div 
            className="flex items-center gap-1.5 p-2 bg-black/40 border-b border-white/5 overflow-x-auto no-scrollbar"
            role="tablist"
            aria-label="Legal document tabs"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                    isActive
                      ? 'bg-gold text-app-bg shadow-md shadow-gold/20'
                      : 'text-text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Body */}
          <div 
            className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs text-text-secondary leading-relaxed space-y-4 font-sans select-text"
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'terms' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gold/10 border border-gold/20 text-gold-bright flex items-start gap-2.5">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    By accessing or using the TitanStream network, interface, or telegram mini-app, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.
                  </p>
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">1. Eligibility & Age Restriction</h3>
                  <p>
                    You must be at least 18 years of age (or the age of legal majority in your jurisdiction) to access or use TitanStream. By using the platform, you represent and warrant that you meet this requirement and are legally capable of entering into binding contracts.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">2. Nature of Service</h3>
                  <p>
                    TitanStream provides a distributed platform interface allowing users to lease virtual compute capacity and access distributed computational workloads. Mining rewards and hash settlement figures represent internal operational metrics based on computational uptime and network load.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">3. No Financial Guarantees</h3>
                  <p>
                    TitanStream is NOT a bank, credit union, depository institution, or asset management firm. All computational reward calculations, APYs, and yield metrics are estimates and are never guaranteed. Hardware yields fluctuate dynamically based on task difficulty, operational costs, network congestion, and market liquidity.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">4. Prohibited Activities</h3>
                  <p>
                    Users agree not to: (a) operate automated bots, scrapers, or exploits; (b) spoof device fingerprints, IP addresses, or geolocations; (c) create fraudulent multi-accounts for referral manipulation; or (d) use the service for money laundering, terrorism financing, or in violation of applicable laws. Violations result in immediate account termination and forfeiture of unverified balances.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">5. Limitation of Liability</h3>
                  <p>
                    To the maximum extent permitted by law, TitanStream and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or digital assets resulting from service downtime, blockchain network reorganizations, third-party wallet failures, or security breaches outside our direct control.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-usdt-green/10 border border-usdt-green/20 text-usdt-green flex items-start gap-2.5">
                  <CheckCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    Privacy by Design: We practice strict Data Minimization. We never sell, rent, or monetize your personal data with third-party advertisers.
                  </p>
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">1. Information We Collect</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">Account Identification:</strong> Telegram User ID and public display name for session authentication.</li>
                    <li><strong className="text-white">Security & Audit Telemetry:</strong> Coarse IP geolocation (country-level), user-agent hash, and session timestamps used solely for fraud prevention and double-entry ledger audit integrity.</li>
                    <li><strong className="text-white">Optional Contact Channels:</strong> WhatsApp phone number only if voluntarily connected by you for settlement notifications.</li>
                    <li><strong className="text-white">Ledger Data:</strong> Machine provisioning history, internal crystal balances, and withdrawal transaction hashes.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">2. Lawful Basis & Use</h3>
                  <p>
                    Data is processed solely for: (a) performing our contractual service obligations; (b) protecting against unauthorized transactions and Sybil exploits; and (c) complying with anti-financial crime obligations.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">3. Your Data Rights (GDPR & CCPA)</h3>
                  <p>
                    You retain full control of your digital identity:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <strong className="text-white block mb-1">Right to Access & Export</strong>
                      <span>Download your complete transaction ledger and profile data anytime via the "Export Data" tool in Profile.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <strong className="text-white block mb-1">Right to Erasure</strong>
                      <span>Permanently purge your account, credentials, and telemetry using the "Delete My Account" action.</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">4. Security Safeguards</h3>
                  <p>
                    We employ cryptographic session signing, encrypted database persistence, strict zero-trust role-based access control, and continuous security audits to protect stored information.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'refund' && (
              <div className="space-y-4">
                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">1. Digital Performance Contracts</h3>
                  <p>
                    Virtual machine node allocations, mining hashpower leases, and crystal power boosts are intangible digital services that begin execution immediately upon confirmation. Once hardware capacity is reserved and compute jobs are dispatched, digital services are deemed fully performed and are non-refundable.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">2. Failed Transactions & Erroneous Charges</h3>
                  <p>
                    If your payment rail (Mobile Money, Pesapal, or USDT on-chain transfer) is debited but your in-app balance or machine is not credited due to network latency, you are entitled to a full correction or refund:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">Investigation Window:</strong> Support resolves verified rail discrepancies within 24 to 48 business hours.</li>
                    <li><strong className="text-white">Automatic Reversal:</strong> If payment processor records confirm a failed settlement, funds are automatically reversed to the originating funding account.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">3. Dispute Escalation</h3>
                  <p>
                    To report a billing discrepancy or request an order review, contact our Treasury desk at <span className="text-gold font-mono font-bold">compliance@titanstream.io</span> with your operator ID, transaction reference code, and timestamp.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'cookies' && (
              <div className="space-y-4">
                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">1. Local Storage & Session Keys</h3>
                  <p>
                    TitanStream uses browser <span className="font-mono text-white">localStorage</span> and <span className="font-mono text-white">sessionStorage</span> to maintain authentication sessions, store chosen fiat currency exchange rates, and remember your visual theme preference.
                  </p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black uppercase text-gold font-mono">Key Storage Entries:</span>
                    <ul className="space-y-1 font-mono text-[11px]">
                      <li><span className="text-white">tether_auth_token:</span> Secure JWT session key</li>
                      <li><span className="text-white">titan_user_settings:</span> Theme, haptic, and layout preference</li>
                      <li><span className="text-white">has_chosen_currency:</span> Dual-currency display state</li>
                      <li><span className="text-white">titan_cookie_consent_v1:</span> Consent confirmation flag</li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">2. Zero Third-Party Advertising Cookies</h3>
                  <p>
                    We do not install marketing cookies, retargeting pixels, or behavioral tracking beacons (such as Meta Pixel, Google Analytics Ad tracking, or TikTok pixels). Your app usage is never shared with advertising networks.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">3. Managing Local Storage</h3>
                  <p>
                    You can clear local data at any time via your browser settings or by tapping "Sign Out" in the Profile screen. Note that clearing storage will require re-authenticating your session.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'business' && (
              <div className="space-y-4">
                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">1. Company Particulars</h3>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-text-tertiary">Legal Entity:</span>
                      <span className="font-bold text-white">TitanStream Cloud Computing Technologies Ltd.</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-text-tertiary">Company Type:</span>
                      <span className="text-white">Private Limited Technology Company</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-text-tertiary">Primary Domain:</span>
                      <span className="text-usdt-green font-mono">https://titanstream.io</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-text-tertiary">Customer Support:</span>
                      <a href="mailto:support@titanstream.io" className="text-gold font-mono hover:underline flex items-center gap-1">
                        <Mail size={12} /> support@titanstream.io
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Compliance & Legal:</span>
                      <a href="mailto:compliance@titanstream.io" className="text-gold font-mono hover:underline flex items-center gap-1">
                        <Mail size={12} /> compliance@titanstream.io
                      </a>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">2. Regulatory & Banking Disclaimer</h3>
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1.5">
                    <strong className="block text-xs uppercase tracking-wide">Mandatory Financial Notice</strong>
                    <p className="text-[11px] leading-relaxed">
                      TitanStream is an enterprise cloud computing interface. TitanStream is NOT a bank, credit union, depository institution, or registered investment advisor. Digital compute credits and internal tokens do not constitute securities, bank deposits, or collective investment schemes.
                    </p>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wide font-mono">3. Restricted Jurisdictions</h3>
                  <p>
                    TitanStream strictly adheres to international sanctions and anti-money laundering frameworks. Access is restricted for residents or citizens of countries subject to comprehensive sanctions (including Cuba, Iran, North Korea, Syria, and the Crimea, Donetsk, and Luhansk regions of Ukraine) and jurisdictions where cloud compute or digital asset transactions are prohibited by local law.
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">
              Last updated: September 2026 · Version 2.4-Compliance
            </span>
            <button
              onClick={closeLegalModal}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
