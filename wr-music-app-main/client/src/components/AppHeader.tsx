import { useState, useRef, useEffect } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, Settings, LogOut, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Visão geral da sua escola de música" },
  "/alunos": { title: "Alunos", subtitle: "Gerencie seus alunos" },
  "/aulas": { title: "Aulas", subtitle: "Agenda e histórico de aulas" },
  "/instrumentos": { title: "Instrumentos", subtitle: "Instrumentos ensinados" },
  "/relatorios": { title: "Relatórios", subtitle: "Análises e estatísticas" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do sistema" },
};

interface AppHeaderProps {
  onMobileMenuOpen?: () => void;
}

export function AppHeader({ onMobileMenuOpen }: AppHeaderProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  // Busca global de alunos
  const { data: searchResults } = trpc.students.search.useQuery(
    { q: searchQuery },
    { enabled: searchQuery.trim().length >= 2 }
  );

  // Fechar busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pageInfo = pageTitles[location] ?? { title: "MusicPro", subtitle: "" };
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "P";

  const statusColor: Record<string, string> = {
    ativo: "bg-emerald-400",
    pausado: "bg-amber-400",
    inativo: "bg-red-400",
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden w-11 h-11 rounded-xl text-foreground hover:bg-muted flex-shrink-0"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </Button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-foreground leading-tight truncate">
          Olá, <span className="text-primary">{user?.name?.split(" ")[0] ?? "Professor"}</span>! Bem-vindo de volta.
        </h1>
        <p className="text-xs text-muted-foreground truncate">{pageInfo.subtitle}</p>
      </div>

      {/* Search global */}
      <div ref={searchRef} className="relative hidden md:flex items-center w-60">
        <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none z-10" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Procurar aluno..."
          className="w-full h-9 pl-8 pr-8 text-sm bg-muted/50 border-0 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
            className="absolute right-2 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
        {/* Dropdown de resultados */}
        {searchOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {!searchResults || searchResults.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center">Nenhum aluno encontrado</div>
            ) : (
              <div className="py-1">
                {searchResults.map(s => (
                  <button key={s.id} onClick={() => { navigate("/alunos"); setSearchQuery(""); setSearchOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-white">
                        {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor[s.status] ?? "bg-muted")} />
                  </button>
                ))}
                <div className="border-t border-border px-3 py-2">
                  <button onClick={() => { navigate("/alunos"); setSearchQuery(""); setSearchOpen(false); }}
                    className="text-[10px] text-primary font-semibold hover:underline">
                    Ver todos os alunos →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theme toggle */}
      <Button
        variant="ghost" size="icon"
        className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={toggleTheme}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </Button>

      {/* Notifications */}
      <Button
        variant="ghost" size="icon"
        className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted relative"
        onClick={() => navigate("/configuracoes")}
        title="Configurações de notificações"
      >
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
      </Button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted transition-colors">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-tight">{user?.name?.split(" ")[0] ?? "Professor"}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Admin</p>
            </div>
            <ChevronDown size={12} className="text-muted-foreground hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/configuracoes")}>
            <User size={14} /> Meu Perfil
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/configuracoes")}>
            <Settings size={14} /> Configurações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut size={14} /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
