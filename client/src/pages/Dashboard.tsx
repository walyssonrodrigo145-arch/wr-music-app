import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, Calendar, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  XCircle, ChevronRight, Bell,
  Search, MinusCircle, RefreshCcw, BarChart as LucideBarChart
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function MetricCard({ 
  title, value, icon: Icon, color, sparkData, trend, isLoading
}: { 
  title: string; value: string | number; icon: any; color: string; sparkData?: any[]; trend?: string; isLoading?: boolean
}) {
  // BUG-004: trend dinâmico — seta e cor corretas conforme positivo/negativo
  const isNegative = trend?.startsWith('-');
  const TrendIcon = isNegative ? ArrowDownRight : ArrowUpRight;
  const trendColor = trend ? (isNegative ? 'text-rose-500' : 'text-emerald-500') : 'text-muted-foreground';

  return (
    <div className="bg-card/40 backdrop-blur-xl rounded-[1.25rem] p-6 border border-white/10 shadow-2xl shadow-primary/5 hover:shadow-primary/15 hover:-translate-y-1.5 transition-all duration-500 group cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6 shadow-sm", color.replace('text-', 'bg-') + '/10')}>
          <Icon size={24} className={color} />
        </div>
        <div className="flex flex-col items-end">
          {trend ? (
            <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest", trendColor)}>
              <TrendIcon size={12} />
              {trend}
            </div>
          ) : (
            <div className="h-4" />
          )}
          <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">este mês</p>
        </div>
      </div>
      <div>
        {/* MH-003: Skeleton loader em vez de "..." */}
        {isLoading ? (
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse mb-1" />
        ) : (
          <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
        )}
        <p className="text-xs font-bold text-muted-foreground mt-1">{title}</p>
      </div>
      {sparkData && sparkData.length > 0 && (
        <div className="h-12 mt-6 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color.includes('blue') ? '#2563EB' : color.includes('emerald') ? '#10B981' : color.includes('orange') ? '#F59E0B' : '#7C3AED'} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={color.includes('blue') ? '#2563EB' : color.includes('emerald') ? '#10B981' : color.includes('orange') ? '#F59E0B' : '#7C3AED'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={color.includes('blue') ? '#2563EB' : color.includes('emerald') ? '#10B981' : color.includes('orange') ? '#F59E0B' : '#7C3AED'} 
                strokeWidth={2} 
                fill={`url(#gradient-${title.replace(/\s+/g, '')})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // BUG-003: Estado para controlar período do gráfico
  const [chartPeriod, setChartPeriod] = useState<'6m' | '12m'>('6m');
  
  // Queries — MH-002: cache de 5 minutos para reduzir chamadas
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { data: monthlyDataRaw } = trpc.dashboard.monthlyStats.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { data: upcomingLessons } = trpc.lessons.upcoming.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  // BUG#5 FIX: filtrar apenas aulas do dia de hoje no servidor — antes buscava TODAS sem filtro
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const { data: allLessons = [] } = trpc.lessons.list.useQuery(
    { date: todayStr },
    { staleTime: 2 * 60 * 1000 }
  );

  // BUG-003: Filtrar dados do gráfico pelo período selecionado
  const monthlyData = useMemo(() => {
    if (!monthlyDataRaw) return monthlyDataRaw;
    if (chartPeriod === '6m') return monthlyDataRaw.slice(-6);
    return monthlyDataRaw; // 12m = todos
  }, [monthlyDataRaw, chartPeriod]);

  // Real sparkline data from monthlyStats
  const sparkAlunos = useMemo(() => monthlyData?.map(d => ({ value: d.alunos })) || [], [monthlyData]);
  const sparkAulas = useMemo(() => monthlyData?.map(d => ({ value: d.aulas })) || [], [monthlyData]);
  const sparkReceita = useMemo(() => monthlyData?.map(d => ({ value: d.receita })) || [], [monthlyData]);
  // BUG#4 FIX: sparkline de receita já existia, mas a linha de receita não era plotada no gráfico principal
  // A correção foi adicionar o terceiro <Area> no AreaChart abaixo

  // Today's summary calculation
  const todaySummary = useMemo(() => {
    const today = new Date();
    const todays = allLessons.filter(l => {
      const lessonDate = new Date(l.scheduledAt);
      return lessonDate.getDate() === today.getDate() &&
             lessonDate.getMonth() === today.getMonth() &&
             lessonDate.getFullYear() === today.getFullYear();
    });

    return [
      { label: "Aulas agendadas", count: todays.length, color: "bg-blue-500/10 text-blue-600", icon: Calendar },
      { label: "Concluídas", count: todays.filter(l => l.status === "concluida").length, color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
      { label: "Faltas", count: todays.filter(l => l.status === "falta").length, color: "bg-orange-500/10 text-orange-600", icon: MinusCircle },
      { label: "Remarcadas", count: todays.filter(l => l.status === "remarcada").length, color: "bg-purple-500/10 text-purple-600", icon: RefreshCcw },
      { label: "Canceladas", count: todays.filter(l => l.status === "cancelada").length, color: "bg-rose-500/10 text-rose-600", icon: XCircle },
    ];
  }, [allLessons]);

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
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      
      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Alunos Ativos" 
          value={stats?.activeStudents ?? 0} 
          icon={Users} 
          color="text-blue-600" 
          trend={trends.alunos} 
          sparkData={sparkAlunos}
          isLoading={statsLoading}
        />
        <MetricCard 
          title="Aulas Realizadas" 
          value={stats?.completedLessons ?? 0} 
          icon={CheckCircle2} 
          color="text-emerald-500" 
          trend={trends.aulas} 
          sparkData={sparkAulas}
          isLoading={statsLoading}
        />
        {/* BUG#2 FIX: removido trend e sparkData de 'Aulas Realizadas' deste card — dado incorreto */}
        <MetricCard 
          title="Aulas Agendadas" 
          value={stats?.scheduledLessons ?? 0} 
          icon={Clock} 
          color="text-orange-500"
          isLoading={statsLoading}
        />
        {/* BUG#1 FIX: value agora usa formatCurrency — antes exibia o número cru sem R$ */}
        {/* BUG#3 FIX: removido ternário statsLoading?0:... redundante — isLoading já controla o skeleton */}
        <MetricCard 
          title="Receita do Mês" 
          value={formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={DollarSign} 
          color="text-purple-600" 
          trend={trends.receita} 
          sparkData={sparkReceita}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl shadow-primary/5 space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                 <h3 className="text-base font-black text-foreground tracking-tight">Evolução Mensal</h3>
                 <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                       <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Aulas realizadas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Novos alunos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Receita (R$)</span>
                    </div>
                 </div>
              </div>
             <select
               value={chartPeriod}
               onChange={(e) => setChartPeriod(e.target.value as '6m' | '12m')}
               className="bg-muted border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground focus:outline-none cursor-pointer"
             >
               <option value="6m">Últimos 6 meses</option>
               <option value="12m">Este ano (12 meses)</option>
             </select>
          </div>

          <div className="h-[320px] w-full">
            {(!monthlyData || monthlyData.length === 0) ? (
               <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                 <LucideBarChart size={48} className="mb-4 opacity-50" />
                 <p className="text-xs font-bold uppercase tracking-widest">Sem dados suficientes para o gráfico</p>
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chartEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    {/* BUG#4 FIX: gradient roxo para linha de receita */}
                    <linearGradient id="chartPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} opacity={0.5} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} opacity={0.5} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Area type="monotone" dataKey="aulas" name="Aulas" stroke="#2563EB" strokeWidth={3} fill="url(#chartBlue)" dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="alunos" name="Alunos" stroke="#10B981" strokeWidth={3} fill="url(#chartEmerald)" dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  {/* BUG#4 FIX: linha de receita — dado já existia em monthlyData mas não era plotado */}
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="#7C3AED" strokeWidth={2} strokeDasharray="4 2" fill="url(#chartPurple)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Summary */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl shadow-primary/5 space-y-8">
           <h3 className="text-base font-black text-foreground tracking-tight">Resumo do dia</h3>
           <div className="space-y-4">
              {todaySummary.map((item, i) => (
                <div key={i} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm border border-card", item.color)}>
                      <item.icon size={18} />
                    </div>
                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</span>
                  </div>
                  <span className="text-base font-black text-foreground">{item.count}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* ── Secondary Widgets Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Upcoming Lessons */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl shadow-primary/5 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground tracking-tight">Próximas Aulas</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-500/10" onClick={() => navigate('/aulas')}>Ver todas</Button>
           </div>
           <div className="space-y-4">
              {upcomingLessons?.slice(0, 4).map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-transparent hover:border-border transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-card border border-border flex flex-col items-center justify-center shadow-sm">
                         <span className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">
                           {lesson.scheduledAt ? format(new Date(lesson.scheduledAt), "MMM", { locale: ptBR }).replace('.', '') : '---'}
                         </span>
                         <span className="text-sm font-black text-foreground leading-none">
                           {lesson.scheduledAt ? format(new Date(lesson.scheduledAt), "d") : '--'}
                         </span>
                      </div>
                      <div>
                         <p className="text-xs font-black text-foreground">{lesson.studentName || lesson.experimentalName || "Aluno"}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-2">
                           <Clock size={12} className="text-blue-500" /> 
                           {lesson.scheduledAt ? format(new Date(lesson.scheduledAt), "HH:mm") : '--:--'} • {lesson.title}
                         </p>
                      </div>
                   </div>
                   <div className="px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">
                      Agendada
                   </div>
                </div>
              ))}
              {upcomingLessons?.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">Nenhuma aula agendada</div>
              )}
           </div>
        </div>

        {/* Overdue Payments */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl shadow-primary/5 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground tracking-tight">Inadimplentes</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-500/10" onClick={() => navigate('/financeiro')}>Ver todas</Button>
           </div>
           <div className="space-y-4">
              {overduePayments?.slice(0, 4).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-transparent hover:bg-card hover:scale-[1.01] hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-xs">
                         {(payment.studentName || "A")[0]}
                      </div>
                      <div>
                         <p className="text-xs font-black text-foreground">{payment.studentName}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                           {Math.floor((new Date().getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24))} dias em atraso
                         </p>
                      </div>
                   </div>
                   <span className="text-xs font-black text-rose-600 tracking-tight">
                      {formatCurrency(Number(payment.amount))}
                   </span>
                </div>
              ))}
              {overduePayments.length === 0 && (
                <div className="py-12 text-center">
                   <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                   </div>
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhum pagamento atrasado</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

