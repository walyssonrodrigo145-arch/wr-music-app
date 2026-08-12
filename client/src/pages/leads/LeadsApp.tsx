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
  MessageCircle, Share2, CheckSquare, XCircle, AlertCircle, Compass, Flame
} from "lucide-react";

// Estágios Padrão do Funil Universal Comercial (7 Estágios)
const DEFAULT_STAGES = [
  { key: "novo", label: "Novo Lead", color: "bg-[#5B50E6]", text: "text-indigo-400", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "contato", label: "Contato Realizado", color: "bg-purple-500", text: "text-purple-400", bgLight: "bg-purple-500/10", border: "border-purple-500/30" },
  { key: "qualificacao", label: "Qualificação", color: "bg-cyan-500", text: "text-cyan-400", bgLight: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { key: "demonstracao", label: "Demonstração", color: "bg-amber-500", text: "text-amber-400", bgLight: "bg-amber-500/10", border: "border-amber-500/30" },
  { key: "proposta", label: "Proposta Enviada", color: "bg-blue-500", text: "text-blue-400", bgLight: "bg-blue-500/10", border: "border-blue-500/30" },
  { key: "negociacao", label: "Negociação", color: "bg-indigo-500", text: "text-indigo-400", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "fechado", label: "Fechado (Ganho)", color: "bg-emerald-500", text: "text-emerald-400", bgLight: "bg-emerald-500/10", border: "border-emerald-500/30" },
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

  // Consultas tRPC Reais do Banco Postgres
  const { data: metrics } = trpc.crm.getDashboardMetrics.useQuery({ period: "30d" });
  const { data: dbLeads = [] } = trpc.crm.listLeads.useQuery({
    search: searchTerm,
    stage: selectedStageFilter,
    priority: selectedPriorityFilter,
  });
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });
  const { data: reportsData } = trpc.crm.getReportsData.useQuery();

  // Mutations
  const moveStageMutation = trpc.crm.moveStage.useMutation({
    onSuccess: () => {
      toast.success("Estágio do lead atualizado!");
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeFollowUpMutation = trpc.crm.completeFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Atividade concluída com sucesso!");
      utils.crm.listFollowUps.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  const deleteLeadMutation = trpc.crm.deleteLead.useMutation({
    onSuccess: () => {
      toast.success("Lead removido!");
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  // Fallback de dados de exemplo ultra-fidedignos caso a base esteja inicializando
  const mockFallbackItems = [
    { id: 101, name: "Mariana Silva", companyOrSchool: "Empresa XPTO", cityState: "São Paulo - SP", planName: "Plano Enterprise", value: "8500.00", temperature: "quente", stage: "novo", phone: "(11) 99881-2233", createdAt: new Date() },
    { id: 102, name: "Carlos Mendes", companyOrSchool: "TechSolutions", cityState: "Curitiba - PR", planName: "SaaS Custom", value: "8500.00", temperature: "morno", stage: "novo", phone: "(41) 99112-4455", createdAt: new Date() },
    { id: 103, name: "Juliana Costa", companyOrSchool: "Agência Digital", cityState: "Belo Horizonte - MG", planName: "Gestão Tráfego", value: "12000.00", temperature: "quente", stage: "novo", phone: "(31) 98822-3344", createdAt: new Date() },
    { id: 104, name: "Roberto Alves", companyOrSchool: "Construtora Prime", cityState: "Goiânia - GO", planName: "Projeto Obra", value: "35000.00", temperature: "quente", stage: "contato", phone: "(62) 97654-3210", createdAt: new Date() },
    { id: 105, name: "Ana Beatriz", companyOrSchool: "Startup Labs", cityState: "Campinas - SP", planName: "Aceleração", value: "18000.00", temperature: "morno", stage: "contato", phone: "(19) 98123-4567", createdAt: new Date() },
    { id: 106, name: "Lucas Ferreira", companyOrSchool: "Comercial LTDA", cityState: "Porto Alegre - RS", planName: "Consultoria B2B", value: "9500.00", temperature: "morno", stage: "contato", phone: "(51) 99554-1122", createdAt: new Date() },
    { id: 107, name: "Paulo Henrique", companyOrSchool: "Indústria Alfa", cityState: "Salvador - BA", planName: "Automação", value: "42000.00", temperature: "quente", stage: "proposta", phone: "(71) 99223-8899", createdAt: new Date() },
    { id: 108, name: "Fernanda Lima", companyOrSchool: "Design Studio", cityState: "Recife - PE", planName: "Branding Pro", value: "23000.00", temperature: "morno", stage: "proposta", phone: "(81) 98765-1122", createdAt: new Date() },
    { id: 109, name: "Rafael Souza", companyOrSchool: "Consultoria 360", cityState: "Fortaleza - CE", planName: "Mentoria Executive", value: "38000.00", temperature: "morno", stage: "proposta", phone: "(85) 99443-2211", createdAt: new Date() },
    { id: 110, name: "Bruna Santos", companyOrSchool: "Marketing Pro", cityState: "Rio de Janeiro - RJ", planName: "Inbound Marketing", value: "85000.00", temperature: "quente", stage: "negociacao", phone: "(21) 98877-6655", createdAt: new Date() },
    { id: 111, name: "Thiago Martins", companyOrSchool: "Sistema Web", cityState: "Brasília - DF", planName: "ERP Cloud", value: "22000.00", temperature: "morno", stage: "negociacao", phone: "(61) 99112-3344", createdAt: new Date() },
    { id: 112, name: "Daniel Oliveira", companyOrSchool: "Clínica Mais", cityState: "Florianópolis - SC", planName: "Software Médico", value: "45000.00", temperature: "ganho", stage: "fechado", phone: "(48) 99445-6677", createdAt: new Date() },
    { id: 113, name: "Camila Rodrigues", companyOrSchool: "Imobiliária House", cityState: "Ribeirão Preto - SP", planName: "Gestão Imóveis", value: "32000.00", temperature: "ganho", stage: "fechado", phone: "(16) 98112-4433", createdAt: new Date() },
  ];

  const leadsDisplayList = dbLeads.length > 0 ? dbLeads : mockFallbackItems;

  const getPriorityBadge = (temp?: string | null) => {
    switch (temp) {
      case "quente":
        return <span className="flex items-center gap-1 font-bold text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Alta</span>;
      case "frio":
        return <span className="flex items-center gap-1 font-bold text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Baixa</span>;
      default:
        return <span className="flex items-center gap-1 font-bold text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Média</span>;
    }
  };

  const getWhatsAppLink = (phone?: string | null) => {
    if (!phone) return "#";
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean.startsWith("55") ? clean : `55${clean}`}`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B091A] font-sans antialiased text-slate-200 selection:bg-indigo-500/30">
      {/* ── 1. SIDEBAR COMPACTA PREMIA (ESCURA #13102B) ── */}
      <aside className="w-64 bg-[#13102B] text-slate-400 flex flex-col shrink-0 select-none border-r border-indigo-950/40">
        {/* LOGO PLATAFORMA */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B50E6] to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
              W
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight font-outfit leading-none">MusicPro</span>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest mt-1">CRM Universal</span>
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
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Gestão de Clientes</p>
            <button
              onClick={() => setActiveMenu("clientes")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "clientes"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Building2 size={16} /> Clientes Conquistados
            </button>

            <button
              onClick={() => setActiveMenu("onboarding")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "onboarding"
                  ? "bg-[#5B50E6] text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Rocket size={16} /> Onboarding de Negócios
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
              {activeMenu === "clientes" && "Clientes Conquistados"}
              {activeMenu === "onboarding" && "Onboarding de Negócios"}
              {activeMenu === "suporte" && "Atendimento & Suporte"}
              {activeMenu === "performance" && "Performance de Vendas"}
              {activeMenu === "origens" && "Origem das Oportunidades"}
              {activeMenu === "configuracoes" && "Configurações Gerais"}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Visão geral dos seus leads e oportunidades comerciais.</p>
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
              <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-black text-xs flex items-center justify-center">
                M
              </div>
            </div>
          </div>
        </header>

        {/* MAIN BODY DE ACORDO COM A ABA ATIVA */}
        <main className="p-8 space-y-6">
          {/* ── 1. LEADS & OPORTUNIDADES VIEW ── */}
          {activeMenu === "leads" && (
            <div className="space-y-6">
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
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Em Negociação</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20"><Briefcase size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">189</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Clock size={14} /> 12 em fase final
                  </div>
                </div>

                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa de Conversão</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><TrendingUp size={16} /></div>
                  </div>
                  <p className="text-3xl font-black font-outfit text-white tracking-tight">24,8%</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <ArrowUpRight size={14} /> 3,1% <span className="text-slate-500 font-normal">vs mês anterior</span>
                  </div>
                </div>
              </div>

              {/* GRID PRINCIPAL: EVOLUÇÃO + RECENTES + FONTES + PIPELINE */}
              <div className="grid grid-cols-12 gap-6">
                {/* EVOLUÇÃO DE LEADS (GRÁFICO DE LINHA) */}
                <div className="col-span-8 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <div>
                      <h3 className="font-bold text-base font-outfit text-white">Evolução de Leads</h3>
                      <p className="text-xs text-slate-400">Desempenho de captação e conversão ao longo do tempo.</p>
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

                {/* LEADS RECENTES */}
                <div className="col-span-4 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-950/50 pb-4">
                    <h3 className="font-bold text-base font-outfit text-white">Leads Recentes</h3>
                    <span className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer">Ver todos</span>
                  </div>
                  <div className="space-y-4 text-xs">
                    {leadsDisplayList.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center">
                            {lead.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-white leading-snug">{lead.name}</p>
                            <p className="text-[11px] text-slate-400">{lead.companyOrSchool || "Empresa XPTO"}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold">há 15 min</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FONTES DE LEADS (DONUT CHART) */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Fontes de Leads</h3>
                  <div className="flex items-center gap-6 py-2">
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path strokeDasharray="35, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#5B50E6" strokeWidth="4" />
                        <path strokeDasharray="29, 100" strokeDashoffset="-35" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#06B6D4" strokeWidth="4" />
                        <path strokeDasharray="20, 100" strokeDashoffset="-64" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F59E0B" strokeWidth="4" />
                      </svg>
                      <div className="absolute flex flex-col items-center text-center">
                        <span className="font-extrabold text-white text-base font-outfit">1.243</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Total</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-xs font-bold">
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#5B50E6]" /> Instagram</span><span className="text-white">35%</span></div>
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Site / Google Ads</span><span className="text-white">29%</span></div>
                      <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Indicação</span><span className="text-white">20%</span></div>
                    </div>
                  </div>
                </div>

                {/* VALOR DO PIPELINE */}
                <div className="col-span-6 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Valor do Pipeline</h3>
                    <div className="mt-3">
                      <p className="text-3xl font-black font-outfit text-white">R$ 1.280.450</p>
                      <p className="text-xs text-emerald-400 font-bold mt-1 flex items-center gap-1"><ArrowUpRight size={14} /> +14.8% vs mês anterior</p>
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
                    <h3 className="font-bold text-lg font-outfit text-white">Funil de Vendas (Kanban)</h3>
                    <p className="text-xs text-slate-400">Acompanhe o progresso das suas oportunidades comercialmente.</p>
                  </div>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#5B50E6] text-white font-bold text-xs gap-1.5"><Plus size={15} /> Novo Lead</Button>
                </div>

                <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
                  {DEFAULT_STAGES.slice(0, 5).map((stg) => {
                    const stageLeads = leadsDisplayList.filter((l) => l.stage === stg.key);
                    const totalVal = stageLeads.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
                    return (
                      <div key={stg.key} className="space-y-3 min-w-[200px] bg-[#13102B] p-3 rounded-2xl border border-indigo-950/40">
                        <div className="space-y-1 px-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-white font-outfit">{stg.label}</span>
                            <span className="text-indigo-400 font-extrabold">{stageLeads.length}</span>
                          </div>
                          <p className="text-[11px] font-extrabold text-slate-400">R$ {totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>

                        <div className="space-y-3">
                          {stageLeads.map((item) => (
                            <div key={item.id} className="bg-[#18153A] border border-indigo-950/80 rounded-xl p-3.5 space-y-2.5 shadow-md hover:border-[#5B50E6]/60 transition-all group">
                              <div>
                                <h4 onClick={() => { setSelectedLeadId(item.id); setIsProfileModalOpen(true); }} className="font-bold text-xs text-white group-hover:text-indigo-300 cursor-pointer leading-snug">{item.name}</h4>
                                <p className="text-[10px] text-slate-400">{item.companyOrSchool || "Empresa XPTO"}</p>
                              </div>
                              <p className="font-extrabold text-xs text-white">R$ {Number(item.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>

                              <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60 text-[10px]">
                                {getPriorityBadge(item.temperature)}
                                <span className="text-slate-400">Hoje</span>
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
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Oportunidades</p><p className="text-base font-black font-outfit text-white">292</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><DollarSign size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Valor Total</p><p className="text-base font-black font-outfit text-white">R$ 1.280.450</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg"><Briefcase size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Valor Ponderado</p><p className="text-base font-black font-outfit text-white">R$ 716.800</p></div>
                  </div>
                  <div className="bg-[#13102B] p-3.5 rounded-xl border border-indigo-950/40 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><TrendingUp size={16} /></div>
                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Taxa de Conversão</p><p className="text-base font-black font-outfit text-white">24,8%</p></div>
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
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Hoje</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <Phone className="text-indigo-400" size={16} />
                        <div><p className="font-bold text-white">Ligar para Mariana Silva</p><p className="text-[11px] text-slate-400">Empresa XPTO</p></div>
                      </div>
                      <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">09:00</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <FileText className="text-amber-400" size={16} />
                        <div><p className="font-bold text-white">Enviar proposta para Carlos Mendes</p><p className="text-[11px] text-slate-400">TechSolutions</p></div>
                      </div>
                      <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">11:30</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="text-emerald-400" size={16} />
                        <div><p className="font-bold text-white">Follow-up com Juliana Costa</p><p className="text-[11px] text-slate-400">Agência Digital</p></div>
                      </div>
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">14:00</span>
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
                        <div><p className="font-bold text-white">Ana Beatriz</p><p className="text-[11px] text-slate-400">Startup Labs</p></div>
                      </div>
                      <span className="text-slate-400 font-bold">Amanhã, 09:00</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center">PH</div>
                        <div><p className="font-bold text-white">Paulo Henrique</p><p className="text-[11px] text-slate-400">Indústria Alfa</p></div>
                      </div>
                      <span className="text-slate-400 font-bold">Amanhã, 11:00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RESUMO CARDS INDICADORES */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#161334]/80 p-4 rounded-xl border border-indigo-950/50 flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-xs font-bold text-slate-300">12 Tarefas para hoje</span></div>
                <div className="bg-[#161334]/80 p-4 rounded-xl border border-indigo-950/50 flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-xs font-bold text-slate-300">8 Atrasadas</span></div>
                <div className="bg-[#161334]/80 p-4 rounded-xl border border-indigo-950/50 flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs font-bold text-slate-300">23 Próximas</span></div>
                <div className="bg-[#161334]/80 p-4 rounded-xl border border-indigo-950/50 flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs font-bold text-slate-300">45 Concluídas</span></div>
              </div>
            </div>
          )}

          {/* ── 4. PROPOSTAS & FECHAMENTO VIEW ── */}
          {activeMenu === "propostas" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Propostas Enviadas</span>
                  <p className="text-3xl font-black font-outfit text-white">42</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Aguardando Resposta</span>
                  <p className="text-3xl font-black font-outfit text-white">18</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Propostas Aprovadas</span>
                  <p className="text-3xl font-black font-outfit text-emerald-400">12</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Valor das Propostas</span>
                  <p className="text-2xl font-black font-outfit text-white">R$ 356.000</p>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Propostas Recentes</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/40">
                      <div><p className="font-bold text-white">Proposta Comercial - Empresa XPTO</p><p className="text-[11px] text-slate-400">Mariana Silva</p></div>
                      <span className="font-extrabold text-white">R$ 15.000</span>
                      <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Enviada</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/40">
                      <div><p className="font-bold text-white">Proposta de Serviços - Tech Solutions</p><p className="text-[11px] text-slate-400">Carlos Mendes</p></div>
                      <span className="font-extrabold text-white">R$ 8.500</span>
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Aguardando</Badge>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col items-center justify-center text-center">
                  <h3 className="font-bold text-base font-outfit text-white">Taxa de Aprovação</h3>
                  <div className="relative w-36 h-36 flex items-center justify-center my-2">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path strokeDasharray="28, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#5B50E6" strokeWidth="4" />
                    </svg>
                    <span className="text-2xl font-black font-outfit text-white">28,6%</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-bold">+5,2% vs mês anterior</p>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. METAS COMERCIAIS VIEW ── */}
          {activeMenu === "metas" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white">Meta de Faturamento</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Meta: R$ 250.000</p>
                    <p className="text-3xl font-black font-outfit text-white">R$ 187.450</p>
                  </div>
                  <div className="w-full h-3 bg-[#13102B] rounded-full overflow-hidden border border-indigo-950/50">
                    <div className="h-full bg-gradient-to-r from-[#5B50E6] to-emerald-500" style={{ width: "74.98%" }} />
                  </div>
                  <p className="text-xs font-bold text-right text-emerald-400">74,98% atingido</p>
                </div>

                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white">Meta de Negócios</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Meta: 50 contratos</p>
                    <p className="text-3xl font-black font-outfit text-white">37 realizados</p>
                  </div>
                  <div className="w-full h-3 bg-[#13102B] rounded-full overflow-hidden border border-indigo-950/50">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: "74%" }} />
                  </div>
                  <p className="text-xs font-bold text-right text-cyan-400">74% atingido</p>
                </div>
              </div>

              {/* TABELA DE EQUIPE + BANNER TROFÉU */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Metas da Equipe</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center">BS</div>
                        <span className="font-bold text-white">Bruna Santos</span>
                      </div>
                      <span className="font-bold text-slate-300">R$ 65.000 / 80.000</span>
                      <span className="font-bold text-emerald-400">28,4% conversão</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B] border border-indigo-950/40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-white font-bold flex items-center justify-center">TM</div>
                        <span className="font-bold text-white">Thiago Martins</span>
                      </div>
                      <span className="font-bold text-slate-300">R$ 45.300 / 60.000</span>
                      <span className="font-bold text-cyan-400">26,3% conversão</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 bg-gradient-to-tr from-[#161334] to-[#251F56] border border-indigo-950/50 rounded-2xl p-6 space-y-3 shadow-xl flex flex-col items-center justify-center text-center">
                  <Trophy size={48} className="text-amber-400 animate-bounce" />
                  <h4 className="font-extrabold text-white font-outfit text-base">Você está no caminho certo!</h4>
                  <p className="text-xs text-slate-300">Continue assim para bater suas metas deste mês!</p>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. CLIENTES CONQUISTADOS VIEW ── */}
          {activeMenu === "clientes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Clientes Conquistados</span>
                  <p className="text-3xl font-black font-outfit text-white">17</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Faturamento Total</span>
                  <p className="text-2xl font-black font-outfit text-emerald-400">R$ 192.000</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Ticket Médio</span>
                  <p className="text-2xl font-black font-outfit text-white">R$ 11.294</p>
                </div>
                <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-5 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Taxa de Retenção</span>
                  <p className="text-3xl font-black font-outfit text-cyan-400">78,6%</p>
                </div>
              </div>

              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Tabela de Clientes Conquistados</h3>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#13102B] text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Empresa</th>
                        <th className="p-3">Valor Contrato</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Responsável</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-950/40">
                      {leadsDisplayList.slice(0, 5).map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">{item.name[0]}</div>
                            {item.name}
                          </td>
                          <td className="p-3 text-slate-300">{item.companyOrSchool || "Empresa XPTO"}</td>
                          <td className="p-3 font-extrabold text-emerald-400">R$ {Number(item.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-slate-400">14/08/2025</td>
                          <td className="p-3 text-slate-300">Walysson Rodrigues</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── 7. ONBOARDING DE NEGÓCIOS VIEW ── */}
          {activeMenu === "onboarding" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="px-4 py-2 rounded-xl bg-[#5B50E6] text-white">Em Andamento (8)</span>
                <span className="px-4 py-2 rounded-xl bg-[#161334] text-slate-400 border border-indigo-950/50">Concluídos (12)</span>
                <span className="px-4 py-2 rounded-xl bg-[#161334] text-slate-400 border border-indigo-950/50">Pendentes (5)</span>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-7 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Acompanhamento de Clientes</h3>
                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold"><span>Empresa XPTO</span><span className="text-indigo-400">60%</span></div>
                      <div className="w-full h-2 bg-[#13102B] rounded-full overflow-hidden"><div className="h-full bg-[#5B50E6]" style={{ width: "60%" }} /></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold"><span>TechSolutions</span><span className="text-cyan-400">40%</span></div>
                      <div className="w-full h-2 bg-[#13102B] rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: "40%" }} /></div>
                    </div>
                  </div>
                </div>

                <div className="col-span-5 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Etapas do Onboarding</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#13102B]"><span className="text-slate-300">Boas-vindas e apresentação</span><CheckCircle2 size={16} className="text-emerald-400" /></div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#13102B]"><span className="text-slate-300">Coleta de informações</span><CheckCircle2 size={16} className="text-emerald-400" /></div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#13102B]"><span className="text-slate-300">Configuração inicial</span><Clock size={16} className="text-amber-400" /></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 8. ATENDIMENTO & SUPORTE VIEW ── */}
          {activeMenu === "suporte" && (
            <div className="space-y-6">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-4">
                  <div className="bg-[#161334]/80 p-5 rounded-2xl border border-indigo-950/50 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">Tickets Abertos</span><span className="text-2xl font-black font-outfit text-white">12</span></div>
                  <div className="bg-[#161334]/80 p-5 rounded-2xl border border-indigo-950/50 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">Em Atendimento</span><span className="text-2xl font-black font-outfit text-indigo-400">8</span></div>
                  <div className="bg-[#161334]/80 p-5 rounded-2xl border border-indigo-950/50 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">Resolvidos</span><span className="text-2xl font-black font-outfit text-emerald-400">45</span></div>
                </div>

                <div className="col-span-8 bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Tickets Recentes</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#13102B]">
                      <div><p className="font-bold text-white">Dúvida sobre integração WhatsApp</p><p className="text-[11px] text-slate-400">Mariana Silva - Empresa XPTO</p></div>
                      <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Em Atendimento</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 9. PERFORMANCE DE VENDAS VIEW ── */}
          {activeMenu === "performance" && (
            <div className="space-y-6">
              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Relatório de Performance de Vendas</h3>
                <p className="text-xs text-slate-400">Desempenho comparativo de conversão por período e responsável.</p>
              </div>
            </div>
          )}

          {/* ── 10. ORIGEM DAS OPORTUNIDADES VIEW ── */}
          {activeMenu === "origens" && (
            <div className="space-y-6">
              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Detalhamento por Canal de Captação</h3>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-[#13102B] rounded-xl border border-indigo-950/50"><p className="font-bold text-slate-400">Instagram Ads</p><p className="text-2xl font-black font-outfit text-white">35% das vendas</p></div>
                  <div className="p-4 bg-[#13102B] rounded-xl border border-indigo-950/50"><p className="font-bold text-slate-400">Google Search</p><p className="text-2xl font-black font-outfit text-cyan-400">29% das vendas</p></div>
                  <div className="p-4 bg-[#13102B] rounded-xl border border-indigo-950/50"><p className="font-bold text-slate-400">Indicação direta</p><p className="text-2xl font-black font-outfit text-amber-400">20% das vendas</p></div>
                </div>
              </div>
            </div>
          )}

          {/* ── 11. CONFIGURAÇÕES VIEW ── */}
          {activeMenu === "configuracoes" && (
            <div className="space-y-6 max-w-4xl">
              <div className="bg-[#161334]/80 border border-indigo-950/50 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-base font-outfit text-white border-b border-indigo-950/50 pb-4">Configurações do CRM Universal</h3>
                <p className="text-xs text-slate-400">Gerencie segmento da organização, regras de automação e campos personalizados.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: CADASTRAR OPORTUNIDADE UNIVERSAL ── */}
      <CreateLeadModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedLeadId && (
        <LeadProfileModal leadId={selectedLeadId} open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      )}
    </div>
  );
}

// ── MODAL CADASTRAR OPORTUNIDADE PREMIUN (DARK TONE) ──
function CreateLeadModal({ open, onClose }: any) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [productService, setProductService] = useState("");
  const [value, setValue] = useState("5000");

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade cadastrada com sucesso!");
      onClose();
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-[#13102B] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white">Cadastrar Nova Oportunidade</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return toast.error("Preencha o nome do lead");
            createMutation.mutate({ name, phone, email, productService, value: Number(value) });
          }}
          className="space-y-3 py-2"
        >
          <div className="space-y-1">
            <label className="font-bold text-slate-400">Nome do Lead / Empresa *</label>
            <Input placeholder="Ex: Mariana Silva ou Empresa XPTO" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Telefone / WhatsApp</label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">E-mail</label>
              <Input placeholder="contato@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Produto / Serviço</label>
              <Input placeholder="Ex: Plano Enterprise" value={productService} onChange={(e) => setProductService(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Valor Estimado (R$)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-xs bg-[#1A163B] border-indigo-950 text-white" />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs border-indigo-950 text-slate-300 hover:bg-white/5">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-9 text-xs bg-[#5B50E6] hover:bg-[#4A40D0] text-white font-bold">
              {createMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── MODAL PERFIL DO LEAD PREMIUN (DARK TONE) ──
function LeadProfileModal({ leadId, open, onClose }: any) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.getLeadDetails.useQuery({ leadId });

  const convertMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: () => {
      toast.success("🎉 Parabéns! Lead convertido em Cliente Conquistado.");
      onClose();
      utils.crm.listLeads.invalidate();
    },
  });

  if (!data?.lead) return null;
  const lead = data.lead;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#13102B] text-slate-200 border border-indigo-950/80 text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-white">{lead.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3 bg-[#1A163B] p-3 rounded-xl border border-indigo-950/60 text-xs">
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Produto / Serviço</span><p className="font-bold text-white">{lead.productService || lead.instrument || "Não informado"}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Valor da Oportunidade</span><p className="font-bold text-emerald-400">R$ {Number(lead.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Telefone</span><p className="font-bold text-white">{lead.phone || "Não informado"}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Origem</span><p className="font-bold text-white">{lead.source || "WhatsApp"}</p></div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {lead.phone && (
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs hover:bg-emerald-700 transition-colors"
              >
                <MessageSquare size={14} /> Contato via WhatsApp
              </a>
            )}

            {lead.stage !== "fechado" && (
              <Button
                onClick={() => convertMutation.mutate({ leadId: lead.id, monthlyFee: Number(lead.value || 0) })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
              >
                <UserCheck size={14} /> Converter em Cliente
              </Button>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button onClick={onClose} className="h-9 text-xs bg-slate-800 text-white font-bold">Fechar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
