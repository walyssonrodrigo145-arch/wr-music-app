import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, Calendar, TrendingUp, DollarSign,
  ArrowUpRight, Clock, CheckCircle2,
  XCircle, ChevronRight, Bell,
  Search, MinusCircle, RefreshCcw
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
    <div className="bg-white rounded-[1.25rem] p-6 border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 group cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6", color.replace('text-', 'bg-').replace('-600', '-50').replace('-500', '-50'))}>
          <Icon size={24} className={color} />
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
            <ArrowUpRight size={12} />
            {trend}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">este mês</p>
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">{title}</p>
      </div>
      {sparkData && (
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
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: upcomingLessons } = trpc.lessons.upcoming.useQuery();
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery();

  // MOCK sparkline data for demo if not in DB or as visual backup
  const sparkAlunos = useMemo(() => monthlyData?.slice(-6).map(d => ({ value: d.alunos })) || [ {value: 10}, {value: 15}, {value: 12}, {value: 20}, {value: 25}, {value: 28} ], [monthlyData]);
  const sparkAulas = useMemo(() => monthlyData?.slice(-6).map(d => ({ value: d.aulas })) || [ {value: 80}, {value: 120}, {value: 100}, {value: 150}, {value: 180}, {value: 175} ], [monthlyData]);
  const sparkAgendadas = [ {value: 30}, {value: 45}, {value: 40}, {value: 56}, {value: 52}, {value: 56} ];
  const sparkReceita = [ {value: 8000}, {value: 9500}, {value: 10200}, {value: 11000}, {value: 12450}, {value: 12450} ];

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      
      {/* ── Header Section ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            Olá, {user?.name?.split(' ')[0] || 'WR'}! <span className="animate-bounce">👋</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Aqui está o resumo geral da sua escola de música.
          </p>
        </div>
        
        {/* Header Actions Desktop */}
        <div className="hidden lg:flex items-center gap-4">
           <div className="relative group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Procurar..." 
                className="h-12 w-64 bg-white border border-slate-100 rounded-2xl pl-12 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
              />
           </div>
           <button className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm relative">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-600 border-2 border-white rounded-full" />
           </button>
           <Avatar className="w-12 h-12 border-2 border-white shadow-sm ring-1 ring-slate-100">
              <AvatarFallback className="bg-blue-600 text-white font-black">WR</AvatarFallback>
           </Avatar>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total de Alunos" 
          value={stats?.totalStudents || 128} 
          icon={Users} 
          color="text-blue-600" 
          trend="12%" 
          sparkData={sparkAlunos}
        />
        <MetricCard 
          title="Aulas Esta Semana" 
          value={stats?.weekLessons || 56} 
          icon={CheckCircle2} 
          color="text-emerald-500" 
          trend="8%" 
          sparkData={sparkAulas}
        />
        <MetricCard 
          title="Aulas Agendadas" 
          value={stats?.weekLessons || 56} 
          icon={Clock} 
          color="text-orange-500" 
          trend="15%" 
          sparkData={sparkAgendadas}
        />
        <MetricCard 
          title="Receita do Mês" 
          value={formatCurrency(stats?.monthlyRevenue || 12450)} 
          icon={DollarSign} 
          color="text-purple-600" 
          trend="18%" 
          sparkData={sparkReceita}
        />
      </div>

      {/* ── Main Section (Chart + Summary) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
             <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">Evolução Mensal</h3>
                <div className="flex items-center gap-4 mt-2">
                   <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aulas realizadas</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novos alunos</span>
                   </div>
                </div>
             </div>
             <select className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 focus:outline-none">
                <option>Últimos 6 meses</option>
                <option>Este ano</option>
             </select>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          </div>
        </div>

        {/* Daily Summary */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
           <h3 className="text-base font-black text-slate-800 tracking-tight">Resumo do dia</h3>
           <div className="space-y-4">
              {[
                { label: "Aulas agendadas", count: 5, color: "bg-blue-50 text-blue-600", icon: Calendar },
                { label: "Concluídas", count: 1, color: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
                { label: "Faltas", count: 1, color: "bg-orange-50 text-orange-600", icon: MinusCircle },
                { label: "Remarcadas", count: 1, color: "bg-purple-50 text-purple-600", icon: RefreshCcw },
                { label: "Canceladas", count: 1, color: "bg-rose-50 text-rose-600", icon: XCircle },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", item.color)}>
                      <item.icon size={18} />
                    </div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                  </div>
                  <span className="text-base font-black text-slate-800">{item.count}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* ── Secondary Widgets Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upcoming Lessons */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 tracking-tight">Próximas Aulas</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50" onClick={() => navigate('/aulas')}>Ver todas</Button>
           </div>
           <div className="space-y-4">
              {upcomingLessons?.slice(0, 4).map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-100 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                         <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{format(new Date(lesson.scheduledAt), "MMM", { locale: ptBR }).replace('.', '')}</span>
                         <span className="text-sm font-black text-slate-800 leading-none">{format(new Date(lesson.scheduledAt), "d")}</span>
                      </div>
                      <div>
                         <p className="text-xs font-black text-slate-800">{lesson.studentName || lesson.experimentalName}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                           <Clock size={12} className="text-blue-500" /> {format(new Date(lesson.scheduledAt), "HH:mm")} • {lesson.title}
                         </p>
                      </div>
                   </div>
                   <div className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">
                      Agendada
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Overdue Payments */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 tracking-tight">Inadimplentes</h3>
              <Button variant="ghost" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50" onClick={() => navigate('/mensalidades')}>Ver todas</Button>
           </div>
           <div className="space-y-4">
              {overduePayments?.slice(0, 4).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-100 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs">
                         {(payment.studentName || "A")[0]}
                      </div>
                      <div>
                         <p className="text-xs font-black text-slate-800">{payment.studentName}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
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
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum pagamento atrasado</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
