import { useState } from "react";
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
  Rocket, Headphones, RefreshCcw, HeartPulse, DollarSign, Bell
} from "lucide-react";

// Paleta de Estágios do Pipeline Comercial (7 Estágios fiéis à imagem)
const STAGES = [
  { key: "novo", label: "Novo Lead", count: 12, dotColor: "bg-amber-400" },
  { key: "contato", label: "Contato", count: 18, dotColor: "bg-[#5B50E6]" },
  { key: "interessado", label: "Interessado", count: 21, dotColor: "bg-cyan-500" },
  { key: "demonstracao", label: "Demonstração", count: 12, dotColor: "bg-amber-500" },
  { key: "proposta", label: "Proposta", count: 8, dotColor: "bg-purple-500" },
  { key: "negociacao", label: "Negociação", count: 9, dotColor: "bg-indigo-500" },
  { key: "fechado", label: "Fechado", count: 6, dotColor: "bg-emerald-500" },
];

export default function LeadsApp() {
  const utils = trpc.useUtils();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("01/08/2025 - 12/08/2025");

  // State de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Consultas tRPC
  const { data: metrics } = trpc.crm.getDashboardMetrics.useQuery({ period: "30d" });
  const { data: leads = [] } = trpc.crm.listLeads.useQuery();
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });

  // Mock de Cards do Kanban fiéis à imagem de referência
  const mockKanbanData = [
    {
      stage: "novo",
      items: [
        { id: 101, name: "Escola Som & Tal", city: "Belo Horizonte - MG", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "13/08" },
        { id: 102, name: "Instituto Harmonia", city: "Curitiba - PR", plan: "Plano Essential", value: "R$ 149/mês", temp: "frio", tempDot: "bg-blue-400", date: "14/08" },
        { id: 103, name: "Escola Nota Certa", city: "Goiânia - GO", plan: "Plano Pro", value: "R$ 199/mês", temp: "frio", tempDot: "bg-blue-400", date: "15/08" },
      ],
    },
    {
      stage: "contato",
      items: [
        { id: 104, name: "Vivace Escola de Música", city: "São Paulo - SP", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "Hoje" },
        { id: 105, name: "Toque de Classe", city: "Campinas - SP", plan: "Plano Essential", value: "R$ 149/mês", temp: "morno", tempDot: "bg-amber-400", date: "13/08" },
        { id: 106, name: "Studio Musical", city: "Porto Alegre - RS", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "14/08" },
      ],
    },
    {
      stage: "interessado",
      items: [
        { id: 107, name: "Academia do Som", city: "Salvador - BA", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "Hoje" },
        { id: 108, name: "Escola Musicale", city: "Recife - PE", plan: "Plano Essential", value: "R$ 149/mês", temp: "morno", tempDot: "bg-amber-400", date: "13/08" },
        { id: 109, name: "Clube da Música", city: "Fortaleza - CE", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "15/08" },
      ],
    },
    {
      stage: "demonstracao",
      items: [
        { id: 110, name: "Center Music", city: "Rio de Janeiro - RJ", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "Hoje 16:00" },
        { id: 111, name: "Escola Adagio", city: "Brasília - DF", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "Amanhã 10:00" },
        { id: 112, name: "Som & Louvor", city: "João Pessoa - PB", plan: "Plano Essential", value: "R$ 149/mês", temp: "morno", tempDot: "bg-amber-400", date: "14/08 14:00" },
      ],
    },
    {
      stage: "proposta",
      items: [
        { id: 113, name: "Escola Allegro", city: "Niterói - RJ", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "Hoje" },
        { id: 114, name: "Musical Center", city: "Uberlândia - MG", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "13/08" },
        { id: 115, name: "Escola Melodia", city: "Maringá - PR", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "14/08" },
      ],
    },
    {
      stage: "negociacao",
      items: [
        { id: 116, name: "Escola Clave de Sol", city: "Florianópolis - SC", plan: "Plano Pro", value: "R$ 199/mês", temp: "quente", tempDot: "bg-rose-500", date: "Hoje" },
        { id: 117, name: "Compasso Escola", city: "Ribeirão Preto - SP", plan: "Plano Pro", value: "R$ 199/mês", temp: "morno", tempDot: "bg-amber-400", date: "13/08" },
        { id: 118, name: "Música em Foco", city: "Vitória - ES", plan: "Plano Essential", value: "R$ 149/mês", temp: "morno", tempDot: "bg-amber-400", date: "14/08" },
      ],
    },
    {
      stage: "fechado",
      items: [
        { id: 119, name: "Escola Nova Voz", city: "Bauru - SP", plan: "Plano Pro", value: "R$ 199/mês", temp: "ganho", tempDot: "bg-emerald-500", date: "08/08" },
        { id: 120, name: "Harmonia Escola", city: "Joinville - SC", plan: "Plano Essential", value: "R$ 149/mês", temp: "ganho", tempDot: "bg-emerald-500", date: "05/08" },
        { id: 121, name: "Domínio Musical", city: "Campo Grande - MS", plan: "Plano Pro", value: "R$ 199/mês", temp: "ganho", tempDot: "bg-emerald-500", date: "04/08" },
      ],
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans antialiased text-slate-800">
      {/* ── 1. MENU LATERAL ESQUERO (NAVBAR ESCURO #16162A) ── */}
      <aside className="w-64 bg-[#16162A] text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800">
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

        {/* NAVEGAÇÃO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 text-xs">
          {/* DASHBOARD ATIVO */}
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
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Users size={15} /> Leads
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Briefcase size={15} /> Oportunidades
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <Layers size={15} /> Pipeline
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <CalendarCheck size={15} /> Atividades
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <FileSpreadsheet size={15} /> Propostas
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
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
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <DollarSign size={15} /> Vendas
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <TrendingUp size={15} /> Conversão
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <BarChart2 size={15} /> MRR / Financeiro
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all">
              <PieChart size={15} /> Origem dos Leads
            </button>
          </div>
        </div>

        {/* CONFIGURAÇÕES E USER FOOTER */}
        <div className="p-3 border-t border-slate-800/80 space-y-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium text-xs transition-all">
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

      {/* ── 2. ÁREA DE CONTEÚDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* TOP HEADER DA PÁGINA */}
        <header className="sticky top-0 z-20 bg-[#F8FAFC]/90 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-slate-200/80">
          <div>
            <h1 className="text-2xl font-black font-outfit text-slate-900 tracking-tight">Dashboard Comercial</h1>
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

            {/* AÇÕES DE PERFIL SUPERIOR */}
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

        {/* CORPO DA PÁGINA COM GRIDS */}
        <main className="p-8 space-y-6">
          {/* ── 3. LINHA DE 7 CARDS KPI COMPACTOS (FIÉIS À IMAGEM) ── */}
          <div className="grid grid-cols-7 gap-3">
            {/* CARD 1: Leads ativos */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Users size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Leads ativos</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">127</p>
              <p className="text-[11px] font-bold text-emerald-600">+23 este mês</p>
            </div>

            {/* CARD 2: Demonstrações */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                  <PhoneCall size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Demonstrações</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">12</p>
              <p className="text-[11px] font-bold text-indigo-600">Agendadas</p>
            </div>

            {/* CARD 3: Propostas enviadas */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <FileText size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Propostas enviadas</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">8</p>
              <p className="text-[11px] font-bold text-amber-600">Aguardando retorno</p>
            </div>

            {/* CARD 4: Negociações */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <CheckCircle2 size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Negociações</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">9</p>
              <p className="text-[11px] font-bold text-purple-600">Em andamento</p>
            </div>

            {/* CARD 5: Escolas fechadas */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <Building2 size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Escolas fechadas</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">6</p>
              <p className="text-[11px] font-bold text-emerald-600">+2 este mês</p>
            </div>

            {/* CARD 6: MRR novo */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                  <DollarSign size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">MRR novo</span>
              </div>
              <p className="text-xl font-black font-outfit text-slate-900">R$ 1.194<span className="text-xs font-semibold text-slate-400">/mês</span></p>
              <p className="text-[11px] font-bold text-emerald-600">+R$ 398 este mês</p>
            </div>

            {/* CARD 7: Taxa de conversão */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Taxa de conversão</span>
              </div>
              <p className="text-2xl font-black font-outfit text-slate-900">8,4%</p>
              <p className="text-[11px] font-bold text-slate-500">Leads → Clientes</p>
            </div>
          </div>

          {/* ── 4. ÁREA CENTRAL: PIPELINE KANBAN (7 COLUNAS) + WIDGETS LATERAIS ── */}
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* KANBAN (9 COLUNAS DE GRADE) */}
            <div className="col-span-9 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base font-outfit text-slate-900">Pipeline Comercial</h3>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer">
                  <span>Kanban</span>
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* COLUNAS KANBAN */}
              <div className="grid grid-cols-7 gap-3.5 overflow-x-auto pb-2">
                {mockKanbanData.map((col) => {
                  const stageInfo = STAGES.find((s) => s.key === col.stage)!;
                  return (
                    <div key={col.stage} className="space-y-3 min-w-[140px]">
                      {/* HEADER DA COLUNA */}
                      <div className="flex items-center justify-between text-xs font-bold px-1">
                        <span className="text-slate-800 font-outfit">{stageInfo.label}</span>
                        <span className="text-slate-400 font-extrabold">{col.items.length}</span>
                      </div>

                      {/* CARDS */}
                      <div className="space-y-2.5">
                        {col.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedLeadId(item.id);
                              setIsProfileModalOpen(true);
                            }}
                            className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs hover:shadow-md hover:bg-white hover:border-[#5B50E6]/50 transition-all cursor-pointer group"
                          >
                            <div>
                              <h4 className="font-bold text-xs text-slate-900 group-hover:text-[#5B50E6] transition-colors leading-snug">
                                {item.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium">{item.city}</p>
                            </div>

                            <div className="text-[10px] space-y-0.5">
                              <p className="text-slate-500 font-semibold">{item.plan}</p>
                              <p className="font-bold text-slate-900">{item.value}</p>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${item.tempDot}`} />
                                <span className="capitalize text-slate-600">{item.temp}</span>
                              </div>
                              <span className="text-slate-400 font-medium flex items-center gap-0.5">
                                <Calendar size={10} /> {item.date}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-[#5B50E6] py-1 transition-colors">
                        + Ver mais
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* WIDGETS LATERAIS DIREITOS (3 COLUNAS DE GRADE) */}
            <div className="col-span-3 space-y-6">
              {/* WIDGET 1: PRÓXIMAS AÇÕES */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm font-outfit text-slate-900">Próximas Ações</h3>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                    <span>Hoje</span>
                    <ChevronDown size={12} />
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* ITEM 1 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">Follow-up: Escola Vivace</p>
                      <p className="text-[11px] text-slate-400 truncate">Retornar contato via WhatsApp</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <p className="font-bold text-slate-700">09:30</p>
                      <p className="text-slate-400">Walysson</p>
                    </div>
                  </div>

                  {/* ITEM 2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">Ligação: Center Music</p>
                      <p className="text-[11px] text-slate-400 truncate">Confirmar demonstração</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <p className="font-bold text-slate-700">11:00</p>
                      <p className="text-slate-400">Irmão</p>
                    </div>
                  </div>

                  {/* ITEM 3 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">Demonstração: Adagio</p>
                      <p className="text-[11px] text-slate-400 truncate">Apresentação do sistema</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <p className="font-bold text-slate-700">14:00</p>
                      <p className="text-slate-400">Walysson</p>
                    </div>
                  </div>

                  {/* ITEM 4 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">Proposta: Escola Allegro</p>
                      <p className="text-[11px] text-slate-400 truncate">Enviar proposta comercial</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <p className="font-bold text-slate-700">15:30</p>
                      <p className="text-slate-400">Irmão</p>
                    </div>
                  </div>

                  {/* ITEM 5 */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">Follow-up: Compasso</p>
                      <p className="text-[11px] text-slate-400 truncate">Negociação em andamento</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <p className="font-bold text-slate-700">16:30</p>
                      <p className="text-slate-400">Walysson</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <button className="text-[11px] font-bold text-[#5B50E6] hover:underline">Ver todas as atividades</button>
                </div>
              </div>

              {/* WIDGET 2: METAS DO MÊS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm font-outfit text-slate-900">Metas do Mês</h3>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                    <span>Agosto/2025</span>
                    <ChevronDown size={12} />
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* BARRA 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Novas escolas</span>
                      <span className="text-slate-500">6/10 <span className="text-[10px] font-normal">(60%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>

                  {/* BARRA 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Demonstrações</span>
                      <span className="text-slate-500">18/25 <span className="text-[10px] font-normal">(72%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "72%" }} />
                    </div>
                  </div>

                  {/* BARRA 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Propostas enviadas</span>
                      <span className="text-slate-500">12/20 <span className="text-[10px] font-normal">(60%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>

                  {/* BARRA 4 */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Escolas fechadas</span>
                      <span className="text-slate-500">6/10 <span className="text-[10px] font-normal">(60%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>

                  {/* BARRA 5 */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">MRR conquistado</span>
                      <span className="text-slate-900">R$ 1.194 / <span className="text-slate-400">R$ 2.000</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. PAINEL INFERIOR: 4 CARDS ANALÍTICOS (FIÉIS À IMAGEM) ── */}
          <div className="grid grid-cols-4 gap-6 items-stretch">
            {/* CARD 1: CONVERSÃO DO FUNIL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm font-outfit text-slate-900">Conversão do Funil</h3>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                  <span>Este mês</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              {/* FUNIL GRÁFICO TRAPEZOIDAL */}
              <div className="flex gap-4 items-center flex-1 py-2">
                <div className="w-24 space-y-1 flex flex-col items-center">
                  <div className="w-full h-6 bg-[#5B50E6] rounded-t-md" />
                  <div className="w-[85%] h-6 bg-cyan-500" />
                  <div className="w-[70%] h-6 bg-indigo-500" />
                  <div className="w-[55%] h-6 bg-amber-500" />
                  <div className="w-[40%] h-6 bg-purple-500" />
                  <div className="w-[28%] h-6 bg-rose-500" />
                  <div className="w-[18%] h-6 bg-emerald-500 rounded-b-md" />
                </div>

                <div className="flex-1 space-y-1.5 text-[11px] font-bold">
                  <div className="flex justify-between"><span><strong className="text-slate-900">127</strong> Leads recebidos</span></div>
                  <div className="flex justify-between"><span><strong className="text-slate-900">82</strong> Contatados <span className="text-[10px] text-slate-400">(64,6%)</span></span></div>
                  <div className="flex justify-between"><span><strong className="text-slate-900">47</strong> Interessados <span className="text-[10px] text-slate-400">(37,0%)</span></span></div>
                  <div className="flex justify-between"><span><strong className="text-slate-900">29</strong> Demonstrações <span className="text-[10px] text-slate-400">(22,8%)</span></span></div>
                  <div className="flex justify-between"><span><strong className="text-slate-900">18</strong> Propostas <span className="text-[10px] text-slate-400">(14,2%)</span></span></div>
                  <div className="flex justify-between"><span><strong className="text-slate-900">9</strong> Negociações <span className="text-[10px] text-slate-400">(7,1%)</span></span></div>
                  <div className="flex justify-between text-emerald-600"><span><strong className="text-emerald-700">6</strong> Clientes <span className="text-[10px] text-emerald-600/80">(4,7%)</span></span></div>
                </div>
              </div>
            </div>

            {/* CARD 2: ORIGEM DOS LEADS (GRÁFICO DONUT) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm font-outfit text-slate-900">Origem dos Leads</h3>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                  <span>Este mês</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="flex items-center gap-4 py-2">
                {/* SVG DONUT CHART */}
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path strokeDasharray="38, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#5B50E6" strokeWidth="4.5" />
                    <path strokeDasharray="24, 100" strokeDashoffset="-38" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F59E0B" strokeWidth="4.5" />
                    <path strokeDasharray="17, 100" strokeDashoffset="-62" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10B981" strokeWidth="4.5" />
                    <path strokeDasharray="12, 100" strokeDashoffset="-79" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3B82F6" strokeWidth="4.5" />
                    <path strokeDasharray="6, 100" strokeDashoffset="-91" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#EF4444" strokeWidth="4.5" />
                  </svg>
                  <div className="absolute flex flex-col items-center text-center">
                    <span className="font-extrabold text-slate-900 text-sm">127</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Leads</span>
                  </div>
                </div>

                {/* LEGENDA DA ORIGEM */}
                <div className="flex-1 space-y-1.5 text-[11px] font-bold">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#5B50E6]" />Instagram</span><span>38% <span className="text-[10px] text-slate-400 font-normal">(48)</span></span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Indicação</span><span>24% <span className="text-[10px] text-slate-400 font-normal">(30)</span></span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />WhatsApp</span><span>17% <span className="text-[10px] text-slate-400 font-normal">(21)</span></span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Google</span><span>12% <span className="text-[10px] text-slate-400 font-normal">(15)</span></span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" />Prospecção</span><span>6% <span className="text-[10px] text-slate-400 font-normal">(8)</span></span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />Outros</span><span>3% <span className="text-[10px] text-slate-400 font-normal">(5)</span></span></div>
                </div>
              </div>
            </div>

            {/* CARD 3: MRR - VISÃO GERAL (GRÁFICO DE LINHA) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm font-outfit text-slate-900">MRR - Visão Geral</h3>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                  <span>Este mês</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xl font-black font-outfit text-slate-900">R$ 1.194</p>
                <p className="text-[11px] font-bold text-slate-400">MRR novo este mês</p>
              </div>

              {/* SVG LINE CHART */}
              <div className="h-28 w-full pt-2">
                <svg className="w-full h-full" viewBox="0 0 200 80">
                  <path d="M 10 70 L 50 60 L 90 45 L 130 50 L 170 30 L 190 35" fill="none" stroke="#5B50E6" strokeWidth="2.5" />
                  <circle cx="10" cy="70" r="3" fill="#5B50E6" />
                  <circle cx="50" cy="60" r="3" fill="#5B50E6" />
                  <circle cx="90" cy="45" r="3" fill="#5B50E6" />
                  <circle cx="130" cy="50" r="3" fill="#5B50E6" />
                  <circle cx="170" cy="30" r="3" fill="#5B50E6" />
                  <circle cx="190" cy="35" r="3" fill="#5B50E6" />
                </svg>
                <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1">
                  <span>01/08</span>
                  <span>04/08</span>
                  <span>07/08</span>
                  <span>10/08</span>
                  <span>12/08</span>
                </div>
              </div>
            </div>

            {/* CARD 4: DESEMPENHO DA EQUIPE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm font-outfit text-slate-900">Desempenho da Equipe</h3>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer">
                  <span>Este mês</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* REP 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        WR
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Walysson Rodrigues</p>
                        <p className="text-[10px] text-slate-400">5 clientes</p>
                      </div>
                    </div>
                    <p className="font-black text-slate-900">R$ 996</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "83%" }} />
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold text-right">83% da meta</p>
                </div>

                {/* REP 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        MI
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Meu Irmão</p>
                        <p className="text-[10px] text-slate-400">3 clientes</p>
                      </div>
                    </div>
                    <p className="font-black text-slate-900">R$ 996</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5B50E6] rounded-full" style={{ width: "60%" }} />
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold text-right">60% da meta</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODAIS INTERATIVOS DE SUPORTE (NOVA OPORTUNIDADE & PERFIL) ── */}
      <CreateLeadModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedLeadId && (
        <LeadProfileModal
          leadId={selectedLeadId}
          open={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── COMPONENTE: MODAL CADASTRAR NOVA OPORTUNIDADE ──
function CreateLeadModal({ open, onClose }: any) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instrument, setInstrument] = useState("Violão");
  const [value, setValue] = useState("199");

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade cadastrada no Funil Comercial!");
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

// ── COMPONENTE: MODAL PERFIL COMPLETO ──
function LeadProfileModal({ leadId, open, onClose }: any) {
  const { data } = trpc.crm.getLeadDetails.useQuery({ leadId });

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

          <DialogFooter className="pt-2">
            <Button onClick={onClose} className="h-9 text-xs bg-slate-900 text-white font-bold">Fechar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
