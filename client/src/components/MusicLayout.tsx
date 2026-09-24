import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileTabBar } from "./MobileTabBar";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Music, ShieldAlert } from "lucide-react";
import LoadingScreen from "./LoadingScreen";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useLocation } from "wouter";
import { firstAllowedPath, isPageAllowed } from "@shared/permissions";
import { ReferralPromoModal } from "@/components/indicacao/ReferralPromoModal";
import { SubscriptionRenewalModal } from "@/components/dashboard/SubscriptionAlerts";

interface MusicLayoutProps {
  children: React.ReactNode;
}

export function MusicLayout({ children }: MusicLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { isMobile, isTablet, isDesktop, isXL, isMacBook } = useBreakpoint();
  
  // Sidebar state
  // On tablet or MacBook Air/Pro 13/14", start collapsed.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280 || (typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) && window.innerWidth <= 1440);
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync collapsed state with breakpoint
  useEffect(() => {
    if (isTablet || isMacBook) {
      setCollapsed(true);
    } else if (isDesktop && !isXL) {
      // Desktop pequeno (1024-1279px = MacBook Air 13"): colapsa sidebar
      setCollapsed(true);
    } else if (isXL && !isMacBook) {
      // Desktop grande (≥1280px não-MacBook): expande sidebar
      setCollapsed(false);
    }
  }, [isTablet, isDesktop, isXL, isMacBook]);

  const [location, setLocation] = useLocation();

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

  // Guard de permissão: professor só acessa páginas liberadas pelo admin.
  // Rotas admin-only (ex.: /novidades, /marketing) são bloqueadas; rotas fora do
  // catálogo (ex.: /checkout, /assinatura) permanecem liberadas.
  useEffect(() => {
    if (loading || !isAuthenticated || user?.role !== 'professor') return;
    const perms = (user as any)?.permissions || [];
    if (isPageAllowed(perms, location)) return;
    const fallback = firstAllowedPath(perms);
    if (fallback) setLocation(fallback);
  }, [loading, isAuthenticated, user, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Professor sem nenhuma página liberada: aviso (sem redirect — evita loop)
  if (user?.role === 'professor' && !firstAllowedPath((user as any)?.permissions || [])) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldAlert className="mx-auto text-destructive" size={48} />
          <h1 className="text-2xl font-black">Acesso restrito</h1>
          <p className="text-muted-foreground text-sm">
            Seu usuário ainda não tem nenhuma página liberada. Fale com o administrador da escola.
          </p>
          <Button variant="outline" onClick={() => { void logout(); }}>Sair</Button>
        </div>
      </div>
    );
  }

  const u = user as any;
  const trialEndsAt = u?.trialEndsAt ? new Date(u.trialEndsAt) : null;
  const isTrialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
  const isSubscriptionActive = u?.subscriptionStatus === "active";
  const isGracePeriod = false;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ maxHeight: '100dvh' }}>
      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar - Desktop & Tablet */}
      <div
        className="hidden md:flex flex-shrink-0 transition-all duration-300"
        style={{ width: collapsed ? '80px' : '270px', minWidth: collapsed ? '80px' : '270px' }}
      >
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{ minWidth: 0 }}>
        <AppHeader 
          onMobileMenuOpen={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed(!collapsed)}
          sidebarCollapsed={collapsed}
        />
        
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

        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-5 lg:p-6 scrollbar-thin no-scrollbar overflow-x-hidden min-w-0" style={{ paddingBottom: isDesktop || isTablet ? 'max(1.5rem, env(safe-area-inset-bottom, 0px))' : 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-[1600px] mx-auto w-full fluid-container">
            {children}
          </div>
        </main>
      </div>

      {/* Tab Bar Inferior para Mobile (Admin/Professor) */}
      <MobileTabBar onMenuClick={() => setMobileOpen(true)} />

      {/* Anúncio do Indique & Ganhe — 2x ao dia (manhã e tarde) */}
      <ReferralPromoModal />

      {/* Lembrete amigável da mensalidade do MusicPro (≤ 3 dias, 1x/dia) */}
      <SubscriptionRenewalModal />
    </div>
  );
}

