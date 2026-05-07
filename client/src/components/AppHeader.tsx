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

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/alunos": "Alunos",
  "/aulas": "Aulas",
  "/instrumentos": "Instrumentos",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
  "/lembretes": "Lembretes",
  "/progresso": "Progresso",
  "/mensalidades": "Mensalidades",
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

  const pageTitle = pageTitles[location] ?? "MusicPro";
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "WR";

  return (
    <header className="h-16 lg:h-20 bg-white border-b border-slate-100 flex items-center px-4 lg:px-8 gap-4 lg:gap-8 flex-shrink-0 z-40 sticky top-0">
      {/* Mobile menu button & Title */}
      <div className="flex items-center gap-3 lg:gap-4 shrink-0">
        <button
          className="lg:hidden w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-slate-100 flex-shrink-0 transition-all active:scale-95 shadow-sm"
          onClick={onMobileMenuOpen}
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg lg:text-2xl font-black text-slate-800 tracking-tight leading-none">
          {pageTitle}
        </h1>
      </div>

      {/* Global Search - Positioned in the middle for Desktop/Tablet */}
      <div ref={searchRef} className="flex-1 flex justify-center max-w-2xl mx-auto px-4 hidden sm:flex">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar aula ou aluno..."
            className="w-full h-11 lg:h-12 pl-12 pr-10 text-sm font-bold bg-[#F8FAFC] border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-800 placeholder:text-slate-400 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
          
          {/* Dropdown Results */}
          <AnimatePresence>
            {searchOpen && searchQuery.trim().length >= 2 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-14 left-0 right-0 bg-white border border-slate-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 overflow-hidden"
              >
                {!searchResults || searchResults.length === 0 ? (
                  <div className="px-6 py-8 text-xs text-slate-400 font-bold text-center">Nenhum aluno encontrado</div>
                ) : (
                  <div className="p-3 space-y-1">
                    {searchResults.map(s => (
                      <button key={s.id} onClick={() => { navigate("/alunos"); setSearchQuery(""); setSearchOpen(false); }}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 rounded-2xl transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <span className="text-[10px] font-black text-white">
                            {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Side: Notifications & Profile */}
      <div className="flex items-center gap-3 lg:gap-4 shrink-0">
        {/* Mobile Search Icon */}
        <button className="sm:hidden w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center active:scale-95 shadow-sm">
          <Search size={18} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center active:scale-95">
            <Bell size={20} />
          </button>
          <div className="absolute top-2.5 right-2.5 w-4 h-4 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">2</div>
        </div>

        {/* Theme toggle - hidden on small mobile */}
        <button className="hidden md:flex w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all shadow-sm items-center justify-center active:scale-95" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-2xl hover:bg-slate-50 transition-all group active:scale-95">
              <Avatar className="w-10 h-10 border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[11px] font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left mr-2">
                <p className="text-xs font-black text-slate-800 leading-none tracking-tight">{user?.name?.split(" ")[0] ?? "WR"}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Admin</p>
              </div>
              <ChevronDown size={14} className="text-slate-300 hidden lg:block group-hover:text-slate-600 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-[2rem] p-3 border-slate-100 shadow-[0_30px_60px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-200 mt-2">
            <div className="px-4 py-3 mb-2 bg-[#F8FAFC] rounded-2xl">
                <p className="text-xs font-black text-slate-800">{user?.name || "MusicPro Admin"}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{user?.email || "admin@musicpro.com"}</p>
            </div>
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-blue-600" onClick={() => navigate("/configuracoes")}>
              <User size={16} /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 rounded-xl p-3 cursor-pointer text-xs font-bold text-slate-600 hover:text-blue-600" onClick={() => navigate("/configuracoes")}>
              <Settings size={16} /> Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100 my-2 mx-2" />
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
