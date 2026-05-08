import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  Library,
  ClipboardCheck,
  Activity,
  MessageSquare,
  DollarSign,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Music,
  X,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/aluno", icon: LayoutDashboard },
  { label: "Aulas", href: "/aluno/aulas", icon: Calendar },
  { label: "Agenda", href: "/aluno/agenda", icon: CalendarDays },
  { label: "Materiais", href: "/aluno/materiais", icon: Library },
  { label: "Exercícios", href: "/aluno/exercicios", icon: ClipboardCheck },
  { label: "Progresso", href: "/aluno/progresso", icon: Activity },
  { label: "Mensagens", href: "/aluno/mensagens", icon: MessageSquare },
  { label: "Pagamentos", href: "/aluno/pagamentos", icon: DollarSign },
  { label: "Perfil", href: "/aluno/perfil", icon: User },
];

interface StudentSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function StudentSidebar({ collapsed, onToggle, onNavigate }: StudentSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AL";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#0B1220] text-slate-400 transition-all duration-300 ease-in-out relative border-r border-slate-800/50 shadow-2xl z-20 overflow-hidden",
        collapsed ? "w-[80px]" : "w-[260px]",
        "lg:translate-x-0"
      )}
    >
      {/* Mobile Close Button */}
      <button
        onClick={onToggle}
        className="lg:hidden absolute top-6 right-4 w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors z-50"
        aria-label="Fechar menu"
      >
        <X size={20} />
      </button>

      {/* Toggle button - desktop only */}
      <button
        onClick={onToggle}
        className="hidden lg:flex absolute -right-3.5 top-10 z-30 w-7 h-7 rounded-full bg-[#0B1220] text-slate-400 items-center justify-center shadow-xl hover:text-white hover:scale-110 transition-all border border-slate-800"
        aria-label="Recolher menu"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-6 py-8",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
          <Music size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <p className="text-base font-black text-white tracking-tight leading-none">MusicPro</p>
            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">Portal do Aluno</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto no-scrollbar scroll-smooth">
        {!collapsed && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-3 mb-4 animate-in fade-in duration-500">Menu Principal</p>
        )}
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/aluno" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer group relative",
                  isActive
                    ? "bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-white",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
                {!collapsed && (
                  <span className="truncate tracking-tight">{item.label}</span>
                )}
                
                {/* Active Indicator Glow */}
                {isActive && !collapsed && (
                   <div className="absolute left-[-4px] top-1/4 bottom-1/4 w-1 bg-white rounded-full shadow-[0_0_10px_#fff]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      <div className={cn(
        "p-4 bg-slate-900/30 border-t border-slate-800/50",
        collapsed ? "flex justify-center" : ""
      )}>
        {collapsed ? (
          <Avatar className="w-10 h-10 cursor-pointer border-2 border-slate-800 shadow-xl" title={user?.name ?? "Perfil"}>
            <AvatarFallback className="bg-[#7C3AED] text-white text-xs font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex items-center gap-3 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/30 group/profile">
            <Avatar className="w-9 h-9 flex-shrink-0 border border-slate-600 shadow-lg group-hover/profile:scale-105 transition-transform">
              <AvatarFallback className="bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white text-xs font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate tracking-tight">{user?.name ?? "Aluno"}</p>
              <p className="text-[9px] text-purple-400 font-bold truncate uppercase tracking-tighter">Aluno</p>
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
