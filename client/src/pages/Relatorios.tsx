import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, Calendar, Filter, UserPlus, TrendingUp, 
  ChevronDown, CheckCircle2, XCircle, BookOpen, 
  Guitar, Music2, Users, CreditCard, ArrowUpRight,
  DollarSign, Clock, LayoutGrid, FileText, Settings,
  ChevronRight, MinusCircle, RefreshCcw, Download,
  Target, BarChart as LucideBarChart, Search, Bell, Share2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { VencimentosReportModal } from "@/components/modals/VencimentosReportModal";

const EmptyChart = () => (
  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
     <LucideBarChart size={48} className="mb-4 opacity-50" />
     <p className="text-xs font-bold uppercase tracking-widest text-center">Sem dados suficientes<br/>para o gráfico</p>
  </div>
);

// ─── Stat Card Component ───────────────────────────────────────────────────
function ReportMetricCard({ 
  title, value, trend, color, sparkData, icon: Icon, onClick
}: { 
  title: string; value: string | number; trend: string; color: string; sparkData?: any[]; icon: any; onClick?: () => void;
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-card rounded-[1.5rem] lg:rounded-[2rem] p-6 border border-border shadow-sm hover:shadow-md transition-all group cursor-default",
        onClick && "cursor-pointer hover:border-primary/40 active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6", color.replace('text-', 'bg-').replace('-600', '-50').replace('-500', '-50'))}>
          <Icon size={18} className={color} />
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-0.5 text-[10px] font-black", isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isPositive ? <ArrowUpRight size={10} /> : <TrendingUp size={10} className="rotate-180" />}
            {trend}
          </div>
          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">vs mês anterior</span>
        </div>
      </div>

      {sparkData && sparkData.length > 0 && (
        <div className="h-12 mt-6 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={color.includes('blue') ? '#2563EB' : color.includes('emerald') ? '#10B981' : color.includes('orange') ? '#F59E0B' : '#7C3AED'} 
                strokeWidth={2.5} 
                fill="transparent"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Category Chip Component ───────────────────────────────────────────────
function CategoryChip({ 
  label, icon: Icon, active, onClick 
}: { 
  label: string; icon: any; active?: boolean; onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-6 py-3.5 rounded-2xl transition-all whitespace-nowrap group shrink-0",
        active 
          ? "bg-[#2563EB] text-white shadow-xl shadow-blue-500/20" 
          : "bg-card text-muted-foreground hover:bg-muted border border-border"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
        active ? "bg-card/20" : "bg-muted group-hover:bg-card"
      )}>
        <Icon size={16} className={active ? "text-white" : "text-muted-foreground"} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Relatorios() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("Visão Geral");
  const [isVencimentosModalOpen, setIsVencimentosModalOpen] = useState(false);
  
  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: allLessons = [] } = trpc.lessons.list.useQuery();

  // Data processing
  const sparkReceita = useMemo(() => monthlyData?.map(d => ({ value: d.receita })) || [], [monthlyData]);
  const sparkAulas = useMemo(() => monthlyData?.map(d => ({ value: d.aulas })) || [], [monthlyData]);
  const sparkAlunos = useMemo(() => monthlyData?.map(d => ({ value: d.alunos })) || [], [monthlyData]);

  const lessonStatusData = useMemo(() => {
    const counts: Record<string, number> = { concluida: 0, agendada: 0, cancelada: 0, remarcada: 0, falta: 0 };
    allLessons.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    const total = allLessons.length || 1;
    return [
      { name: "Concluídas", value: counts.concluida, color: "#10B981", pct: Math.round((counts.concluida / total) * 100) },
      { name: "Agendadas", value: counts.agendada, color: "#2563EB", pct: Math.round((counts.agendada / total) * 100) },
      { name: "Canceladas", value: counts.cancelada, color: "#EF4444", pct: Math.round((counts.cancelada / total) * 100) },
      { name: "Remarcadas", value: counts.remarcada, color: "#7C3AED", pct: Math.round((counts.remarcada / total) * 100) },
      { name: "Faltas", value: counts.falta, color: "#F59E0B", pct: Math.round((counts.falta / total) * 100) },
    ].sort((a, b) => b.value - a.value);
  }, [allLessons]);

  const revenueCategoryData = [
    { name: "Mensalidades", value: (stats?.monthlyRevenue || 0) * 0.65, color: "#2563EB", pct: 65 },
    { name: "Aulas Avulsas", value: (stats?.monthlyRevenue || 0) * 0.20, color: "#10B981", pct: 20 },
    { name: "Matrículas", value: (stats?.monthlyRevenue || 0) * 0.10, color: "#F59E0B", pct: 10 },
    { name: "Outros", value: (stats?.monthlyRevenue || 0) * 0.05, color: "#7C3AED", pct: 5 },
  ];

  // Trend calculations
  const trends = useMemo(() => {
    if (!monthlyData || monthlyData.length < 2) return { receita: "+0%", aulas: "+0%", alunos: "+0%" };
    
    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];
    
    const calc = (curr: number, prev: number) => {
      if (!prev || prev === 0) return curr > 0 ? "+100%" : "0%";
      const diff = ((curr - prev) / prev) * 100;
      return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
    };

    return {
      receita: calc(current.receita, previous.receita),
      aulas: calc(current.aulas, previous.aulas),
      alunos: calc(current.alunos, previous.alunos),
    };
  }, [monthlyData]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 lg:pb-12">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">Relatórios</h1>
          <p className="text-sm font-bold text-muted-foreground">
            {activeCategory === "Visão Geral" ? "Analise e acompanhe todos os dados da sua escola" : `Detalhamento de ${activeCategory}`}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card px-4 py-3 rounded-2xl border border-border shadow-sm">
            <Calendar size={16} className="text-blue-600" />
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-tight">01/05/2025 - 31/05/2025</span>
          </div>
          <Button onClick={() => toast.info("Filtros em desenvolvimento")} className="h-12 px-6 rounded-2xl bg-card border-border text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground gap-2 shadow-sm hover:bg-muted">
             <Filter size={16} className="text-blue-600" /> Filtros
          </Button>
          <Button onClick={() => toast.info("Exportação em desenvolvimento")} className="hidden md:flex h-12 px-6 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.15em] gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700">
             <Download size={16} /> Exportar
          </Button>
        </div>
      </div>

      {/* ── Category Chips ── */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0 py-2 scroll-smooth">
        <CategoryChip label="Visão Geral" icon={LayoutGrid} active={activeCategory === "Visão Geral"} onClick={() => setActiveCategory("Visão Geral")} />
        <CategoryChip label="Financeiro" icon={DollarSign} active={activeCategory === "Financeiro"} onClick={() => setActiveCategory("Financeiro")} />
        <CategoryChip label="Alunos" icon={Users} active={activeCategory === "Alunos"} onClick={() => setActiveCategory("Alunos")} />
        <CategoryChip label="Aulas" icon={Calendar} active={activeCategory === "Aulas"} onClick={() => setActiveCategory("Aulas")} />
        <CategoryChip label="Mensalidades" icon={CreditCard} active={activeCategory === "Mensalidades"} onClick={() => setActiveCategory("Mensalidades")} />
        <CategoryChip label="Instrumentos" icon={Guitar} active={activeCategory === "Instrumentos"} onClick={() => setActiveCategory("Instrumentos")} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* ── Dynamic Content Based on Category ── */}
          {activeCategory === "Visão Geral" && (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportMetricCard title="Receita Total" value={statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue || 0)} trend={trends.receita} color="text-blue-600" sparkData={sparkReceita} icon={DollarSign} />
                <ReportMetricCard title="Aulas Realizadas" value={statsLoading ? "..." : (stats?.weekLessons || 0) * 4} trend={trends.aulas} color="text-emerald-500" sparkData={sparkAulas} icon={CheckCircle2} />
                <ReportMetricCard title="Novos Alunos" value={statsLoading ? "..." : stats?.totalStudents || 0} trend={trends.alunos} color="text-indigo-600" sparkData={sparkAlunos} icon={UserPlus} />
                <ReportMetricCard title="Taxa de Ocupação" value={statsLoading ? "..." : `${stats?.completionRate || 0}%`} trend="+ 5%" color="text-orange-500" sparkData={sparkAulas} icon={Target} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                   <h3 className="text-base font-black text-foreground tracking-tight">Evolução da Receita</h3>
                   <div className="h-[340px] w-full">
                     {(!monthlyData || monthlyData.length === 0) ? <EmptyChart /> : (
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={monthlyData}>
                           <defs><linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                           <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} />
                           <Tooltip contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                           <Area type="monotone" dataKey="receita" name="Receita" stroke="#2563EB" strokeWidth={4} fill="url(#chartBlue)" dot={{ r: 5, strokeWidth: 3, fill: 'white' }} />
                         </AreaChart>
                       </ResponsiveContainer>
                     )}
                   </div>
                </div>
                <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8 flex flex-col justify-between">
                   <h3 className="text-base font-black text-foreground tracking-tight">Resumo Financeiro</h3>
                   <div className="space-y-6 flex-1 flex flex-col justify-center">
                      {[
                        { label: "Receitas", value: stats?.monthlyRevenue || 0, color: "text-emerald-500", trend: trends.receita },
                        { label: "Despesas", value: (stats?.monthlyRevenue || 0) * 0.25, color: "text-rose-500", trend: "+ 4%" },
                        { label: "Lucro Líquido", value: (stats?.monthlyRevenue || 0) * 0.75, color: "text-blue-600", trend: "+ 22%" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between pb-5 border-b border-border last:border-0 last:pb-0">
                          <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest block">{item.label}</span>
                          <span className={cn("text-base font-black tracking-tight", item.color)}>{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                   </div>
                   <div className="pt-6 border-t border-border flex items-center justify-between">
                      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest block">Margem de Lucro</span>
                      <span className="text-lg font-black text-foreground">81%</span>
                   </div>
                </div>
              </div>
            </>
          )}

          {activeCategory === "Financeiro" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportMetricCard title="Receita Bruta" value={formatCurrency(stats?.monthlyRevenue || 0)} trend={trends.receita} color="text-blue-600" sparkData={sparkReceita} icon={DollarSign} />
                <ReportMetricCard title="Ticket Médio" value={formatCurrency((stats?.monthlyRevenue || 0) / (stats?.totalStudents || 1))} trend="+2%" color="text-emerald-500" icon={TrendingUp} />
                <ReportMetricCard title="Previsão Receita" value={formatCurrency((stats?.monthlyRevenue || 0) * 1.05)} trend="+5%" color="text-indigo-600" icon={TrendingUp} onClick={() => setIsVencimentosModalOpen(true)} />
                <ReportMetricCard title="Inadimplência" value={formatCurrency((stats?.monthlyRevenue || 0) * 0.12)} trend="-5%" color="text-rose-500" icon={XCircle} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                    <h3 className="text-base font-black text-foreground tracking-tight">Receita por Categoria</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                       <div className="h-56 relative">
                          {(!stats?.monthlyRevenue || stats.monthlyRevenue === 0) ? <EmptyChart /> : (
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart><Pie data={revenueCategoryData} innerRadius={65} outerRadius={90} paddingAngle={8} dataKey="value">{revenueCategoryData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
                            </ResponsiveContainer>
                          )}
                       </div>
                       <div className="space-y-4">
                          {revenueCategoryData.map((item, i) => (
                             <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.name}</span>
                                <span className="text-[11px] font-black text-foreground">{formatCurrency(item.value)}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                    <h3 className="text-base font-black text-foreground tracking-tight">Projeção Próximos Meses</h3>
                    <div className="h-64 w-full">
                       {(!monthlyData || monthlyData.length === 0) ? <EmptyChart /> : (
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData.slice(-6)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><Tooltip /><Bar dataKey="receita" fill="#2563EB" radius={[8, 8, 0, 0]} /></BarChart>
                         </ResponsiveContainer>
                       )}
                    </div>
                 </div>
              </div>
            </>
          )}

          {activeCategory === "Alunos" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportMetricCard title="Total Alunos" value={stats?.totalStudents || 0} trend={trends.alunos} color="text-blue-600" sparkData={sparkAlunos} icon={Users} />
                <ReportMetricCard title="Alunos Ativos" value={stats?.activeStudents || 0} trend="+3%" color="text-emerald-500" icon={CheckCircle2} />
                <ReportMetricCard title="Novas Matrículas" value={Math.round((stats?.totalStudents || 0) * 0.15)} trend="+10%" color="text-indigo-600" icon={UserPlus} />
                <ReportMetricCard title="Taxa de Churn" value="1.2%" trend="-0.5%" color="text-rose-500" icon={MinusCircle} />
              </div>

              <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                 <h3 className="text-base font-black text-foreground tracking-tight">Crescimento da Base de Alunos</h3>
                 <div className="h-[300px] w-full">
                    {(!monthlyData || monthlyData.length === 0) ? <EmptyChart /> : (
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="alunos" name="Alunos" stroke="#10B981" fill="#10B98120" strokeWidth={3} />
                         </AreaChart>
                      </ResponsiveContainer>
                    )}
                 </div>
              </div>
            </>
          )}

          {activeCategory === "Aulas" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportMetricCard title="Aulas Realizadas" value={(stats?.weekLessons || 0) * 4} trend={trends.aulas} color="text-blue-600" sparkData={sparkAulas} icon={Calendar} />
                <ReportMetricCard title="Aulas Agendadas" value={(stats?.weekLessons || 0) * 2} trend="+12%" color="text-indigo-600" icon={Clock} />
                <ReportMetricCard title="Taxa Presença" value="94%" trend="+2%" color="text-emerald-500" icon={CheckCircle2} />
                <ReportMetricCard title="Cancelamentos" value="4" trend="-15%" color="text-rose-500" icon={XCircle} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                    <h3 className="text-base font-black text-foreground tracking-tight">Aulas por Status</h3>
                    <div className="h-64 w-full">
                       {(!allLessons || allLessons.length === 0) ? <EmptyChart /> : (
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={lessonStatusData} innerRadius={60} outerRadius={80} dataKey="value">{lessonStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
                         </ResponsiveContainer>
                       )}
                    </div>
                 </div>
                 <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
                    <h3 className="text-base font-black text-foreground tracking-tight">Frequência Semanal</h3>
                    <div className="h-64 w-full">
                       {(!monthlyData || monthlyData.length === 0) ? <EmptyChart /> : (
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData.slice(-6)}><XAxis dataKey="month" /><Tooltip /><Bar dataKey="aulas" fill="#7C3AED" radius={[8, 8, 0, 0]} /></BarChart>
                         </ResponsiveContainer>
                       )}
                    </div>
                 </div>
              </div>
            </>
          )}

          {/* Table Section (Visible in all categories, but could be filtered) */}
          <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm overflow-hidden">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h3 className="text-base font-black text-foreground tracking-tight">Histórico de Relatórios</h3>
                <Button variant="ghost" onClick={() => toast.info("Histórico completo em desenvolvimento")} className="text-[10px] font-black text-blue-600 uppercase tracking-widest gap-2">Ver todos <ChevronRight size={14} /></Button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full">
                   <thead>
                      <tr className="text-left border-b border-border">
                         <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4">Relatório</th>
                         <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4">Período</th>
                         <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4">Status</th>
                         <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 text-right">Ações</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {[
                        { name: "Financeiro Completo", period: "Maio 2025", status: "Gerado", color: "text-emerald-500 bg-emerald-50", icon: DollarSign },
                        { name: "Desempenho de Alunos", period: "Maio 2025", status: "Gerado", color: "text-blue-500 bg-blue-50", icon: Users },
                        { name: "Carga Horária Professores", period: "Abril 2025", status: "Arquivado", color: "text-muted-foreground bg-muted", icon: Clock },
                      ].map((report, i) => (
                        <tr key={i} className="group hover:bg-muted/50 transition-colors">
                           <td className="py-5 px-4"><div className="flex items-center gap-3"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", report.color)}><report.icon size={16} /></div><span className="text-xs font-black text-foreground">{report.name}</span></div></td>
                           <td className="py-5 px-4 text-xs font-black text-muted-foreground">{report.period}</td>
                           <td className="py-5 px-4"><span className="px-3 py-1 rounded-full bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground">{report.status}</span></td>
                           <td className="py-5 px-4 text-right"><div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => toast.info("Download em desenvolvimento")} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-blue-600"><Download size={14} /></button></div></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button onClick={() => toast.info("Exportação em desenvolvimento")} className="fixed bottom-8 right-6 lg:hidden w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl z-50"><Download size={24} /></button>

      <VencimentosReportModal 
        open={isVencimentosModalOpen} 
        onClose={() => setIsVencimentosModalOpen(false)}
        month={new Date().getMonth() + 1}
        year={new Date().getFullYear()}
      />
    </div>
  );
}



