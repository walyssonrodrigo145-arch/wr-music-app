import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  BookOpen,
  Music,
  Video,
  FileText,
  Bell,
  Download,
  Play,
  MessageSquare,
  DollarSign,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Search,
  Moon,
  User,
  LayoutDashboard,
  ClipboardCheck,
  Circle,
  QrCode,
  Bot
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { RescheduleModal } from "@/components/RescheduleModal";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const { data: dashboard, isLoading } = trpc.studentPortal.getDashboard.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'Aluno';

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-10 pb-10 max-w-[1600px] mx-auto"
    >
      {/* Welcome Section - Hero Banner */}
      <motion.div variants={item} className="relative overflow-hidden rounded-[2.5rem] md:rounded-[3rem] bg-card text-card-foreground border border-border shadow-sm p-8 md:p-12 mb-4">
        {/* Abstract Glow Effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
             <h1 className="text-3xl md:text-4xl font-black tracking-tighter drop-shadow-sm mb-2 text-foreground">Olá, {firstName}!</h1>
             <p className="text-muted-foreground text-sm md:text-base font-medium max-w-xl">Pronto para dominar seu instrumento hoje? Aqui está o resumo da sua jornada musical.</p>
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-4">
             <button onClick={() => navigate('/aluno/scanner')} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 w-full md:w-auto">
               <QrCode size={16} />
               <span>Marcar Presença</span>
             </button>
             <div className="flex items-center gap-4 bg-muted/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-border w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center text-yellow-950 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nível Atual</p>
                  <p className="text-sm font-black text-foreground">Intermediário</p>
                </div>
             </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards Row - Modern & Refined */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Aulas Realizadas */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-6 border border-border/10 shadow-xl shadow-primary/5 flex flex-col justify-between group overflow-hidden relative transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 opacity-5 group-hover:opacity-10 transition-opacity duration-700 blur-2xl" />
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-background/50 border border-border/50 shadow-inner text-purple-500">
              <Calendar size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Aulas Feitas</h3>
            <p className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-none">{dashboard?.stats?.lessonsDone || 0}</p>
          </div>
        </div>

        {/* Exercícios Pendentes */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-6 border border-border/10 shadow-xl shadow-primary/5 flex flex-col justify-between group overflow-hidden relative transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-5 group-hover:opacity-10 transition-opacity duration-700 blur-2xl" />
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-background/50 border border-border/50 shadow-inner text-emerald-500">
              <ClipboardCheck size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Atividades</h3>
            <p className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-none">{dashboard?.stats?.pendingExercises || 0}</p>
          </div>
        </div>

        {/* Avisos */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2rem] p-6 border border-border/10 shadow-xl shadow-primary/5 flex flex-col justify-between group overflow-hidden relative transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 opacity-5 group-hover:opacity-10 transition-opacity duration-700 blur-2xl" />
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-background/50 border border-border/50 shadow-inner text-orange-500">
              <Bell size={20} strokeWidth={2} />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Avisos</h3>
            <p className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-none">{dashboard?.stats?.unreadAnnouncements || 0}</p>
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Tasks/Info) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Próximas Aulas & Avisos Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Avisos Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 mx-6 px-0 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background/80 shadow-sm flex items-center justify-center text-primary">
                      <Bell size={16} />
                    </div>
                    <CardTitle className="text-base md:text-lg font-black tracking-tight">Mural de Avisos</CardTitle>
                  </div>
                  <button onClick={() => navigate('/aluno/avisos')} className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:text-primary/70 transition-all">Ver todos</button>
                </CardHeader>
                <CardContent className="p-6 space-y-2">
                  {dashboard?.announcements?.map((aviso: any) => (
                    <div key={aviso.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-background/80 transition-all cursor-pointer group shadow-sm">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-all",
                        aviso.important ? "bg-primary shadow-[0_0_10px_rgba(124,58,237,0.8)] animate-pulse" : "bg-muted-foreground/30"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">{aviso.title}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-1.5 uppercase tracking-widest">{aviso.date}</p>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.announcements || dashboard.announcements.length === 0) && (
                    <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                      <Bell size={24} className="mb-3 opacity-50" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem novidades por aqui</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Materiais Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 mx-6 px-0 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background/80 shadow-sm flex items-center justify-center text-primary">
                      <BookOpen size={16} />
                    </div>
                    <CardTitle className="text-base md:text-lg font-black tracking-tight">Acervo Musical</CardTitle>
                  </div>
                  <button onClick={() => navigate('/aluno/materiais')} className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:text-primary/70 transition-all">Explorar</button>
                </CardHeader>
                <CardContent className="p-6 space-y-2">
                  {dashboard?.materials?.map((mat: any) => (
                    <div key={mat.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-background/80 transition-all cursor-pointer group shadow-sm">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                        mat.category === 'pdf' ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white" : 
                        mat.category === 'video' ? "bg-gradient-to-br from-pink-400 to-pink-600 text-white" : 
                        "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                      )}>
                        {mat.category === 'pdf' ? <FileText size={16} /> : 
                         mat.category === 'video' ? <Video size={16} /> : 
                         <Music size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{mat.fileName}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-70">
                           {mat.category} • {(mat.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background/80 text-foreground group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                        {mat.category === 'video' || mat.category === 'audio' ? <Play size={12} fill="currentColor" /> : <Download size={12} />}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Financeiro & Mensagens Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Financeiro */}
            {/* Financeiro */}
            <motion.div variants={item}>
              <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl h-full rounded-[2rem] md:rounded-[2.5rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/10 mx-6 px-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background/80 shadow-sm flex items-center justify-center text-primary">
                      <DollarSign size={16} />
                    </div>
                    <CardTitle className="text-base md:text-lg font-black tracking-tight">Assinatura</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="mensalidades" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-background/80 p-1.5 rounded-2xl mb-8 h-12 shadow-inner">
                      <TabsTrigger value="mensalidades" className="rounded-xl text-[10px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Faturas</TabsTrigger>
                      <TabsTrigger value="historico" className="rounded-xl text-[10px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Histórico</TabsTrigger>
                    </TabsList>
                    <TabsContent value="mensalidades" className="space-y-4">
                      {dashboard?.payments?.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-4 rounded-[1.5rem] bg-background/40 hover:bg-background/80 transition-all shadow-sm group border border-transparent hover:border-primary/20">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <DollarSign size={16} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-foreground">
                                  {format(new Date(payment.dueDate), "MMMM / yy", { locale: ptBR })}
                                </p>
                                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1">Vence {format(new Date(payment.dueDate), "dd/MM")}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-3 py-1.5 rounded-full shadow-sm",
                              payment.status === 'pago' ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white" : "bg-background/80 text-foreground border border-border/50"
                            )}>
                              {payment.status === 'pago' ? 'Pago' : 'Pendente'}
                            </span>
                            <button className="w-8 h-8 rounded-full flex items-center justify-center bg-background/80 text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm">
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => navigate('/aluno/pagamentos')} className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-95 transition-all">
                         Gerenciar Financeiro
                      </button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>


          </div>
        </div>

        {/* Right Column (Focus & Actions) */}
        <div className="space-y-10">
          
          {/* Próxima Aula Card - Premium Highlight */}
          {/* Próxima Aula Card - Premium Highlight */}
          <motion.div variants={item}>
             {dashboard?.upcomingLessons[0] && (
               <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl overflow-hidden relative group rounded-[2rem]">
                 <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-all duration-700 group-hover:scale-125 text-primary">
                    <Music className="w-24 h-24 md:w-32 md:h-32" strokeWidth={1} />
                 </div>
                 <CardContent className="p-6 md:p-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4 md:mb-6">
                       <Clock size={12} className="animate-pulse" />
                       Falta Pouco!
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sua Próxima Aula</p>
                    <h3 className="text-xl md:text-2xl font-black mt-2 md:mt-3 leading-tight tracking-tight text-foreground">
                       {format(new Date(dashboard.upcomingLessons[0].scheduledAt), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="mt-6 md:mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Horário</p>
                          <p className="text-lg md:text-xl font-black text-foreground">{format(new Date(dashboard.upcomingLessons[0].scheduledAt), "HH:mm")}h</p>
                       </div>
                       <div className="hidden sm:block w-px h-10 bg-border/50" />
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Professor</p>
                          <p className="text-lg md:text-xl font-black text-foreground">{dashboard.teacherName.split(' ')[0]}</p>
                       </div>
                    </div>
                    <div className="mt-8 md:mt-10 flex flex-col gap-3">
                      <button onClick={() => navigate('/aluno/aulas')} className="w-full py-4 md:py-5 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                         Ver Conteúdo da Aula
                      </button>
                      <button onClick={() => setRescheduleModalOpen(true)} className="w-full py-4 md:py-5 bg-primary/10 text-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                         <Bot size={14} /> Remarcar / Reposição
                      </button>
                    </div>
                 </CardContent>
               </Card>
             )}
          </motion.div>

          {/* Exercícios Card */}
          <motion.div variants={item}>
            <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl rounded-[2rem] overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background/80 shadow-sm flex items-center justify-center text-primary">
                    <ClipboardCheck size={16} />
                  </div>
                  <CardTitle className="text-base md:text-lg font-black tracking-tight">Prática</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-4">
                <Tabs defaultValue="pendentes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-background/80 p-1 rounded-2xl mb-8 h-10 shadow-inner">
                    <TabsTrigger value="pendentes" className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Missões</TabsTrigger>
                    <TabsTrigger value="enviados" className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Enviados</TabsTrigger>
                    <TabsTrigger value="concluidos" className="rounded-xl text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">XP</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pendentes" className="space-y-3">
                    {dashboard?.pendingGoals?.length === 0 ? (
                      <div className="text-center py-10 bg-muted/10 rounded-3xl border border-dashed border-border/50">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                           <CheckCircle2 size={20} />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-relaxed">Missões Cumpridas!<br/>Você está em dia.</p>
                      </div>
                    ) : dashboard?.pendingGoals?.map((ex: any) => (
                      <div key={ex.id} className="p-4 rounded-2xl bg-background/40 hover:bg-background/80 transition-all cursor-pointer group shadow-sm border border-transparent hover:border-primary/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-purple-500 group-hover:text-white transition-all shadow-sm">
                               <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-foreground leading-tight group-hover:text-primary transition-colors">{ex.title}</p>
                              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1.5 opacity-70">
                                Liberação: {format(new Date(ex.createdAt), "dd MMM")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => navigate('/aluno/exercicios')} className="w-full mt-6 py-4 text-[10px] font-black text-primary bg-primary/5 hover:bg-primary/10 rounded-2xl transition-colors uppercase tracking-[0.2em]">
                      Abrir Treinamentos
                    </button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Atalhos Rápidos */}
          <motion.div variants={item}>
            <Card className="border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-background/60 backdrop-blur-3xl rounded-[2rem] overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-border/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background/80 shadow-sm flex items-center justify-center text-primary">
                    <LayoutDashboard size={16} />
                  </div>
                  <CardTitle className="text-base md:text-lg font-black tracking-tight">Central Rápida</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <button onClick={() => {
                   if (dashboard?.upcomingLessons[0]) {
                     setRescheduleModalOpen(true);
                   } else {
                     navigate('/aluno/aulas');
                   }
                }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-background/40 hover:bg-background/80 transition-all group shadow-sm border border-transparent hover:border-primary/20">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm relative">
                       <Bot size={16} />
                       <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse border border-card"></div>
                     </div>
                     <p className="text-sm font-black text-foreground">Remarcação c/ Robô</p>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Security Footer - Refined */}
      <motion.div variants={item} className="pt-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 md:p-8 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
           <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20 shrink-0 shadow-inner">
             <ShieldCheck size={24} />
           </div>
           <div className="flex-1 text-center sm:text-left">
             <h4 className="text-sm font-black text-emerald-700 uppercase tracking-widest mb-1">Ambiente Seguro & Criptografado</h4>
             <p className="text-xs text-muted-foreground font-medium leading-relaxed">Você está em uma área de acesso exclusivo. Todas as suas informações de progresso, mensagens e dados financeiros são protegidos por criptografia de ponta a ponta.</p>
           </div>
           <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl text-[10px] font-black text-emerald-600 border border-emerald-500/20 uppercase tracking-widest">
              <Circle size={8} fill="currentColor" className="animate-pulse" />
              Conexão Segura
           </div>
        </div>
      </motion.div>

      {/* Reschedule Modal */}
      {dashboard?.upcomingLessons[0] && (
        <RescheduleModal
          open={rescheduleModalOpen}
          onOpenChange={setRescheduleModalOpen}
          lessonId={dashboard.upcomingLessons[0].id}
          lessonTitle={dashboard.upcomingLessons[0].title}
        />
      )}
    </motion.div>
  );
}
