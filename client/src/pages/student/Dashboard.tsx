import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ChevronRight,
  BookOpen,
  Music,
  Video,
  FileText
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data: dashboard, isLoading } = trpc.studentPortal.getDashboard.useQuery();

  if (isLoading) return <div>Carregando dashboard...</div>;

  const chartData = [
    { name: 'Dez', progresso: 20 },
    { name: 'Jan', progresso: 45 },
    { name: 'Fev', progresso: 55 },
    { name: 'Mar', progresso: 75 },
    { name: 'Abr', progresso: 70 },
    { name: 'Mai', progresso: 85 },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Olá, {user?.name?.split(' ')[0] || 'Aluno'}! 🎵
        </h1>
        <p className="text-muted-foreground font-medium">Bem-vinda ao seu portal de estudos.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 from-card to-card/50 overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Próxima Aula</p>
                <p className="text-lg font-black text-foreground">
                  {dashboard?.upcomingLessons[0] 
                    ? format(new Date(dashboard.upcomingLessons[0].scheduledAt), "dd 'mai' yyyy", { locale: ptBR })
                    : "Sem aulas"}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                   {dashboard?.upcomingLessons[0] ? format(new Date(dashboard.upcomingLessons[0].scheduledAt), "HH:mm") : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 from-card to-card/50 overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aulas Realizadas</p>
                <p className="text-2xl font-black text-foreground">{dashboard?.stats.lessonsDone || 0}</p>
                <p className="text-xs font-medium text-green-600">Frequência: {dashboard?.stats.frequency}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 from-card to-card/50 overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Exercícios</p>
                <p className="text-2xl font-black text-foreground">{dashboard?.stats.pendingExercises || 0}</p>
                <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 from-card to-card/50 overflow-hidden group hover:scale-[1.02] transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Progresso Geral</p>
                <p className="text-2xl font-black text-foreground">{dashboard?.stats.generalProgress || 0}%</p>
                <p className="text-xs font-bold text-green-600 uppercase">Excelente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Chart */}
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/50 bg-muted/50 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black">Resumo do Progresso</CardTitle>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Últimos 6 meses</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fontWeight: 600, fill: '#64748B'}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fontWeight: 600, fill: '#64748B'}}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      backdropFilter: 'blur(8px)'
                    }}
                    labelStyle={{ fontWeight: 800, color: '#1E293B' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="progresso" 
                    stroke="#7C3AED" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorProg)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-none shadow-xl bg-card/50 bg-muted/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg font-black">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {dashboard?.recentActivities.map((activity, idx) => (
                <div key={activity.id} className="flex gap-4 group cursor-pointer">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                    activity.category === 'tecnica' ? "bg-blue-500/10 text-blue-600" :
                    activity.category === 'teoria' ? "bg-purple-500/10 text-purple-600" :
                    "bg-orange-500/10 text-orange-600"
                  )}>
                    {activity.category === 'tecnica' ? <Music size={18} /> :
                     activity.category === 'teoria' ? <FileText size={18} /> :
                     <Video size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground font-medium">Há {idx + 1} dias</p>
                  </div>
                </div>
              ))}
              {!dashboard?.recentActivities.length && (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
                </div>
              )}
            </div>
            
            <Button variant="ghost" className="w-full mt-6 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5">
              Ver Tudo <ChevronRight size={14} className="ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const Button = ({ children, className, variant, ...props }: any) => {
  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-xl text-sm font-bold transition-all",
        variant === 'ghost' ? "hover:bg-accent" : "bg-primary text-primary-foreground hover:opacity-90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
