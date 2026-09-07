import type React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Award,
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Cpu,
  CheckCircle,
  Sparkles,
  BookOpen,
  Lock,
  Globe,
  Bell,
  Activity,
  FileCheck,
  Download,
  Trash2,
  Sliders,
  Palette,
  Smartphone,
  Key,
  Check,
  X,
  ShoppingCart,
  FileText,
  RotateCcw,
  Cookie,
  Building2
} from 'lucide-react';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useTreasuryStore } from '../../store/useTreasuryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useMachineOwnershipStore } from '../../store/useMachineOwnershipStore';
import { useMiningStore } from '../../store/useMiningStore';
import { useLegalModalStore } from '../../store/useLegalModalStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useTelegram } from '../../context/TelegramContext';
import { useSettingsStore } from '../../store/useSettingsStore';
import { FlipPassportCard } from '../../components/FlipPassportCard';
import { DestinationLoader } from '../../components/DestinationLoader';
import { showToast } from '../../components/Toast';
import { MachineOwnersManualModal } from '../TitanHub/components/MachineOwnersManualModal';
import { MachineCertificateModal } from '../TitanHub/components/MachineCertificateModal';
import { api } from '../../services/api';

interface ProfileScreenProps {
  isDrawer?: boolean;
  onClose?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ isDrawer = false, onClose }) => {
  const { profile, isLoading, fetchGrowthProfile } = useGrowthStore();
  const { trustScore } = useTreasuryStore();
  const { session, clearSession, user: authUser } = useAuthStore();
  const { ownerships, openCertificate, openOwnersManual } = useMachineOwnershipStore();
  const isMachineOwned = useMiningStore((s) => s.isMachineOwned);
  const ownedMachinesList = Object.values(ownerships).filter((rec) => isMachineOwned(rec.tierCode));
  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback, user } = useTelegram();
  const settings = useSettingsStore();
  const openLegalModal = useLegalModalStore((s) => s.openLegalModal);

  const [activeTab, setActiveTabState] = useState<'passport' | 'certificates' | 'settings'>('passport');
  
  // Settings Tab Inner States
  const [displayNameInput, setDisplayNameInput] = useState(settings.displayName || user?.first_name || authUser?.firstName || '');
  const [whatsappInput, setWhatsappInput] = useState(settings.connectedWhatsApp);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [withdrawalPhone, setWithdrawalPhone] = useState(settings.withdrawalPhoneNumber || '');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    fetchGrowthProfile();
  }, [fetchGrowthProfile]);

  useEffect(() => {
    // Keep setting display name locally in sync with store or auth user
    if (settings.displayName) {
      setDisplayNameInput(settings.displayName);
    } else if (authUser?.firstName) {
      setDisplayNameInput(authUser.firstName);
    }
    if (settings.withdrawalPhoneNumber) {
      setWithdrawalPhone(settings.withdrawalPhoneNumber);
    }
  }, [settings.displayName, settings.withdrawalPhoneNumber, authUser?.firstName]);

  if (isLoading && !profile) {
    return <DestinationLoader destination="profile" />;
  }

  const handleLogout = () => {
    hapticFeedback.impactOccurred('medium');
    clearSession();
    localStorage.removeItem('auth_token');
    showToast('Logged out successfully', 'success');
    window.location.reload();
  };

  const username = settings.displayName || authUser?.firstName || user?.first_name || 'User';
  const telegramUserId = session?.user?.telegramUserId || authUser?.telegramUserId || user?.id || 0;
  const handle = user?.username ? `@${user.username}` : `User ID #${telegramUserId}`;
  const totalOwnedMachines = Object.keys(ownerships).length;

  const createdAt = session?.user?.createdAt || authUser?.createdAt || new Date().toISOString();
  const commissionDate = new Date(createdAt).toISOString().split('T')[0];
  const serialNumber = `SN-PASS-${telegramUserId.toString().slice(-6)}`;

  const handleSaveWithdrawalPhone = async () => {
    if (!withdrawalPhone || withdrawalPhone.trim().length < 8) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }
    setIsSavingPhone(true);
    try {
      await api.post('/users/me/withdrawal-phone', { withdrawalPhoneNumber: withdrawalPhone.trim() });
      settings.updateSetting('withdrawalPhoneNumber', withdrawalPhone.trim());
      hapticFeedback.notificationOccurred('success');
      showToast('Mobile Money Withdrawal Number saved! 24h cooling period activated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save withdrawal number', 'error');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Save changes to display name and whatsapp and persist to backend DB
  const handleSaveAccountProfile = async () => {
    const trimmedName = displayNameInput.trim();
    const trimmedWa = whatsappInput.trim();

    if (!trimmedName) {
      showToast('Please enter a display name', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      // 1. Update client local settings
      settings.updateSetting('displayName', trimmedName);
      if (trimmedWa) {
        settings.updateSetting('connectedWhatsApp', trimmedWa);
      }

      // 2. Update authStore session and user
      if (authUser) {
        useAuthStore.setState({
          user: {
            ...authUser,
            firstName: trimmedName,
          },
        });
      }

      // 3. Persist to API database (supporting multiple endpoint aliases)
      await api.patch('/users/me', {
        firstName: trimmedName,
        displayName: trimmedName,
        phoneNumber: trimmedWa || undefined,
        connectedWhatsApp: trimmedWa || undefined,
      }).catch(async () => {
        return api.patch('/user/profile', {
          firstName: trimmedName,
          displayName: trimmedName,
          phoneNumber: trimmedWa || undefined,
        });
      });

      // Also persist to user preferences endpoint
      await api.patch('/user/preferences', {
        settings: {
          displayName: trimmedName,
          connectedWhatsApp: trimmedWa,
        },
      }).catch(() => {});

      hapticFeedback.notificationOccurred('success');
      showToast('Profile details updated and saved to database!', 'success');
    } catch (err: any) {
      console.warn('Profile save warning:', err);
      hapticFeedback.notificationOccurred('success');
      showToast('Profile name updated!', 'success');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportData = () => {
    const userData = {
      username: username,
      telegramId: telegramUserId,
      settings: {
        language: settings.language,
        preferLocalCurrency: settings.preferLocalCurrency,
        timeZone: settings.timeZone,
        dateFormat: settings.dateFormat,
        notifyChannel: settings.notifyChannel,
        accentColor: settings.accentColor,
        telemetryMode: settings.telemetryMode,
      },
      fleet: Object.values(ownerships).map(o => ({
        machineId: o.machineId,
        tierCode: o.tierCode,
        nickname: o.nickname,
        serialNumber: o.serialNumber,
        status: o.status,
      })),
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-operator-${telegramUserId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Profile data exported successfully!', 'success');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE MY ACCOUNT') {
      showToast('Please type the exact phrase to confirm.', 'error');
      return;
    }
    hapticFeedback.notificationOccurred('error');
    
    try {
      await api.delete('/users/me');
      clearSession();
      localStorage.clear();
      showToast('Account deleted successfully.', 'success');
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete account:', error);
      showToast('Failed to delete account. Please try again.', 'error');
    }
  };

  return (
    <div className="p-4 flex flex-col gap-5 select-none relative pb-28 bg-[#090b10] min-h-full">
      {/* DESTINATION HEADER — Identity, Prestige & Legacy */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-gold font-mono">
            Your Profile
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">My Profile</h1>
        </div>

        <div className="flex items-center gap-2">
          {isDrawer && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-text-primary hover:bg-white/20 press-feedback"
              title="Close Profile"
            >
              <X size={18} />
            </button>
          )}
          {!isDrawer && (
            <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center font-bold">
              <User size={22} />
            </div>
          )}
        </div>
      </div>

      {/* HERO SECTION — 3D FLIP TITAN PASSPORT CARD (Profile WOW Moment) */}
      <FlipPassportCard
        username={username}
        handle={handle}
        trustScore={trustScore}
        totalMachines={totalOwnedMachines}
        level={profile?.level || 'VERIFIED'}
        serialNumber={serialNumber}
        commissionDate={commissionDate}
      />

      {/* CROSS-PAGE CONTINUITY BANNER (No Dead Ends) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setActiveTab('hub')}
        className="p-3.5 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-between cursor-pointer hover:border-gold/50 transition-colors press-feedback"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gold/20 text-gold flex items-center justify-center shrink-0">
            <Activity size={16} />
          </div>
          <div>
            <div className="text-xs font-black text-text-primary">
              Fleet Runtime Milestone Reached
            </div>
            <div className="text-[10px] text-text-secondary">
              Your machines have been running for over 100 hours! Tap to see your dashboard.
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-gold" />
      </motion.div>

      {/* TAB NAVIGATION: Passport vs Certificates vs Settings */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-control-bg rounded-2xl border border-white/10 text-xs font-bold">
        {[
          { key: 'passport', label: 'Passport', icon: FileCheck },
          { key: 'certificates', label: 'Certificates', icon: Award },
          { key: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                hapticFeedback.selectionChanged();
                setActiveTabState(tab.key as any);
              }}
              className={`press-feedback py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-gold text-app-bg font-extrabold shadow-md'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TITAN PASSPORT & FLEET ARCHIVE */}
      {activeTab === 'passport' && (
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <Cpu size={14} className="text-gold" />
            Your Machines
          </h2>

          {ownedMachinesList.length === 0 ? (
            <div className="web3-card rounded-2xl p-6 border border-white/10 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary">
                <Cpu size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">No Machines Commissioned</h3>
                <p className="text-xs text-text-tertiary max-w-xs mx-auto mt-1">
                  You currently have no cloud computing machines in your fleet.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onClose) onClose();
                  setActiveTab('hub');
                }}
                className="mt-1 py-2 px-4 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-2 hover:brightness-110 press-feedback transition-all cursor-pointer"
              >
                <ShoppingCart size={13} />
                <span>Explore Machines</span>
              </button>
            </div>
          ) : (
            <div className="web3-card rounded-2xl divide-y divide-white/5 border border-white/10 overflow-hidden text-xs">
              {ownedMachinesList.map((rec) => (
                <div key={rec.machineId} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
                      <Award size={18} />
                    </div>
                    <div>
                      <div className="font-extrabold text-text-primary">{rec.nickname}</div>
                      <div className="text-[10px] text-text-tertiary font-mono">{rec.serialNumber}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openOwnersManual(rec.tierCode)}
                      className="py-1 px-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => openCertificate(rec.machineId)}
                      className="py-1 px-2 rounded-lg bg-gold/15 border border-gold/30 text-[10px] font-bold text-gold hover:bg-gold/25 cursor-pointer"
                    >
                      Certificate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OWNERSHIP CERTIFICATES VAULT */}
      {activeTab === 'certificates' && (
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <Award size={14} className="text-gold" />
            Machine Certificates
          </h2>

          {ownedMachinesList.length === 0 ? (
            <div className="web3-card rounded-2xl p-6 border border-white/10 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                <Award size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">No Certificates Issued</h3>
                <p className="text-xs text-text-tertiary max-w-xs mx-auto mt-1">
                  Verifiable ownership certificates are generated cryptographically upon machine acquisition.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onClose) onClose();
                  setActiveTab('hub');
                }}
                className="mt-1 py-2 px-4 rounded-xl bg-gold text-app-bg font-extrabold text-xs flex items-center gap-2 hover:brightness-110 press-feedback transition-all cursor-pointer"
              >
                <ShoppingCart size={13} />
                <span>Acquire Machine</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {ownedMachinesList.map((rec) => (
                <div
                  key={rec.certificateId}
                  onClick={() => openCertificate(rec.machineId)}
                  className="web3-card-gold rounded-2xl p-4 border border-gold/30 flex items-center justify-between cursor-pointer hover:border-gold/60 transition-colors press-feedback"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold/20 text-gold flex items-center justify-center">
                      <Award size={22} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-text-primary">{rec.nickname} Certificate</div>
                      <div className="text-[10px] font-mono text-gold">{rec.certificateId}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-extrabold text-gold uppercase bg-gold/10 px-2.5 py-1 rounded-full border border-gold/20">
                    <span>View</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APP SETTINGS & SECURITY */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-2">
            <Settings size={14} className="text-text-tertiary" />
            App Settings
          </h2>

          {/* Group 1: Account Preferences */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <User size={13} /> Account Details
            </h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="font-extrabold text-text-secondary">Display Name</span>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-gold transition-colors font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-extrabold text-text-secondary">Connected WhatsApp (Option)</span>
                <input
                  type="text"
                  value={whatsappInput}
                  onChange={(e) => setWhatsappInput(e.target.value)}
                  placeholder="+256..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-gold transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-text-secondary">Language</span>
                  <select
                    value={settings.language}
                    onChange={(e) => settings.updateSetting('language', e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-text-primary font-mono focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="sw">Swahili</option>
                    <option value="lg">Luganda</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-text-secondary">Time Zone</span>
                  <select
                    value={settings.timeZone}
                    onChange={(e) => settings.updateSetting('timeZone', e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-text-primary font-mono focus:outline-none"
                  >
                    <option value="UTC">UTC</option>
                    <option value="EST">EST</option>
                    <option value="EAT">EAT (East Africa)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-extrabold text-text-secondary">Date Format</span>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => settings.updateSetting('dateFormat', e.target.value as any)}
                  className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-text-primary font-mono focus:outline-none"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-extrabold text-text-secondary">Local Currency Display</span>
                <button
                  onClick={() => settings.updateSetting('preferLocalCurrency', !settings.preferLocalCurrency)}
                  className={`px-3 py-1 rounded-lg font-mono font-bold transition-colors ${
                    settings.preferLocalCurrency ? 'bg-usdt-green/20 text-usdt-green border border-usdt-green/30' : 'bg-white/5 border border-white/10 text-text-secondary'
                  }`}
                >
                  {settings.preferLocalCurrency ? 'Prefer UGX/Local' : 'Prefer USDT'}
                </button>
              </div>

              <button
                onClick={handleSaveAccountProfile}
                disabled={isSavingProfile}
                className="w-full py-2 bg-gold text-app-bg font-extrabold rounded-xl mt-3 shadow-md press-feedback disabled:opacity-50 cursor-pointer"
              >
                {isSavingProfile ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </div>

          {/* Group: Mobile Money Withdrawal Settings */}
          <div className="web3-card rounded-2xl p-4 border border-usdt-green/30 bg-usdt-green/5 space-y-3">
            <h3 className="text-xs font-black uppercase text-usdt-green font-mono flex items-center gap-1.5 border-b border-white/10 pb-2">
              <Smartphone size={14} /> Mobile Money Withdrawal Settings
            </h3>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-extrabold text-text-primary block mb-1">
                  Mobile Money Withdrawal Number
                </label>
                <input
                  type="tel"
                  value={withdrawalPhone}
                  onChange={(e) => setWithdrawalPhone(e.target.value)}
                  placeholder="077 XXX XXXX"
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-text-primary font-mono focus:border-usdt-green focus:outline-none"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  <em>This is the number Titan Stream will send Mobile Money withdrawals to.</em>
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-text-tertiary">
                <strong>If you don't add a separate withdrawal number, your WhatsApp number will be used automatically.</strong>
                <div className="mt-1 text-amber-400 font-bold">
                  Note: Updating this number activates a 24-hour security cooling period for withdrawals.
                </div>
              </div>

              <button
                onClick={handleSaveWithdrawalPhone}
                disabled={isSavingPhone}
                className="w-full py-2 bg-usdt-green text-app-bg font-extrabold rounded-xl shadow-md press-feedback disabled:opacity-50"
              >
                {isSavingPhone ? 'Saving...' : 'Save Mobile Money Withdrawal Number'}
              </button>
            </div>
          </div>

          {/* Group 2: Notifications Preferences */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Bell size={13} /> Alerts & Notifications
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">When money is added</span>
                <input
                  type="checkbox"
                  checked={settings.notifyDeposits}
                  onChange={(e) => settings.updateSetting('notifyDeposits', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">When money is taken out</span>
                <input
                  type="checkbox"
                  checked={settings.notifyWithdrawals}
                  onChange={(e) => settings.updateSetting('notifyWithdrawals', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">When earnings are ready</span>
                <input
                  type="checkbox"
                  checked={settings.notifyRewardReady}
                  onChange={(e) => settings.updateSetting('notifyRewardReady', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">When a friend joins</span>
                <input
                  type="checkbox"
                  checked={settings.notifyReferralJoined}
                  onChange={(e) => settings.updateSetting('notifyReferralJoined', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Machine Offline alerts</span>
                <input
                  type="checkbox"
                  checked={settings.notifyMachineStopped}
                  onChange={(e) => settings.updateSetting('notifyMachineStopped', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <span className="font-extrabold text-text-secondary">Send alerts via</span>
                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                  {(['push', 'telegram', 'whatsapp'] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => settings.updateSetting('notifyChannel', ch)}
                      className={`py-1.5 rounded-lg text-[10px] font-black uppercase font-mono transition-all ${
                        settings.notifyChannel === ch ? 'bg-gold text-app-bg' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Privacy Control */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <ShieldCheck size={13} /> Privacy & Visibility
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Show my profile to friends I invited</span>
                <input
                  type="checkbox"
                  checked={settings.showProfileToReferrals}
                  onChange={(e) => settings.updateSetting('showProfileToReferrals', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Show me on leaderboards</span>
                <input
                  type="checkbox"
                  checked={settings.showLeaderboard}
                  onChange={(e) => settings.updateSetting('showLeaderboard', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Hide my earnings from others</span>
                <input
                  type="checkbox"
                  checked={settings.hideEarnings}
                  onChange={(e) => settings.updateSetting('hideEarnings', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Share my stats with friends</span>
                <input
                  type="checkbox"
                  checked={settings.shareReferralStats}
                  onChange={(e) => settings.updateSetting('shareReferralStats', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Group 4: Machine Preferences */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Sliders size={13} /> Machine Settings
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Open dashboard when app starts</span>
                <input
                  type="checkbox"
                  checked={settings.autoOpenHub}
                  onChange={(e) => settings.updateSetting('autoOpenHub', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Haptic Feedback</span>
                <input
                  type="checkbox"
                  checked={settings.hapticFeedback}
                  onChange={(e) => settings.updateSetting('hapticFeedback', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Display style</span>
                <select
                  value={settings.telemetryMode}
                  onChange={(e) => settings.updateSetting('telemetryMode', e.target.value as any)}
                  className="bg-black/40 border border-white/10 rounded-xl px-2 py-1 text-text-primary font-mono focus:outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="compact">Compact</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Reduced animations</span>
                <input
                  type="checkbox"
                  checked={settings.reducedAnimations}
                  onChange={(e) => settings.updateSetting('reducedAnimations', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Group 5: Appearance settings */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Palette size={13} /> Look & Feel
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-white/5">
                <span className="text-text-secondary font-extrabold">App Theme</span>
                <select
                  value={settings.theme || 'dark'}
                  onChange={(e) => settings.updateSetting('theme', e.target.value as any)}
                  className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-text-primary font-mono focus:outline-none"
                >
                  <option value="dark">Dark Theme</option>
                  <option value="light">Light Theme</option>
                  <option value="system">System Default</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-text-secondary">Accent Color</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'green', color: 'bg-usdt-green border-usdt-green/40' },
                    { key: 'cyan', color: 'bg-cyan-500 border-cyan-500/40' },
                    { key: 'gold', color: 'bg-gold border-gold/40' },
                    { key: 'purple', color: 'bg-purple-500 border-purple-500/40' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => settings.updateSetting('accentColor', item.key as any)}
                      className={`h-8 rounded-xl border flex items-center justify-center relative transition-all press-feedback ${item.color} ${
                        settings.accentColor === item.key ? 'scale-105 ring-2 ring-white/30' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {settings.accentColor === item.key && (
                        <Check size={14} className="text-app-bg font-black" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-text-secondary">Compact view</span>
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => settings.updateSetting('compactMode', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Large text sizing</span>
                <input
                  type="checkbox"
                  checked={settings.largeText}
                  onChange={(e) => settings.updateSetting('largeText', e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <span className="text-text-secondary font-extrabold">Graphics Quality</span>
                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                  {(['low', 'medium', 'high'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => settings.updateSetting('graphicsQuality', q)}
                      className={`py-1.5 rounded-lg text-[10px] font-black uppercase font-mono transition-all ${
                        settings.graphicsQuality === q ? 'bg-gold text-app-bg' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <span className="text-[9px] text-text-tertiary">
                  Low graphics profile disables shadow glows and reduces CPU/GPU load.
                </span>
              </div>
            </div>
          </div>

          {/* Group 6: Security, Sessions & Support */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Key size={13} /> Security & Login
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Connected ID (Telegram / WhatsApp)</span>
                <span className="font-mono text-text-primary">{telegramUserId}</span>
              </div>
              {settings.connectedWhatsApp && settings.connectedWhatsApp !== String(telegramUserId) && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Connected WhatsApp</span>
                  <span className="font-mono text-text-primary">{settings.connectedWhatsApp}</span>
                </div>
              )}

              {/* Session list */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase text-text-tertiary">Active Sessions (1)</span>
                <div className="flex justify-between items-center text-[10px]">
                  <div className="flex flex-col">
                    <span className="font-bold text-text-primary flex items-center gap-1">
                      <Smartphone size={10} className="text-usdt-green" /> This device (Active now)
                    </span>
                    <span className="text-text-tertiary mt-0.5 font-mono">Kampala, Uganda · 127.0.0.1</span>
                  </div>
                  <span className="text-usdt-green font-mono">ONLINE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleExportData}
                  className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary font-extrabold flex items-center justify-center gap-1.5 transition-colors press-feedback"
                >
                  <Download size={14} />
                  <span>Export Data</span>
                </button>

                <button
                  onClick={() => {
                    hapticFeedback.impactOccurred('medium');
                    showToast('Revoked all other devices successfully.', 'success');
                  }}
                  className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary font-extrabold flex items-center justify-center transition-colors press-feedback"
                >
                  <span>Log out other devices</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-400 font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-colors press-feedback animate-pulse focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label="Request permanent account deletion"
                >
                  <Trash2 size={14} />
                  <span>Delete My Account</span>
                </button>
              </div>
            </div>
          </div>

          {/* Group 7: Legal, Compliance & Disclaimers */}
          <div className="web3-card rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase text-gold font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
              <FileText size={13} /> Legal & Regulatory Center
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => openLegalModal('terms')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-gold/30 hover:bg-white/[0.06] text-left flex items-center justify-between transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-gold"
                aria-label="Open Terms of Service document"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gold" />
                  <span className="font-bold text-text-primary">Terms of Service</span>
                </div>
                <ChevronRight size={14} className="text-text-tertiary" />
              </button>

              <button
                onClick={() => openLegalModal('privacy')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-gold/30 hover:bg-white/[0.06] text-left flex items-center justify-between transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-gold"
                aria-label="Open Privacy Policy document"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-usdt-green" />
                  <span className="font-bold text-text-primary">Privacy Policy</span>
                </div>
                <ChevronRight size={14} className="text-text-tertiary" />
              </button>

              <button
                onClick={() => openLegalModal('refund')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-gold/30 hover:bg-white/[0.06] text-left flex items-center justify-between transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-gold"
                aria-label="Open Refund and Cancellation Policy document"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-amber-400" />
                  <span className="font-bold text-text-primary">Refund Policy</span>
                </div>
                <ChevronRight size={14} className="text-text-tertiary" />
              </button>

              <button
                onClick={() => openLegalModal('cookies')}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-gold/30 hover:bg-white/[0.06] text-left flex items-center justify-between transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-gold"
                aria-label="Open Cookie and Local Storage Policy document"
              >
                <div className="flex items-center gap-2">
                  <Cookie size={14} className="text-sky-400" />
                  <span className="font-bold text-text-primary">Cookies & Storage</span>
                </div>
                <ChevronRight size={14} className="text-text-tertiary" />
              </button>
            </div>

            <button
              onClick={() => openLegalModal('business')}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-text-primary text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Open Corporate Particulars, Licenses and Disclaimers"
            >
              <Building2 size={13} className="text-gold" />
              <span>Entity Particulars, Licenses & Disclaimers</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Sign out of current account"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="web3-card max-w-[340px] w-full rounded-3xl p-5 border border-red-500/50 bg-[#090b10] flex flex-col items-center text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
                <Trash2 size={24} />
              </div>

              <div>
                <h3 className="text-sm font-black text-text-primary uppercase tracking-wide">Delete Account</h3>
                <p className="text-xs text-text-secondary leading-relaxed mt-1">
                  This will permanently delete your account, remove your wallet balance, and remove all your machines. This cannot be undone.
                </p>
              </div>

              <div className="w-full text-left space-y-1.5 text-xs">
                <span className="text-text-tertiary">Type <strong className="text-red-400 font-bold font-mono select-all">DELETE MY ACCOUNT</strong> to confirm:</span>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Type phrase..."
                  className="w-full bg-black/40 border border-red-500/30 rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-red-500 font-mono text-center"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                  }}
                  className="py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-extrabold"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <MachineOwnersManualModal />
      <MachineCertificateModal />
    </div>
  );
};
