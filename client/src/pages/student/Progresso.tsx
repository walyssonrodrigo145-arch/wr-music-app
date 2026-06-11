import { trpc } from "@/lib/trpc";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Target, 
  CheckCircle2, 
  Clock, 
  Star,
  Award,
  Zap,
  ChevronRight,
  Info
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function StudentProgress() {
  const { data: progress, isLoading: isProgressLoading } = trpc.studentPortal.getProgress.useQuery();
  const { data: activePlan, isLoading: isPlanLoading, refetch: refetchPlan } = trpc.progress.getActiveStudyPlan.useQuery();

  const toggleDayMutation = trpc.progress.toggleStudyPlanDay.useMutation({
    onSuccess: (data) => {
      refetchPlan();
      if (data.allCompleted) {
        toast.success("Parabéns! Você gabaritou a semana! 🎉 Seu professor foi notificado do seu esforço!");
      } else {
        toast.success("Treino do dia marcado como concluído! Continue assim!");
      }
    },
    onError: (e) => toast.error("Erro ao registrar treino: " + e.message)
  });

  if (isProgressLoading || isPlanLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const skills = [
    { name: "Técnica Vocal", value: 90, color: "#8B5CF6" },
    { name: "Harmonia", value: 85, color: "#3B82F6" },
    { name: "Ritmo", value: 80, color: "#10B981" },
    { name: "Leitura", value: 88, color: "#F59E0B" },
    { name: "Teoria", value: 85, color: "#EC4899" },
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
          <p className="text-muted-foreground font-medium">Visualize sua evolução musical através de dados e conquistas.</p>
        </div>
        <select className="bg-card border border-border rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
          <option>Últimos 6 meses</option>
          <option>Último ano</option>
        </select>
      </div>

      {/* Summary Cards */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { label: "Performance Geral", value: "87%", sub: "Top 5% da Escola", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
          { label: "Aulas Concluídas", value: progress?.stats.lessonsDone || 0, sub: "Meta: 50", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Exercícios", value: "18", sub: "100% Taxa de Entrega", icon: Target, color: "text-green-600", bg: "bg-green-100" },
          { label: "Frequência", value: "95%", sub: "Assiduidade Exemplar", icon: Zap, color: "text-orange-600", bg: "bg-orange-100" },
        ].map((stat, i) => (
          <motion.div variants={item} key={i}>
            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:scale-[1.02] transition-transform">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                   <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                      <stat.icon size={20} />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
                </div>
                <p className={cn("text-4xl font-black mb-1", stat.color)}>{stat.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Daily Study Plan Section */}
      {activePlan && (
        <Card className="border-none shadow-2xl bg-gradient-to-br from-amber-500 to-orange-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
             <Star size={120} />
          </div>
          <CardHeader className="pb-4 border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                <Target size={20} />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-white uppercase tracking-tight">Seu Plano de Treino Diário</CardTitle>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Sugerido pelo seu professor</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 bg-card text-foreground">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-y-auto subtle-scrollbar pr-4">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activePlan.planText}
                 </ReactMarkdown>
               </div>
               
               <div className="bg-muted/50 rounded-2xl p-6 border border-border flex flex-col justify-center">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-center">Dar Baixa no Treino</h3>
                  <p className="text-xs text-muted-foreground text-center mb-6">Marque os dias que você já treinou essa semana. Seja honesto! 😉</p>
                  
                  <div className="flex justify-center gap-3 flex-wrap">
                    {[1, 2, 3, 4, 5].map((dayNum, index) => {
                      const daysCompleted = JSON.parse(activePlan.daysCompleted as string);
                      const isCompleted = daysCompleted[index];
                      return (
                        <button
                          key={dayNum}
                          onClick={() => toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: index })}
                          disabled={toggleDayMutation.isPending}
                          className={cn(
                            "flex flex-col items-center justify-center w-16 h-20 rounded-2xl border-2 transition-all group shadow-sm",
                            isCompleted 
                              ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-600 hover:border-orange-600" 
                              : "bg-background border-border text-muted-foreground hover:border-orange-300 hover:bg-orange-50"
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest mb-2">Dia</span>
                          <span className="text-2xl font-black leading-none">{dayNum}</span>
                          {isCompleted && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white border-2 border-card shadow-sm">
                               <CheckCircle2 size={14} />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {activePlan.status === 'concluido' && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                        <p className="text-green-600 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                           <Award size={16} /> Semana concluída!
                        </p>
                     </motion.div>
                  )}
               </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evolution Chart */}
        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <TrendingUp size={20} />
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Curva de Aprendizado</CardTitle>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
               <TrendingUp size={10} /> +12% esse mês
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="progGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                      padding: '16px'
                    }} 
                    itemStyle={{ fontSize: '12px', fontWeight: 900, color: '#8B5CF6' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="val" 
                    stroke="#8B5CF6" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#progGradient)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Skills Progress */}
        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl">
          <CardHeader className="pb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Star size={20} />
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Habilidades Dominadas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {skills.map((skill) => (
              <div key={skill.name} className="space-y-3 group cursor-default">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-primary">{skill.value}%</span>
                    <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${skill.value}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                    style={{ backgroundColor: skill.color }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-6 mt-6 border-t border-border flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Award size={24} />
               </div>
               <div className="flex-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">Próxima Conquista</p>
                  <p className="text-xs text-muted-foreground font-medium">Complete 5 exercícios de harmonia para liberar o selo "Harmonizador".</p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proactive Tip */}
      <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
               <Zap size={24} fill="currentColor" />
            </div>
            <div>
               <h4 className="text-base font-black text-foreground">Como melhorar seu progresso?</h4>
               <p className="text-sm text-muted-foreground font-medium">Participe dos fóruns e tire dúvidas no chat para subir de nível mais rápido.</p>
            </div>
         </div>
         <button className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap">
            Falar com Suporte
         </button>
      </div>
    </div>
  );
}
