import { useState, useRef, useEffect } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, Settings, LogOut, User, Menu, X, ChevronRight } from "lucide-react";
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
  "/aluno": { title: "Portal do Aluno", subtitle: "Bem-vinda de volta ao seu portal de estudos" },
  "/aluno/aulas": { title: "Minhas Aulas", subtitle: "Acompanhe seu cronograma de aulas" },
  "/aluno/agenda": { title: "Agenda", subtitle: "Seus compromissos e eventos musicais" },
  "/aluno/materiais": { title: "Materiais", subtitle: "Acesse seus PDFs, vídeos e áudios" },
  "/aluno/exercicios": { title: "Exercícios", subtitle: "Pratique e envie suas atividades" },
  "/aluno/progresso": { title: "Meu Progresso", subtitle: "Sua evolução musical em detalhes" },
  "/aluno/mensagens": { title: "Mensagens", subtitle: "Comunicação direta com seu professor" },
  "/aluno/pagamentos": { title: "Pagamentos", subtitle: "Histórico financeiro e mensalidades" },
  "/aluno/perfil": { title: "Meu Perfil", subtitle: "Suas informações e conquistas" },
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
    <header className="h-20 lg:h-24 bg-background/60 backdrop-blur-2xl border-b border-border/30 flex items-center px-6 lg:px-10 gap-6 lg:gap-10 flex-shrink-0 z-40 sticky top-0 transition-all duration-500">
      {/* Mobile menu button - Refined */}
      <button
        className="md:hidden w-12 h-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary/10 hover:text-primary flex-shrink-0 transition-all shadow-sm active:scale-90 border border-border/40"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
      >
        <Menu size={24} />
      </button>

      {/* Page title - Premium Typography */}
      <div className="flex-1 min-w-0 text-left">
        <h1 className="text-xl lg:text-3xl font-black text-foreground tracking-tight leading-none truncate drop-shadow-sm">
          {pageInfo.title}
        </h1>
        {location !== "/dashboard" && (
          <div className="hidden md:flex items-center gap-2 mt-2.5 min-w-0">
             <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
             <p className="text-[11px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 truncate">{pageInfo.subtitle}</p>
          </div>
        )}
      </div>

      {/* Search global - Premium Glassmorphism Input */}
      <div ref={searchRef} className="relative hidden md:flex items-center w-48 lg:w-96 group">
        <Search size={18} className="absolute left-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors pointer-events-none z-10" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Procurar conteúdo..."
          className="w-full h-12 lg:h-14 pl-12 lg:pl-14 pr-12 text-xs font-bold bg-muted/30 border border-border/30 rounded-[1.25rem] focus:bg-card focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all text-foreground placeholder:text-muted-foreground/40 shadow-inner"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
            className="absolute right-4 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
            <X size={14} />
          </button>
        )}
        
        {/* Results dropdown - Premium Look */}
        <AnimatePresence>
          {searchOpen && searchQuery.trim().length >= 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute top-16 left-0 right-0 bg-card/90 backdrop-blur-2xl border border-border/40 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] z-50 overflow-hidden p-3"
            >
              {!searchResults || searchResults.length === 0 ? (
                <div className="px-8 py-10 text-xs text-muted-foreground font-black text-center uppercase tracking-widest opacity-40">Sem resultados para "{searchQuery}"</div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map(s => (
                    <button key={s.id} onClick={() => { 
                      if (user?.role === 'aluno') {
                        navigate("/aluno/perfil");
                      } else {
                        navigate("/alunos");
                      }
                      setSearchQuery(""); 
                      setSearchOpen(false); 
                    }}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-primary/5 rounded-2xl transition-all text-left group">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all shadow-lg shadow-primary/10">
                        <span className="text-[10px] font-black text-white">
                          {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 opacity-60">{s.email}</p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 lg:gap-5">
        {/* Actions - Theme & Notifications */}
        <div className="flex items-center gap-2 lg:gap-3 bg-muted/30 p-1.5 rounded-2xl border border-border/20 shadow-inner">
           <button 
             className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card transition-all shadow-sm flex items-center justify-center active:scale-90 relative group" 
             onClick={toggleTheme}
           >
             {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
             <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full scale-0 group-hover:scale-100 transition-transform" />
           </button>

           <button 
             className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-card transition-all shadow-sm relative flex items-center justify-center active:scale-90 group" 
             onClick={() => navigate("/aluno/avisos")}
           >
             <Bell size={20} />
             <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-background animate-bounce group-hover:animate-none" />
           </button>
        </div>

        <div className="h-10 w-px bg-border/40 mx-1 hidden md:block" />
        
        {/* User Profile Dropdown - Premium Style */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 lg:gap-4 pl-2 pr-4 py-2 rounded-[1.5rem] bg-card/40 hover:bg-card transition-all group active:scale-95 border border-border/20 shadow-sm">
              <div className="relative">
                 <Avatar className="w-10 h-10 lg:w-12 lg:h-12 border-2 border-primary/20 shadow-lg group-hover:rotate-6 transition-all duration-500">
                   <AvatarFallback className="bg-gradient-to-br from-primary via-indigo-600 to-violet-600 text-white text-[11px] lg:text-[12px] font-black tracking-tight">
                     {initials}
                   </AvatarFallback>
                 </Avatar>
                 <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-black text-foreground leading-tight tracking-tight drop-shadow-sm">{user?.name?.split(" ")[0] ?? "WR"}</p>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.1em] mt-1">
                  Membro Premium
                </p>
              </div>
              <ChevronDown size={16} className="text-muted-foreground/50 hidden md:block group-hover:text-primary transition-all duration-300 group-hover:translate-y-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-[2rem] p-3 border-border/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] bg-card/80 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
            <div className="px-4 py-4 mb-2">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Acesso Rápido</p>
               <p className="text-sm font-bold text-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-border/20 my-2" />
            <DropdownMenuItem 
              className="gap-4 rounded-2xl p-4 cursor-pointer text-sm font-bold text-muted-foreground hover:text-primary transition-all focus:bg-primary/5 focus:text-primary group" 
              onClick={() => navigate(user?.role === 'aluno' ? "/aluno/perfil" : "/configuracoes")}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-all">
                <User size={18} />
              </div>
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-4 rounded-2xl p-4 cursor-pointer text-sm font-bold text-muted-foreground hover:text-primary transition-all focus:bg-primary/5 focus:text-primary group" 
              onClick={() => navigate(user?.role === 'aluno' ? "/aluno/perfil" : "/configuracoes")}
            >
              <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center group-hover:scale-110 transition-all">
                <Settings size={18} />
              </div>
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/20 my-2" />
            <DropdownMenuItem 
               className="gap-4 rounded-2xl p-4 cursor-pointer text-sm font-black text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 transition-all group" 
               onClick={() => logoutMutation.mutate()}
            >
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-all">
                <LogOut size={18} />
              </div>
              Sair da Plataforma
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}



