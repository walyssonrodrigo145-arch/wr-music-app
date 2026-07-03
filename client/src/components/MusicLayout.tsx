import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2, Music } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useLocation } from "wouter";

interface MusicLayoutProps {
  children: React.ReactNode;
}

export function MusicLayout({ children }: MusicLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  // Sidebar state
  // On tablet, start collapsed. On desktop, start open.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync collapsed state with tablet breakpoint
  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (isDesktop) {
      setCollapsed(false);
    }
  }, [isTablet, isDesktop]);

  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        setLocation(getLoginUrl());
      } else if (user?.role === 'aluno' && !window.location.pathname.startsWith('/aluno')) {
        setLocation("/aluno");
      }
    }
  }, [loading, isAuthenticated, user?.role, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shadow-xl animate-pulse overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center relative z-10">
              <div className="flex items-center gap-[4px] h-6">
                <div className="w-1.5 bg-white/90 rounded-full h-3" />
                <div className="w-1.5 bg-white/90 rounded-full h-6" />
                <div className="w-1.5 bg-white rounded-full h-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <div className="w-1.5 bg-white/90 rounded-full h-4.5" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm font-medium">Carregando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const isTrialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
  const isSubscriptionActive = user?.subscriptionStatus === "active";
  const isGracePeriod = !isSubscriptionActive && isTrialExpired && trialEndsAt !== null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() + 3 * 24 * 60 * 60 * 1000 - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar - Desktop & Tablet */}
      <div className="hidden md:flex flex-shrink-0 transition-all duration-300">
        <AppSidebar 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
        />
      </div>

      {/* Sidebar - Mobile Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AppSidebar 
          collapsed={false} 
          onToggle={() => setMobileOpen(false)} 
          onNavigate={() => setMobileOpen(false)} 
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        
        {isGracePeriod && (
          <div className="bg-destructive/10 border-b border-destructive/20 p-3 sm:p-4 shrink-0 flex items-start gap-3 justify-center text-center sm:text-left z-30">
            <div className="bg-destructive/20 p-1.5 rounded-full mt-0.5">
              <span className="text-destructive font-black text-xs sm:text-sm">⚠️</span>
            </div>
            <div>
              <h3 className="text-destructive font-black text-sm sm:text-base">
                O seu período de teste grátis acabou!
              </h3>
              <p className="text-destructive/80 text-xs sm:text-sm mt-1 font-medium max-w-3xl">
                Você tem <strong>{daysLeft} dia(s)</strong> para efetuar o pagamento. Caso contrário, o sistema será bloqueado e <strong className="underline">todos os seus dados poderão ser excluídos permanentemente</strong>. <a href="/checkout" className="text-destructive font-bold underline hover:text-red-700 ml-1">Pagar agora &rarr;</a>
              </p>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 scrollbar-thin no-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

