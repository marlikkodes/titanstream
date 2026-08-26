import type React from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { GamesScreen } from '../pages/Games';
import { useNavigationStore } from '../store/useNavigationStore';
import { ToastContainer } from '../components/Toast';
import { UserNotificationModal } from '../components/UserNotificationModal';
import { useUserNotificationStore } from '../store/useUserNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { showGames } = useNavigationStore();
  const { isModalOpen, setModalOpen } = useUserNotificationStore();
  const isMirrorMode = useAuthStore((s) => s.isMirrorMode) || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mirror_mode') === 'true');
  const session = useAuthStore((s) => s.session);
  const exitMirrorSession = useAuthStore((s) => s.exitMirrorSession);

  return (
    <div className="w-full max-w-[480px] lg:max-w-[768px] xl:max-w-[1024px] min-h-screen mx-auto flex flex-col bg-[#090a0f] text-text-primary relative overflow-hidden shadow-2xl border-x border-border/40">
      {/* Background Mesh Glow Leaks for premium depth */}
      <div className="mesh-glow-bg">
        <div className="mesh-glow-1" />
        <div className="mesh-glow-2" />
      </div>

      {isMirrorMode && (
        <div className="bg-amber-400 text-black px-3 py-2 text-xs font-black flex items-center justify-between sticky top-0 z-[100] shadow-xl border-b border-amber-500 animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-black animate-ping flex-shrink-0" />
            <span className="truncate">
              MIRROR MODE: {session?.user?.firstName || 'Operator'} ({session?.user?.telegramUsername ? `@${session.user.telegramUsername}` : session?.user?.telegramUserId || 'User'})
            </span>
          </div>
          <button
            onClick={() => {
              exitMirrorSession();
              window.location.href = '/admin/users';
            }}
            className="px-2.5 py-1 rounded-lg bg-black text-amber-300 hover:bg-neutral-900 font-extrabold text-[11px] transition-all flex items-center gap-1 flex-shrink-0 ml-2 cursor-pointer shadow"
          >
            <ArrowLeft size={12} />
            <span>Exit to Admin</span>
          </button>
        </div>
      )}

      <Header />

      <main className="flex-1 pb-[88px] lg:pb-[96px] overflow-y-auto no-scrollbar relative z-10">
        {children}
      </main>

      {/* Games Screen Overlay */}
      {showGames && <GamesScreen />}

      <BottomNav />
      <ToastContainer />

      {/* User Notification Modal (Escapes Header stacking context for perfect z-index layering) */}
      <UserNotificationModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};
