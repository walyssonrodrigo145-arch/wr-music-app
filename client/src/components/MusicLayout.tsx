import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2, Music } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-xl animate-pulse">
            <Music size={28} className="text-white" />
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar - Desktop & Tablet */}
      <div className="hidden lg:flex flex-shrink-0 transition-all duration-300">
        <AppSidebar 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
        />
      </div>

      {/* Sidebar - Mobile Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
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
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 scrollbar-thin no-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
          {/* Bottom padding for mobile to avoid content being hidden by floating buttons or safe areas */}
          <div className="h-20 lg:hidden" />
        </main>
      </div>
    </div>
  );
}

