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
  Activity, HelpCircle, UserPlus, ArrowRight, Music, RefreshCw, Layers,
  LayoutDashboard, Briefcase, CalendarCheck, FileSpreadsheet, Building2,
  Rocket, Headphones, RefreshCcw, HeartPulse, DollarSign, Bell, Trash2, Edit3
} from "lucide-react";

// Paleta de Estágios do Pipeline Comercial (7 Estágios fiéis à imagem)
const STAGES = [
  { key: "novo", label: "Novo Lead", color: "bg-amber-400", text: "text-amber-600", bgLight: "bg-amber-400/10", border: "border-amber-400/30" },
  { key: "contato", label: "Contato", color: "bg-[#5B50E6]", text: "text-indigo-600", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "interessado", label: "Interessado", color: "bg-cyan-500", text: "text-cyan-600", bgLight: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { key: "demonstracao", label: "Demonstração", color: "bg-amber-500", text: "text-amber-600", bgLight: "bg-amber-500/10", border: "border-amber-500/30" },
  { key: "proposta", label: "Proposta", color: "bg-purple-500", text: "text-purple-600", bgLight: "bg-purple-500/10", border: "border-purple-500/30" },
  { key: "negociacao", label: "Negociação", color: "bg-indigo-500", text: "text-indigo-600", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "fechado", label: "Fechado", color: "bg-emerald-500", text: "text-emerald-600", bgLight: "bg-emerald-500/10", border: "border-emerald-500/30" },
];

export default function LeadsApp() {
  const utils = trpc.useUtils();
  const [activeMenu, setActiveMenu] = useState<
    "dashboard" | "leads" | "pipeline" | "atividades" | "propostas" | "metas" | "relatorios" | "configuracoes"
  >("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("01/08/2025 - 12/08/2025");

  // Filtros Globais
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState("todos");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("todas");
  const [selectedOriginFilter, setSelectedOriginFilter] = useState("todas");

  // State de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Consultas tRPC Reais do Banco Postgres
  const { data: metrics } = trpc.crm.getDashboardMetrics.useQuery({ period: "30d" });
  const { data: dbLeads = [] } = trpc.crm.listLeads.useQuery({
    search: searchTerm,
    stage: selectedStageFilter,
    priority: selectedPriorityFilter,
    source: selectedOriginFilter,
  });
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });
  const { data: reportsData } = trpc.crm.getReportsData.useQuery();
  const { data: settings } = trpc.crm.getSettings.useQuery();

  // Mutations
  const moveStageMutation = trpc.crm.moveStage.useMutation({
    onSuccess: () => {
      toast.success("Estágio do lead atualizado com sucesso!");
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(`Erro ao atualizar estágio: ${err.message}`),
  });

  const completeFollowUpMutation = trpc.crm.completeFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up concluído com sucesso!");
      utils.crm.listFollowUps.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  const deleteLeadMutation = trpc.crm.deleteLead.useMutation({
    onSuccess: () => {
      toast.success("Lead removido com sucesso!");
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Fallback de dados para renderização visual completa caso a base esteja inicializando
  const mockFallbackItems = [
    { id: 101, name: "Escola Som & Tal", cityState: "Belo Horizonte - MG", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "novo", phone: "(31) 99881-2233", createdAt: new Date() },
    { id: 102, name: "Instituto Harmonia", cityState: "Curitiba - PR", planName: "Plano Essential", value: "149.00", temperature: "frio", stage: "novo", phone: "(41) 99112-4455", createdAt: new Date() },
    { id: 103, name: "Escola Nota Certa", cityState: "Goiânia - GO", planName: "Plano Pro", value: "199.00", temperature: "frio", stage: "novo", phone: "(62) 98822-3344", createdAt: new Date() },
    { id: 104, name: "Vivace Escola de Música", cityState: "São Paulo - SP", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "contato", phone: "(11) 97654-3210", createdAt: new Date() },
    { id: 105, name: "Toque de Classe", cityState: "Campinas - SP", planName: "Plano Essential", value: "149.00", temperature: "morno", stage: "contato", phone: "(19) 98123-4567", createdAt: new Date() },
    { id: 106, name: "Studio Musical", cityState: "Porto Alegre - RS", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "contato", phone: "(51) 99554-1122", createdAt: new Date() },
    { id: 107, name: "Academia do Som", cityState: "Salvador - BA", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "interessado", phone: "(71) 99223-8899", createdAt: new Date() },
    { id: 108, name: "Escola Musicale", cityState: "Recife - PE", planName: "Plano Essential", value: "149.00", temperature: "morno", stage: "interessado", phone: "(81) 98765-1122", createdAt: new Date() },
    { id: 109, name: "Clube da Música", cityState: "Fortaleza - CE", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "interessado", phone: "(85) 99443-2211", createdAt: new Date() },
    { id: 110, name: "Center Music", cityState: "Rio de Janeiro - RJ", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "demonstracao", phone: "(21) 98877-6655", createdAt: new Date() },
    { id: 111, name: "Escola Adagio", cityState: "Brasília - DF", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "demonstracao", phone: "(61) 99112-3344", createdAt: new Date() },
    { id: 112, name: "Som & Louvor", cityState: "João Pessoa - PB", planName: "Plano Essential", value: "149.00", temperature: "morno", stage: "demonstracao", phone: "(83) 98833-2211", createdAt: new Date() },
    { id: 113, name: "Escola Allegro", cityState: "Niterói - RJ", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "proposta", phone: "(21) 97112-9988", createdAt: new Date() },
    { id: 114, name: "Musical Center", cityState: "Uberlândia - MG", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "proposta", phone: "(34) 99887-1122", createdAt: new Date() },
    { id: 115, name: "Escola Melodia", cityState: "Maringá - PR", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "proposta", phone: "(44) 99123-5566", createdAt: new Date() },
    { id: 116, name: "Escola Clave de Sol", cityState: "Florianópolis - SC", planName: "Plano Pro", value: "199.00", temperature: "quente", stage: "negociacao", phone: "(48) 99445-6677", createdAt: new Date() },
    { id: 117, name: "Compasso Escola", cityState: "Ribeirão Preto - SP", planName: "Plano Pro", value: "199.00", temperature: "morno", stage: "negociacao", phone: "(16) 98112-4433", createdAt: new Date() },
    { id: 118, name: "Música em Foco", cityState: "Vitória - ES", planName: "Plano Essential", value: "149.00", temperature: "morno", stage: "negociacao", phone: "(27) 99776-5544", createdAt: new Date() },
    { id: 119, name: "Escola Nova Voz", cityState: "Bauru - SP", planName: "Plano Pro", value: "199.00", temperature: "ganho", stage: "fechado", phone: "(14) 99122-3344", createdAt: new Date() },
    { id: 120, name: "Harmonia Escola", cityState: "Joinville - SC", planName: "Plano Essential", value: "149.00", temperature: "ganho", stage: "fechado", phone: "(47) 98844-5566", createdAt: new Date() },
    { id: 121, name: "Domínio Musical", cityState: "Campo Grande - MS", planName: "Plano Pro", value: "199.00", temperature: "ganho", stage: "fechado", phone: "(67) 99223-4455", createdAt: new Date() },
  ];

  const leadsDisplayList = dbLeads.length > 0 ? dbLeads : mockFallbackItems;

  const getTemperatureDot = (temp?: string | null) => {
    switch (temp) {
      case "quente":
        return <span className="w-2 h-2 rounded-full bg-rose-500" title="Temperatura Quente" />;
      case "frio":
        return <span className="w-2 h-2 rounded-full bg-blue-400" title="Temperatura Fria" />;
      case "ganho":
        return <span className="w-2 h-2 rounded-full bg-emerald-500" title="Fechado / Ganho" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-amber-400" title="Temperatura Morna" />;
    }
  };

  const getWhatsAppLink = (phone?: string | null) => {
    if (!phone) return "#";
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean.startsWith("55") ? clean : `55${clean}`}`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans antialiased text-slate-800 selection:bg-indigo-500/20">
      {/* ── 1. MENU LATERAL ESQUERDO (NAVBAR ESCURO #16162A) ── */}
      <aside className="w-64 bg-[#16162A] text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800/80">
        {/* BRANDING LOGO */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#5B50E6] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
              M
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-lg tracking-tight font-outfit">MusicPro</span>
              <span className="bg-[#5B50E6] text-white text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider">
                CRM
              </span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE MENU */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 text-xs">
          {/* ITEM ATIVO TOP */}
          <div>
            <button
              onClick={() => setActiveMenu("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
                activeMenu === "dashboard"
                  ? "bg-[#5B50E6] text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutDashboard size={16} /> Dashboard
            </button>
          </div>

          {/* GRUPO COMERCIAL */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Comercial</p>
            <button
              onClick={() => setActiveMenu("leads")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "leads" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3"><Users size={15} /> Leads</span>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-extrabold">{leadsDisplayList.length}</span>
            </button>
            <button
              onClick={() => setActiveMenu("pipeline")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "pipeline" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers size={15} /> Pipeline
            </button>
            <button
              onClick={() => setActiveMenu("atividades")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "atividades" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CalendarCheck size={15} /> Atividades
            </button>
            <button
              onClick={() => setActiveMenu("propostas")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "propostas" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileSpreadsheet size={15} /> Propostas
            </button>
            <button
              onClick={() => setActiveMenu("metas")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "metas" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Target size={15} /> Metas
            </button>
          </div>

          {/* GRUPO CLIENTES */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Clientes</p>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Building2 size={15} /> Escolas / Clientes
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Rocket size={15} /> Onboarding
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Headphones size={15} /> Suporte
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <RefreshCcw size={15} /> Renovações
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <HeartPulse size={15} /> Saúde do Cliente
            </button>
          </div>

          {/* GRUPO RELATÓRIOS */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Relatórios</p>
            <button
              onClick={() => setActiveMenu("relatorios")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
                activeMenu === "relatorios" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <DollarSign size={15} /> Vendas & Conversão
            </button>
            <button
              onClick={() => setActiveMenu("relatorios")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all"
            >
              <PieChart size={15} /> Origem dos Leads
            </button>
          </div>
        </div>

        {/* CONFIGURAÇÕES E USER FOOTER */}
        <div className="p-3 border-t border-slate-800/80 space-y-3">
          <button
            onClick={() => setActiveMenu("configuracoes")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
              activeMenu === "configuracoes" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings size={15} /> Configurações
          </button>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
              WR
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-white text-xs truncate">Walysson Rodrigues</p>
              <p className="text-[10px] text-slate-400 truncate">Administrador</p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* ── 2. CONTEÚDO PRINCIPAL DA APLICAÇÃO ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* HEADER TOP DA PÁGINA */}
        <header className="sticky top-0 z-20 bg-[#F8FAFC]/90 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-slate-200/80">
          <div>
            <h1 className="text-2xl font-black font-outfit text-slate-900 tracking-tight">
              {activeMenu === "dashboard" && "Dashboard Comercial"}
              {activeMenu === "leads" && "Base Geral de Leads"}
              {activeMenu === "pipeline" && "Pipeline Comercial (Kanban)"}
              {activeMenu === "atividades" && "Atividades & Follow-ups"}
              {activeMenu === "propostas" && "Propostas & Matrículas"}
              {activeMenu === "metas" && "Metas Comerciais"}
              {activeMenu === "relatorios" && "Relatórios Analíticos"}
              {activeMenu === "configuracoes" && "Configurações do CRM"}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Visão geral do funil de vendas e desempenho comercial do MusicPro.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* SELETOR DE DATA */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs font-bold text-slate-700 cursor-pointer">
              <Calendar size={14} className="text-slate-400" />
              <span>{selectedPeriod}</span>
              <ChevronDown size={14} className="text-slate-400 ml-1" />
            </div>

            {/* BOTAO + NOVA OPORTUNIDADE */}
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#5B50E6] hover:bg-[#4A40D0] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 gap-2 transition-all"
            >
              <Plus size={16} /> Nova Oportunidade
            </Button>

            {/* PERFIL E NOTIFICAÇÕES */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="relative p-2 rounded-xl hover:bg-slate-200/60 cursor-pointer text-slate-600 transition-all">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center">
                  3
                </span>
              </div>
              <div className="p-2 rounded-xl hover:bg-slate-200/60 cursor-pointer text-slate-600 transition-all">
                <HelpCircle size={18} />
              </div>
              <div className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">MusicPro</span>
                <div className="w-8 h-8 rounded-full bg-violet-600 text-white font-black text-xs flex items-center justify-center">
                  M
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL DE ACORDO COM A ABA ATIVA */}
        <main className="p-8 space-y-6">
          {/* ── ABA 1: DASHBOARD COMERCIAL (FIEL À IMAGEM) ── */}
          {activeMenu === "dashboard" && (
            <>
              {/* LINHA DE 7 CARDS KPI COMPACTOS */}
              <div className="grid grid-cols-7 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><Users size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Leads ativos</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">{metrics?.totalLeads ?? 127}</p>
                  <p className="text-[11px] font-bold text-emerald-600">+23 este mês</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600"><PhoneCall size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Demonstrações</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">12</p>
                  <p className="text-[11px] font-bold text-indigo-600">Agendadas</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><FileText size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Propostas enviadas</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">8</p>
                  <p className="text-[11px] font-bold text-amber-600">Aguardando retorno</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600"><CheckCircle2 size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Negociações</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">9</p>
                  <p className="text-[11px] font-bold text-purple-600">Em andamento</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Building2 size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Escolas fechadas</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">{metrics?.convertedLeads ?? 6}</p>
                  <p className="text-[11px] font-bold text-emerald-600">+2 este mês</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-violet-50 text-violet-600"><DollarSign size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">MRR novo</span>
                  </div>
                  <p className="text-xl font-black font-outfit text-slate-900">R$ 1.194<span className="text-xs font-semibold text-slate-400">/mês</span></p>
                  <p className="text-[11px] font-bold text-emerald-600">+R$ 398 este mês</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><TrendingUp size={16} /></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Taxa de conversão</span>
                  </div>
                  <p className="text-2xl font-black font-outfit text-slate-900">{metrics?.conversionRate ?? 8.4}%</p>
                  <p className="text-[11px] font-bold text-slate-500">Leads → Clientes</p>
                </div>
              </div>

              {/* PIPELINE KANBAN (7 COLUNAS) + WIDGETS LATERAIS */}
              <div className="grid grid-cols-12 gap-6 items-start">
                <div className="col-span-9 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-base font-outfit text-slate-900">Pipeline Comercial</h3>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer">
                      <span>Kanban</span><ChevronDown size={14} />
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-3.5 overflow-x-auto pb-2">
                    {STAGES.map((stg) => {
                      const stageLeads = leadsDisplayList.filter((l) => l.stage === stg.key);
                      return (
                        <div key={stg.key} className="space-y-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-xs font-bold px-1">
                            <span className="text-slate-800 font-outfit">{stg.label}</span>
                            <span className="text-slate-400 font-extrabold">{stageLeads.length}</span>
                          </div>

                          <div className="space-y-2.5">
                            {stageLeads.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => { setSelectedLeadId(item.id); setIsProfileModalOpen(true); }}
                                className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs hover:shadow-md hover:bg-white hover:border-[#5B50E6]/50 transition-all cursor-pointer group"
                              >
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-[#5B50E6] transition-colors leading-snug">
                                    {item.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-medium">{item.cityState || "São Paulo - SP"}</p>
                                </div>
                                <div className="text-[10px] space-y-0.5">
                                  <p className="text-slate-500 font-semibold">{item.planName || "Plano Pro"}</p>
                                  <p className="font-bold text-slate-900">R$ {Number(item.value || 199).toFixed(2)}/mês</p>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] font-bold">
                                  <div className="flex items-center gap-1.5">
                                    {getTemperatureDot(item.temperature)}
                                    <span className="capitalize text-slate-600">{item.temperature || "morno"}</span>
                                  </div>
                                  <span className="text-slate-400 font-medium flex items-center gap-0.5">
                                    <Calendar size={10} /> Hoje
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button onClick={() => setActiveMenu("pipeline")} className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-[#5B50E6] py-1 transition-colors">
                            + Ver mais
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* WIDGETS LATERAIS DIREITOS */}
                <div className="col-span-3 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-sm font-outfit text-slate-900">Próximas Ações</h3>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                        <span>Hoje</span><ChevronDown size={12} />
                      </div>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5"><MessageSquare size={13} /></div>
                        <div className="flex-1 min-w-0"><p className="font-bold text-slate-900 truncate">Follow-up: Escola Vivace</p><p className="text-[11px] text-slate-400 truncate">Retornar contato via WhatsApp</p></div>
                        <div className="text-right shrink-0 text-[10px]"><p className="font-bold text-slate-700">09:30</p><p className="text-slate-400">Walysson</p></div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5"><Phone size={13} /></div>
                        <div className="flex-1 min-w-0"><p className="font-bold text-slate-900 truncate">Ligação: Center Music</p><p className="text-[11px] text-slate-400 truncate">Confirmar demonstração</p></div>
                        <div className="text-right shrink-0 text-[10px]"><p className="font-bold text-slate-700">11:00</p><p className="text-slate-400">Irmão</p></div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5"><Calendar size={13} /></div>
                        <div className="flex-1 min-w-0"><p className="font-bold text-slate-900 truncate">Demonstração: Adagio</p><p className="text-[11px] text-slate-400 truncate">Apresentação do sistema</p></div>
                        <div className="text-right shrink-0 text-[10px]"><p className="font-bold text-slate-700">14:00</p><p className="text-slate-400">Walysson</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-sm font-outfit text-slate-900">Metas do Mês</h3>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer"><span>Agosto/2025</span><ChevronDown size={12} /></div>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="space-y-1"><div className="flex justify-between font-bold"><span className="text-slate-700">Novas escolas</span><span className="text-slate-500">6/10</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#5B50E6]" style={{ width: "60%" }} /></div></div>
                      <div className="space-y-1"><div className="flex justify-between font-bold"><span className="text-slate-700">Demonstrações</span><span className="text-slate-500">18/25</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#5B50E6]" style={{ width: "72%" }} /></div></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAINEL INFERIOR: 4 CARDS ANALÍTICOS */}
              <div className="grid grid-cols-4 gap-6 items-stretch">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="font-bold text-sm font-outfit text-slate-900">Conversão do Funil</h3></div>
                  <div className="flex gap-4 items-center flex-1 py-2">
                    <div className="w-24 space-y-1 flex flex-col items-center">
                      <div className="w-full h-5 bg-[#5B50E6] rounded-t-md" /><div className="w-[85%] h-5 bg-cyan-500" /><div className="w-[70%] h-5 bg-indigo-500" /><div className="w-[55%] h-5 bg-amber-500" /><div className="w-[40%] h-5 bg-purple-500" /><div className="w-[28%] h-5 bg-rose-500" /><div className="w-[18%] h-5 bg-emerald-500 rounded-b-md" />
                    </div>
                    <div className="flex-1 space-y-1 text-[11px] font-bold">
                      <p><strong>127</strong> Leads recebidos</p><p><strong>82</strong> Contatados (64,6%)</p><p><strong>47</strong> Interessados (37,0%)</p><p><strong>29</strong> Demonstrações (22,8%)</p><p><strong>18</strong> Propostas (14,2%)</p><p className="text-emerald-600"><strong>6</strong> Clientes (4,7%)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="font-bold text-sm font-outfit text-slate-900">Origem dos Leads</h3></div>
                  <div className="flex items-center gap-4 py-2">
                    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path strokeDasharray="38, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#5B50E6" strokeWidth="4.5" />
                        <path strokeDasharray="24, 100" strokeDashoffset="-38" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F59E0B" strokeWidth="4.5" />
                        <path strokeDasharray="17, 100" strokeDashoffset="-62" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10B981" strokeWidth="4.5" />
                      </svg>
                      <div className="absolute flex flex-col items-center text-center"><span className="font-extrabold text-slate-900 text-sm">127</span><span className="text-[9px] text-slate-400 font-bold uppercase">Leads</span></div>
                    </div>
                    <div className="flex-1 space-y-1 text-[11px] font-bold">
                      <p><span className="w-2 h-2 rounded-full bg-[#5B50E6] inline-block mr-1" />Instagram (38%)</p>
                      <p><span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" />Indicação (24%)</p>
                      <p><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />WhatsApp (17%)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="font-bold text-sm font-outfit text-slate-900">MRR - Visão Geral</h3></div>
                  <div className="space-y-1"><p className="text-xl font-black font-outfit text-slate-900">R$ 1.194</p><p className="text-[11px] font-bold text-slate-400">MRR novo este mês</p></div>
                  <div className="h-20 w-full pt-2">
                    <svg className="w-full h-full" viewBox="0 0 200 60"><path d="M 10 50 L 50 40 L 90 25 L 130 30 L 170 15 L 190 20" fill="none" stroke="#5B50E6" strokeWidth="2.5" /><circle cx="190" cy="20" r="3" fill="#5B50E6" /></svg>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="font-bold text-sm font-outfit text-slate-900">Desempenho da Equipe</h3></div>
                  <div className="space-y-3 text-xs">
                    <div><div className="flex justify-between font-bold"><span>Walysson Rodrigues</span><span>R$ 996</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-[#5B50E6]" style={{ width: "83%" }} /></div></div>
                    <div><div className="flex justify-between font-bold"><span>Meu Irmão</span><span>R$ 996</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-[#5B50E6]" style={{ width: "60%" }} /></div></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── ABA 2: BASE GERAL DE LEADS (TABELA COMPLETA) ── */}
          {activeMenu === "leads" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative min-w-[300px]">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <Input placeholder="Buscar por nome, telefone, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs bg-white border-slate-200" />
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#5B50E6] text-white font-bold text-xs gap-1.5"><Plus size={15} /> Adicionar Lead</Button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Nome / Contato</th>
                      <th className="p-3.5">Instrumento</th>
                      <th className="p-3.5">Estágio</th>
                      <th className="p-3.5">Plano / Valor</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {leadsDisplayList.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <p onClick={() => { setSelectedLeadId(l.id); setIsProfileModalOpen(true); }} className="font-bold text-slate-900 hover:text-[#5B50E6] cursor-pointer">{l.name}</p>
                          <p className="text-[11px] text-slate-400">{l.phone || l.email || "Sem telefone"}</p>
                        </td>
                        <td className="p-3.5 font-medium text-slate-700">{l.instrument || l.cityState || "—"}</td>
                        <td className="p-3.5">
                          <Badge className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px] font-bold">
                            {STAGES.find((s) => s.key === l.stage)?.label || l.stage}
                          </Badge>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">R$ {Number(l.value || 199).toFixed(2)}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {l.phone && (
                              <a href={getWhatsAppLink(l.phone)} target="_blank" rel="noreferrer" className="p-1.5 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
                                <MessageSquare size={14} />
                              </a>
                            )}
                            <Button onClick={() => { setSelectedLeadId(l.id); setIsProfileModalOpen(true); }} variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900"><Eye size={14} /></Button>
                            <Button onClick={() => deleteLeadMutation.mutate({ leadId: l.id })} variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ABA 3: KANBAN COMPLETO ── */}
          {activeMenu === "pipeline" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-base font-outfit text-slate-900">Pipeline Comercial de Vendas</h3>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#5B50E6] text-white font-bold text-xs gap-1.5"><Plus size={15} /> Nova Oportunidade</Button>
                </div>

                <div className="grid grid-cols-7 gap-3.5 overflow-x-auto pb-4">
                  {STAGES.map((stg) => {
                    const stageLeads = leadsDisplayList.filter((l) => l.stage === stg.key);
                    return (
                      <div key={stg.key} className="space-y-3 min-w-[140px]">
                        <div className="flex items-center justify-between text-xs font-bold px-1">
                          <span className="text-slate-800 font-outfit">{stg.label}</span>
                          <span className="text-slate-400 font-extrabold">{stageLeads.length}</span>
                        </div>

                        <div className="space-y-2.5">
                          {stageLeads.map((item) => (
                            <div key={item.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs hover:shadow-md hover:bg-white hover:border-[#5B50E6]/50 transition-all group">
                              <div>
                                <h4 onClick={() => { setSelectedLeadId(item.id); setIsProfileModalOpen(true); }} className="font-bold text-xs text-slate-900 group-hover:text-[#5B50E6] cursor-pointer leading-snug">{item.name}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">{item.cityState || "São Paulo - SP"}</p>
                              </div>
                              <div className="text-[10px]">
                                <p className="font-bold text-slate-900">R$ {Number(item.value || 199).toFixed(2)}/mês</p>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                                <select value={item.stage} onChange={(e) => moveStageMutation.mutate({ leadId: item.id, stage: e.target.value })} className="h-6 text-[10px] px-1 bg-white border border-slate-200 rounded font-bold">
                                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                                {item.phone && (
                                  <a href={getWhatsAppLink(item.phone)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800"><MessageSquare size={13} /></a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── ABA 4: ATIVIDADES E FOLLOW-UPS ── */}
          {activeMenu === "atividades" && (
            <div className="space-y-4 max-w-4xl">
              <h2 className="text-lg font-black font-outfit text-slate-900">Atividades e Tarefas Agendadas</h2>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                {followUps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Nenhum follow-up pendente agendado no momento.</p>
                ) : (
                  followUps.map(({ followUp, leadName }: any) => (
                    <div key={followUp.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{followUp.title}</p>
                        <p className="text-[11px] text-slate-500">Lead: <strong>{leadName}</strong> — Data: {new Date(followUp.dueDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <Button onClick={() => completeFollowUpMutation.mutate({ followUpId: followUp.id })} size="sm" className="h-7 text-xs bg-emerald-600 text-white font-bold">Concluir</Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── ABA 5: PROPOSTAS E MATRÍCULAS ── */}
          {activeMenu === "propostas" && (
            <div className="space-y-4 max-w-4xl">
              <h2 className="text-lg font-black font-outfit text-slate-900">Propostas & Matrículas</h2>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <p className="text-xs text-slate-600">Selecione um lead no Kanban ou na Tabela para gerar proposta ou converter em Aluno diretamente no MusicPro.</p>
              </div>
            </div>
          )}

          {/* ── ABA 6: RELATÓRIOS ── */}
          {activeMenu === "relatorios" && (
            <div className="space-y-6">
              <h2 className="text-lg font-black font-outfit text-slate-900">Relatórios Comerciais</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-bold text-sm font-outfit text-slate-900">Conversão por Origem</h3>
                  {(reportsData?.origins || []).map((o: any) => (
                    <div key={o.source} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="font-bold text-slate-700">{o.source}</span>
                      <span className="font-black text-[#5B50E6]">{o.converted} / {o.total} ({o.conversionRate}%)</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-bold text-sm font-outfit text-slate-900">Demanda por Instrumentos</h3>
                  {(reportsData?.instruments || []).map((i: any) => (
                    <div key={i.instrument} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="font-bold text-slate-700">{i.instrument}</span>
                      <span className="font-black text-emerald-600">{i.converted} / {i.total} ({i.conversionRate}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: CADASTRAR OPORTUNIDADE ── */}
      <CreateLeadModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedLeadId && (
        <LeadProfileModal leadId={selectedLeadId} open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      )}
    </div>
  );
}

// ── COMPONENTE: MODAL CADASTRAR OPORTUNIDADE ──
function CreateLeadModal({ open, onClose }: any) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instrument, setInstrument] = useState("Violão");
  const [value, setValue] = useState("199");

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade cadastrada no CRM!");
      onClose();
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-slate-900">Cadastrar Nova Oportunidade</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return toast.error("Preencha o nome da escola ou interessado");
            createMutation.mutate({ name, phone, email, instrument, value: Number(value) });
          }}
          className="space-y-3 py-2"
        >
          <div className="space-y-1">
            <label className="font-bold text-slate-600">Nome da Escola / Lead *</label>
            <Input placeholder="Ex: Escola de Música Melodia" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Telefone / WhatsApp</label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">E-mail</label>
              <Input placeholder="contato@escola.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Instrumento / Curso</label>
              <Input value={instrument} onChange={(e) => setInstrument(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Valor Mensalidade (R$)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-9 text-xs bg-[#5B50E6] hover:bg-[#4A40D0] text-white font-bold">
              {createMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />} Cadastrar Oportunidade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: MODAL PERFIL DO LEAD ──
function LeadProfileModal({ leadId, open, onClose }: any) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.getLeadDetails.useQuery({ leadId });

  const convertMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: (res) => {
      toast.success(`🎉 Sucesso! Aluno "${res.student.name}" matriculado no MusicPro.`);
      onClose();
      utils.crm.listLeads.invalidate();
    },
  });

  if (!data?.lead) return null;
  const lead = data.lead;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-slate-900">{lead.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Instrumento</span><p className="font-bold text-slate-800">{lead.instrument || "Não informado"}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Valor Potencial</span><p className="font-bold text-emerald-600">R$ {Number(lead.value || 0).toFixed(2)}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Telefone</span><p className="font-bold text-slate-800">{lead.phone || "Não informado"}</p></div>
            <div><span className="text-[10px] text-slate-400 font-bold uppercase">Origem</span><p className="font-bold text-slate-800">{lead.source || "WhatsApp"}</p></div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {lead.phone && (
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs hover:bg-emerald-700"
              >
                <MessageSquare size={14} /> WhatsApp Direto
              </a>
            )}

            {lead.stage !== "matriculado" && (
              <Button
                onClick={() => convertMutation.mutate({ leadId: lead.id, monthlyFee: Number(lead.value || 199) })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
              >
                <UserCheck size={14} /> Converter em Aluno
              </Button>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button onClick={onClose} className="h-9 text-xs bg-slate-900 text-white font-bold">Fechar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
