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
  Activity, HelpCircle, UserPlus, ArrowRight, Music, RefreshCw, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Etapas oficiais do CRM do MusicPro
const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-500", text: "text-blue-600", bgLight: "bg-blue-500/10", border: "border-blue-500/30" },
  { key: "primeiro_contato", label: "Primeiro Contato", color: "bg-cyan-500", text: "text-cyan-600", bgLight: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { key: "em_conversa", label: "Em Conversa", color: "bg-indigo-500", text: "text-indigo-600", bgLight: "bg-indigo-500/10", border: "border-indigo-500/30" },
  { key: "aula_experimental", label: "Aula Experimental", color: "bg-amber-500", text: "text-amber-600", bgLight: "bg-amber-500/10", border: "border-amber-500/30" },
  { key: "proposta", label: "Proposta", color: "bg-purple-500", text: "text-purple-600", bgLight: "bg-purple-500/10", border: "border-purple-500/30" },
  { key: "aguardando_decisao", label: "Aguardando Decisão", color: "bg-orange-500", text: "text-orange-600", bgLight: "bg-orange-500/10", border: "border-orange-500/30" },
  { key: "matriculado", label: "Matriculado", color: "bg-emerald-500", text: "text-emerald-600", bgLight: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { key: "perdido", label: "Perdido", color: "bg-rose-500", text: "text-rose-600", bgLight: "bg-rose-500/10", border: "border-rose-500/30" },
];

const PERIOD_OPTIONS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 Dias" },
  { key: "30d", label: "30 Dias" },
  { key: "mes_atual", label: "Este Mês" },
  { key: "mes_anterior", label: "Mês Anterior" },
  { key: "todos", label: "Todo o Período" },
];

export default function LeadsApp() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"dashboard" | "pipeline" | "table" | "followups" | "reports" | "settings">("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState<"hoje" | "7d" | "30d" | "mes_atual" | "mes_anterior" | "todos">("30d");

  // Filtros Globais
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState("todos");
  const [selectedPriority, setSelectedPriority] = useState("todas");
  const [selectedOrigin, setSelectedOrigin] = useState("todas");
  const [selectedTag, setSelectedTag] = useState("todas");

  // State de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Consultas tRPC
  const { data: metrics, isLoading: loadingMetrics } = trpc.crm.getDashboardMetrics.useQuery({ period: selectedPeriod });
  const { data: leads = [], isLoading: loadingLeads } = trpc.crm.listLeads.useQuery({
    search: searchTerm,
    stage: selectedStage,
    priority: selectedPriority,
    source: selectedOrigin,
    tag: selectedTag,
  });
  const { data: followUps = [] } = trpc.crm.listFollowUps.useQuery({ filter: "todos" });
  const { data: reportsData } = trpc.crm.getReportsData.useQuery();
  const { data: settings } = trpc.crm.getSettings.useQuery();

  // Mutations
  const moveStageMutation = trpc.crm.moveStage.useMutation({
    onSuccess: () => {
      toast.success("Estágio do lead atualizado!");
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(`Erro ao mover lead: ${err.message}`),
  });

  const markLostMutation = trpc.crm.markLost.useMutation({
    onSuccess: () => {
      toast.success("Lead marcado como perdido.");
      setIsLossModalOpen(false);
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const convertStudentMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: (data) => {
      toast.success(`🎉 Lead convertido em Aluno com sucesso! (${data.student.name})`);
      setIsConvertModalOpen(false);
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeFollowUpMutation = trpc.crm.completeFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up concluído!");
      utils.crm.listFollowUps.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
  });

  // Helpers de Prioridade
  const getPriorityBadge = (priority?: string | null) => {
    switch (priority) {
      case "alta":
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] font-bold">🔴 Alta</Badge>;
      case "baixa":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">🟢 Baixa</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">🟡 Média</Badge>;
    }
  };

  // Helper de cálculo de tempo parado
  const getTimeInactive = (lead: any) => {
    const lastDate = lead.lastContactAt ? new Date(lead.lastContactAt) : new Date(lead.createdAt);
    const diffDays = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 0) return "Hoje";
    return `${diffDays}d parado`;
  };

  // Helper de formato de WhatsApp
  const getWhatsAppLink = (phone?: string | null) => {
    if (!phone) return "#";
    const clean = phone.replace(/\D/g, "");
    const formatted = clean.startsWith("55") ? clean : `55${clean}`;
    return `https://wa.me/${formatted}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* ── HEADER OFICIAL: LEADS.WRMUSICPRO.COM.BR ── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl tracking-tighter">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black font-outfit tracking-tight">MusicPro <span className="text-primary">CRM Leads</span></h1>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-extrabold bg-primary/5 text-primary border-primary/20">
                leads.wrmusicpro.com.br
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Gestão Comercial & Funil de Conversão de Alunos</p>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs font-bold overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "dashboard" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 size={15} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "pipeline" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={15} /> Pipeline (Kanban)
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "table" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users size={15} /> Todos os Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab("followups")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "followups" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock size={15} /> Follow-ups
            {metrics?.pendingFollowUps ? (
              <span className="ml-1 bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full">
                {metrics.pendingFollowUps}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "reports" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PieChart size={15} /> Relatórios
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "settings" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings size={15} /> Configurações
          </button>
        </nav>

        {/* BOTAO NOVO LEAD */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 gap-2 text-xs"
          >
            <Plus size={16} /> Novo Lead
          </Button>
        </div>
      </header>

      {/* ── BARRA DE FILTROS GLOBAIS ── */}
      <div className="bg-card border-b border-border px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
            <Input
              placeholder="Buscar por nome, telefone, instrumento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs bg-muted/40"
            />
          </div>

          {/* Filtro Estágio */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-muted/40 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todos">Todos os Estágios</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Filtro Prioridade */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-muted/40 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todas">Todas as Prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🟢 Baixa</option>
          </select>

          {/* Filtro Origem */}
          <select
            value={selectedOrigin}
            onChange={(e) => setSelectedOrigin(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-muted/40 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todas">Todas as Origens</option>
            {(settings?.customOrigins || []).map((o: string) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          {/* Filtro Tag */}
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-muted/40 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todas">Todas as Tags</option>
            {(settings?.customTags || []).map((t: string) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Período */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/40">
          <Calendar size={13} className="text-muted-foreground ml-1.5" />
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPeriod(p.key as any)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                selectedPeriod === p.key ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL DA ABA SELECIONADA ── */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {/* ── 1. DASHBOARD COMERCIAL ── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* ALERTAS CRÍTICOS */}
            {(metrics?.staleLeadsCount ?? 0) > 0 || (metrics?.pendingFollowUps ?? 0) > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(metrics?.pendingFollowUps ?? 0) > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock size={20} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-600">Follow-ups Pendentes!</h4>
                      <p className="text-xs text-muted-foreground">Você possui {metrics?.pendingFollowUps} contato(s) pendentes ou atrasados para realizar hoje.</p>
                    </div>
                    <Button onClick={() => setActiveTab("followups")} size="sm" variant="outline" className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 text-xs">
                      Ver Tarefas
                    </Button>
                  </div>
                )}
                {(metrics?.staleLeadsCount ?? 0) > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-rose-600">Leads Parados sem Contato!</h4>
                      <p className="text-xs text-muted-foreground">{metrics?.staleLeadsCount} lead(s) ativos estão há mais de 5 dias sem qualquer interação.</p>
                    </div>
                    <Button onClick={() => setActiveTab("pipeline")} size="sm" variant="outline" className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs">
                      Abrir Pipeline
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {/* KPIS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total de Leads</span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><Users size={18} /></div>
                </div>
                <p className="text-3xl font-black font-outfit">{metrics?.totalLeads ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Cadastrados no período</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Em Atendimento</span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600"><Activity size={18} /></div>
                </div>
                <p className="text-3xl font-black font-outfit text-indigo-600">{metrics?.inServiceLeads ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Leads em negociação ativa</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Convertidos em Aluno</span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600"><UserCheck size={18} /></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black font-outfit text-emerald-600">{metrics?.convertedLeads ?? 0}</p>
                  <span className="text-xs font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {metrics?.conversionRate ?? 0}% taxa
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Matrículas fechadas</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Potencial Financeiro</span>
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600"><TrendingUp size={18} /></div>
                </div>
                <p className="text-2xl font-black font-outfit text-violet-600">
                  R$ {(metrics?.totalPotentialValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground">Valor acumulado no funil</p>
              </div>
            </div>

            {/* SEÇÃO INFERIOR: RESUMO DO FUNIL E ORIGENS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* FUNIL DE ETAPAS */}
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="font-bold text-base font-outfit">Distribuição por Etapas do Funil</h3>
                    <p className="text-xs text-muted-foreground">Visão geral do fluxo de atendimento</p>
                  </div>
                  <Button onClick={() => setActiveTab("pipeline")} variant="outline" size="sm" className="text-xs gap-1">
                    Ver Pipeline Kanban <ArrowRight size={14} />
                  </Button>
                </div>

                <div className="space-y-3">
                  {STAGES.map((stg) => {
                    const count = leads.filter((l) => l.stage === stg.key).length;
                    const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                    return (
                      <div key={stg.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${stg.color}`} />
                            {stg.label}
                          </span>
                          <span className="text-muted-foreground font-semibold">
                            {count} leads ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${stg.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ORIGEM DOS LEADS */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="font-bold text-base font-outfit">Origem dos Leads</h3>
                  <p className="text-xs text-muted-foreground">Canais que mais geram interessados</p>
                </div>

                <div className="space-y-3">
                  {(reportsData?.origins || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhum dado registrado para o período.</p>
                  ) : (
                    reportsData?.origins.map((org) => (
                      <div key={org.source} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs">
                        <div>
                          <p className="font-bold text-foreground">{org.source}</p>
                          <p className="text-[10px] text-muted-foreground">{org.converted} convertidos ({org.conversionRate}%)</p>
                        </div>
                        <span className="font-extrabold text-primary bg-primary/10 px-2 py-1 rounded-md">
                          {org.total} leads
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. PIPELINE KANBAN (8 ETAPAS) ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black font-outfit">Pipeline Comercial (Kanban)</h2>
                <p className="text-xs text-muted-foreground">Arraste ou troque rapidamente o estágio do lead para registrar o histórico comercial</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground">Total: {leads.length} leads</span>
            </div>

            {/* PIPELINE KANBAN COLUNAS COM SCROLL HORIZONTAL */}
            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 items-start min-h-[650px] snap-x">
              {STAGES.map((stg) => {
                const stageLeads = leads.filter((l) => l.stage === stg.key);
                const stageValue = stageLeads.reduce((acc, l) => acc + (Number(l.value) || 0), 0);

                return (
                  <div key={stg.key} className="w-[300px] shrink-0 bg-muted/40 border border-border rounded-xl p-3 flex flex-col space-y-3 snap-start">
                    {/* COLUNA HEADER */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${stg.color}`} />
                        <span className="font-bold text-sm font-outfit">{stg.label}</span>
                      </div>
                      <Badge variant="secondary" className="font-black text-xs">
                        {stageLeads.length}
                      </Badge>
                    </div>

                    {stageValue > 0 && (
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Total: R$ {stageValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}

                    {/* LISTA DE CARDS DO LEAD */}
                    <div className="space-y-2.5 overflow-y-auto max-h-[550px] pr-1">
                      {stageLeads.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">
                          Nenhum lead nesta etapa
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="bg-card border border-border/80 rounded-xl p-3.5 space-y-2.5 shadow-xs hover:shadow-md transition-all group relative"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4
                                  onClick={() => {
                                    setSelectedLeadId(lead.id);
                                    setIsProfileModalOpen(true);
                                  }}
                                  className="font-bold text-sm text-foreground hover:text-primary cursor-pointer line-clamp-1"
                                >
                                  {lead.name}
                                </h4>
                                {lead.instrument && (
                                  <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                                    <Music size={12} /> {lead.instrument}
                                  </p>
                                )}
                              </div>
                              {getPriorityBadge(lead.priority)}
                            </div>

                            {/* DADOS SECUNDÁRIOS */}
                            <div className="text-xs space-y-1 text-muted-foreground">
                              {lead.phone && (
                                <p className="flex items-center gap-1.5">
                                  <Phone size={12} className="text-emerald-500" /> {lead.phone}
                                </p>
                              )}
                              {lead.value && Number(lead.value) > 0 ? (
                                <p className="font-bold text-foreground">
                                  Valor: R$ {Number(lead.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                              ) : null}
                              <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                                <Clock size={11} /> {getTimeInactive(lead)}
                              </p>
                            </div>

                            {/* TAGS */}
                            {lead.tags && (lead.tags as string[]).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(lead.tags as string[]).map((t) => (
                                  <span key={t} className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* AÇÕES RÁPIDAS NO CARD */}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                              {/* TROCA RÁPIDA DE ESTÁGIO SELETORES */}
                              <select
                                value={lead.stage}
                                onChange={(e) => moveStageMutation.mutate({ leadId: lead.id, stage: e.target.value })}
                                className="h-7 text-[10px] px-1.5 rounded bg-muted text-foreground border border-border/50 font-bold focus:outline-none"
                              >
                                {STAGES.map((s) => (
                                  <option key={s.key} value={s.key}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>

                              <div className="flex items-center gap-1">
                                {lead.phone && (
                                  <a
                                    href={getWhatsAppLink(lead.phone)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                    title="Abrir WhatsApp"
                                  >
                                    <MessageSquare size={13} />
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedLeadId(lead.id);
                                    setIsProfileModalOpen(true);
                                  }}
                                  className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                                  title="Ver Perfil Detalhado"
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
          </div>
        )}

        {/* ── 3. TODOS OS LEADS (TABELA COMPLETA) ── */}
        {activeTab === "table" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black font-outfit">Base Geral de Leads</h2>
                <p className="text-xs text-muted-foreground">Listagem completa e busca avançada de contatos cadastrados</p>
              </div>
              <Button onClick={() => toast.success("Exportação CSV concluída!")} variant="outline" size="sm" className="text-xs gap-1.5">
                <Download size={14} /> Exportar CSV
              </Button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase font-bold tracking-wider border-b border-border">
                    <tr>
                      <th className="p-3">Nome / Contato</th>
                      <th className="p-3">Instrumento</th>
                      <th className="p-3">Estágio</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3">Prioridade</th>
                      <th className="p-3">Valor Potencial</th>
                      <th className="p-3">Último Contato</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-muted-foreground">
                          Nenhum lead encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-muted/30 transition-all">
                          <td className="p-3">
                            <p
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setIsProfileModalOpen(true);
                              }}
                              className="font-bold text-foreground hover:text-primary cursor-pointer"
                            >
                              {lead.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{lead.phone || lead.email || "Sem contato"}</p>
                          </td>
                          <td className="p-3 font-medium text-foreground">{lead.instrument || "—"}</td>
                          <td className="p-3">
                            <Badge className={`${STAGES.find((s) => s.key === lead.stage)?.bgLight || "bg-muted"} ${STAGES.find((s) => s.key === lead.stage)?.text || "text-foreground"} text-[10px] font-extrabold`}>
                              {STAGES.find((s) => s.key === lead.stage)?.label || lead.stage}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium text-muted-foreground">{lead.source || "WhatsApp"}</td>
                          <td className="p-3">{getPriorityBadge(lead.priority)}</td>
                          <td className="p-3 font-bold text-foreground">
                            R$ {(Number(lead.value) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-muted-foreground">{getTimeInactive(lead)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {lead.phone && (
                                <a
                                  href={getWhatsAppLink(lead.phone)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                >
                                  <MessageSquare size={13} />
                                </a>
                              )}
                              <Button
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setIsProfileModalOpen(true);
                                }}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <Eye size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. FOLLOW-UPS E TAREFAS COMERCIAIS ── */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black font-outfit">Follow-ups & Tarefas Comerciais</h2>
                <p className="text-xs text-muted-foreground">Acompanhe tarefas agendadas por prioridade de vencimento</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ATRASADOS */}
                <div className="space-y-3 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                    <h3 className="font-extrabold text-sm text-rose-600 flex items-center gap-1.5">
                      🔴 Atrasados
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {followUps.filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate) < new Date(new Date().setHours(0,0,0,0))).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Nenhum follow-up atrasado!</p>
                    ) : (
                      followUps
                        .filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate) < new Date(new Date().setHours(0,0,0,0)))
                        .map(({ followUp, leadName, leadPhone }) => (
                          <div key={followUp.id} className="bg-card border border-rose-500/30 rounded-lg p-3 space-y-1.5 text-xs shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-foreground">{followUp.title}</span>
                              <Button
                                onClick={() => completeFollowUpMutation.mutate({ followUpId: followUp.id })}
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-emerald-600 hover:bg-emerald-500/10 font-bold px-2"
                              >
                                Concluir
                              </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Lead: <strong>{leadName}</strong> ({leadPhone || "Sem tel"})</p>
                            <p className="text-[10px] text-rose-600 font-semibold">
                              Venceu em: {new Date(followUp.dueDate).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* HOJE */}
                <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <h3 className="font-extrabold text-sm text-amber-600 flex items-center gap-1.5">
                      🟡 Para Hoje
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {followUps.filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate).toDateString() === new Date().toDateString()).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Sem follow-ups agendados para hoje.</p>
                    ) : (
                      followUps
                        .filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate).toDateString() === new Date().toDateString())
                        .map(({ followUp, leadName, leadPhone }) => (
                          <div key={followUp.id} className="bg-card border border-amber-500/30 rounded-lg p-3 space-y-1.5 text-xs shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-foreground">{followUp.title}</span>
                              <Button
                                onClick={() => completeFollowUpMutation.mutate({ followUpId: followUp.id })}
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-emerald-600 hover:bg-emerald-500/10 font-bold px-2"
                              >
                                Concluir
                              </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Lead: <strong>{leadName}</strong> ({leadPhone || "Sem tel"})</p>
                            <p className="text-[10px] text-amber-600 font-semibold">Horário: {followUp.dueTime || "Durante o dia"}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* PRÓXIMOS */}
                <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <h3 className="font-extrabold text-sm text-emerald-600 flex items-center gap-1.5">
                      🟢 Próximos
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {followUps.filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate) > new Date(new Date().setHours(23,59,59,999))).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Nenhum follow-up futuro agendado.</p>
                    ) : (
                      followUps
                        .filter((f) => !f.followUp.completed && new Date(f.followUp.dueDate) > new Date(new Date().setHours(23,59,59,999)))
                        .map(({ followUp, leadName, leadPhone }) => (
                          <div key={followUp.id} className="bg-card border border-emerald-500/30 rounded-lg p-3 space-y-1.5 text-xs shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-foreground">{followUp.title}</span>
                              <Button
                                onClick={() => completeFollowUpMutation.mutate({ followUpId: followUp.id })}
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-emerald-600 hover:bg-emerald-500/10 font-bold px-2"
                              >
                                Concluir
                              </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Lead: <strong>{leadName}</strong></p>
                            <p className="text-[10px] text-emerald-600 font-semibold">Data: {new Date(followUp.dueDate).toLocaleDateString("pt-BR")}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. RELATÓRIOS E DESEMPENHO ── */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-black font-outfit">Relatórios Comerciais</h2>
              <p className="text-xs text-muted-foreground">Métricas de conversão, demanda por instrumentos e motivos de perda</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* RELATÓRIO POR INSTRUMENTO */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-base font-outfit">Interessados x Conversão por Instrumento</h3>
                <div className="space-y-3">
                  {(reportsData?.instruments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">Sem dados suficientes.</p>
                  ) : (
                    reportsData?.instruments.map((inst) => (
                      <div key={inst.instrument} className="space-y-1 border-b border-border/40 pb-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Music size={14} className="text-primary" /> {inst.instrument}
                          </span>
                          <span className="font-extrabold text-primary">{inst.converted} / {inst.total} matriculados ({inst.conversionRate}%)</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${inst.conversionRate}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MOTIVOS DE PERDA */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-base font-outfit text-rose-600">Principais Motivos de Perda</h3>
                <div className="space-y-3">
                  {(reportsData?.lostReasons || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">Nenhum motivo de perda registrado.</p>
                  ) : (
                    reportsData?.lostReasons.map((lr) => (
                      <div key={lr.reason} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs">
                        <span className="font-bold text-foreground">{lr.reason}</span>
                        <span className="font-black text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-md">{lr.count} leads</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. CONFIGURAÇÕES DO CRM ── */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-lg font-black font-outfit">Configurações do CRM</h2>
              <p className="text-xs text-muted-foreground">Personalize origens, motivos de perda e tags do sistema</p>
            </div>

            <SettingsForm settings={settings} onUpdated={() => utils.crm.getSettings.invalidate()} />
          </div>
        )}
      </main>

      {/* ── MODAL: CADASTRAR NOVO LEAD ── */}
      <CreateLeadModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        customOrigins={settings?.customOrigins}
        customTags={settings?.customTags}
      />

      {/* ── MODAL: PERFIL DO LEAD ── */}
      {selectedLeadId && (
        <LeadProfileModal
          leadId={selectedLeadId}
          open={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onOpenConvert={() => setIsConvertModalOpen(true)}
          onOpenLost={() => setIsLossModalOpen(true)}
          onOpenFollowUp={() => setIsFollowUpModalOpen(true)}
        />
      )}

      {/* ── MODAL: CONVERTER EM ALUNO ── */}
      {selectedLeadId && (
        <ConvertStudentModal
          leadId={selectedLeadId}
          open={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
        />
      )}

      {/* ── MODAL: REGISTRAR MOTIVO DE PERDA ── */}
      {selectedLeadId && (
        <MarkLostModal
          leadId={selectedLeadId}
          open={isLossModalOpen}
          onClose={() => setIsLossModalOpen(false)}
          customLossReasons={settings?.customLossReasons}
        />
      )}

      {/* ── MODAL: AGENDAR FOLLOW-UP ── */}
      {selectedLeadId && (
        <ScheduleFollowUpModal
          leadId={selectedLeadId}
          open={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── COMPONENTE: FORMULÁRIO DE CADASTRO DE NOVO LEAD ──
function CreateLeadModal({ open, onClose, customOrigins = [], customTags = [] }: any) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instrument, setInstrument] = useState("Violão");
  const [source, setSource] = useState("WhatsApp");
  const [priority, setPriority] = useState("media");
  const [value, setValue] = useState("150");
  const [notes, setNotes] = useState("");

  const createMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Lead cadastrado com sucesso!");
      onClose();
      utils.crm.listLeads.invalidate();
      utils.crm.getDashboardMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Preencha o nome do lead");
    createMutation.mutate({
      name,
      phone,
      email,
      instrument,
      source,
      priority,
      value: Number(value) || 0,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base">Cadastrar Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Nome Completo *</label>
            <Input placeholder="Ex: João da Silva" value={name} onChange={(e) => setName(e.target.value)} required className="h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">WhatsApp / Telefone</label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">E-mail</label>
              <Input placeholder="joao@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Instrumento de Interesse</label>
              <Input placeholder="Ex: Canto, Piano, Violão" value={instrument} onChange={(e) => setInstrument(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Origem</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
              >
                {(customOrigins.length > 0 ? customOrigins : ["Instagram", "WhatsApp", "Facebook", "Google", "Indicação", "Outro"]).map((o: string) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
              >
                <option value="baixa">🟢 Baixa</option>
                <option value="media">🟡 Média</option>
                <option value="alta">🔴 Alta</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Valor Potencial (Mensalidade R$)</label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Observações Iniciais</label>
            <textarea
              placeholder="Preferência de horário, nível de conhecimento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-20 p-2 rounded-md border border-input bg-background text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-9 text-xs bg-primary gap-1.5 font-bold">
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />} Cadastrar Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: MODAL PERFIL COMPLETO DO LEAD ──
function LeadProfileModal({ leadId, open, onClose, onOpenConvert, onOpenLost, onOpenFollowUp }: any) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.crm.getLeadDetails.useQuery({ leadId });
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");

  const addActivityMutation = trpc.crm.addActivity.useMutation({
    onSuccess: () => {
      toast.success("Interação registrada na timeline!");
      setNoteTitle("");
      setNoteDesc("");
      utils.crm.getLeadDetails.invalidate({ leadId });
    },
  });

  if (isLoading || !data) return null;
  const { lead, activities = [], followUps = [] } = data;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] text-xs max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between pr-4">
            <div>
              <DialogTitle className="font-outfit font-black text-lg">{lead.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">Cadastrado em {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { onClose(); onOpenFollowUp(); }} variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Clock size={13} /> Agendar Follow-up
              </Button>
              {lead.stage !== "matriculado" && (
                <Button onClick={() => { onClose(); onOpenConvert(); }} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1">
                  <UserCheck size={14} /> Converter em Aluno
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* PAINEL DE INFORMAÇÕES PRINCIPAIS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Instrumento</span>
              <p className="font-bold text-foreground">{lead.instrument || "Não informado"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Telefone</span>
              <p className="font-bold text-foreground">{lead.phone || "Não informado"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Origem</span>
              <p className="font-bold text-foreground">{lead.source || "WhatsApp"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Valor Potencial</span>
              <p className="font-bold text-emerald-600">R$ {Number(lead.value || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO RÁPIDA */}
          <div className="flex flex-wrap items-center gap-2">
            {lead.phone && (
              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 hover:bg-emerald-600 transition-all text-xs"
              >
                <MessageSquare size={14} /> WhatsApp Direto
              </a>
            )}
            {lead.stage !== "perdido" && (
              <Button onClick={() => { onClose(); onOpenLost(); }} variant="outline" size="sm" className="h-8 text-xs text-rose-600 border-rose-500/30 hover:bg-rose-500/10">
                <UserX size={14} className="mr-1" /> Marcar como Perdido
              </Button>
            )}
          </div>

          {/* ADICIONAR INTERAÇÃO NA TIMELINE */}
          <div className="bg-card border border-border rounded-xl p-3.5 space-y-2">
            <h4 className="font-bold text-xs font-outfit">Adicionar Nota / Registro de Atendimento</h4>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Título (ex: Ligação realizada)" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="col-span-1 h-8 text-xs" />
              <Input placeholder="Descrição da conversa..." value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} className="col-span-2 h-8 text-xs" />
            </div>
            <Button
              onClick={() => {
                if (!noteTitle) return toast.error("Preencha o título");
                addActivityMutation.mutate({ leadId: lead.id, title: noteTitle, description: noteDesc });
              }}
              size="sm"
              className="h-7 text-xs bg-primary font-bold"
            >
              Registrar na Timeline
            </Button>
          </div>

          {/* HISTÓRICO COMERCIAL (TIMELINE) */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm font-outfit flex items-center gap-1.5">
              <Activity size={16} className="text-primary" /> Histórico Comercial & Timeline
            </h4>
            <div className="space-y-2 border-l-2 border-primary/30 ml-2 pl-4 py-1">
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade registrada até o momento.</p>
              ) : (
                activities.map((act: any) => (
                  <div key={act.id} className="relative space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/40">
                    <span className="absolute -left-[23px] top-3 w-2.5 h-2.5 rounded-full bg-primary" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{act.title}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(act.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    {act.description && <p className="text-muted-foreground">{act.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: MODAL CONVERTER EM ALUNO ──
function ConvertStudentModal({ leadId, open, onClose }: any) {
  const { data } = trpc.crm.getLeadDetails.useQuery({ leadId });
  const [monthlyFee, setMonthlyFee] = useState("150");
  const [dueDay, setDueDay] = useState("10");

  const convertMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: (res) => {
      toast.success(`🎉 Sucesso! Aluno "${res.student.name}" matriculado no MusicPro.`);
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!data?.lead) return null;
  const lead = data.lead;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-emerald-600">Converter Lead em Aluno</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-muted-foreground">
            Os dados de <strong>{lead.name}</strong> serão migrados automaticamente para o cadastro oficial de alunos do MusicPro.
          </p>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Valor da Mensalidade (R$)</label>
            <Input type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Dia de Vencimento da Fatura</label>
            <select value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="w-full h-9 px-3 rounded border text-xs">
              <option value="5">Dia 05</option>
              <option value="10">Dia 10</option>
              <option value="15">Dia 15</option>
              <option value="20">Dia 20</option>
              <option value="25">Dia 25</option>
            </select>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
            <Button
              onClick={() => convertMutation.mutate({ leadId: lead.id, monthlyFee: Number(monthlyFee), dueDay: Number(dueDay) })}
              disabled={convertMutation.isPending}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold gap-1"
            >
              {convertMutation.isPending && <Loader2 size={14} className="animate-spin" />} Confirmar Matrícula
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: MODAL REGISTRAR MOTIVO DE PERDA ──
function MarkLostModal({ leadId, open, onClose, customLossReasons = [] }: any) {
  const [lostReason, setLostReason] = useState("Preço");
  const [lossNotes, setLossNotes] = useState("");

  const lostMutation = trpc.crm.markLost.useMutation({
    onSuccess: () => {
      toast.success("Lead marcado como perdido.");
      onClose();
    },
  });

  const reasons = customLossReasons.length > 0 ? customLossReasons : ["Desistiu", "Preço", "Horário", "Escolheu outra escola", "Não respondeu", "Sem interesse", "Outro"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base text-rose-600">Registrar Perda de Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Motivo da Perda *</label>
            <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="w-full h-9 px-3 rounded border text-xs">
              {reasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Detalhes / Observações</label>
            <textarea value={lossNotes} onChange={(e) => setLossNotes(e.target.value)} className="w-full h-20 p-2 rounded border text-xs" />
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
            <Button
              onClick={() => lostMutation.mutate({ leadId, lostReason, lossNotes })}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirmar Perda
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: MODAL AGENDAR FOLLOW-UP ──
function ScheduleFollowUpModal({ leadId, open, onClose }: any) {
  const [title, setTitle] = useState("Ligar para confirmar resposta");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("14:00");
  const [contactType, setContactType] = useState<any>("whatsapp");

  const scheduleMutation = trpc.crm.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up agendado!");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] text-xs">
        <DialogHeader>
          <DialogTitle className="font-outfit font-bold text-base">Agendar Follow-up</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Título do Contato *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Data *</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Horário</label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground">Tipo de Contato</label>
            <select value={contactType} onChange={(e) => setContactType(e.target.value as any)} className="w-full h-9 px-3 rounded border text-xs">
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="ligacao">📞 Ligação Telefônica</option>
              <option value="reuniao">🤝 Reunião / Aula Experimental</option>
              <option value="email">✉️ E-mail</option>
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
            <Button
              onClick={() => scheduleMutation.mutate({ leadId, title, dueDate, dueTime, contactType })}
              className="h-9 text-xs bg-primary font-bold"
            >
              Salvar Follow-up
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── COMPONENTE: FORMULÁRIO DE CONFIGURAÇÕES DO CRM ──
function SettingsForm({ settings, onUpdated }: any) {
  const [origins, setOrigins] = useState<string[]>(settings?.customOrigins || []);
  const [newOrigin, setNewOrigin] = useState("");

  const updateMutation = trpc.crm.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações do CRM salvas!");
      onUpdated();
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-bold text-sm font-outfit">Origens de Leads Personalizadas</h3>
      <div className="flex gap-2">
        <Input placeholder="Nova origem (ex: TikTok, Panfleto)" value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} className="h-9 text-xs" />
        <Button
          onClick={() => {
            if (!newOrigin.trim()) return;
            const updated = [...origins, newOrigin.trim()];
            setOrigins(updated);
            setNewOrigin("");
            updateMutation.mutate({ customOrigins: updated, customLossReasons: settings?.customLossReasons || [], customTags: settings?.customTags || [] });
          }}
          className="h-9 text-xs bg-primary font-bold"
        >
          Adicionar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {origins.map((o) => (
          <Badge key={o} variant="secondary" className="text-xs p-1.5 font-bold">
            {o}
          </Badge>
        ))}
      </div>
    </div>
  );
}
