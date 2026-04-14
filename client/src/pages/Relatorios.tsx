import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, Filter, UserPlus, TrendingUp, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { cn } from "@/lib/utils";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{
              p.name === "Receita"
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)
                : p.value
            }</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
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

  return (
    <div className="space-y-5 max-w-[1400px]">
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
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
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

           <div className="w-full md:w-48 h-64 md:h-auto bg-muted/10 flex items-center justify-center p-4 border-t md:border-t-0 md:border-l border-border/50">
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
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                 <span className="text-xs font-black text-foreground">{expStats?.conversionRate ?? 0}%</span>
                 <span className="text-[8px] font-bold text-muted-foreground uppercase">Meta</span>
              </div>
           </div>
        </div>

        {/* Evolução de alunos */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
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
        </div>

        {/* Receita mensal */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
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
        </div>

        {/* Aulas por dia */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
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
        </div>
      </div>
    </div>
  );
}
