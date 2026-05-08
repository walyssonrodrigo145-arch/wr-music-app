import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, Calendar, TrendingUp, DollarSign,
  ArrowUpRight, Clock, CheckCircle2,
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
  title, value, icon: Icon, color, sparkData, trend 
}: { 
  title: string; value: string | number; icon: any; color: string; sparkData?: any[]; trend: string 
}) {
  return (
    <div className="bg-card rounded-[1.25rem] p-6 border border-border shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 group cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6", color.replace('text-', 'bg-').replace('-600', '-50').replace('-500', '-50'))}>
          <Icon size={24} className={color} />
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
            <ArrowUpRight size={12} />
            {trend}
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">este mês</p>
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
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
  
  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: upcomingLessons } = trpc.lessons.upcoming.useQuery();
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery();
  const { data: allLessons = [] } = trpc.lessons.list.useQuery();

  // Real sparkline data from monthlyStats
  const sparkAlunos = useMemo(() => monthlyData?.map(d => ({ value: d.alunos })) || [], [monthlyData]);
  const sparkAulas = useMemo(() => monthlyData?.map(d => ({ value: d.aulas })) || [], [monthlyData]);
  const sparkReceita = useMemo(() => monthlyData?.map(d => ({ value: d.receita })) || [], [monthlyData]);
  
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
      { label: "Aulas agendadas", count: todays.length, color: "bg-blue-50 text-blue-600", icon: Calendar },
      { label: "Concluídas", count: todays.filter(l => l.status === "concluida").length, color: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
      { label: "Faltas", count: todays.filter(l => l.status === "falta").length, color: "bg-orange-50 text-orange-600", icon: MinusCircle },
      { label: "Remarcadas", count: todays.filter(l => l.status === "remarcada").length, color: "bg-purple-50 text-purple-600", icon: RefreshCcw },
      { label: "Canceladas", count: todays.filter(l => l.status === "cancelada").length, color: "bg-rose-50 text-rose-600", icon: XCircle },
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
          title="Total de Alunos" 
          value={statsLoading ? "..." : stats?.totalStudents ?? 0} 
          icon={Users} 
          color="text-blue-600" 
          trend={trends.alunos} 
          sparkData={sparkAlunos}
        />
        <MetricCard 
          title="Aulas Realizadas" 
          value={statsLoading ? "..." : stats?.weekLessons ?? 0} 
          icon={CheckCircle2} 
          color="text-emerald-500" 
          trend={trends.aulas} 
          sparkData={sparkAulas}
        />
        <MetricCard 
          title="Aulas Agendadas" 
          value={statsLoading ? "..." : stats?.weekLessons ?? 0} 
          icon={Clock} 
          color="text-orange-500" 
          trend="+5%" 
          sparkData={sparkAulas}
        />
        <MetricCard 
          title="Receita do Mês" 
          value={statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue ?? 0)} 
          icon={DollarSign} 
          color="text-purple-600" 
          trend={trends.receita} 
          sparkData={sparkReceita}
        />
      </div>

      {/* ── Main Section (Chart + Summary) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
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
                </div>
             </div>
             <select className="bg-muted border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground focus:outline-none">
                <option>Últimos 6 meses</option>
                <option>Este ano</option>
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
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Area type="monotone" dataKey="aulas" name="Aulas" stroke="#2563EB" strokeWidth={3} fill="url(#chartBlue)" dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="alunos" name="Alunos" stroke="#10B981" strokeWidth={3} fill="url(#chartEmerald)" dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Summary */}
        <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upcoming Lessons */}
        <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground tracking-tight">Próximas Aulas</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50" onClick={() => navigate('/aulas')}>Ver todas</Button>
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
                   <div className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">
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
        <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground tracking-tight">Inadimplentes</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50" onClick={() => navigate('/mensalidades')}>Ver todas</Button>
           </div>
           <div className="space-y-4">
              {overduePayments?.slice(0, 4).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-transparent hover:border-border transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs">
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
                   <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
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

