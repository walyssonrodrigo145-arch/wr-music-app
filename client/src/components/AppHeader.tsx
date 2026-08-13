import { useState, useRef, useEffect } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, Settings, LogOut, User, Menu, X, ChevronRight, CreditCard, CheckCheck, Sparkles, Palette, Users } from "lucide-react";
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

  const { data: notifications = [], refetch: refetchNotifications } = trpc.system.getNotifications.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60000, // Atualiza a cada 1 min
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  const markReadMutation = trpc.system.markNotificationRead.useMutation({
    onSuccess: () => refetchNotifications()
  });

  const markAllReadMutation = trpc.system.markAllNotificationsRead.useMutation({
    onSuccess: () => refetchNotifications()
  });

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
    <header className="h-14 md:h-16 bg-background/60 backdrop-blur-2xl border-b border-border/30 flex items-center px-3 sm:px-5 lg:px-6 gap-3 sm:gap-5 lg:gap-6 flex-shrink-0 z-40 sticky top-0 transition-all duration-500 overflow-hidden">
      {/* Mobile menu button - Refined */}
      <button
        id="tour-mobile-menu"
        className={cn(
          "w-12 h-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary/10 hover:text-primary flex-shrink-0 transition-all shadow-sm active:scale-90 border border-border/40",
          user?.role === "aluno" ? "md:hidden" : "hidden"
        )}
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
      >
        <Menu size={24} />
      </button>

      {/* Page title - Premium Typography */}
      <div className="flex-1 min-w-0 text-left overflow-hidden">
        <h1 className="text-base sm:text-xl lg:text-3xl font-black text-foreground tracking-tight leading-none truncate drop-shadow-sm">
          {pageInfo.title}
        </h1>
        {location !== "/dashboard" && (
          <div className="hidden md:flex items-center gap-2 mt-2.5 min-w-0">
             <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
             <p className="text-[11px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 truncate">{pageInfo.subtitle}</p>
          </div>
        )}
      </div>

      {/* Botão de Atalho Direto: Gestão de Leads (Abre em nova aba) */}
      {user?.role !== "aluno" && (
        <Button
          onClick={() => window.open("/leads", "_blank")}
          className="hidden sm:flex items-center gap-2 h-10 lg:h-11 px-3.5 lg:px-4 rounded-2xl bg-gradient-to-r from-[#5B50E6] to-purple-600 hover:from-[#4A40D0] hover:to-purple-700 text-white font-bold text-xs shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 border border-indigo-400/30 shrink-0"
        >
          <Users size={16} />
          <span className="hidden md:inline font-outfit">Gestão de Leads</span>
        </Button>
      )}

      {/* Search global - Premium Glassmorphism Input */}
      <div ref={searchRef} className="relative hidden md:flex items-center w-44 lg:w-64 group">
        <Search size={18} className="absolute left-5 text-muted-foreground/50 group-focus-within:text-primary transition-colors pointer-events-none z-10" />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Procurar conteúdo..."
          className="w-full h-11 lg:h-12 pl-12 lg:pl-14 pr-10 text-xs font-bold bg-muted/30 border border-border/30 rounded-[1.25rem] focus:bg-card focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all text-foreground placeholder:text-muted-foreground/40 shadow-inner"
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
             className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card transition-all shadow-sm flex items-center justify-center active:scale-90 relative group" 
             onClick={toggleTheme}
             title={`Tema atual: ${theme}. Clique para alternar.`}
           >
             {theme === "dark" ? (
               <Moon size={20} className="text-indigo-400" />
             ) : theme === "midnight" ? (
               <Sparkles size={20} className="text-cyan-400" />
             ) : theme === "purple" ? (
               <Palette size={20} className="text-purple-400" />
             ) : (
               <Sun size={20} className="text-amber-500" />
             )}
             <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full scale-0 group-hover:scale-100 transition-transform" />
           </button>

           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <button 
                 className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-card transition-all shadow-sm relative flex items-center justify-center active:scale-90 group" 
               >
                 <motion.div
                   animate={unreadCount > 0 ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}
                   transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}
                 >
                   <Bell size={20} />
                 </motion.div>
                 {unreadCount > 0 && (
                   <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full border-2 border-background group-hover:scale-110 transition-transform">
                     {unreadCount}
                   </span>
                 )}
               </button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-80 rounded-[2rem] p-3 border-border/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] bg-card/90 backdrop-blur-2xl">
               <div className="px-4 py-3 border-b border-border/20 mb-2 flex items-center justify-between">
                  <p className="text-xs font-black text-foreground uppercase tracking-widest">Notificações</p>
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[10px] flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      <CheckCheck size={12} />
                      MARCAR TODAS COMO LIDO
                    </button>
                  )}
               </div>
               <div className="max-h-[60vh] overflow-y-auto subtle-scrollbar">
                 {notifications.length === 0 ? (
                   <div className="py-8 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-60">Nenhuma notificação</div>
                 ) : (
                   notifications.map(notif => (
                     <div 
                       key={notif.id} 
                       className={cn("p-3 mb-2 rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors border", notif.read ? "border-transparent opacity-70" : "border-primary/20 bg-primary/5")}
                       onClick={() => {
                         if (!notif.read) markReadMutation.mutate({ id: notif.id });
                         if (notif.actionUrl) navigate(notif.actionUrl);
                       }}
                     >
                       <p className="text-[11px] font-black uppercase tracking-wider mb-1 text-primary">{notif.title}</p>
                       <p className="text-xs font-medium text-muted-foreground">{notif.message}</p>
                     </div>
                   ))
                 )}
               </div>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>

        <div className="h-10 w-px bg-border/40 mx-1 hidden md:block" />
        
        {/* User Profile Dropdown - Premium Style */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button id="tour-mobile-user-menu" className="flex items-center gap-3 lg:gap-4 pl-2 pr-4 py-2 rounded-[1.5rem] bg-card/40 hover:bg-card transition-all group active:scale-95 border border-border/20 shadow-sm">
              <div className="relative">
                 <Avatar className="w-9 h-9 lg:w-10 lg:h-10 border-2 border-primary/20 shadow-lg group-hover:rotate-6 transition-all duration-500">
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
            {user?.role !== 'aluno' && (
              <DropdownMenuItem 
                className="gap-4 rounded-2xl p-4 cursor-pointer text-sm font-bold text-muted-foreground hover:text-amber-500 transition-all focus:bg-amber-500/5 focus:text-amber-500 group" 
                onClick={() => navigate("/assinatura")}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-all">
                  <CreditCard size={18} />
                </div>
                Assinatura
              </DropdownMenuItem>
            )}
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



