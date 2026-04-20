import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, Calendar, TrendingUp, DollarSign,
  ArrowUpRight, Music2, Star, Clock, CheckCircle2,
  XCircle, AlertCircle, Guitar, Bell, ChevronRight, MessageCircle,
  PlusCircle, Search, CreditCard, Send
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  title, value, subtitle, icon: Icon, gradient, trend, chartData, chartColor
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  trend?: string;
  chartData?: any[];
  chartColor?: string;
}) {
  return (
    <div className={cn("rounded-2xl p-5 text-white shadow-lg relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl duration-300 group", gradient)}>
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8 blur-2xl group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-8 -translate-x-8 blur-xl" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform">
            <Icon size={24} className="text-white" />
          </div>
          {trend && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
              <ArrowUpRight size={12} className="text-white" />
              <span className="text-[11px] font-bold text-white leading-none">{trend}</span>
            </div>
          )}
        </div>
        
        <div>
          <p className="text-3xl font-extrabold tracking-tight mb-1">{value}</p>
          <p className="text-sm font-semibold text-white/90">{title}</p>
          <p className="text-[11px] text-white/70 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            {subtitle}
          </p>
        </div>

        {/* Mini Sparkline */}
        {chartData && chartData.length > 0 && (
          <div className="h-12 mt-4 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={chartColor || "white"} 
                  strokeWidth={2.5} 
                  dot={false}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Action Item ────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, onClick, color }: { icon: any, label: string, onClick: () => void, color: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group transition-all"
    >
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-translate-y-1 transition-all", color)}>
        <Icon size={24} className="text-white group-hover:scale-110 transition-transform" />
      </div>
      <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    </button>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function LessonStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    concluida: { label: "Concluída", className: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20", icon: CheckCircle2 },
    agendada: { label: "Agendada", className: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20", icon: Clock },
    cancelada: { label: "Cancelada", className: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20", icon: XCircle },
    falta: { label: "Falta", className: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20", icon: AlertCircle },
  };
  const c = config[status] ?? config.agendada;
  const StatusIcon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full", c.className)}>
      <StatusIcon size={12} />
      {c.label}
    </span>
  );
}

// ─── Student Level Badge ──────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    iniciante: { label: "Iniciante", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/10" },
    intermediario: { label: "Intermediário", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/10" },
    avancado: { label: "Avançado", className: "bg-primary/10 text-primary border border-primary/10" },
  };
  const c = config[level] ?? config.iniciante;
  return <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full", c.className)}>{c.label}</span>;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-2xl p-4 text-xs animate-in fade-in zoom-in duration-200">
        <p className="font-bold text-foreground mb-2 border-b border-border/50 pb-1">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: p.color }} />
                <span className="text-muted-foreground font-medium">{p.name}</span>
              </div>
              <span className="font-bold text-foreground">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: dayData } = trpc.dashboard.lessonsByDay.useQuery();
  const { data: upcomingLessons } = trpc.lessons.upcoming.useQuery();
  const { data: recentStudents } = trpc.students.recent.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();
  const { data: pendingReminders = [] } = trpc.reminders.list.useQuery({ status: "pendente" });
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const sparklineDataAlunos = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.slice(-6).map(d => ({ value: d.alunos }));
  }, [monthlyData]);

  const sparklineDataAulas = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.slice(-6).map(d => ({ value: d.aulas }));
  }, [monthlyData]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    const total = stats.weekLessons || 1;
    const done = Math.round(total * (stats.completionRate / 100));
    return [
      { name: "Concluídas", value: done, color: "oklch(0.52 0.22 264)" },
      { name: "Pendentes", value: total - done, color: "var(--muted-foreground / 30%)" },
    ];
  }, [stats]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-8 max-w-[1400px] animate-in fade-in duration-700">
      
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            {greeting}, {user?.name?.split(' ')[0] || 'Professor'}! <span className="animate-bounce">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Aqui está o que está acontecendo na sua escola hoje.
          </p>
        </div>

        {/* Quick Actions Row */}
        <div className="flex items-center gap-4 bg-card p-4 rounded-3xl border border-border shadow-sm">
          <QuickAction 
            icon={PlusCircle} 
            label="Novo Aluno" 
            onClick={() => navigate('/alunos')} 
            color="bg-primary hover:bg-primary/90" 
          />
          <QuickAction 
            icon={Calendar} 
            label="Agendar Aula" 
            onClick={() => navigate('/aulas')} 
            color="bg-violet-500 hover:bg-violet-600" 
          />
          <QuickAction 
            icon={CreditCard} 
            label="Mensalidades" 
            onClick={() => navigate('/mensalidades')} 
            color="bg-rose-500 hover:bg-rose-600" 
          />
          <QuickAction 
            icon={Send} 
            label="Lembretes" 
            onClick={() => navigate('/lembretes')} 
            color="bg-emerald-500 hover:bg-emerald-600" 
          />
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total de Alunos"
          value={statsLoading ? "..." : stats?.totalStudents ?? 0}
          subtitle={`${stats?.activeStudents ?? 0} alunos ativos`}
          icon={Users}
          gradient="bg-gradient-to-br from-indigo-600 to-blue-500"
          trend="+12%"
          chartData={sparklineDataAlunos}
        />
        <StatCard
          title="Aulas Esta Semana"
          value={statsLoading ? "..." : stats?.weekLessons ?? 0}
          subtitle="Total de agendamentos"
          icon={Music2}
          gradient="bg-gradient-to-br from-violet-600 to-fuchsia-500"
          trend="+5%"
          chartData={sparklineDataAulas}
        />
        <StatCard
          title="Taxa de Conclusão"
          value={statsLoading ? "..." : `${stats?.completionRate ?? 0}%`}
          subtitle="Desempenho da semana"
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-rose-600 to-pink-500"
          trend="+3%"
        />
        <StatCard
          title="Receita Mensal"
          value={statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue ?? 0)}
          subtitle="Projeção atualizado"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-emerald-600 to-teal-500"
          trend="+8%"
        />
      </div>

      {/* ── Overdue Payments Alert ── */}
      {overduePayments.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-3xl p-6 shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0 animate-pulse">
              <AlertCircle size={24} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                <div>
                  <h3 className="text-base font-bold text-rose-900 dark:text-rose-400 tracking-tight">
                    Atenção: {overduePayments.length} mensalidade{overduePayments.length > 1 ? 's' : ''} em atraso
                  </h3>
                  <p className="text-sm text-rose-700/70 dark:text-rose-400/70">
                    Alunos com pagamento vencido. Recomendamos o contato imediato.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/mensalidades')}
                  className="rounded-xl border-rose-200 bg-white hover:bg-rose-50 text-rose-600"
                >
                  Gestão Financeira <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overduePayments.slice(0, 6).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-3 border border-rose-100 dark:border-rose-900/30 hover:border-rose-400 transition-colors group/item">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center font-black text-rose-700 dark:text-rose-300 text-xs">
                        {(p.studentName ?? 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-rose-900 dark:text-rose-200 truncate">{p.studentName ?? 'Aluno'}</p>
                        <p className="text-[10px] text-rose-500 font-medium">{formatCurrency(Number(p.amount))}</p>
                      </div>
                    </div>
                    {p.studentPhone && (
                      <a
                        href={`https://wa.me/55${p.studentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${p.studentName}, sua mensalidade de R$ ${Number(p.amount).toFixed(2).replace('.', ',')} venceu em ${new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}. Por favor, entre em contato para regularizar.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Dashboard Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Charts) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Evolution Chart */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-border relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-base font-black text-foreground tracking-tight">Evolução da Escola</h3>
                <p className="text-xs text-muted-foreground font-medium">Comparativo de alunos e aulas nos últimos 12 meses</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                  <span className="text-[11px] font-bold text-muted-foreground">Alunos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-violet-400 shadow-sm" />
                  <span className="text-[11px] font-bold text-muted-foreground">Aulas</span>
                </div>
              </div>
            </div>
            
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAlunos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAulas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.70 0.15 295)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="oklch(0.70 0.15 295)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 30%)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                  <Area 
                    type="monotone" 
                    dataKey="alunos" 
                    name="Alunos" 
                    stroke="var(--primary)" 
                    strokeWidth={4} 
                    fill="url(#colorAlunos)" 
                    dot={{ r: 4, strokeWidth: 2, fill: "white" }} 
                    activeDot={{ r: 6, strokeWidth: 0 }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="aulas" 
                    name="Aulas" 
                    stroke="oklch(0.70 0.15 295)" 
                    strokeWidth={4} 
                    fill="url(#colorAulas)" 
                    dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Aulas por Dia */}
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-border">
              <div className="mb-6">
                <h3 className="text-sm font-black text-foreground tracking-tight">Presença Semanal</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Frequência média por dia da semana</p>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData ?? []} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 30%)" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 700 }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={5}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 700 }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar 
                      dataKey="aulas" 
                      name="Aulas" 
                      fill="var(--primary)" 
                      radius={[6, 6, 0, 0]} 
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Instrumentos Populares */}
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-border">
              <div className="mb-6">
                <h3 className="text-sm font-black text-foreground tracking-tight">Instrumentos</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Distribuição por popularidade</p>
              </div>
              <div className="space-y-4">
                {(instruments ?? []).slice(0, 5).map((inst) => {
                  const max = instruments?.[0]?.studentCount ?? 1;
                  const pct = Math.round((Number(inst.studentCount) / Number(max)) * 100);
                  return (
                    <div key={inst.id} className="space-y-2 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:rotate-12" style={{ background: inst.color + "20" }}>
                            <Guitar size={14} style={{ color: inst.color ?? "var(--primary)" }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{inst.name}</span>
                        </div>
                        <span className="text-[11px] font-black text-muted-foreground">{inst.studentCount} alunos</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%`, background: inst.color ?? "var(--primary)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Students Table */}
          <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div>
                <h3 className="text-sm font-black text-foreground tracking-tight">Últimas Matrículas</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Novos alunos que ingressaram recentemente</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/alunos")} className="text-primary font-bold hover:bg-primary/5 rounded-xl">
                Ver todos <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-6 py-4">Aluno</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 py-4 hidden sm:table-cell">Instrumento</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 py-4 hidden md:table-cell text-center">Início</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(recentStudents ?? []).map((student: any) => (
                    <tr key={student.id} className="hover:bg-muted/30 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span className="text-xs font-black text-primary">
                              {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{student.name}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: student.instrumentColor ?? "#6366f1" }} />
                          <span className="text-xs font-semibold text-foreground/80">{student.instrumentName ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell text-center">
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {student.startDate ? new Date(student.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black px-2.5 py-1 rounded-full",
                            student.status === "ativo" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10" :
                            student.status === "pausado" ? "bg-amber-500/10 text-amber-600 border border-amber-500/10" :
                            "bg-rose-500/10 text-rose-600 border border-rose-500/10"
                          )}>
                            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Widgets) */}
        <div className="space-y-8">
          
          {/* Completion Rate Gauge */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-border flex flex-col items-center">
            <div className="w-full mb-6">
              <h3 className="text-sm font-black text-foreground tracking-tight">Taxa de Conclusão</h3>
              <p className="text-[11px] text-muted-foreground font-medium">Aproveitamento das aulas da semana</p>
            </div>
            
            <div className="relative w-full aspect-square max-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    startAngle={225}
                    endAngle={-45}
                    cornerRadius={8}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-foreground tracking-tighter leading-none">
                  {stats?.completionRate ?? 0}%
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Concluído</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              {pieData.map((d) => (
                <div key={d.name} className="bg-muted/30 p-3 rounded-2xl border border-border/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{d.name}</span>
                  </div>
                  <p className="text-lg font-black text-foreground">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Lessons Widget */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black text-foreground tracking-tight">Agenda Próxima</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Aulas agendadas recentemente</p>
              </div>
              <Calendar size={18} className="text-muted-foreground/50" />
            </div>
            
            <div className="space-y-4">
              {(upcomingLessons ?? []).filter(l => l.status === "agendada").slice(0, 5).map((lesson) => (
                <div key={lesson.id} className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-card shadow-sm border border-border flex flex-col items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="text-[9px] font-black uppercase leading-none">{new Date(lesson.scheduledAt).toLocaleDateString("pt-BR", { month: "short" }).replace('.', '')}</span>
                    <span className="text-sm font-black leading-none">{new Date(lesson.scheduledAt).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{lesson.studentName || lesson.experimentalName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • {lesson.duration}min
                    </p>
                  </div>
                  {lesson.isExperimental && (
                    <Badge variant="secondary" className="text-[8px] uppercase tracking-tighter bg-rose-500/10 text-rose-500 border-none font-black px-1.5 h-4">EXP</Badge>
                  )}
                </div>
              ))}
              {(upcomingLessons ?? []).filter(l => l.status === "agendada").length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Calendar size={20} className="text-muted-foreground/30" />
                  </div>
                  <p className="text-[11px] font-bold text-muted-foreground">Nenhuma aula agendada</p>
                </div>
              )}
            </div>
            {upcomingLessons && upcomingLessons.length > 5 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/aulas")}
                className="w-full mt-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                Ver Agenda Completa
              </Button>
            )}
          </div>

          {/* Pending Reminders */}
          {pendingReminders.length > 0 && (
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-border relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black text-foreground tracking-tight flex items-center gap-2">
                    Lembretes <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-lg text-[10px] leading-none">{pendingReminders.length}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">Ações necessárias</p>
                </div>
                <Bell size={18} className="text-amber-500" />
              </div>

              <div className="space-y-3">
                {pendingReminders.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4 group/reminder hover:bg-amber-500/10 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-amber-900 dark:text-amber-200 line-clamp-2">{r.message}</p>
                      <p className="text-[9px] font-bold text-amber-600/70 mt-1 uppercase tracking-widest">{r.studentName || 'Geral'}</p>
                    </div>
                    {r.studentPhone && (
                      <a href={`https://wa.me/55${r.studentPhone.replace(/\D/g, "")}?text=${encodeURIComponent(r.message)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 shadow-sm border border-amber-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all">
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/lembretes")}
                className="w-full mt-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50"
              >
                Ver todos lembretes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
