import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Radio, Wallet, Users, Cpu, ShieldAlert, Sparkles, ChevronLeft, Gamepad2, Settings, MessageSquare, Gift, Store,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

const primaryNavItems: NavItem[] = [
  { label: 'Mission Control', icon: <Radio size={18} />, path: '/admin' },
  { label: 'Treasury & Financials', icon: <Wallet size={18} />, path: '/admin/treasury' },
  { label: 'Merchant Settlements', icon: <Store size={18} />, path: '/admin/merchants' },
  { label: 'Users & Support', icon: <Users size={18} />, path: '/admin/users', badge: 2 },
  { label: 'Growth & Rewards', icon: <Gift size={18} />, path: '/admin/growth' },
  { label: 'WhatsApp Fleet', icon: <MessageSquare size={18} />, path: '/admin/whatsapp' },
  { label: 'Operations & Infra', icon: <Cpu size={18} />, path: '/admin/operations' },
  { label: 'Security & Intelligence', icon: <ShieldAlert size={18} />, path: '/admin/risk', badge: 1 },
  { label: 'Wallet & Settings', icon: <Sparkles size={18} />, path: '/admin/settings' },
  { label: 'Games Command', icon: <Gamepad2 size={18} />, path: '/admin/games' },
  { label: 'Readiness & Cert', icon: <Settings size={18} />, path: '/admin/readiness' },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed, onToggle, mobile = false }) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (mobile) {
    return (
      <aside className="flex flex-col h-full bg-app-bg-secondary">
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 no-scrollbar">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Mission Operations</p>
          {primaryNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-medium transition-all mb-1 min-h-[44px]
                  ${active ? 'bg-usdt-green/15 text-usdt-green font-bold border border-usdt-green/30' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-error-red text-white text-[10px] font-bold">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside className={`h-screen bg-app-bg-secondary border-r border-border flex flex-col transition-all duration-200 ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}>
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-usdt-green animate-pulse" />
            <span className="text-sm font-black tracking-wider text-text-primary uppercase">TITAN CONTROL</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg hover:bg-control-bg transition-colors text-text-secondary ${collapsed ? 'mx-auto' : ''}`}
        >
          <ChevronLeft size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1.5 no-scrollbar">
        {!collapsed && (
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Mission Operations</p>
        )}
        {primaryNavItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all
                ${active ? 'bg-usdt-green/15 text-usdt-green border border-usdt-green/30 shadow-sm shadow-usdt-green/10' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}
                ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-error-red text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-error-red text-white text-[9px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <span className="w-2 h-2 rounded-full bg-usdt-green animate-ping" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-text-primary leading-none">PRODUCTION LIVE</span>
              <span className="text-[9px] text-text-tertiary mt-0.5">Real-time Data Direct</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
