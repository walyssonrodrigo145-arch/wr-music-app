import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StudentSidebar } from "./StudentSidebar";
import { AppHeader } from "./AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2, Music } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useLocation } from "wouter";

interface StudentPortalLayoutProps {
  children: React.ReactNode;
}

export function StudentPortalLayout({ children }: StudentPortalLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (isDesktop) {
      setCollapsed(false);
    }
  }, [isTablet, isDesktop]);

  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        setLocation(getLoginUrl());
      } else if (user?.role && user.role !== 'aluno' && user.role !== 'admin') {
        setLocation("/dashboard");
      }
    }
  }, [loading, isAuthenticated, user?.role, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center overflow-hidden relative">
        {/* Animated Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        
        <div className="flex flex-col items-center gap-8 relative z-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary via-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_20px_50px_rgba(124,58,237,0.3)] relative group"
          >
            <Music size={40} className="text-white group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 rounded-[2rem] border-2 border-white/20 animate-ping opacity-20" />
          </motion.div>
          
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-white text-xl font-black tracking-tight">MusicPro Portal</h2>
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <Loader2 size={16} className="animate-spin text-primary" />
              <span className="text-xs font-black text-white/60 uppercase tracking-[0.2em]">Sincronizando seus dados...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'aluno' && user?.role !== 'admin')) return null;

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
        <StudentSidebar 
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
        <StudentSidebar 
          collapsed={false} 
          onToggle={() => setMobileOpen(false)} 
          onNavigate={() => setMobileOpen(false)} 
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 scrollbar-thin no-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
          <div className="h-20 md:hidden" />
        </main>
      </div>
    </div>
  );
}
