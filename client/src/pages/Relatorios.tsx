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

// ─── Stat Card Component ───────────────────────────────────────────────────
function ReportMetricCard({ 
  title, value, trend, color, sparkData, icon: Icon 
}: { 
  title: string; value: string | number; trend: string; color: string; sparkData?: any[]; icon: any 
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div className="bg-white rounded-[1.5rem] lg:rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-default">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6", color.replace('text-', 'bg-').replace('-600', '-50').replace('-500', '-50'))}>
          <Icon size={18} className={color} />
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-0.5 text-[10px] font-black", isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isPositive ? <ArrowUpRight size={10} /> : <TrendingUp size={10} className="rotate-180" />}
            {trend}
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">vs mês anterior</span>
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
          : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-100"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
        active ? "bg-white/20" : "bg-slate-100 group-hover:bg-white"
      )}>
        <Icon size={16} className={active ? "text-white" : "text-slate-400"} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Relatorios() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("Visão Geral");
  
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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 lg:pb-12">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-sm font-bold text-slate-400">
            Analise e acompanhe todos os dados da sua escola de música
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <Calendar size={16} className="text-blue-600" />
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">01/05/2025 - 31/05/2025</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Comparar com</span>
             <span className="text-[11px] font-black text-slate-600 uppercase">Mês anterior</span>
             <ChevronDown size={14} className="text-slate-300" />
          </div>
          <Button className="h-12 px-6 rounded-2xl bg-white border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 gap-2 shadow-sm hover:bg-slate-50">
             <Filter size={16} className="text-blue-600" /> Filtros
          </Button>
          <Button className="hidden md:flex h-12 px-6 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.15em] gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700">
             <Download size={16} /> Exportar
          </Button>
        </div>
      </div>

      {/* ── Category Chips (Horizontal Scroll) ── */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0 py-2 scroll-smooth">
        <CategoryChip label="Visão Geral" icon={LayoutGrid} active={activeCategory === "Visão Geral"} onClick={() => setActiveCategory("Visão Geral")} />
        <CategoryChip label="Financeiro" icon={DollarSign} active={activeCategory === "Financeiro"} onClick={() => setActiveCategory("Financeiro")} />
        <CategoryChip label="Alunos" icon={Users} active={activeCategory === "Alunos"} onClick={() => setActiveCategory("Alunos")} />
        <CategoryChip label="Aulas" icon={Calendar} active={activeCategory === "Aulas"} onClick={() => setActiveCategory("Aulas")} />
        <CategoryChip label="Mensalidades" icon={CreditCard} active={activeCategory === "Mensalidades"} onClick={() => setActiveCategory("Mensalidades")} />
        <CategoryChip label="Professores" icon={Users} active={activeCategory === "Professores"} onClick={() => setActiveCategory("Professores")} />
        <CategoryChip label="Instrumentos" icon={Guitar} active={activeCategory === "Instrumentos"} onClick={() => setActiveCategory("Instrumentos")} />
        <CategoryChip label="Mais" icon={LayoutGrid} onClick={() => {}} />
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard 
          title="Receita Total" 
          value={statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue || 0)} 
          trend="+ 18%" 
          color="text-blue-600" 
          sparkData={sparkReceita} 
          icon={DollarSign}
        />
        <ReportMetricCard 
          title="Aulas Realizadas" 
          value={statsLoading ? "..." : (stats?.weekLessons || 0) * 4} // Estimativa mensal aproximada
          trend="+ 12%" 
          color="text-emerald-500" 
          sparkData={sparkAulas} 
          icon={CheckCircle2}
        />
        <ReportMetricCard 
          title="Novos Alunos" 
          value={statsLoading ? "..." : stats?.totalStudents || 0} 
          trend="+ 27%" 
          color="text-indigo-600" 
          sparkData={sparkAlunos} 
          icon={UserPlus}
        />
        <ReportMetricCard 
          title="Taxa de Ocupação" 
          value={statsLoading ? "..." : `${stats?.completionRate || 0}%`} 
          trend="+ 8%" 
          color="text-orange-500" 
          sparkData={sparkAulas} 
          icon={Target}
        />
      </div>

      {/* ── Main Chart & Financial Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Evolution */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 tracking-tight">Evolução da Receita</h3>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diário</span>
                 <ChevronDown size={14} className="text-slate-400" />
              </div>
           </div>
           
           <div className="h-[340px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={monthlyData || []}>
                 <defs>
                   <linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                     <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} />
                 <Tooltip 
                   contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                   itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}
                 />
                 <Area type="monotone" dataKey="receita" name="Receita" stroke="#2563EB" strokeWidth={4} fill="url(#chartBlue)" dot={{ r: 5, strokeWidth: 3, fill: 'white' }} activeDot={{ r: 7, strokeWidth: 0 }} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Financial Summary Widget */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8 flex flex-col justify-between">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 tracking-tight">Resumo Financeiro</h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                 Este mês <ChevronDown size={12} />
              </div>
           </div>
           
           <div className="space-y-6 flex-1 flex flex-col justify-center">
              {[
                { label: "Receitas", value: stats?.monthlyRevenue || 0, color: "text-emerald-500", trend: "+ 18%" },
                { label: "Despesas", value: (stats?.monthlyRevenue || 0) * 0.25, color: "text-rose-500", trend: "+ 4%" },
                { label: "Lucro Líquido", value: (stats?.monthlyRevenue || 0) * 0.75, color: "text-blue-600", trend: "+ 22%" },
                { label: "Inadimplência", value: (stats?.monthlyRevenue || 0) * 0.12, color: "text-orange-500", trend: "- 5%" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between pb-5 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">{item.label}</span>
                    <span className={cn("text-[9px] font-black uppercase", item.trend.startsWith('+') ? "text-emerald-500" : "text-rose-500")}>{item.trend}</span>
                  </div>
                  <span className={cn("text-base font-black tracking-tight", item.color)}>{formatCurrency(item.value)}</span>
                </div>
              ))}
           </div>

           <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">Margem de Lucro</span>
                 <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: '81%' }} />
                 </div>
              </div>
              <span className="text-lg font-black text-slate-800">81%</span>
           </div>
        </div>
      </div>

      {/* ── Category Breakdown Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Revenue by Category (Pie Chart) */}
         <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <h3 className="text-base font-black text-slate-800 tracking-tight">Receita por Categoria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               <div className="h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={revenueCategoryData}
                           innerRadius={65}
                           outerRadius={90}
                           paddingAngle={8}
                           dataKey="value"
                        >
                           {revenueCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xl font-black text-slate-800 tracking-tighter">{formatCurrency(stats?.monthlyRevenue || 0).split(',')[0]}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Geral</span>
                  </div>
               </div>
               <div className="space-y-4">
                  {revenueCategoryData.map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-100/50 transition-colors group cursor-default">
                        <div className="flex items-center gap-3">
                           <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                        </div>
                        <div className="text-right">
                           <p className="text-[11px] font-black text-slate-800">{formatCurrency(item.value)}</p>
                           <p className="text-[9px] font-black text-blue-600">{item.pct}%</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Most Accessed Reports List */}
         <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black text-slate-800 tracking-tight">Relatórios mais acessados</h3>
               <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Ver todos</button>
            </div>
            <div className="space-y-4">
               {[
                 { title: "Relatório Financeiro", desc: "Receitas, despesas e fluxo de caixa", icon: CreditCard, color: "bg-blue-50 text-blue-600" },
                 { title: "Relatório de Alunos", desc: "Novos alunos, ativos, cancelados e inativos", icon: Users, color: "bg-emerald-50 text-emerald-600" },
                 { title: "Relatório de Aulas", desc: "Aulas realizadas, agendadas e canceladas", icon: Calendar, color: "bg-purple-50 text-purple-600" },
                 { title: "Relatório de Mensalidades", desc: "Mensalidades pagas, em aberto e inadimplência", icon: DollarSign, color: "bg-rose-50 text-rose-600" },
                 { title: "Desempenho de Professores", desc: "Carga horária e avaliações", icon: UserPlus, color: "bg-indigo-50 text-indigo-600" },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                       <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", item.color)}>
                          <item.icon size={20} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-800">{item.title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">{item.desc}</p>
                       </div>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                       <ChevronRight size={16} />
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* ── Footer Stats Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Revenue Projection (Bar Chart) */}
         <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black text-slate-800 tracking-tight">Projeção de Receita</h3>
               <div className="bg-blue-600 px-4 py-2 rounded-2xl shadow-lg shadow-blue-500/20 text-right">
                  <p className="text-[8px] font-black text-white/70 uppercase tracking-widest">Dezembro</p>
                  <p className="text-xs font-black text-white">{formatCurrency((stats?.monthlyRevenue || 0) * 1.25)}</p>
               </div>
            </div>
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData?.slice(-6) || []}>
                     <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor="#2563EB" />
                           <stop offset="100%" stopColor="#7C3AED" />
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} dy={10} />
                     <Tooltip cursor={{ fill: '#F8FAFC' }} />
                     <Bar dataKey="receita" fill="url(#barGrad)" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Lessons by Status (Pie Chart) */}
         <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <h3 className="text-base font-black text-slate-800 tracking-tight">Aulas por Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               <div className="h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={lessonStatusData}
                           innerRadius={65}
                           outerRadius={90}
                           paddingAngle={8}
                           dataKey="value"
                        >
                           {lessonStatusData.map((entry, index) => (
                              <Cell key={`cell-status-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xl font-black text-slate-800 tracking-tighter">{allLessons.length}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Aulas</span>
                  </div>
               </div>
               <div className="space-y-2">
                  {lessonStatusData.map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-black text-slate-400">{item.pct}%</span>
                           <span className="text-[11px] font-black text-slate-800">{item.value}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* ── Table Section ── */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm overflow-hidden">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="text-base font-black text-slate-800 tracking-tight">Últimos Relatórios Gerados</h3>
            <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest gap-2">
               Ver todos <ChevronRight size={14} />
            </Button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="text-left border-b border-slate-50">
                     <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Relatório</th>
                     <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Descrição</th>
                     <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Período</th>
                     <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Gerado em</th>
                     <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {[
                    { name: "Financeiro", desc: "Resumo financeiro completo", period: "05/2025", date: "06/05/2025 10:30", icon: DollarSign, color: "text-emerald-500 bg-emerald-50" },
                    { name: "Alunos", desc: "Análise de alunos e matrículas", period: "05/2025", date: "06/05/2025 09:15", icon: Users, color: "text-blue-500 bg-blue-50" },
                    { name: "Aulas", desc: "Aulas realizadas e agendadas", period: "05/2025", date: "05/05/2025 22:45", icon: Calendar, color: "text-orange-500 bg-orange-50" },
                    { name: "Mensalidades", desc: "Mensalidades e inadimplência", period: "05/2025", date: "05/05/2025 18:20", icon: DollarSign, color: "text-rose-500 bg-rose-50" },
                  ].map((report, i) => (
                    <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                       <td className="py-5 px-4">
                          <div className="flex items-center gap-3">
                             <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", report.color)}>
                                <report.icon size={16} />
                             </div>
                             <span className="text-xs font-black text-slate-800">{report.name}</span>
                          </div>
                       </td>
                       <td className="py-5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-tight">{report.desc}</td>
                       <td className="py-5 px-4 text-xs font-black text-slate-600">{report.period}</td>
                       <td className="py-5 px-4 text-[10px] font-bold text-slate-400">{report.date}</td>
                       <td className="py-5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"><FileText size={16} /></button>
                             <button className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"><Download size={16} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Floating Mobile Export Button */}
      <button className="fixed bottom-8 right-6 lg:hidden w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl shadow-blue-500/40 active:scale-95 transition-transform z-50">
         <Download size={24} />
      </button>

    </div>
  );
}
