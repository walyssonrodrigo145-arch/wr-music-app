import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, Filter, UserPlus, TrendingUp, ChevronDown, CheckCircle2, XCircle, BookOpen, Guitar, Music2, Users } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Sector
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl p-3 text-xs min-w-[120px]"
      >
        {label && <p className="font-black text-foreground mb-2 text-[10px] uppercase tracking-wider opacity-60 border-b border-border/30 pb-1">{label}</p>}
        <div className="space-y-1.5">
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-medium text-muted-foreground">{p.name}</span>
              </div>
              <span className="font-black text-foreground">
                {p.name === "Receita"
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)
                  : p.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
  return null;
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export default function Relatorios() {
  const now = new Date();
  const [filterMode, setFilterMode] = useState<"all" | "monthly">("all");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: dayData } = trpc.dashboard.lessonsByDay.useQuery();
  const { data: expStats, isLoading: isExpLoading } = trpc.dashboard.experimentalStats.useQuery(
    filterMode === "monthly" ? { month: selectedMonth, year: selectedYear } : undefined
  );
  const { data: instruments = [], isLoading: isInstrumentsLoading } = trpc.instruments.list.useQuery();

  const instrumentDistribution = useMemo(() => {
    return instruments.map(inst => ({
      name: inst.name,
      value: Number(inst.studentCount),
      color: inst.color || "#6366f1"
    })).filter(d => d.value > 0);
  }, [instruments]);

  const topTwoComparison = useMemo(() => {
    if (instruments.length < 2) return null;
    const sorted = [...instruments].sort((a, b) => Number(b.studentCount) - Number(a.studentCount));
    const first = sorted[0];
    const second = sorted[1];
    
    const total = Number(first.studentCount) + Number(second.studentCount);
    return {
      first: { ...first, pct: total > 0 ? (Number(first.studentCount) / total) * 100 : 0 },
      second: { ...second, pct: total > 0 ? (Number(second.studentCount) / total) * 100 : 0 },
      totalStudents: total
    };
  }, [instruments]);

  const revenueData = (monthlyData ?? []).map(d => ({
    month: d.month,
    Receita: d.receita,
  }));

  const pieData = expStats ? [
    { name: "Convertidos", value: expStats.converted, color: "oklch(0.65 0.2 150)" }, // Emerald
    { name: "Não Convertidos", value: expStats.notConverted, color: "oklch(0.7 0.2 60)" }, // Amber/Orange
  ] : [];

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const [activeExpIndex, setActiveExpIndex] = useState<number | null>(null);
  const [activeInstIndex, setActiveInstIndex] = useState<number | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-[1400px]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-pink-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Relatórios</h2>
            <p className="text-xs text-muted-foreground">Análises e estatísticas detalhadas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
           <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="h-10 px-4 bg-card border border-border rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-muted transition-all"
              >
                <Filter size={14} className="text-primary" />
                {filterMode === "all" ? "Todo o Período" : `${months[selectedMonth-1]} / ${selectedYear}`}
                <ChevronDown size={14} className={cn("transition-transform", isFilterOpen && "rotate-180")} />
              </button>
              
              {isFilterOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in duration-200">
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => { setFilterMode("all"); setIsFilterOpen(false); }}
                      className={cn(
                        "w-full h-10 rounded-xl text-xs font-bold transition-all",
                        filterMode === "all" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"
                      )}
                    >
                      Todo o Período
                    </button>
                    <button 
                      onClick={() => setFilterMode("monthly")}
                      className={cn(
                        "w-full h-10 rounded-xl text-xs font-bold transition-all",
                        filterMode === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"
                      )}
                    >
                      Filtrar por Mês
                    </button>
                  </div>

                  {filterMode === "monthly" && (
                    <div className="space-y-3 pt-2 border-t border-border">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted-foreground/60 px-1">Mês</label>
                          <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full h-10 rounded-xl bg-muted/50 border-none text-xs font-bold"
                          >
                             {months.map((m, i) => (
                               <option key={m} value={i + 1}>{m}</option>
                             ))}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted-foreground/60 px-1">Ano</label>
                          <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full h-10 rounded-xl bg-muted/50 border-none text-xs font-bold"
                          >
                             {years.map(y => (
                               <option key={y} value={y}>{y}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                  )}
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aulas Experimentais (DESTAQUE) */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
           <div className="p-6 flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus size={16} className="text-yellow-500" />
                  <h3 className="text-sm font-bold text-foreground">Aulas Experimentais</h3>
                </div>
                <p className="text-xs text-muted-foreground">Conversão de novos alunos</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Total Dadas</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground">{expStats?.total ?? 0}</span>
                      <BookOpen size={14} className="text-primary/40" />
                    </div>
                 </div>
                 <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Conversão</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-2xl font-black text-primary">{expStats?.conversionRate ?? 0}%</span>
                       <TrendingUp size={14} className="text-primary/40" />
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex items-center justify-between text-xs p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                    <div className="flex items-center gap-2 font-bold text-emerald-600">
                       <CheckCircle2 size={14} />
                       <span>Convertidos</span>
                    </div>
                    <span className="font-black text-emerald-700">{expStats?.converted ?? 0}</span>
                 </div>
                 <div className="flex items-center justify-between text-xs p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <div className="flex items-center gap-2 font-bold text-amber-600">
                       <XCircle size={14} />
                       <span>Não Convertidos</span>
                    </div>
                    <span className="font-black text-amber-700">{expStats?.notConverted ?? 0}</span>
                 </div>
              </div>
           </div>

           <div className="relative w-full md:w-48 h-64 md:h-auto bg-muted/10 flex items-center justify-center p-4 border-t md:border-t-0 md:border-l border-border/50">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    activeIndex={activeExpIndex ?? undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveExpIndex(index)}
                    onMouseLeave={() => setActiveExpIndex(null)}
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-xs font-black text-foreground">{expStats?.conversionRate ?? 0}%</span>
                 <span className="text-[8px] font-bold text-muted-foreground uppercase">Meta</span>
              </div>
           </div>
        </motion.div>

        {/* Análise por Instrumento */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
           <div className="p-6 flex-1 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Music2 size={16} className="text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">Análise por Instrumento</h3>
                </div>
                <p className="text-xs text-muted-foreground">Comparativo de alunos matriculados</p>
              </div>

              {topTwoComparison ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs font-bold px-1">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {topTwoComparison.first.name}
                      </div>
                      <div className="flex items-center gap-2 text-rose-500">
                        {topTwoComparison.second.name}
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                      </div>
                    </div>
                    
                    <div className="h-5 w-full bg-muted/30 rounded-full overflow-hidden flex shadow-inner border border-border/50">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000 ease-out flex items-center justify-center text-[8px] font-black text-white px-2"
                        style={{ width: `${topTwoComparison.first.pct}%` }}
                      >
                         {Math.round(topTwoComparison.first.pct)}%
                      </div>
                      <div 
                        className="h-full bg-rose-500 transition-all duration-1000 ease-out flex items-center justify-center text-[8px] font-black text-white px-2"
                        style={{ width: `${topTwoComparison.second.pct}%` }}
                      >
                         {Math.round(topTwoComparison.second.pct)}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-center">
                        <p className="text-[9px] font-black text-indigo-600 uppercase mb-0.5">{topTwoComparison.first.name}</p>
                        <p className="text-xl font-black text-indigo-700">{topTwoComparison.first.studentCount}</p>
                        <p className="text-[8px] text-indigo-500/70 font-bold">alunos</p>
                      </div>
                      <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 text-center">
                        <p className="text-[9px] font-black text-rose-600 uppercase mb-0.5">{topTwoComparison.second.name}</p>
                        <p className="text-xl font-black text-rose-700">{topTwoComparison.second.studentCount}</p>
                        <p className="text-[8px] text-rose-500/70 font-bold">alunos</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center p-4 bg-muted/10 rounded-2xl border border-dashed border-border">
                  <Users size={24} className="text-muted-foreground/30 mb-2" />
                  <p className="text-[10px] font-bold text-muted-foreground">Cadastre pelo menos 2 instrumentos para ver o comparativo</p>
                </div>
              )}
           </div>

           <div className="relative w-full md:w-48 h-64 md:h-auto bg-muted/5 flex items-center justify-center p-4 border-t md:border-t-0 md:border-l border-border/50">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={instrumentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    activeIndex={activeInstIndex ?? undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveInstIndex(index)}
                    onMouseLeave={() => setActiveInstIndex(null)}
                    animationBegin={200}
                    animationDuration={1500}
                  >
                    {instrumentDistribution.map((entry, index) => (
                      <Cell key={`cell-inst-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {topTwoComparison && (
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-xs font-black text-foreground">{topTwoComparison.totalStudents}</span>
                   <span className="text-[8px] font-bold text-muted-foreground uppercase">Tudo</span>
                </div>
              )}
           </div>
        </motion.div>

        {/* Evolução de alunos */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-1">Evolução de Alunos</h3>
          <p className="text-xs text-muted-foreground mb-4">Alunos ativos por mês</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAlunos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="alunos" name="Alunos" stroke="oklch(0.52 0.22 264)" strokeWidth={2.5} fill="url(#gradAlunos)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Receita mensal */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-1">Receita Mensal</h3>
          <p className="text-xs text-muted-foreground mb-4">Faturamento por mês</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.58 0.24 295)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(0.58 0.24 295)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Receita" stroke="oklch(0.58 0.24 295)" strokeWidth={2.5} fill="url(#gradReceita)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Aulas por dia */}
        <motion.div variants={itemVariants} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-1">Aulas por Dia da Semana</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimas 4 semanas</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayData ?? []} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="aulas" name="Aulas" fill="oklch(0.52 0.22 264)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </motion.div>
  );
}
