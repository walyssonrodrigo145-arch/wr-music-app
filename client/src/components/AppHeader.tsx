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
import { motion, AnimatePresence } from "framer-motion";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Visão geral da sua escola de música" },
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
    <header className="h-16 lg:h-20 bg-background border-b border-border flex items-center px-4 lg:px-8 gap-4 lg:gap-6 flex-shrink-0 z-10 sticky top-0">
      {/* Mobile menu button */}
      <button
        className="lg:hidden w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent flex-shrink-0 transition-colors shadow-sm active:scale-95"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0 text-left">
        <h1 className="text-base lg:text-xl font-black text-foreground tracking-tight leading-none truncate">
          {pageInfo.title}
        </h1>
        {location !== "/dashboard" && <p className="hidden lg:block text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-2">{pageInfo.subtitle}</p>}
      </div>

      {/* Search global - hidden on mobile, shown as icon or compact on tablet */}
      <div ref={searchRef} className="relative hidden md:flex items-center w-40 lg:w-80">
        <Search size={16} className="absolute left-4 text-muted-foreground pointer-events-none z-10" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Procurar..."
          className="w-full h-10 lg:h-11 pl-10 lg:pl-12 pr-10 text-xs font-bold bg-[#F8FAFC] border-none rounded-2xl focus:bg-card focus:ring-2 focus:ring-blue-500/20 transition-all text-foreground placeholder:text-muted-foreground shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
            className="absolute right-3 text-muted-foreground hover:text-muted-foreground transition-colors">
            <X size={14} />
          </button>
        )}
        
        {/* Results dropdown */}
        <AnimatePresence>
          {searchOpen && searchQuery.trim().length >= 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-14 left-0 right-0 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              {!searchResults || searchResults.length === 0 ? (
                <div className="px-6 py-4 text-xs text-muted-foreground font-bold text-center">Nenhum aluno encontrado</div>
              ) : (
                <div className="py-2">
                  {searchResults.map(s => (
                    <button key={s.id} onClick={() => { navigate("/alunos"); setSearchQuery(""); setSearchOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left group">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <span className="text-[10px] font-black text-white">
                          {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium truncate">{s.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {/* Mobile Search Icon */}
        <div className="md:hidden">
          <button 
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 rounded-xl bg-card border border-border text-muted-foreground flex items-center justify-center active:scale-95 transition-all shadow-sm"
          >
            <Search size={18} />
          </button>
          
          <AnimatePresence>
            {searchOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="fixed inset-0 z-50 bg-card p-4"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Procurar aluno..."
                      className="w-full h-12 pl-12 pr-4 bg-muted rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <button 
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 text-left">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Resultados</p>
                  {searchQuery.trim().length >= 2 ? (
                    <div className="space-y-2">
                      {!searchResults || searchResults.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-xs font-bold text-muted-foreground">Nenhum aluno encontrado</p>
                        </div>
                      ) : (
                        searchResults.map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => { navigate("/alunos"); setSearchOpen(false); setSearchQuery(""); }}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted active:bg-muted transition-colors"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                              {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-foreground">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{s.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-xs font-bold text-muted-foreground">Digite pelo menos 2 caracteres</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="w-10 h-10 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm flex items-center justify-center active:scale-95" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="w-10 h-10 rounded-xl bg-card border border-border text-muted-foreground hover:text-[#2563EB] hover:bg-muted transition-all shadow-sm relative flex items-center justify-center active:scale-95" onClick={() => navigate("/configuracoes")}>
          <Bell size={18} />
          <span className="absolute top-3 right-3 w-2 h-2 bg-[#2563EB] rounded-full border border-white" />
        </button>

        <div className="h-8 w-px bg-muted mx-1 hidden lg:block" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 lg:gap-3 pl-1 pr-1 py-1 rounded-2xl hover:bg-muted transition-all group active:scale-95">
              <Avatar className="w-9 h-9 lg:w-10 lg:h-10 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                <AvatarFallback className="bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white text-[10px] lg:text-[11px] font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-black text-foreground leading-tight tracking-tight">{user?.name?.split(" ")[0] ?? "WR"}</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Admin</p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden lg:block group-hover:text-muted-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] p-2 border-border shadow-2xl animate-in zoom-in-95 duration-200">
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-muted-foreground hover:text-[#2563EB]" onClick={() => navigate("/configuracoes")}>
              <User size={16} /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-muted-foreground hover:text-[#2563EB]" onClick={() => navigate("/configuracoes")}>
              <Settings size={16} /> Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted my-2" />
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => logoutMutation.mutate()}>
              <LogOut size={16} /> Sair do Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}



