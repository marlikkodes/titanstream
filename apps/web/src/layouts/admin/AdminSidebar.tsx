import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Radio, Wallet, Users, Cpu, ShieldAlert, Sparkles, ChevronLeft, Gamepad2, Settings, MessageSquare,
  Gift, Store, ShoppingCart, Activity, Zap, Bell, FileText, Headphones, BookOpen,
} from 'lucide-react';

interface NavSection {
  title: string;
  items: {
    label: string;
    icon: React.ReactNode;
    path: string;
    badge?: number;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Core Control Plane',
    items: [
      { label: 'Mission Control', icon: <Radio size={16} />, path: '/admin' },
      { label: 'Treasury & Reserves', icon: <Wallet size={16} />, path: '/admin/treasury' },
      { label: 'General Ledger', icon: <BookOpen size={16} />, path: '/admin/financial' },
      { label: 'Settlement Orders', icon: <ShoppingCart size={16} />, path: '/admin/orders' },
      { label: 'Merchant Pools', icon: <Store size={16} />, path: '/admin/merchants' },
    ],
  },
  {
    title: 'Fleet & Operations',
    items: [
      { label: 'Compute Machines', icon: <Zap size={16} />, path: '/admin/machines' },
      { label: 'Operations HQ', icon: <Cpu size={16} />, path: '/admin/operations-hq' },
      { label: 'System Health', icon: <Activity size={16} />, path: '/admin/health' },
      { label: 'Automation Rules', icon: <Sparkles size={16} />, path: '/admin/automation' },
    ],
  },
  {
    title: 'Users & Community',
    items: [
      { label: 'User Intelligence', icon: <Users size={16} />, path: '/admin/users' },
      { label: 'Support Desk', icon: <Headphones size={16} />, path: '/admin/support' },
      { label: 'Growth & Referrals', icon: <Gift size={16} />, path: '/admin/growth' },
      { label: 'WhatsApp Network', icon: <MessageSquare size={16} />, path: '/admin/whatsapp' },
      { label: 'Games Engine', icon: <Gamepad2 size={16} />, path: '/admin/games' },
    ],
  },
  {
    title: 'Security & Integrity',
    items: [
      { label: 'Risk & Fraud Center', icon: <ShieldAlert size={16} />, path: '/admin/risk', badge: 1 },
      { label: 'Audit Log Explorer', icon: <FileText size={16} />, path: '/admin/audit' },
      { label: 'System Alerts', icon: <Bell size={16} />, path: '/admin/notifications' },
      { label: 'Launch Certification', icon: <Settings size={16} />, path: '/admin/readiness' },
      { label: 'Platform Settings', icon: <Sparkles size={16} />, path: '/admin/settings' },
    ],
  },
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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 no-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                {section.title}
              </p>
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[40px]
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
            </div>
          ))}
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

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 no-scrollbar">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-text-tertiary">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                    ${active ? 'bg-usdt-green/15 text-usdt-green border border-usdt-green/30 shadow-sm shadow-usdt-green/10' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}
                    ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate text-[11px]">{item.label}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full bg-error-red text-white text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && item.badge && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-error-red text-white text-[8px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
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
