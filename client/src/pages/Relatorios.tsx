import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, Filter, UserPlus, TrendingUp, ChevronDown, CheckCircle2, XCircle, BookOpen, Guitar, Music2, Users, CreditCard } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Sector
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

  const instrumentStats = useMemo(() => {
    if (instruments.length === 0) return null;
    const items = instruments
      .map(inst => ({
        ...inst,
        count: Number(inst.studentCount)
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const total = items.reduce((sum, item) => sum + item.count, 0);
    
    return {
      items: items.map(item => ({
        ...item,
        pct: total > 0 ? (item.count / total) * 100 : 0
      })),
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
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-[#F8FAFC]">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 scrollbar-thin no-scrollbar">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center shadow-sm shrink-0">
              <BarChart3 size={24} className="text-pink-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight leading-none">Relatórios</h2>
              <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 lg:mt-2">Análises e indicadores de desempenho</p>
            </div>
          </div>

          <div className="relative w-full sm:w-auto">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full sm:w-auto h-11 px-6 bg-white border border-slate-100 rounded-xl flex items-center justify-between sm:justify-start gap-4 text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-indigo-600" />
                <span>{filterMode === "all" ? "Todo o Período" : `${months[selectedMonth-1]} / ${selectedYear}`}</span>
              </div>
              <ChevronDown size={14} className={cn("transition-transform text-slate-400", isFilterOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-14 z-50 w-full sm:w-72 bg-white border border-slate-100 rounded-[2rem] shadow-2xl p-6 space-y-6"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => { setFilterMode("all"); setIsFilterOpen(false); }}
                      className={cn(
                        "h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                        filterMode === "all" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      Todo Período
                    </button>
                    <button 
                      onClick={() => setFilterMode("monthly")}
                      className={cn(
                        "h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                        filterMode === "monthly" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      Mensal
                    </button>
                  </div>

                  {filterMode === "monthly" && (
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Mês de Referência</label>
                          <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full h-11 rounded-xl bg-slate-50 border-none text-xs font-black text-slate-700 outline-none"
                          >
                             {months.map((m, i) => (
                               <option key={m} value={i + 1}>{m}</option>
                             ))}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Ano</label>
                          <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full h-11 rounded-xl bg-slate-50 border-none text-xs font-black text-slate-700 outline-none"
                          >
                             {years.map(y => (
                               <option key={y} value={y}>{y}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                  )}
                  
                  <Button className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px]" onClick={() => setIsFilterOpen(false)}>
                    Aplicar Filtros
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Aulas Experimentais */}
          <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col xl:flex-row">
             <div className="p-8 flex-1 space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                      <UserPlus size={16} />
                    </div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Aulas Experimentais</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Taxa de conversão de leads</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Total de Aulas</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800 tracking-tighter">{expStats?.total ?? 0}</span>
                        <BookOpen size={16} className="text-slate-300" />
                      </div>
                   </div>
                   <div className="p-6 bg-indigo-50 rounded-[1.5rem] border border-indigo-100/50">
                      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">Conversão</p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black text-indigo-600 tracking-tighter">{expStats?.conversionRate ?? 0}%</span>
                         <TrendingUp size={16} className="text-indigo-300" />
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700">
                      <div className="flex items-center gap-3">
                         <CheckCircle2 size={16} />
                         <span>Convertidos</span>
                      </div>
                      <span className="text-xs">{expStats?.converted ?? 0}</span>
                   </div>
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700">
                      <div className="flex items-center gap-3">
                         <XCircle size={16} />
                         <span>Perdidos</span>
                      </div>
                      <span className="text-xs">{expStats?.notConverted ?? 0}</span>
                   </div>
                </div>
             </div>

             <div className="relative w-full xl:w-64 h-72 xl:h-auto bg-slate-50/50 flex items-center justify-center p-8 border-t xl:border-t-0 xl:border-l border-slate-100/50">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={8}
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
                   <span className="text-xl font-black text-slate-800 tracking-tighter">{expStats?.conversionRate ?? 0}%</span>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Conversão</span>
                </div>
             </div>
          </motion.div>

          {/* Análise por Instrumento */}
          <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col xl:flex-row">
             <div className="p-8 flex-1 space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <Music2 size={16} />
                    </div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Por Instrumento</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Distribuição de matrículas</p>
                </div>

                {instrumentStats && instrumentStats.items.length > 0 ? (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">
                        <span>Concentração</span>
                        <span>Total: {instrumentStats.totalStudents}</span>
                      </div>

                      <div className="h-8 w-full bg-slate-50 rounded-2xl overflow-hidden flex shadow-inner border border-slate-100">
                        {instrumentStats.items.map((item, idx) => (
                          <motion.div 
                            key={item.id}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ duration: 1, delay: idx * 0.1 }}
                            className="h-full flex items-center justify-center text-[8px] font-black text-white px-1 truncate group relative"
                            style={{ backgroundColor: item.color || "#6366f1" }}
                          >
                             {item.pct >= 12 && `${Math.round(item.pct)}%`}
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto no-scrollbar pr-1">
                      {instrumentStats.items.map((item) => (
                        <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-lg transition-all">
                          <div className="w-2 h-2 rounded-full mb-3 shadow-sm" style={{ backgroundColor: item.color || "#6366f1" }} />
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest truncate w-full mb-1">{item.name}</p>
                          <span className="text-xl font-black text-indigo-600 tracking-tighter">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <Users size={32} className="text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem dados disponíveis</p>
                  </div>
                )}
             </div>

             <div className="relative w-full xl:w-64 h-72 xl:h-auto bg-slate-50/50 flex items-center justify-center p-8 border-t xl:border-t-0 xl:border-l border-slate-100/50">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={instrumentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
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
                {instrumentStats && (
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xl font-black text-slate-800 tracking-tighter">{instrumentStats.totalStudents}</span>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Alunos</span>
                  </div>
                )}
             </div>
          </motion.div>

          {/* Evolução de alunos */}
          <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Evolução de Alunos</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico de matrículas ativas</p>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAlunos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="alunos" name="Alunos" stroke="#4F46E5" strokeWidth={4} fill="url(#gradAlunos)" dot={{ r: 4, fill: "#4F46E5", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Receita mensal */}
          <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Performance Financeira</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Faturamento mensal bruto</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Receita" stroke="#7C3AED" strokeWidth={4} fill="url(#gradReceita)" dot={{ r: 4, fill: "#7C3AED", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Aulas por dia */}
          <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm col-span-1 lg:col-span-2">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Demanda Diária</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Volume de aulas por dia da semana</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dayData ?? []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 800, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="aulas" name="Aulas" fill="#4F46E5" radius={[12, 12, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
