import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Music,
  Calendar,
  BarChart3,
  Settings,
  Guitar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  DollarSign,
  Activity,
  X,
  Megaphone,
  Inbox,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

// navItems are dynamic (badge count), so we build them inside the component
const staticNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Alunos", href: "/alunos", icon: Users },
  { label: "Aulas", href: "/aulas", icon: Calendar },
  { label: "Instrumentos", href: "/instrumentos", icon: Guitar },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Lembretes", href: "/lembretes", icon: Bell },
  { label: "Comunicados", href: "/comunicados", icon: Megaphone },
  { label: "Mensagens", href: "/mensagens", icon: MessageSquare },
  { label: "Solicitações", href: "/solicitacoes", icon: Inbox },
  { label: "IA Assistente", href: "/ia", icon: Sparkles },
  { label: "Progresso", href: "/progresso", icon: Activity },
  { label: "Mensalidades", href: "/mensalidades", icon: DollarSign },
];

const bottomItems: NavItem[] = [
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: AppSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: reminderCount = 0 } = trpc.reminders.pendingCount.useQuery();
  const { data: messageCount = 0 } = trpc.chat.unreadCount.useQuery();
  const { data: requestCount = 0 } = trpc.reschedule.pendingCount.useQuery();

  const navItems: NavItem[] = staticNavItems.map(item => {
    if (item.href === "/lembretes") return { ...item, badge: reminderCount > 0 ? reminderCount : undefined };
    if (item.href === "/mensagens") return { ...item, badge: messageCount > 0 ? messageCount : undefined };
    if (item.href === "/solicitacoes") return { ...item, badge: requestCount > 0 ? requestCount : undefined };
    return item;
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "P";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative border-r border-sidebar-border shadow-2xl z-20 overflow-hidden",
        collapsed ? "w-[80px]" : "w-[260px]",
        // Mobile drawer specific styling
        "lg:translate-x-0"
      )}
    >
      {/* Mobile Close Button */}
      <button
        onClick={onToggle}
        className="lg:hidden absolute top-6 right-4 w-10 h-10 rounded-xl bg-sidebar-accent text-sidebar-foreground flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors z-50"
        aria-label="Fechar menu"
      >
        <X size={20} />
      </button>

      {/* Toggle button - desktop only */}
      <button
        onClick={onToggle}
        className={cn(
          "hidden lg:flex absolute -right-4 top-10 z-[60] w-9 h-9 rounded-xl items-center justify-center shadow-[0_8px_20px_-4px_rgba(37,99,235,0.4)] transition-all duration-300 border border-white/10 group/toggle",
          collapsed 
            ? "bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white rotate-0" 
            : "bg-sidebar text-sidebar-foreground rotate-0 hover:bg-sidebar-accent"
        )}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? (
          <ChevronRight size={20} className="group-hover/toggle:scale-110 transition-transform" />
        ) : (
          <ChevronLeft size={20} className="group-hover/toggle:scale-110 transition-transform" />
        )}
      </button>

      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-6 py-8",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
          <Music size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <p className="text-base font-black text-white tracking-tight leading-none">MusicPro</p>
            <p className="text-[10px] text-sidebar-foreground/50 font-bold uppercase tracking-widest mt-1">Gestão Musical</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto no-scrollbar scroll-smooth">
        {!collapsed && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/30 px-3 mb-4 animate-in fade-in duration-500">Menu</p>
        )}
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer group relative overflow-hidden",
                  isActive
                    ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebarActiveGlow"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
                <Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0 transition-transform duration-300 relative z-10",
                    isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-indigo-400"
                  )}
                />
                {!collapsed && (
                  <span className="truncate tracking-tight relative z-10">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="ml-auto bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-rose-500/20 relative z-10">
                    {item.badge}
                  </span>
                )}
                
                {/* Active Indicator Glow */}
                {isActive && !collapsed && (
                   <div className="absolute left-[-4px] top-1/4 bottom-1/4 w-1 bg-white rounded-full shadow-[0_0_10px_#fff] z-20" />
                )}
              </div>
            </Link>
          );
        })}

        {!collapsed && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/30 px-3 mt-8 mb-4 animate-in fade-in duration-500">Geral</p>
        )}
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer group",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0 group-hover:scale-110 transition-transform group-hover:text-indigo-400" />
                {!collapsed && <span className="truncate tracking-tight">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      <div className={cn(
        "p-4 bg-sidebar-accent/30 border-t border-sidebar-border",
        collapsed ? "flex justify-center" : ""
      )}>
        {collapsed ? (
          <Avatar className="w-10 h-10 cursor-pointer border-2 border-sidebar-border shadow-xl" title={user?.name ?? "Perfil"}>
            <AvatarFallback className="bg-[#2563EB] text-white text-xs font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex items-center gap-3 bg-sidebar-accent/50 p-3 rounded-2xl border border-sidebar-border/50 group/profile">
            <Avatar className="w-9 h-9 flex-shrink-0 border border-sidebar-border shadow-lg group-hover/profile:scale-105 transition-transform">
              <AvatarFallback className="bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white text-xs font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate tracking-tight">{user?.name ?? "WR Music"}</p>
              <p className="text-[9px] text-sidebar-foreground/40 font-bold truncate uppercase tracking-tighter">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'professor' ? 'Professor' : user?.role === 'aluno' ? 'Aluno' : 'Membro'}
              </p>
            </div>
            <button
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center flex-shrink-0 transition-all"
              onClick={() => logoutMutation.mutate()}
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
