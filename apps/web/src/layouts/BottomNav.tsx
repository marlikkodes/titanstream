import { Wallet, TrendingUp, Cpu, ShoppingCart, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '../store/useNavigationStore';
import { useRewardQueueStore } from '../store/useRewardQueueStore';
import { Badge } from '../components/Badge';

type TabId = 'wallet' | 'grow' | 'hub' | 'shop' | 'rewards';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  isCenter?: boolean;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore();
  const claimableMissionsCount = useRewardQueueStore(
    (s) => (Array.isArray(s.missions) ? s.missions.filter((m) => m.eligible).length : 0),
  );

  const navItems: NavItem[] = [
    { id: 'wallet', label: 'Wallet', icon: <Wallet size={18} /> },
    { id: 'grow', label: 'Grow', icon: <TrendingUp size={18} /> },
    { id: 'hub', label: 'Titan Hub', icon: <Cpu size={22} />, isCenter: true },
    { id: 'shop', label: 'Shop', icon: <ShoppingCart size={18} /> },
    { id: 'rewards', label: 'Rewards', icon: <Gift size={18} />, badge: claimableMissionsCount },
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[440px] lg:max-w-[700px] xl:max-w-[960px] h-[64px] lg:h-[72px] glass-nav rounded-2xl flex items-center justify-around px-1 z-30 select-none">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              relative flex flex-col items-center justify-center flex-1 h-full py-1.5 press-feedback transition-colors duration-150
              ${isActive ? 'text-usdt-green' : 'text-text-secondary hover:text-text-primary'}
            `}
          >
            {/* Animated active backdrop capsule */}
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className={`absolute inset-x-1.5 inset-y-1 rounded-xl border shadow-[0_0_12px_rgba(0,230,118,0.15)] ${
                  item.isCenter
                    ? 'bg-usdt-green/15 border-usdt-green/30'
                    : 'bg-usdt-green/10 border-usdt-green/20'
                }`}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}

            {/* Center hub glow ring */}
            {item.isCenter && isActive && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-usdt-green/40 blur-sm" />
            )}

            <div className="relative z-10 mb-0.5 flex items-center justify-center">
              {item.icon}
              {item.badge ? (
                <Badge
                  count={item.badge}
                  className="absolute -top-1.5 -right-2.5 shadow-md border border-[#12141d] scale-85"
                />
              ) : null}
            </div>

            <span className={`relative z-10 text-[9px] font-extrabold uppercase tracking-widest leading-none mt-1 ${isActive ? 'text-usdt-green' : 'text-text-tertiary'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
