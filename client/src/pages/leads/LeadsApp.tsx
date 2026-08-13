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
  MessageCircle, Share2, CheckSquare, XCircle, AlertCircle, Compass, Flame, Music
} from "lucide-react";

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

  // Consultas tRPC Reais do Banco Postgres
  const { data: metrics } = trpc.crm.getDashboardMetrics.useQuery({ period: "30d" });
  const { data: dbLeads = [] } = trpc.crm.listLeads.useQuery({
    search: searchTerm,
    stage: selectedStageFilter,
    priority: selectedPriorityFilter,
  });
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });

  // Fallback de dados de exemplo ultra-fidedignos caso a base esteja inicializando
  const mockFallbackItems = [
    { id: 101, name: "Mariana Silva", instrument: "Guitarra", modality: "Presencial", cityState: "São Paulo - SP", value: "320.00", temperature: "quente", stage: "novo", phone: "(11) 99881-2233", source: "Instagram Ads", createdAt: new Date() },
    { id: 102, name: "Carlos Mendes", instrument: "Bateria", modality: "Presencial", cityState: "Curitiba - PR", value: "380.00", temperature: "morno", stage: "novo", phone: "(41) 99112-4455", source: "WhatsApp", createdAt: new Date() },
    { id: 103, name: "Juliana Costa", instrument: "Piano / Teclado", modality: "Online", cityState: "Belo Horizonte - MG", value: "290.00", temperature: "quente", stage: "novo", phone: "(31) 98822-3344", source: "Google Ads", createdAt: new Date() },
    { id: 104, name: "Roberto Alves", instrument: "Canto / Técnica Vocal", modality: "Presencial", cityState: "Goiânia - GO", value: "350.00", temperature: "quente", stage: "contato", phone: "(62) 97654-3210", source: "Indicação", createdAt: new Date() },
    { id: 105, name: "Ana Beatriz", instrument: "Violão", modality: "Presencial", cityState: "Campinas - SP", value: "270.00", temperature: "morno", stage: "aula_experimental", phone: "(19) 98123-4567", source: "Instagram", createdAt: new Date() },
    { id: 106, name: "Lucas Ferreira", instrument: "Saxofone", modality: "Presencial", cityState: "Porto Alegre - RS", value: "420.00", temperature: "morno", stage: "fez_aula", phone: "(51) 99554-1122", source: "Google Search", createdAt: new Date() },
    { id: 107, name: "Paulo Henrique", instrument: "Baixo", modality: "Online", cityState: "Salvador - BA", value: "280.00", temperature: "quente", stage: "proposta", phone: "(71) 99223-8899", source: "WhatsApp", createdAt: new Date() },
    { id: 108, name: "Fernanda Lima", instrument: "Ukulele", modality: "Presencial", cityState: "Recife - PE", value: "230.00", temperature: "morno", stage: "fechado", phone: "(81) 98765-1122", source: "Instagram", createdAt: new Date() },
  ];

  const leadsDisplayList = dbLeads.length > 0 ? dbLeads : mockFallbackItems;

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B091A] font-sans antialiased text-slate-200 selection:bg-indigo-500/30">
      {/* ── 1. SIDEBAR COMPACTA PREMIUM (ESCURA #13102B) ── */}
      <aside className="w-64 bg-[#13102B] text-slate-400 flex flex-col shrink-0 select-none border-r border-indigo-950/40">
        {/* LOGO PLATAFORMA */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B50E6] to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
              <Music size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight font-outfit leading-none">MusicPro</span>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mt-1">CRM Comercial</span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE CATEGORIAS */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 text-xs">
          {/* GESTÃO COMERCIAL */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Gestão Comercial</p>
            <button
              onClick={() => setActiveMenu("leads")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "leads"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3"><Users size={16} /> Leads & Oportunidades</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md font-extrabold text-white">{leadsDisplayList.length}</span>
            </button>

            <button
              onClick={() => setActiveMenu("pipeline")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "pipeline"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers size={16} /> Funil de Vendas (Kanban)
            </button>

            <button
              onClick={() => setActiveMenu("atividades")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "atividades"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CalendarCheck size={16} /> Tarefas & Follow-ups
            </button>

            <button
              onClick={() => setActiveMenu("propostas")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "propostas"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileSpreadsheet size={16} /> Propostas & Fechamento
            </button>

            <button
              onClick={() => setActiveMenu("metas")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "metas"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Target size={16} /> Metas Comerciais
            </button>
          </div>

          {/* GESTÃO DE CLIENTES */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Gestão de Alunos</p>
            <button
              onClick={() => setActiveMenu("clientes")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "clientes"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Building2 size={16} /> Alunos Matriculados
            </button>

            <button
              onClick={() => setActiveMenu("onboarding")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "onboarding"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Rocket size={16} /> Onboarding de Alunos
            </button>

            <button
              onClick={() => setActiveMenu("suporte")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "suporte"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Headphones size={16} /> Atendimento & Suporte
            </button>
          </div>

          {/* RELATÓRIOS ANALÍTICOS */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Relatórios Analíticos</p>
            <button
              onClick={() => setActiveMenu("performance")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "performance"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart2 size={16} /> Performance de Vendas
            </button>

            <button
              onClick={() => setActiveMenu("origens")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "origens"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <PieChart size={16} /> Origem das Oportunidades
            </button>
          </div>
        </div>

        {/* FOOTER DA SIDEBAR */}
        <div className="p-3 border-t border-indigo-950/40 space-y-2">
          <button
            onClick={() => setActiveMenu("configuracoes")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
              activeMenu === "configuracoes" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings size={16} /> Configurações Gerais
          </button>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
              WR
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-white text-xs truncate">Walysson Rodrigues</p>
              <p className="text-[10px] text-slate-400 truncate">Administrador SaaS</p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* ── 2. CONTEÚDO PRINCIPAL DA APLICAÇÃO ── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#0B091A]">
        {/* HEADER TOP DA PÁGINA */}
        <header className="sticky top-0 z-20 bg-[#0B091A]/90 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-indigo-950/40">
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
            <div className="flex items-center gap-2 bg-[#161334] px-3.5 py-2 rounded-xl border border-indigo-950/60 text-xs font-bold text-slate-300 cursor-pointer hover:border-indigo-500/40 transition-all">
              <Calendar size={14} className="text-indigo-400" />
              <span>{selectedPeriod}</span>
              <ChevronDown size={14} className="text-slate-400 ml-1" />
            </div>

            {/* BOTÃO PRIMÁRIO + NOVO LEAD */}
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-[#5B50E6] to-purple-600 hover:from-[#4A40D0] hover:to-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 gap-2 transition-all"
            >
              <Plus size={16} /> Novo Lead
            </Button>

            {/* NOTIFICAÇÕES E PERFIL */}
            <div className="flex items-center gap-3 border-l border-indigo-950/60 pl-4">
              <div className="relative p-2 rounded-xl hover:bg-white/5 cursor-pointer text-slate-300 transition-all">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5B50E6] text-white font-black text-[9px] flex items-center justify-center shadow-xs">
                  3
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTAINER DA PÁGINA */}
        <main className="p-8 space-y-6">
          {/* ── 1. LEADS & OPORTUNIDADES VIEW ── */}
          {activeMenu === "leads" && (
            <div className="space-y-6">
              {/* 🤖 MUSICPRO AI COPILOT BANNER */}
              <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-[#161334]/80 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                    <Sparkles size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-outfit">MusicPro AI Copilot</span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">3 Ações Recomendadas</Badge>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Detectamos <strong>3 leads interessados em Bateria e Guitarra sem contato há +48h</strong>. Dispare o convite para Aula Experimental via WhatsApp!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => toast.success("📱 Disparo de convites de Aula Experimental ativado via WhatsApp!")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-900/20"
                  >
                    <MessageCircle size={15} /> Disparar WhatsApp IA
                  </Button>
                </div>
              </div>

              {/* TOP 4 KPI CARDS */}
              <div className="grid grid-cols-4 gap-5">
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leads Totais</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Users size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">1.243</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <ArrowUpRight size={14} /> 14,8% <span className="text-slate-500 font-normal">vs mês anterior</span>
                  </div>
                </div>

                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Novos Leads</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20"><UserPlus size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">316</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <ArrowUpRight size={14} /> 8,2% <span className="text-slate-500 font-normal">vs mês anterior</span>
                  </div>
                </div>

                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aulas Experim.</span>
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Music size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">84</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                    <Clock size={14} /> 18 agendadas esta semana
                  </div>
                </div>

                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa de Conversão</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><TrendingUp size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">34,2%</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <ArrowUpRight size={14} /> 5,4% <span className="text-slate-500 font-normal">vs mês anterior</span>
                  </div>
                </div>
              </div>

              {/* GRID PRINCIPAL: EVOLUÇÃO + RECENTES + FONTES + PIPELINE */}
              <div className="grid grid-cols-12 gap-6">
                {/* EVOLUÇÃO DE LEADS (GRÁFICO DE LINHA) */}
                <div className="col-span-7 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Evolução de Leads & Matrículas</h3>
                      <p className="text-xs text-slate-400">Desempenho de captação e conversão em alunos ativos.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs bg-[#13102B] px-3 py-1.5 rounded-xl border border-indigo-950/60 text-slate-300 font-bold">
                      <span>30 dias</span><ChevronDown size={14} />
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

                {/* LEADS RECENTES COM AÇÕES RÁPIDAS WHATSAPP & EXPERIMENTAL */}
                <div className="col-span-5 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Leads Recentes</h3>
                      <p className="text-[11px] text-slate-400">Ações instantâneas de atendimento</p>
                    </div>
                    <span onClick={() => setActiveMenu("pipeline")} className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer">Ver Kanban</span>
                  </div>
                  <div className="space-y-3 text-xs">
                    {leadsDisplayList.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-[#13102B]/60 border border-indigo-950/40 hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                            {lead.name[0]}
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

                        {/* BOTÕES DE AÇÃO RÁPIDA */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lead.phone && (
                            <a
                              href={getWhatsAppLink(lead.phone, lead.name, lead.instrument || lead.productService)}
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
                </div>

                {/* FONTES DE LEADS (DONUT CHART) */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Canais de Captação</h3>
                  <div className="flex items-center gap-6 py-2">
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path strokeDasharray="40, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#5B50E6" strokeWidth="4" />
                        <path strokeDasharray="30, 100" strokeDashoffset="-40" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#06B6D4" strokeWidth="4" />
                        <path strokeDasharray="20, 100" strokeDashoffset="-70" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F59E0B" strokeWidth="4" />
                      </svg>
                      <div className="absolute flex flex-col items-center text-center">
                        <span className="font-extrabold text-white text-base font-outfit">1.243</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Total</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-xs font-bold">
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#5B50E6]" /> Instagram Ads</span><span className="text-white">40%</span></div>
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> WhatsApp Direct</span><span className="text-white">30%</span></div>
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Indicação de Alunos</span><span className="text-white">20%</span></div>
                    </div>
                  </div>
                </div>

                {/* VALOR DO PIPELINE */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Receita Potencial em Mensalidades</h3>
                    <div className="mt-3">
                      <p className="text-3xl font-black font-outfit text-white">R$ 387.450 / mês</p>
                      <p className="text-xs text-emerald-400 font-bold mt-1 flex items-center gap-1"><ArrowUpRight size={14} /> +18.4% de projeção vs mês anterior</p>
                    </div>
                  </div>
                  <div className="h-20 w-full pt-2">
                    <svg className="w-full h-full" viewBox="0 0 200 60">
                      <path d="M 0 50 Q 50 30, 100 40 T 200 10 L 200 60 L 0 60 Z" fill="#5B50E6" opacity="0.2" />
                      <path d="M 0 50 Q 50 30, 100 40 T 200 10" fill="none" stroke="#5B50E6" strokeWidth="2.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. FUNIL DE VENDAS (KANBAN) VIEW ── */}
          {activeMenu === "pipeline" && (
            <div className="space-y-6">
              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                  <div>
                    <h3 className="font-bold text-lg font-outfit text-white">Funil Comercial de Aulas & Matrículas (Kanban)</h3>
                    <p className="text-xs text-slate-400">Gerencie a jornada completa do lead desde o primeiro contato até a matrícula.</p>
                  </div>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#5B50E6] text-white font-bold text-xs gap-1.5"><Plus size={15} /> Novo Lead</Button>
                </div>

                <div className="grid grid-cols-6 gap-3.5 overflow-x-auto pb-4">
                  {DEFAULT_STAGES.map((stg) => {
                    const stageLeads = leadsDisplayList.filter((l) => l.stage === stg.key);
                    const totalVal = stageLeads.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
                    return (
                      <div key={stg.key} className="space-y-3 min-w-[210px] bg-[#13102B] p-3 rounded-2xl border border-indigo-950/40">
                        <div className="space-y-1 px-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-white font-outfit truncate">{stg.label}</span>
                            <span className="text-indigo-400 font-extrabold">{stageLeads.length}</span>
                          </div>
                          <p className="text-[11px] font-extrabold text-slate-400">R$ {totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p>
                        </div>

                        <div className="space-y-3">
                          {stageLeads.map((item) => (
                            <div key={item.id} className="bg-[#18153A] border border-indigo-950/80 rounded-xl p-3 space-y-2 shadow-md hover:border-[#5B50E6]/60 transition-all group">
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
                                      href={getWhatsAppLink(item.phone, item.name, item.instrument || item.productService)}
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
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RESUMO DO FUNIL */}
                <div className="grid grid-cols-4 gap-4 pt-2 border-t border-indigo-950/50">
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Layers size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Leads Ativos</p><p className="text-base font-black font-outfit text-white">292</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><DollarSign size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Pipeline Mensal</p><p className="text-base font-black font-outfit text-white">R$ 98.450</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg"><Music size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Aulas Experim.</p><p className="text-base font-black font-outfit text-white">84 agendadas</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><TrendingUp size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Taxa de Conversão</p><p className="text-base font-black font-outfit text-white">34,2%</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. TAREFAS & FOLLOW-UPS VIEW ── */}
          {activeMenu === "atividades" && (
            <div className="space-y-6">
              <div className="grid grid-cols-12 gap-6">
                {/* COLUNA HOJE */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Ações de Hoje</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <Phone className="text-indigo-400" size={16} />
                        <div><p className="font-bold text-white">Ligar para Mariana Silva</p><p className="text-[11px] text-slate-400">Interesse em Guitarra Presencial</p></div>
                      </div>
                      <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">09:00</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <Music className="text-cyan-400" size={16} />
                        <div><p className="font-bold text-white">Aula Experimental com Carlos Mendes</p><p className="text-[11px] text-slate-400">Bateria - Prof. Pedro</p></div>
                      </div>
                      <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">14:30</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="text-emerald-400" size={16} />
                        <div><p className="font-bold text-white">Follow-up pós-aula com Juliana Costa</p><p className="text-[11px] text-slate-400">Piano Online</p></div>
                      </div>
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">16:00</span>
                    </div>
                  </div>
                </div>

                {/* COLUNA PRÓXIMOS FOLLOW-UPS */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Próximos Follow-ups</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center">AB</div>
                        <div><p className="font-bold text-white">Ana Beatriz</p><p className="text-[11px] text-slate-400">Violão - Confirmar presença</p></div>
                      </div>
                      <span className="text-slate-400 font-bold">Amanhã, 09:00</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center">PH</div>
                        <div><p className="font-bold text-white">Paulo Henrique</p><p className="text-[11px] text-slate-400">Baixo - Enviar proposta</p></div>
                      </div>
                      <span className="text-slate-400 font-bold">Amanhã, 11:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. OUTRAS VIEWS (PROPOSTAS, METAS, CLIENTES, ETC) ── */}
          {activeMenu === "propostas" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Propostas de Matrícula</span>
                  <p className="text-3xl font-black font-outfit text-white">42</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Aguardando Resposta</span>
                  <p className="text-3xl font-black font-outfit text-white">18</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Matrículas Aprovadas</span>
                  <p className="text-3xl font-black font-outfit text-emerald-400">24</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Valor Mensal Proposto</span>
                  <p className="text-2xl font-black font-outfit text-white">R$ 14.800</p>
                </div>
              </div>
            </div>
          )}

          {activeMenu === "clientes" && (
            <div className="space-y-6">
              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Alunos Matriculados via CRM</h3>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#13102B] text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">Aluno</th>
                        <th className="p-3">Curso / Instrumento</th>
                        <th className="p-3">Modalidade</th>
                        <th className="p-3">Mensalidade</th>
                        <th className="p-3">Origem Lead</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-950/40">
                      {leadsDisplayList.slice(0, 5).map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">{item.name[0]}</div>
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
      <DialogContent className="sm:max-w-[480px] bg-[#13102B] text-slate-200 border border-indigo-950/80 text-xs">
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
            <Input placeholder="Ex: Mariana Silva" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Telefone / WhatsApp *</label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">E-mail</label>
              <Input placeholder="aluno@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Instrumento de Interesse</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="w-full h-9 rounded-md bg-[#1A163B] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                className="w-full h-9 rounded-md bg-[#1A163B] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                className="w-full h-9 rounded-md bg-[#1A163B] border border-indigo-950 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Iniciante">Iniciante (Zero do Zero)</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400">Mensalidade Estimada (R$)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300 hover:bg-white/5">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-9 text-xs bg-[#5B50E6] hover:bg-[#4A40D0] text-white font-bold">
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
  const [notes, setNotes] = useState("");

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
      <DialogContent className="sm:max-w-[420px] bg-[#13102B] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white flex items-center gap-2">
            <Calendar className="text-cyan-400" size={18} /> Agendar Aula Experimental
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            moveStageMutation.mutate({ leadId: lead.id, newStage: "aula_experimental" });
          }}
          className="space-y-3 py-2"
        >
          <div className="p-3 bg-[#1A163B] rounded-xl border border-indigo-950/60 space-y-1">
            <p className="font-bold text-white text-xs">{lead.name}</p>
            <p className="text-[11px] text-slate-300">Instrumento: <strong>{lead.instrument || lead.productService || "Música"}</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Data da Aula *</label>
              <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} required className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Horário *</label>
              <Input type="time" value={trialTime} onChange={(e) => setTrialTime(e.target.value)} required className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400">Observações / Professor</label>
            <Input placeholder="Ex: Prof. Pedro - Estúdio 02" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300">Cancelar</Button>
            <Button type="submit" disabled={moveStageMutation.isPending} className="h-9 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold">
              {moveStageMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Confirmar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── MODAL: PERFIL DO LEAD & CONVERSÃO 1-CLICK ──
function LeadProfileModal({ leadId, open, onClose }: any) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.getLeadDetails.useQuery({ leadId });

  const convertMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: () => {
      toast.success("🎉 Parabéns! Lead convertido em Aluno Matriculado no MusicPro.");
      onClose();
      utils.crm.listLeads.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!data?.lead) return null;
  const lead = data.lead;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#13102B] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white flex items-center justify-between">
            <span>{lead.name}</span>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
              {lead.stage}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 bg-[#1A163B] p-3.5 rounded-xl border border-indigo-950/60 text-xs">
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Instrumento / Curso</span><p className="font-bold text-white">{lead.instrument || lead.productService || "Música"}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Modalidade / Nível</span><p className="font-bold text-white">{lead.modality || "Presencial"} ({lead.level || "Iniciante"})</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Mensalidade Estimada</span><p className="font-bold text-emerald-400">R$ {Number(lead.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Telefone / WhatsApp</span><p className="font-bold text-white">{lead.phone || "Não informado"}</p></div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {lead.phone && (
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs hover:bg-emerald-700 transition-colors shadow-md"
              >
                <MessageSquare size={15} /> WhatsApp Direct
              </a>
            )}

            {lead.stage !== "fechado" && (
              <Button
                onClick={() => convertMutation.mutate({ leadId: lead.id, monthlyFee: Number(lead.value || 0) })}
                disabled={convertMutation.isPending}
                className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                {convertMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />} Matricular Aluno (1-Click)
              </Button>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button onClick={onClose} className="h-9 text-xs bg-slate-800 text-white font-bold w-full">Fechar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
