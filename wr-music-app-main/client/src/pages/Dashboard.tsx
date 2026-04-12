import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, Calendar, TrendingUp, DollarSign,
  ArrowUpRight, Music2, Star, Clock, CheckCircle2,
  XCircle, AlertCircle, Guitar, Bell, ChevronRight, MessageCircle
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  title, value, subtitle, icon: Icon, gradient, trend
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  trend?: string;
}) {
  return (
    <div className={cn("rounded-2xl p-5 text-white shadow-lg relative overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-xl duration-200", gradient)}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
      <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-4 -translate-x-4" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
          {trend && (
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
              <ArrowUpRight size={10} />
              <span className="text-[10px] font-semibold">{trend}</span>
            </div>
          )}
        </div>
        <p className="text-2xl font-bold mb-0.5">{value}</p>
        <p className="text-xs font-semibold text-white/90">{title}</p>
        <p className="text-[10px] text-white/60 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function LessonStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    concluida: { label: "Concluída", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    agendada: { label: "Agendada", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
    cancelada: { label: "Cancelada", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    falta: { label: "Falta", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertCircle },
  };
  const c = config[status] ?? config.agendada;
  const StatusIcon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", c.className)}>
      <StatusIcon size={10} />
      {c.label}
    </span>
  );
}

// ─── Student Level Badge ──────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    iniciante: { label: "Iniciante", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    intermediario: { label: "Intermediário", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    avancado: { label: "Avançado", className: "bg-primary/10 text-primary" },
  };
  const c = config[level] ?? config.iniciante;
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", c.className)}>{c.label}</span>;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}: <span className="font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: dayData } = trpc.dashboard.lessonsByDay.useQuery();
  const { data: upcomingLessons } = trpc.lessons.upcoming.useQuery();
  const { data: recentStudents } = trpc.students.recent.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();
  const { data: pendingReminders = [] } = trpc.reminders.list.useQuery({ status: "pendente" });
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery();

  const pieData = useMemo(() => {
    if (!stats) return [];
    const total = stats.weekLessons || 1;
    const done = Math.round(total * (stats.completionRate / 100));
    return [
      { name: "Concluídas", value: done, color: "oklch(0.52 0.22 264)" },
      { name: "Pendentes", value: total - done, color: "oklch(0.89 0.01 260)" },
    ];
  }, [stats]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total de Alunos"
          value={statsLoading ? "..." : stats?.totalStudents ?? 0}
          subtitle={`${stats?.activeStudents ?? 0} ativos agora`}
          icon={Users}
          gradient="bg-gradient-to-br from-blue-600 to-blue-500"
          trend="+12%"
        />
        <StatCard
          title="Aulas Esta Semana"
          value={statsLoading ? "..." : stats?.weekLessons ?? 0}
          subtitle="Agendadas e concluídas"
          icon={Calendar}
          gradient="bg-gradient-to-br from-violet-600 to-violet-500"
          trend="+5%"
        />
        <StatCard
          title="Taxa de Conclusão"
          value={statsLoading ? "..." : `${stats?.completionRate ?? 0}%`}
          subtitle="Aulas concluídas vs total"
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-pink-600 to-rose-500"
          trend="+3%"
        />
        <StatCard
          title="Receita Mensal"
          value={statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue ?? 0)}
          subtitle="Mês atual"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-teal-600 to-emerald-500"
          trend="+8%"
        />
      </div>

      {/* ── Alerta de Inadimplência ── */}
      {overduePayments.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">
                    {overduePayments.length} mensalidade{overduePayments.length > 1 ? 's' : ''} em atraso
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                    Alunos com pagamento vencido e não quitado
                  </p>
                </div>
                <button
                  onClick={() => navigate('/mensalidades')}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex-shrink-0"
                >
                  Ver mensalidades <ChevronRight size={12} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {overduePayments.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg px-2.5 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-red-700 dark:text-red-300">
                        {(p.studentName ?? 'A').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">{p.studentName ?? 'Aluno'}</span>
                    <span className="text-[10px] text-red-500 dark:text-red-400">
                      R$ {Number(p.amount).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-[10px] text-red-400">
                      venc. {new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    {p.studentPhone && (
                      <a
                        href={`https://wa.me/55${p.studentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${p.studentName}, sua mensalidade de R$ ${Number(p.amount).toFixed(2).replace('.', ',')} venceu em ${new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}. Por favor, entre em contato para regularizar.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <MessageCircle size={10} /> WhatsApp
                      </a>
                    )}
                  </div>
                ))}
                {overduePayments.length > 5 && (
                  <div className="flex items-center px-2.5 py-1.5 text-xs text-red-500">
                    +{overduePayments.length - 5} mais
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução de Alunos */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Evolução de Alunos</h3>
              <p className="text-xs text-muted-foreground">Últimos 12 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Alunos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />Aulas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAlunos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.52 0.22 264)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAulas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.58 0.24 295)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.58 0.24 295)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="alunos" name="Alunos" stroke="oklch(0.52 0.22 264)" strokeWidth={2.5} fill="url(#colorAlunos)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="aulas" name="Aulas" stroke="oklch(0.58 0.24 295)" strokeWidth={2.5} fill="url(#colorAulas)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* % Aulas Assistidas */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">% Aulas Concluídas</h3>
            <p className="text-xs text-muted-foreground">Esta semana</p>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                  <tspan x="50%" dy="-6" fontSize="22" fontWeight="700" fill="currentColor">
                    {stats?.completionRate ?? 0}%
                  </tspan>
                  <tspan x="50%" dy="18" fontSize="10" fill="oklch(0.52 0.02 260)">
                    concluídas
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[10px] text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aulas por Dia */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Aulas por Dia</h3>
            <p className="text-xs text-muted-foreground">Últimas 4 semanas</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dayData ?? []} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="aulas" name="Aulas" fill="oklch(0.52 0.22 264)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Instrumentos Populares */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Instrumentos</h3>
            <p className="text-xs text-muted-foreground">Por número de alunos</p>
          </div>
          <div className="space-y-3">
            {(instruments ?? []).slice(0, 5).map((inst) => {
              const max = instruments?.[0]?.studentCount ?? 1;
              const pct = Math.round((Number(inst.studentCount) / Number(max)) * 100);
              return (
                <div key={inst.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: inst.color + "20" }}>
                        <Guitar size={12} style={{ color: inst.color ?? "oklch(0.52 0.22 264)" }} />
                      </div>
                      <span className="text-xs font-medium text-foreground">{inst.name}</span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{inst.studentCount} alunos</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: inst.color ?? "oklch(0.52 0.22 264)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Próximas Aulas */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Próximas Aulas</h3>
            <p className="text-xs text-muted-foreground">Agendadas</p>
          </div>
          <div className="space-y-2.5">
            {(upcomingLessons ?? []).filter(l => l.status === "agendada").slice(0, 4).map((lesson) => (
              <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Music2 size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{lesson.studentName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{lesson.title}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-semibold text-foreground">
                    {new Date(lesson.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(lesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {(upcomingLessons ?? []).filter(l => l.status === "agendada").length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma aula agendada</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Reminders Widget ── */}
      {(pendingReminders as { id: number; type: string; message: string; scheduledAt: Date; studentName?: string | null; studentPhone?: string | null }[]).length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Bell size={14} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Lembretes Pendentes</h3>
                <p className="text-xs text-muted-foreground">{pendingReminders.length} aguardando envio</p>
              </div>
            </div>
            <button onClick={() => navigate("/lembretes")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {(pendingReminders as { id: number; type: string; message: string; scheduledAt: Date; studentName?: string | null; studentPhone?: string | null }[]).slice(0, 3).map((r) => {
              const typeColors: Record<string, string> = {
                aula: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                cobranca: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                inadimplencia: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                manual: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
              };
              const typeLabels: Record<string, string> = { aula: "Aula", cobranca: "Cobrança", inadimplencia: "Inadimplência", manual: "Manual" };
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0", typeColors[r.type] ?? typeColors.manual)}>
                    {typeLabels[r.type] ?? r.type}
                  </span>
                  <p className="text-xs text-foreground flex-1 truncate">{r.message}</p>
                  {r.studentName && (
                    <span className="text-[10px] text-muted-foreground hidden sm:block flex-shrink-0">{r.studentName}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(r.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  {r.studentPhone && (
                    <a href={`https://wa.me/55${r.studentPhone.replace(/\D/g, "")}?text=${encodeURIComponent(r.message)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors flex-shrink-0">
                      <MessageCircle size={12} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Students Table ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Alunos Recentes</h3>
            <p className="text-xs text-muted-foreground">Últimas matrículas</p>
          </div>
          <a href="/alunos" className="text-xs font-semibold text-primary hover:underline">Ver todos</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Aluno</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Instrumento</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Nível</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Mensalidade</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentStudents ?? []).map((student: NonNullable<typeof recentStudents>[number]) => (
                <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">
                          {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: student.instrumentColor ?? "#6366f1" }} />
                      <span className="text-xs text-foreground">{student.instrumentName ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <LevelBadge level={student.level} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-semibold text-foreground">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      student.status === "ativo" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      student.status === "pausado" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
