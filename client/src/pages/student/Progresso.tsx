import { trpc } from "@/lib/trpc";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StudentProgress() {
  const { data: progress, isLoading } = trpc.studentPortal.getProgress.useQuery();

  if (isLoading) return <div>Carregando progresso...</div>;

  const skills = [
    { name: "Técnica Vocal", value: 90 },
    { name: "Harmonia", value: 85 },
    { name: "Ritmo", value: 80 },
    { name: "Leitura", value: 88 },
    { name: "Teoria", value: 85 },
  ];

  const chartData = [
    { name: 'Dez', val: 20 },
    { name: 'Jan', val: 45 },
    { name: 'Fev', val: 35 },
    { name: 'Mar', val: 65 },
    { name: 'Abr', val: 55 },
    { name: 'Mai', val: 87 },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Meu Progresso</h1>
          <p className="text-muted-foreground font-medium">Acompanhe sua evolução musical detalhada.</p>
        </div>
        <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none">
          <option>Últimos 6 meses</option>
          <option>Último ano</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Desempenho Geral", value: "87%", sub: "Excelente", color: "text-purple-600" },
          { label: "Aulas Concluídas", value: progress?.stats.lessonsDone || 0, sub: "Total", color: "text-blue-600" },
          { label: "Exercícios Concluídos", value: "18", sub: "Total", color: "text-green-600" },
          { label: "Frequência", value: "95%", sub: "Excelente", color: "text-orange-600" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{stat.label}</p>
              <p className={cn("text-3xl font-black mb-1", stat.color)}>{stat.value}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evolution Chart */}
        <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black">Evolução no Período</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="progGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                  <Area type="monotone" dataKey="val" stroke="#2563EB" strokeWidth={4} fillOpacity={1} fill="url(#progGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Skills Progress */}
        <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black">Habilidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {skills.map((skill) => (
              <div key={skill.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground">{skill.name}</span>
                  <span className="text-xs font-black text-primary">{skill.value}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out" 
                    style={{ width: `${skill.value}%` }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
