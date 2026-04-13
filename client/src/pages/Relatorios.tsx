import { trpc } from "@/lib/trpc";
import { BarChart3 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

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
  const { data: monthlyData } = trpc.dashboard.monthlyStats.useQuery();
  const { data: dayData } = trpc.dashboard.lessonsByDay.useQuery();

  const revenueData = (monthlyData ?? []).map(d => ({
    month: d.month,
    Receita: d.receita,
  }));

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
          <BarChart3 size={20} className="text-pink-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Relatórios</h2>
          <p className="text-xs text-muted-foreground">Análises e estatísticas detalhadas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {/* Aulas e alunos comparativo */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-1">Aulas vs Alunos</h3>
          <p className="text-xs text-muted-foreground mb-4">Comparativo mensal</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData ?? []} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.89 0.01 260 / 50%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.02 260)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="alunos" name="Alunos" fill="oklch(0.52 0.22 264)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aulas" name="Aulas" fill="oklch(0.58 0.24 295)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
