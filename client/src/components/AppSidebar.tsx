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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
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
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Alunos", href: "/alunos", icon: Users },
  { label: "Aulas", href: "/aulas", icon: Calendar },
  { label: "Instrumentos", href: "/instrumentos", icon: Guitar },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Lembretes", href: "/lembretes", icon: Bell },
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
  const { data: pendingCount = 0 } = trpc.reminders.pendingCount.useQuery();
  const navItems: NavItem[] = staticNavItems.map(item =>
    item.href === "/lembretes" ? { ...item, badge: pendingCount > 0 ? pendingCount : undefined } : item
  );
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "P";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Toggle button - desktop only */}
      <button
        onClick={onToggle}
        className="hidden lg:flex absolute -right-4 top-20 z-10 w-8 h-8 rounded-full bg-primary text-primary-foreground items-center justify-center shadow-lg hover:bg-primary/90 hover:scale-110 transition-all border-2 border-background"
        aria-label="Recolher menu"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Music size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white leading-tight">MusicPro</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight">Gestão Musical</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-2">Menu</p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-primary"
                  )}
                />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-4 mb-2">Geral</p>
        )}
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={cn("flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      <div className={cn(
        "border-t border-sidebar-border p-3",
        collapsed ? "flex justify-center" : ""
      )}>
        {collapsed ? (
          <Avatar className="w-9 h-9 cursor-pointer" title={user?.name ?? "Perfil"}>
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name ?? "Professor"}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email ?? ""}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={() => logoutMutation.mutate()}
              title="Sair"
            >
              <LogOut size={14} />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
