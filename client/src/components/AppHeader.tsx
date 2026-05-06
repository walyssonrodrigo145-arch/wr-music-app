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

  const { data: searchResults } = trpc.students.search.useQuery(
    { q: searchQuery },
    { enabled: searchQuery.trim().length >= 2 }
  );

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
    : "WR";

  return (
    <header className="h-20 bg-white border-b border-slate-100 flex items-center px-8 gap-6 flex-shrink-0 z-10">
      {/* Mobile menu button */}
      <button
        className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-slate-100 flex-shrink-0 transition-colors shadow-sm"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
          Olá, <span className="text-[#2563EB]">{user?.name?.split(" ")[0] ?? "WR"}</span>! Bem-vindo de volta.
        </h1>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">{pageInfo.subtitle}</p>
      </div>

      {/* Search global */}
      <div ref={searchRef} className="relative hidden md:flex items-center w-80">
        <Search size={16} className="absolute left-4 text-slate-300 pointer-events-none z-10" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Procurar aluno..."
          className="w-full h-11 pl-12 pr-10 text-xs font-bold bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-800 placeholder:text-slate-300 shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
            className="absolute right-3 text-slate-300 hover:text-slate-600 transition-colors">
            <X size={14} />
          </button>
        )}
        
        {/* Dropdown de resultados */}
        {searchOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-14 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {!searchResults || searchResults.length === 0 ? (
              <div className="px-6 py-4 text-xs text-slate-400 font-bold text-center">Nenhum aluno encontrado</div>
            ) : (
              <div className="py-2">
                {searchResults.map(s => (
                  <button key={s.id} onClick={() => { navigate("/alunos"); setSearchQuery(""); setSearchOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-[10px] font-black text-white">
                        {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{s.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button
          className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-[#2563EB] hover:bg-slate-50 transition-all shadow-sm relative flex items-center justify-center"
          onClick={() => navigate("/configuracoes")}
        >
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#2563EB] rounded-full border-2 border-white" />
        </button>

        {/* User profile */}
        <div className="h-10 w-px bg-slate-100 mx-2 hidden sm:block" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-2xl hover:bg-slate-50 transition-all group">
              <Avatar className="w-10 h-10 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                <AvatarFallback className="bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white text-[11px] font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-black text-slate-800 leading-tight tracking-tight">{user?.name?.split(" ")[0] ?? "WR"}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Admin</p>
              </div>
              <ChevronDown size={14} className="text-slate-300 hidden sm:block group-hover:text-slate-600 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] p-2 border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-[#2563EB]" onClick={() => navigate("/configuracoes")}>
              <User size={16} /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-[#2563EB]" onClick={() => navigate("/configuracoes")}>
              <Settings size={16} /> Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100 my-2" />
            <DropdownMenuItem
              className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 focus:text-rose-600 focus:bg-rose-50"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut size={16} /> Sair do Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

