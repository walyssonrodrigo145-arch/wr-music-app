import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users, Plus, Calendar, TrendingUp, PhoneCall, FileText, CheckCircle2,
  ChevronRight, Filter, Search, MessageSquare, Phone, MoreVertical, Eye, Download,
  Loader2, Target, BarChart2, PieChart, ArrowUpRight, Clock, AlertTriangle,
  UserCheck, UserX, Tag, ShieldCheck, Settings, Sparkles, ChevronDown, Check,
  Activity, HelpCircle, UserPlus, ArrowRight, RefreshCw, Layers,
  LayoutDashboard, Briefcase, CalendarCheck, FileSpreadsheet, Building2,
  Rocket, Headphones, RefreshCcw, HeartPulse, DollarSign, Bell, Trash2, Edit3,
  BriefcaseBusiness, FolderKanban, Sliders, Globe, Trophy, Video, BookOpen,
  MessageCircle, Share2, CheckSquare, XCircle, AlertCircle, Compass, Flame, Music, LogOut
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// Estágios Padrão do Funil de Vendas MusicPro (Foco em Escolas de Música & Estúdios)
const DEFAULT_STAGES = [
  { key: "novo", label: "Novo Lead", color: "bg-[#5B50E6]", text: "text-indigo-400", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "contato", label: "Contato Realizado", color: "bg-purple-500", text: "text-purple-400", bgLight: "bg-purple-500/10", border: "border-purple-500/30" },
  { key: "aula_experimental", label: "Aula Experimental", color: "bg-cyan-500", text: "text-cyan-400", bgLight: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { key: "fez_aula", label: "Fez Aula Experim.", color: "bg-amber-500", text: "text-amber-400", bgLight: "bg-amber-500/10", border: "border-amber-500/30" },
  { key: "proposta", label: "Proposta Enviada", color: "bg-blue-500", text: "text-blue-400", bgLight: "bg-blue-500/10", border: "border-blue-500/30" },
  { key: "fechado", label: "Matriculado (Ganho)", color: "bg-emerald-500", text: "text-emerald-400", bgLight: "bg-emerald-500/10", border: "border-emerald-500/30" },
];

export default function LeadsApp() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<
    "leads" | "pipeline" | "atividades" | "propostas" | "metas" | "clientes" | "onboarding" | "suporte" | "performance" | "origens" | "configuracoes"
  >("leads");
  const [selectedPeriod, setSelectedPeriod] = useState("Este mês");

  // Filtros Globais
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState("todos");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("todas");

  // State de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialLead, setTrialLead] = useState<any>(null);

  // Consultas tRPC 100% Reais do Banco Postgres
  const { data: metrics } = trpc.crm.getDashboardMetrics.useQuery({ period: "30d" });
  const { data: dbLeads = [], isLoading: isLoadingLeads } = trpc.crm.listLeads.useQuery({
    search: searchTerm,
    stage: selectedStageFilter,
    priority: selectedPriorityFilter,
  });
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });

  // Somente dados reais do banco de dados (SEM MOCK)
  const leadsDisplayList = dbLeads;

  // Métricas calculadas dinamicamente com base no banco real
  const totalLeadsCount = metrics?.totalLeads ?? dbLeads.length;
  const newLeadsCount = metrics?.newLeads ?? dbLeads.filter(l => l.stage === "novo").length;
  const trialLessonsCount = metrics?.trialLessons ?? dbLeads.filter(l => l.stage === "aula_experimental" || l.stage === "fez_aula").length;
  const conversionRate = dbLeads.length > 0
    ? ((dbLeads.filter(l => l.stage === "fechado").length / dbLeads.length) * 100).toFixed(1)
    : "0.0";
  const totalPipelineRevenue = dbLeads.reduce((acc, l) => acc + (parseFloat(String(l.value || "0")) || 0), 0);

  const getPriorityBadge = (temp?: string | null) => {
    switch (temp) {
      case "quente":
        return <span className="flex items-center gap-1 font-bold text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Quente</span>;
      case "frio":
        return <span className="flex items-center gap-1 font-bold text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Frio</span>;
      default:
        return <span className="flex items-center gap-1 font-bold text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Morno</span>;
    }
  };

  const getWhatsAppLink = (phone?: string | null, name?: string, instrument?: string) => {
    if (!phone) return "#";
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    const text = encodeURIComponent(
      `Olá ${name || ""}! Tudo bem? Sou da escola de música MusicPro. Vi seu interesse no curso de ${instrument || "música"}! Gostaria de agendar uma Aula Experimental gratuita?`
    );
    return `https://wa.me/${num}?text=${text}`;
  };

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "WR";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070514] font-sans antialiased text-slate-200 selection:bg-indigo-500/30">
      
      {/* ── 1. SIDEBAR SAAS PREMIUM ULTRA SLIM & CLEAN (SEM SCROLLBAR FEIA) ── */}
      <aside className="w-64 bg-[#0B091A] text-slate-400 flex flex-col shrink-0 select-none border-r border-indigo-950/40 shadow-2xl z-30">
        
        {/* LOGO PLATAFORMA */}
        <div className="p-6 flex items-center justify-between border-b border-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B50E6] to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
              <Music size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight font-outfit leading-none">MusicPro</span>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mt-1">CRM COMERCIAL</span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE CATEGORIAS (SEM BARRA DE ROLAGEM VISÍVEL) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* GESTÃO COMERCIAL */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <Compass size={13} className="text-indigo-400" />
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Gestão Comercial</p>
            </div>

            <button
              onClick={() => setActiveMenu("leads")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "leads"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3"><Users size={16} /> Leads & Oportunidades</span>
              {dbLeads.length > 0 && (
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black text-white">{dbLeads.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveMenu("pipeline")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "pipeline"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers size={16} /> Funil de Vendas (Kanban)
            </button>

            <button
              onClick={() => setActiveMenu("atividades")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "atividades"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CalendarCheck size={16} /> Tarefas & Follow-ups
            </button>

            <button
              onClick={() => setActiveMenu("propostas")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "propostas"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileSpreadsheet size={16} /> Propostas & Fechamento
            </button>

            <button
              onClick={() => setActiveMenu("metas")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "metas"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Target size={16} /> Metas Comerciais
            </button>
          </div>

          {/* GESTÃO DE ALUNOS */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <Users size={13} className="text-blue-400" />
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Gestão de Alunos</p>
            </div>

            <button
              onClick={() => setActiveMenu("clientes")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "clientes"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Building2 size={16} /> Alunos Matriculados
            </button>

            <button
              onClick={() => setActiveMenu("onboarding")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "onboarding"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Rocket size={16} /> Onboarding de Alunos
            </button>

            <button
              onClick={() => setActiveMenu("suporte")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "suporte"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Headphones size={16} /> Atendimento & Suporte
            </button>
          </div>

          {/* RELATÓRIOS ANALÍTICOS */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <BarChart2 size={13} className="text-purple-400" />
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Relatórios Analíticos</p>
            </div>

            <button
              onClick={() => setActiveMenu("performance")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "performance"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart2 size={16} /> Performance de Vendas
            </button>

            <button
              onClick={() => setActiveMenu("origens")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "origens"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border-l-4 border-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <PieChart size={16} /> Origem das Oportunidades
            </button>
          </div>

        </div>

        {/* FOOTER DA SIDEBAR (PERFIL DO USUÁRIO SAAS) */}
        <div className="p-3 border-t border-indigo-950/40 space-y-2 bg-[#080616]">
          <button
            onClick={() => setActiveMenu("configuracoes")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
              activeMenu === "configuracoes" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings size={16} /> Configurações Gerais
          </button>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md">
              {userInitials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-white text-xs truncate">{user?.name || "Walysson Rodrigues"}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.role === "admin" ? "Administrador SaaS" : "Membro da Escola"}</p>
            </div>
          </div>
        </div>

      </aside>

      {/* ── 2. CONTEÚDO PRINCIPAL DA APLICAÇÃO ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#070514]">
        
        {/* HEADER TOP DA PÁGINA */}
        <header className="sticky top-0 z-20 bg-[#070514]/90 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-indigo-950/40">
          <div>
            <h1 className="text-2xl font-black font-outfit text-white tracking-tight">
              {activeMenu === "leads" && "Leads & Oportunidades"}
              {activeMenu === "pipeline" && "Funil de Vendas (Kanban)"}
              {activeMenu === "atividades" && "Tarefas & Follow-ups"}
              {activeMenu === "propostas" && "Propostas & Fechamento"}
              {activeMenu === "metas" && "Metas Comerciais"}
              {activeMenu === "clientes" && "Alunos Matriculados"}
              {activeMenu === "onboarding" && "Onboarding de Alunos"}
              {activeMenu === "suporte" && "Atendimento & Suporte"}
              {activeMenu === "performance" && "Performance de Vendas"}
              {activeMenu === "origens" && "Origem das Oportunidades"}
              {activeMenu === "configuracoes" && "Configurações Gerais"}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Visão geral da gestão comercial de cursos de música e aulas experimentais.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* SELETOR DE PERÍODO */}
            <div className="flex items-center gap-2 bg-[#13102B] px-3.5 py-2 rounded-xl border border-indigo-950/60 text-xs font-bold text-slate-300 cursor-pointer hover:border-indigo-500/40 transition-all">
              <Calendar size={14} className="text-indigo-400" />
              <span>{selectedPeriod}</span>
              <ChevronDown size={14} className="text-slate-400 ml-1" />
            </div>

            {/* BOTÃO PRIMÁRIO + NOVO LEAD */}
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 gap-2 transition-all"
            >
              <Plus size={16} /> Novo Lead
            </Button>
          </div>
        </header>

        {/* BANNER OFICIAL: MÓDULO EM DESENVOLVIMENTO */}
        <div className="mx-8 mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 text-amber-200 text-xs font-semibold shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="font-bold text-amber-300">🚧 Módulo em Desenvolvimento / Prévia</p>
              <p className="text-[11px] text-amber-200/70">O sistema integrado de Gestão de Leads e CRM está sendo finalizado para lançamento oficial em breve.</p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase px-2.5 py-1">
            Em Breve
          </Badge>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <main className="p-8 space-y-6">
          
          {/* ── 1. DASBOARD / LEADS VIEW ── */}
          {activeMenu === "leads" && (
            <div className="space-y-6">
              
              {/* BANNER IA COPILOT */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/80 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-outfit">MusicPro AI Copilot</span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">Monitorando Oportunidades</Badge>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {dbLeads.length > 0
                        ? `Acompanhando ${dbLeads.length} lead(s) ativos no seu funil comercial de música.`
                        : "Nenhum lead cadastrado ainda. Clique em '+ Novo Lead' para alimentar a inteligência comercial!"}
                    </p>
                  </div>
                </div>
                {dbLeads.length > 0 && (
                  <Button
                    onClick={() => toast.success("📱 Convites de Aula Experimental acionados via WhatsApp!")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-900/20"
                  >
                    <MessageCircle size={15} /> Disparar WhatsApp IA
                  </Button>
                )}
              </div>

              {/* TOP 4 KPI CARDS COM DADOS REAIS DO BANCO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leads Totais</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Users size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">{totalLeadsCount}</p>
                  <p className="text-xs font-medium text-slate-400">Na base cadastrada</p>
                </div>

                <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Novos Leads</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20"><UserPlus size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">{newLeadsCount}</p>
                  <p className="text-xs font-medium text-slate-400">Aguardando 1º contato</p>
                </div>

                <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aulas Experim.</span>
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Music size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">{trialLessonsCount}</p>
                  <p className="text-xs font-medium text-slate-400">Em agendamento / realização</p>
                </div>

                <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa de Conversão</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><TrendingUp size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">{conversionRate}%</p>
                  <p className="text-xs font-medium text-slate-400">Leads fechados / total</p>
                </div>
              </div>

              {/* GRID PRINCIPAL */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* EVOLUÇÃO DE LEADS */}
                <div className="col-span-12 lg:col-span-7 bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Evolução de Leads & Matrículas</h3>
                      <p className="text-xs text-slate-400">Desempenho de captação e conversão em alunos ativos.</p>
                    </div>
                  </div>
                  <div className="h-56 w-full pt-4">
                    <svg className="w-full h-full" viewBox="0 0 500 150">
                      <path d="M 0 130 Q 80 80, 160 90 T 320 40 T 500 20 L 500 150 L 0 150 Z" fill="url(#purpleGradient)" opacity="0.3" />
                      <path d="M 0 130 Q 80 80, 160 90 T 320 40 T 500 20" fill="none" stroke="#5B50E6" strokeWidth="3" />
                      <path d="M 0 140 Q 80 110, 160 120 T 320 80 T 500 60" fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeDasharray="4,4" />
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#5B50E6" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#5B50E6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                {/* LEADS RECENTES */}
                <div className="col-span-12 lg:col-span-5 bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Leads Recentes</h3>
                      <p className="text-[11px] text-slate-400">Atendimento instantâneo em 1-Clique</p>
                    </div>
                    <span onClick={() => setActiveMenu("pipeline")} className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer">Ver Funil</span>
                  </div>

                  {leadsDisplayList.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                        <Users size={24} />
                      </div>
                      <p className="text-xs font-bold text-white">Nenhum lead cadastrado ainda</p>
                      <p className="text-[11px] text-slate-400">Clique em "+ Novo Lead" para começar seu atendimento comercial.</p>
                      <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-1"
                      >
                        <Plus size={14} /> Cadastrar Lead
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs">
                      {leadsDisplayList.slice(0, 5).map((lead) => (
                        <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0B091A] border border-indigo-950/40 hover:bg-white/5 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                              {lead.name ? lead.name[0].toUpperCase() : "L"}
                            </div>
                            <div>
                              <p onClick={() => { setSelectedLeadId(lead.id); setIsProfileModalOpen(true); }} className="font-bold text-white leading-snug cursor-pointer hover:text-indigo-300">
                                {lead.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-[9px] px-1.5 py-0">
                                  🎸 {lead.instrument || lead.productService || "Música"}
                                </Badge>
                                <span className="text-[10px] text-slate-400 font-medium">{lead.modality || "Presencial"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {lead.phone && (
                              <a
                                href={getWhatsAppLink(lead.phone || undefined, lead.name, lead.instrument || lead.productService || undefined)}
                                target="_blank"
                                rel="noreferrer"
                                title="Enviar WhatsApp Instantâneo"
                                className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all"
                              >
                                <MessageCircle size={15} />
                              </a>
                            )}
                            <button
                              onClick={() => { setTrialLead(lead); setIsTrialModalOpen(true); }}
                              title="Agendar Aula Experimental"
                              className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600 hover:text-white transition-all"
                            >
                              <Calendar size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* VALOR DO PIPELINE */}
                <div className="col-span-12 bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Receita Potencial em Mensalidades</h3>
                      <p className="text-xs text-slate-400">Projeção total calculada dos leads ativos na sua base.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-black font-outfit text-white">
                        R$ {totalPipelineRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / mês
                      </p>
                      <p className="text-xs text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <ArrowUpRight size={14} /> Calculado com base nas mensalidades estimadas dos leads cadastrados
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── 2. FUNIL DE VENDAS (KANBAN) VIEW ── */}
          {activeMenu === "pipeline" && (
            <div className="space-y-6">
              <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                  <div>
                    <h3 className="font-bold text-lg font-outfit text-white">Funil Comercial de Aulas & Matrículas (Kanban)</h3>
                    <p className="text-xs text-slate-400">Gerencie a jornada completa do lead desde o primeiro contato até a matrícula.</p>
                  </div>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"><Plus size={15} /> Novo Lead</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
                  {DEFAULT_STAGES.map((stg) => {
                    const stageLeads = dbLeads.filter((l) => l.stage === stg.key);
                    const totalVal = stageLeads.reduce((acc, curr) => acc + (parseFloat(String(curr.value || "0")) || 0), 0);
                    return (
                      <div key={stg.key} className="space-y-3 min-w-[210px] bg-[#0B091A] p-3 rounded-2xl border border-indigo-950/40">
                        <div className="space-y-1 px-1 border-b border-indigo-950/40 pb-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-white font-outfit truncate">{stg.label}</span>
                            <span className="text-indigo-400 font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10">{stageLeads.length}</span>
                          </div>
                          <p className="text-[11px] font-extrabold text-slate-400">R$ {totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p>
                        </div>

                        <div className="space-y-3">
                          {stageLeads.length === 0 ? (
                            <div className="p-4 text-center text-[11px] text-slate-500 italic">
                              Sem leads nesta etapa
                            </div>
                          ) : (
                            stageLeads.map((item) => (
                              <div key={item.id} className="bg-[#13102B] border border-indigo-950/80 rounded-xl p-3 space-y-2 shadow-md hover:border-[#5B50E6]/60 transition-all group">
                                <div className="flex items-start justify-between">
                                  <h4 onClick={() => { setSelectedLeadId(item.id); setIsProfileModalOpen(true); }} className="font-bold text-xs text-white group-hover:text-indigo-300 cursor-pointer leading-snug">
                                    {item.name}
                                  </h4>
                                  {getPriorityBadge(item.temperature)}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-[9px] px-1.5 py-0">
                                    🎵 {item.instrument || item.productService || "Música"}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400 font-medium">{item.modality || "Presencial"}</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60 text-[11px]">
                                  <span className="font-extrabold text-emerald-400">R$ {Number(item.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                  <div className="flex items-center gap-1">
                                    {item.phone && (
                                      <a
                                        href={getWhatsAppLink(item.phone || undefined, item.name, item.instrument || item.productService || undefined)}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="WhatsApp"
                                        className="p-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                                      >
                                        <MessageCircle size={13} />
                                      </a>
                                    )}
                                    <button
                                      onClick={() => { setSelectedLeadId(item.id); setIsProfileModalOpen(true); }}
                                      className="p-1 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all"
                                      title="Detalhes"
                                    >
                                      <Eye size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RESUMO DO FUNIL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-indigo-950/50">
                  <div className="bg-[#0B091A] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Layers size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Leads Ativos</p><p className="text-base font-black font-outfit text-white">{dbLeads.length}</p></div>
                  </div>
                  <div className="bg-[#0B091A] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><DollarSign size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Pipeline Mensal</p><p className="text-base font-black font-outfit text-white">R$ {totalPipelineRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
                  </div>
                  <div className="bg-[#0B091A] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg"><Music size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Aulas Experim.</p><p className="text-base font-black font-outfit text-white">{trialLessonsCount}</p></div>
                  </div>
                  <div className="bg-[#0B091A] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><TrendingUp size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Taxa de Conversão</p><p className="text-base font-black font-outfit text-white">{conversionRate}%</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. TAREFAS & FOLLOW-UPS VIEW ── */}
          {activeMenu === "atividades" && (
            <div className="space-y-6">
              <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Ações & Follow-ups Agendados</h3>
                {followUps.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <CalendarCheck size={28} className="mx-auto text-indigo-400 opacity-60" />
                    <p className="font-bold text-white">Nenhum follow-up pendente</p>
                    <p className="text-[11px] text-slate-500">Agende ligações ou lembretes no perfil dos leads para acompanhar as conversões.</p>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {followUps.map((fu: any) => (
                      <div key={fu.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0B091A] border border-indigo-950/50">
                        <div className="flex items-center gap-3">
                          <Phone className="text-indigo-400" size={16} />
                          <div><p className="font-bold text-white">{fu.title || "Follow-up"}</p><p className="text-[11px] text-slate-400">{fu.description || "Sem notas"}</p></div>
                        </div>
                        <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{fu.scheduledAt ? new Date(fu.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Hoje"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 4. OUTRAS VIEWS (CLIENTES MATRICULADOS REALMENTE) ── */}
          {activeMenu === "clientes" && (
            <div className="space-y-6">
              <div className="bg-[#110E29]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Alunos Matriculados via CRM</h3>
                {dbLeads.filter(l => l.stage === "fechado").length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Building2 size={28} className="mx-auto text-indigo-400 opacity-60" />
                    <p className="font-bold text-white">Nenhum aluno matriculado via CRM ainda</p>
                    <p className="text-[11px] text-slate-500">Quando um lead for convertido no funil, ele aparecerá aqui com seus detalhes de matrícula.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-[#0B091A] text-slate-400 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Aluno</th>
                          <th className="p-3">Curso / Instrumento</th>
                          <th className="p-3">Modalidade</th>
                          <th className="p-3">Mensalidade</th>
                          <th className="p-3">Origem Lead</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-950/40">
                        {dbLeads.filter(l => l.stage === "fechado").map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 font-bold text-white flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                                {item.name ? item.name[0].toUpperCase() : "A"}
                              </div>
                              {item.name}
                            </td>
                            <td className="p-3 text-slate-300">{item.instrument || item.productService || "Música"}</td>
                            <td className="p-3 text-slate-300">{item.modality || "Presencial"}</td>
                            <td className="p-3 font-extrabold text-emerald-400">R$ {Number(item.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</td>
                            <td className="p-3 text-slate-400">{item.source || "WhatsApp"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAIS ── */}
      <CreateLeadModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedLeadId && (
        <LeadProfileModal leadId={selectedLeadId} open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      )}
      {trialLead && (
        <ScheduleTrialModal lead={trialLead} open={isTrialModalOpen} onClose={() => { setIsTrialModalOpen(false); setTrialLead(null); }} />
      )}
    </div>
  );
}

// ── MODAL: CADASTRAR NOVO LEAD (ESPECIALIZADO PARA MÚSICA) ──
function CreateLeadModal({ open, onClose }: any) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instrument, setInstrument] = useState("Guitarra");
  const [level, setLevel] = useState("Iniciante");
  const [modality, setModality] = useState("Presencial");
  const [value, setValue] = useState("320");
  const [source, setSource] = useState("WhatsApp");

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Lead cadastrado com sucesso!");
      onClose();
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#110E29] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white flex items-center gap-2">
            <Music className="text-indigo-400" size={18} /> Cadastrar Lead para Aula de Música
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return toast.error("Preencha o nome do lead");
            createMutation.mutate({
              name,
              phone,
              email,
              instrument,
              productService: instrument,
              level,
              modality,
              value: Number(value),
              source,
            });
          }}
          className="space-y-3.5 py-2"
        >
          <div className="space-y-1">
            <label className="font-bold text-slate-400">Nome do Lead / Futuro Aluno *</label>
            <Input placeholder="Ex: Mariana Silva" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Telefone / WhatsApp *</label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">E-mail</label>
              <Input placeholder="aluno@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Instrumento de Interesse</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="w-full h-9 rounded-md bg-[#0B091A] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Guitarra">Guitarra</option>
                <option value="Bateria">Bateria</option>
                <option value="Piano / Teclado">Piano / Teclado</option>
                <option value="Violão">Violão</option>
                <option value="Canto / Técnica Vocal">Canto / Técnica Vocal</option>
                <option value="Saxofone">Saxofone</option>
                <option value="Baixo">Baixo</option>
                <option value="Ukulele">Ukulele</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400">Modalidade</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full h-9 rounded-md bg-[#0B091A] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Presencial">Presencial</option>
                <option value="Online">Online</option>
                <option value="Híbrido">Híbrido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Nível do Aluno</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full h-9 rounded-md bg-[#0B091A] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Iniciante">Iniciante (Zero do Zero)</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400">Mensalidade Estimada (R$)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300 hover:bg-white/5">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {createMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Cadastrar Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── MODAL: AGENDAR AULA EXPERIMENTAL ──
function ScheduleTrialModal({ lead, open, onClose }: any) {
  const utils = trpc.useUtils();
  const [trialDate, setTrialDate] = useState("");
  const [trialTime, setTrialTime] = useState("14:00");

  const moveStageMutation = trpc.crm.moveStage.useMutation({
    onSuccess: () => {
      toast.success(`🎸 Aula experimental agendada para ${lead.name}!`);
      utils.crm.listLeads.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] bg-[#110E29] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white flex items-center gap-2">
            <Calendar className="text-cyan-400" size={18} /> Agendar Aula Experimental
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            moveStageMutation.mutate({ leadId: lead.id, stage: "aula_experimental" });
          }}
          className="space-y-3 py-2"
        >
          <p className="text-slate-300">
            Confirme o agendamento da aula experimental para <strong className="text-white">{lead?.name}</strong> ({lead?.instrument || "Música"}).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Data da Aula</label>
              <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} required className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Horário</label>
              <Input type="time" value={trialTime} onChange={(e) => setTrialTime(e.target.value)} required className="h-9 text-xs bg-[#0B091A] border-indigo-950 text-white" />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300 hover:bg-white/5">Cancelar</Button>
            <Button type="submit" disabled={moveStageMutation.isPending} className="h-9 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold">
              {moveStageMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Confirmar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── MODAL: PERFIL DO LEAD ──
function LeadProfileModal({ leadId, open, onClose }: { leadId: number; open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: lead } = trpc.crm.getLeadById.useQuery({ id: leadId }, { enabled: !!leadId });
  const convertMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: () => {
      toast.success("🚀 Lead matriculado com sucesso! Aluno cadastrado no sistema.");
      utils.crm.listLeads.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] bg-[#110E29] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-lg text-white flex items-center justify-between">
            <span>{lead.name}</span>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
              🎸 {lead.instrument || lead.productService || "Música"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 bg-[#0B091A] p-3 rounded-xl border border-indigo-950/60">
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Telefone / WhatsApp</p><p className="font-bold text-white mt-0.5">{lead.phone || "Não informado"}</p></div>
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">E-mail</p><p className="font-bold text-white mt-0.5">{lead.email || "Não informado"}</p></div>
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Modalidade</p><p className="font-bold text-white mt-0.5">{lead.modality || "Presencial"}</p></div>
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Mensalidade Proposta</p><p className="font-extrabold text-emerald-400 mt-0.5">R$ {Number(lead.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p></div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300 hover:bg-white/5">Fechar</Button>
            <Button
              onClick={() => convertMutation.mutate({ leadId: lead.id })}
              disabled={convertMutation.isPending}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-lg shadow-emerald-900/20"
            >
              {convertMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              <UserCheck size={15} /> Matricular Aluno (1-Click)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
