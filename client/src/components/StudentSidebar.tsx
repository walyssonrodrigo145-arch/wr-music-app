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
  Bell,
  RefreshCcw,
  Clock,
  PlusCircle,
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

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/aluno", icon: LayoutDashboard },
  { label: "Avisos", href: "/aluno/avisos", icon: Bell },
  { label: "Aulas / Agenda", href: "/aluno/aulas", icon: CalendarDays },
  { label: "Materiais", href: "/aluno/materiais", icon: Library },
  { label: "Exercícios", href: "/aluno/exercicios", icon: ClipboardCheck },
  { label: "Financeiro", href: "/aluno/pagamentos", icon: DollarSign },
  { label: "Mensagens", href: "/aluno/mensagens", icon: MessageSquare },
  { label: "Meu Perfil", href: "/aluno/perfil", icon: User },
];

const requestItems: NavItem[] = [
  { label: "Solicitar Reposição", href: "/aluno/solicitar-reposicao", icon: PlusCircle },
  { label: "Solicitar Remarcação", href: "/aluno/solicitar-remarcacao", icon: Clock },
];

interface StudentSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function StudentSidebar({ collapsed, onToggle, onNavigate }: StudentSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: messageCount = 0 } = trpc.chat.unreadCount.useQuery();
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AL";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar/95 backdrop-blur-xl text-sidebar-foreground/70 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative border-r border-sidebar-border/50 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.5)] z-20 overflow-hidden",
        collapsed ? "w-[90px]" : "w-[280px]",
        "lg:translate-x-0"
      )}
    >
      {/* Mobile Close Button */}
      <button
        onClick={onToggle}
        className="lg:hidden absolute top-6 right-4 w-12 h-12 rounded-2xl bg-sidebar-accent/50 text-white flex items-center justify-center hover:bg-slate-700 transition-all z-50 shadow-xl border border-white/10"
        aria-label="Fechar menu"
      >
        <X size={24} />
      </button>

      {/* Toggle button - desktop only - Refined Style */}
      <button
        onClick={onToggle}
        className="hidden md:flex absolute -right-4 top-12 z-30 w-8 h-8 rounded-full bg-sidebar text-sidebar-foreground/70 items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.3)] hover:text-white hover:scale-110 active:scale-95 transition-all border border-sidebar-border/50 group"
        aria-label="Recolher menu"
      >
        <div className="transition-transform duration-500 group-hover:rotate-12">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </div>
      </button>

      {/* Logo Section - Premium Appearance */}
      <div className={cn(
        "flex items-center gap-4 px-7 py-10",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6366F1] to-[#4F46E5] flex items-center justify-center flex-shrink-0 shadow-[0_8px_20px_-4px_rgba(124,58,237,0.5)] group-hover:rotate-6 transition-all duration-500">
          <Music size={24} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
            <p className="text-xl font-black text-white tracking-tight leading-none">MusicPro</p>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.25em] mt-1.5 opacity-80">Premium Portal</p>
          </div>
        )}
      </div>

      {/* Navigation - Polished Links */}
      <nav className="flex-1 px-5 py-4 space-y-2 overflow-y-auto no-scrollbar scroll-smooth">
        {!collapsed && (
          <div className="flex items-center gap-4 px-3 mb-6 animate-in fade-in duration-700">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/30">Plataforma</p>
            <div className="h-px flex-1 bg-sidebar-border/20" />
          </div>
        )}
        
        <div className="space-y-1.5">
          {mainNavItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/aluno" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-500 cursor-pointer group relative overflow-hidden",
                    isActive
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white shadow-[0_10px_20px_-5px_rgba(124,58,237,0.5)]"
                      : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-white",
                    collapsed && "justify-center px-0 h-14"
                  )}
                  title={collapsed ? item.label : undefined}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <Icon
                    size={20}
                    className={cn(
                      "flex-shrink-0 transition-all duration-500",
                      isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "group-hover:scale-110 group-hover:text-white"
                    )}
                  />
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate tracking-tight animate-in fade-in duration-500">{item.label}</span>
                      {item.href === "/aluno/mensagens" && messageCount > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-rose-500/20">
                          {messageCount}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {isActive && !collapsed && (
                    <div className="absolute right-0 top-3 bottom-3 w-1 bg-white rounded-l-full shadow-[0_0_15px_#fff]" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Requests - More Visual Separation */}
        <div className="pt-8 pb-4">
          {!collapsed && (
            <div className="flex items-center gap-4 px-3 mb-6 animate-in fade-in duration-700">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/30">Suporte</p>
              <div className="h-px flex-1 bg-sidebar-border/20" />
            </div>
          )}
          <div className="space-y-1.5">
            {requestItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-500 cursor-pointer group relative overflow-hidden",
                      isActive
                        ? "bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white shadow-[0_10px_20px_-5px_rgba(124,58,237,0.5)]"
                        : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-white",
                      collapsed && "justify-center px-0 h-14"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className={cn(
                        "flex-shrink-0 transition-all duration-500",
                        isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "group-hover:scale-110"
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate tracking-tight animate-in fade-in duration-500">{item.label}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User Footer - Premium Card Look */}
      <div className={cn(
        "p-6 mt-auto",
        collapsed ? "flex justify-center" : ""
      )}>
        {collapsed ? (
          <Avatar className="w-12 h-12 cursor-pointer border-2 border-sidebar-border/50 shadow-2xl hover:scale-110 transition-all ring-offset-2 ring-offset-sidebar ring-primary/20" title={user?.name ?? "Perfil"}>
            <AvatarFallback className="bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white text-sm font-black uppercase">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="bg-sidebar-accent/20 p-4 rounded-[2rem] border border-sidebar-border/30 group/profile backdrop-blur-md shadow-xl transition-all hover:bg-sidebar-accent/30">
            <div className="flex items-center gap-3">
              <Avatar className="w-11 h-11 flex-shrink-0 border-2 border-sidebar-border shadow-lg group-hover/profile:rotate-3 transition-all duration-500">
                <AvatarFallback className="bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white text-sm font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate tracking-tight">{user?.name ?? "Aluno"}</p>
                <p className="text-[9px] text-indigo-400 font-black truncate uppercase tracking-[0.1em] mt-0.5">Membro Premium</p>
              </div>
              <button
                className="w-10 h-10 rounded-xl bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center flex-shrink-0 transition-all border border-transparent hover:border-rose-500/20 active:scale-90"
                onClick={() => logoutMutation.mutate()}
                title="Sair da conta"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
