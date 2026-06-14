import { useAuth } from "@/_core/hooks/useAuth";
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
  Circle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";

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
      {/* Welcome Section */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Olá, {firstName}! 👋</h1>
           <p className="text-muted-foreground text-sm md:text-base font-medium mt-1">Aqui está um resumo da sua jornada musical hoje.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nível de Progresso</p>
              <p className="text-sm font-black text-primary">Intermediário • 65%</p>
           </div>
           <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <TrendingUp size={24} />
           </div>
        </div>
      </motion.div>

      {/* Stats Cards Row - Modern & Refined */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Aulas Realizadas */}
        <Card className="border-none shadow-xl bg-card/40 backdrop-blur-md overflow-hidden group hover:-translate-y-2 transition-all duration-500 rounded-[2rem] md:rounded-[2.5rem]">
          <CardContent className="p-5 md:p-8 flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-purple-500/10 flex items-center justify-center text-purple-600 shadow-inner group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Aulas Realizadas</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl md:text-4xl font-black tracking-tight">{dashboard?.stats?.lessonsDone || 0}</h3>
                <span className="text-[10px] md:text-xs font-bold text-muted-foreground">no mês</span>
              </div>
              <div className="mt-2 md:mt-3 flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                <TrendingUp size={14} /> + 12% vs mês passado
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercícios Pendentes */}
        <Card className="border-none shadow-xl bg-card/40 backdrop-blur-md overflow-hidden group hover:-translate-y-2 transition-all duration-500 rounded-[2rem] md:rounded-[2.5rem]">
          <CardContent className="p-5 md:p-8 flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 transition-transform">
              <ClipboardCheck className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Atividades</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl md:text-4xl font-black tracking-tight">{dashboard?.stats?.pendingExercises || 0}</h3>
                <span className="text-[10px] md:text-xs font-bold text-muted-foreground">pendentes</span>
              </div>
              <p className="mt-2 md:mt-3 text-[9px] md:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Pratique hoje mesmo</p>
            </div>
          </CardContent>
        </Card>

        {/* Avisos */}
        <Card className="border-none shadow-xl bg-card/40 backdrop-blur-md overflow-hidden group hover:-translate-y-2 transition-all duration-500 rounded-[2rem] md:rounded-[2.5rem]">
          <CardContent className="p-5 md:p-8 flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-orange-500/10 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 transition-transform">
              <Bell className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Notificações</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl md:text-4xl font-black tracking-tight">{dashboard?.stats?.unreadAnnouncements || 0}</h3>
                <span className="text-[10px] md:text-xs font-bold text-muted-foreground">não lidas</span>
              </div>
              <p className="mt-2 md:mt-3 text-[9px] md:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Fique por dentro</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column (Main Tasks/Info) */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Próximas Aulas & Avisos Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Avisos Section */}
            <motion.div variants={item}>
              <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/30 mx-4 md:mx-6 px-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Bell size={18} />
                    </div>
                    <CardTitle className="text-base md:text-lg font-bold tracking-tight">Últimos Avisos</CardTitle>
                  </div>
                  <button onClick={() => navigate('/aluno/avisos')} className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-widest hover:underline px-3 py-1 bg-primary/5 rounded-full border border-primary/10">Ver todos</button>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                  {dashboard?.announcements?.map((aviso: any) => (
                    <div key={aviso.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer group border border-transparent hover:border-primary/10">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 transition-all",
                        aviso.important ? "bg-primary shadow-[0_0_12px_rgba(124,58,237,0.8)] animate-pulse" : "bg-muted-foreground/20"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{aviso.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 font-medium">{aviso.author} • {aviso.date}</p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/30 mt-1 group-hover:text-primary transition-all group-hover:translate-x-1" />
                    </div>
                  ))}
                  {(!dashboard?.announcements || dashboard.announcements.length === 0) && (
                    <div className="py-8 text-center">
                      <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">Sem novos avisos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Materiais Section */}
            <motion.div variants={item}>
              <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/30 mx-6 px-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <BookOpen size={18} />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight">Materiais Recentes</CardTitle>
                  </div>
                  <button onClick={() => navigate('/aluno/materiais')} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline px-3 py-1 bg-primary/5 rounded-full border border-primary/10">Explorar</button>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {dashboard?.materials?.map((mat: any) => (
                    <div key={mat.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 transition-all cursor-pointer group border border-transparent hover:border-primary/10">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm",
                        mat.category === 'pdf' ? "bg-blue-500/10 text-blue-600" : 
                        mat.category === 'video' ? "bg-pink-500/10 text-pink-600" : 
                        "bg-emerald-500/10 text-emerald-600"
                      )}>
                        {mat.category === 'pdf' ? <FileText size={22} /> : 
                         mat.category === 'video' ? <Video size={22} /> : 
                         <Music size={22} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{mat.fileName}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-60">
                           {mat.category} • {(mat.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all">
                        {mat.category === 'video' || mat.category === 'audio' ? <Play size={16} fill="currentColor" /> : <Download size={16} />}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Financeiro & Mensagens Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Financeiro */}
            <motion.div variants={item}>
              <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/30 mx-6 px-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <DollarSign size={18} />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight">Financeiro</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <Tabs defaultValue="mensalidades" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1.5 rounded-2xl mb-8 h-12 border border-border/30 shadow-inner">
                      <TabsTrigger value="mensalidades" className="rounded-xl text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">Pêndencias</TabsTrigger>
                      <TabsTrigger value="historico" className="rounded-xl text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">Histórico</TabsTrigger>
                    </TabsList>
                    <TabsContent value="mensalidades" className="space-y-4">
                      {dashboard?.payments?.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-5 rounded-[1.5rem] border border-border/40 bg-background/40 hover:border-primary/20 transition-all shadow-sm group">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                                <DollarSign size={18} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-foreground">
                                  {format(new Date(payment.dueDate), "MMMM / yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Vence {format(new Date(payment.dueDate), "dd/MM")}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-3 py-1.5 rounded-full shadow-sm border",
                              payment.status === 'pago' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            )}>
                              {payment.status === 'pago' ? 'Liquidado' : 'Pendente'}
                            </span>
                            <button className="text-muted-foreground hover:text-primary hover:scale-110 transition-all">
                              <Download size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => navigate('/aluno/pagamentos')} className="w-full mt-4 py-4 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-[0.1em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                         Gerenciar Financeiro
                      </button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mensagens */}
            <motion.div variants={item}>
              <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md h-full rounded-[2rem] overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/30 mx-6 px-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <MessageSquare size={18} />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight">Chat Direto</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {dashboard?.messages?.map((msg: any) => (
                    <Link key={msg.id} href="/aluno/mensagens">
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/40 hover:bg-primary/5 transition-all cursor-pointer group border border-border/20 hover:border-primary/20">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform shrink-0">
                           {msg.senderName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-black text-foreground truncate">Prof. {msg.senderName.split(' ')[0]}</p>
                            <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase">{format(new Date(msg.createdAt), "HH:mm")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate font-medium">{msg.content}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <button onClick={() => navigate('/aluno/mensagens')} className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-all">
                     Nova Mensagem
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Right Column (Focus & Actions) */}
        <div className="space-y-10">
          
          {/* Próxima Aula Card - Premium Highlight */}
          <motion.div variants={item}>
             {dashboard?.upcomingLessons[0] && (
               <Card className="border-none shadow-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-white overflow-hidden relative group rounded-[2rem] md:rounded-[2.5rem]">
                 <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 group-hover:opacity-20 transition-all duration-700 group-hover:scale-125">
                    <Music className="w-32 h-32 md:w-48 md:h-48" strokeWidth={1} />
                 </div>
                 <CardContent className="p-6 md:p-10 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 mb-4 md:mb-6">
                       <Clock size={12} className="animate-pulse" />
                       Falta Pouco!
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Sua Próxima Aula</p>
                    <h3 className="text-2xl md:text-3xl font-black mt-2 md:mt-3 leading-tight tracking-tight">
                       {format(new Date(dashboard.upcomingLessons[0].scheduledAt), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="mt-6 md:mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">
                       <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Horário</p>
                          <p className="text-lg md:text-xl font-black">{format(new Date(dashboard.upcomingLessons[0].scheduledAt), "HH:mm")}h</p>
                       </div>
                       <div className="hidden sm:block w-px h-10 bg-white/20" />
                       <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Professor</p>
                          <p className="text-lg md:text-xl font-black">{dashboard.teacherName.split(' ')[0]}</p>
                       </div>
                    </div>
                    <button onClick={() => navigate('/aluno/aulas')} className="w-full mt-8 md:mt-10 py-4 md:py-5 bg-white text-primary rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-black/20 hover:scale-[1.05] active:scale-95 transition-all">
                       Ver Conteúdo da Aula
                    </button>
                 </CardContent>
               </Card>
             )}
          </motion.div>

          {/* Exercícios Card */}
          <motion.div variants={item}>
            <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck size={20} />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight">Atividades do Dia</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-2">
                <Tabs defaultValue="pendentes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/40 p-1 rounded-xl mb-8 border border-border/20">
                    <TabsTrigger value="pendentes" className="rounded-lg text-[9px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Praticar</TabsTrigger>
                    <TabsTrigger value="enviados" className="rounded-lg text-[9px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Enviados</TabsTrigger>
                    <TabsTrigger value="concluidos" className="rounded-lg text-[9px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Feitos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pendentes" className="space-y-4">
                    {dashboard?.pendingGoals?.length === 0 ? (
                      <div className="text-center py-10 bg-muted/20 rounded-3xl border border-dashed border-border/50">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/30 mb-4" />
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">Você está em dia!<br/>Nenhum exercício pendente.</p>
                      </div>
                    ) : dashboard?.pendingGoals?.map((ex: any) => (
                      <div key={ex.id} className="p-5 rounded-2xl bg-background/40 border border-border/40 hover:border-primary/30 transition-all cursor-pointer group shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                               <FileText size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-foreground leading-tight">{ex.title}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1 opacity-60">
                                {format(new Date(ex.createdAt), "dd 'de' MMM")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => navigate('/aluno/exercicios')} className="w-full mt-4 py-4 text-xs font-black text-primary hover:bg-primary/5 rounded-2xl transition-colors uppercase tracking-[0.1em]">
                      Abrir Área de Treino
                    </button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Atalhos Rápidos */}
          <motion.div variants={item}>
            <Card className="border border-border/40 shadow-xl bg-card/40 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <PlusCircle size={20} />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight">Atalhos</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-2 space-y-4">
                <button onClick={() => navigate('/aluno/solicitar-reposicao')} className="w-full flex items-center justify-between p-5 rounded-2xl bg-background/40 border border-border/40 hover:bg-primary/5 hover:border-primary/20 transition-all group shadow-sm">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <PlusCircle size={20} />
                     </div>
                     <p className="text-sm font-bold text-foreground">Solicitar Reposição</p>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>

                <button onClick={() => navigate('/aluno/solicitar-remarcacao')} className="w-full flex items-center justify-between p-5 rounded-2xl bg-background/40 border border-border/40 hover:bg-primary/5 hover:border-primary/20 transition-all group shadow-sm">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Clock size={20} />
                     </div>
                     <p className="text-sm font-bold text-foreground">Solicitar Remarcação</p>
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
        <div className="flex flex-col sm:flex-row items-center gap-6 p-8 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
           <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20 shrink-0 shadow-inner">
             <ShieldCheck size={28} />
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
    </motion.div>
  );
}
