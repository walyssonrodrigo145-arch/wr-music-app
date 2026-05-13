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
import { Link } from "wouter";
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
      className="space-y-8 pb-10"
    >

      {/* Stats Cards Row */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Aulas Realizadas */}
        <Card className="border-none shadow-xl bg-white dark:bg-card/50 overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Calendar size={28} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-muted-foreground">Aulas Realizadas</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black">{dashboard?.stats.lessonsDone || 0}</h3>
                <span className="text-xs font-bold text-muted-foreground">este mês</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-green-500 uppercase">
                <TrendingUp size={12} /> + 10% vs mês anterior
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercícios Pendentes */}
        <Card className="border-none shadow-xl bg-white dark:bg-card/50 overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center text-green-600">
              <CheckCircle2 size={28} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-muted-foreground">Exercícios Pendentes</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black">{dashboard?.stats.pendingExercises || 0}</h3>
                <span className="text-xs font-bold text-muted-foreground">para entregar</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avisos Não Lidos */}
        <Card className="border-none shadow-xl bg-white dark:bg-card/50 overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center text-orange-600">
              <Bell size={28} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-muted-foreground">Avisos Não Lidos</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black">{dashboard?.stats.unreadAnnouncements || 0}</h3>
                <span className="text-xs font-bold text-muted-foreground">avisos importantes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left & Center Column (Col Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Avisos Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-xl bg-white dark:bg-card/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-primary" />
                    <CardTitle className="text-lg font-black">Avisos</CardTitle>
                  </div>
                  <Link href="/aluno/avisos">
                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver todos</button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {dashboard?.announcements.map((aviso: any) => (
                    <div key={aviso.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                        aviso.important ? "bg-primary shadow-[0_0_8px_rgba(124,58,237,0.6)]" : "bg-muted"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{aviso.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{aviso.author}</p>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{aviso.date}</span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Link href="/aluno/avisos">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black text-primary hover:bg-primary/5 transition-colors uppercase tracking-widest">
                        Ver todos os avisos
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Materiais Recentes Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-xl bg-white dark:bg-card/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-primary" />
                    <CardTitle className="text-lg font-black">Materiais Recentes</CardTitle>
                  </div>
                  <Link href="/aluno/materiais">
                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver todos</button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {dashboard?.materials.map((mat: any) => (
                    <div key={mat.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {mat.category === 'pdf' ? <FileText size={20} /> : 
                         mat.category === 'video' ? <Video size={20} /> : 
                         <Music size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{mat.fileName}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase">{mat.category} • {(mat.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm">
                        {mat.category === 'video' || mat.category === 'audio' ? <Play size={14} /> : <Download size={14} />}
                      </button>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Link href="/aluno/materiais">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black text-primary hover:bg-primary/5 transition-colors uppercase tracking-widest">
                        Ver todos os materiais
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Financeiro Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-xl bg-white dark:bg-card/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-primary" />
                    <CardTitle className="text-lg font-black">Financeiro</CardTitle>
                  </div>
                  <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver todos</button>
                </CardHeader>
                <CardContent className="pt-4">
                  <Tabs defaultValue="mensalidades" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-xl mb-4 h-10">
                      <TabsTrigger value="mensalidades" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Mensalidades</TabsTrigger>
                      <TabsTrigger value="historico" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Histórico</TabsTrigger>
                    </TabsList>
                    <TabsContent value="mensalidades" className="space-y-3">
                      {dashboard?.payments.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-secondary/20">
                          <div>
                            <p className="text-sm font-black text-foreground">
                              {format(new Date(payment.dueDate), "MMMM / yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">Vencimento: {format(new Date(payment.dueDate), "dd/MM/yyyy")}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2.5 py-1 rounded-full",
                              payment.status === 'pago' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                            )}>
                              {payment.status === 'pago' ? 'Paga' : 'Pendente'}
                            </span>
                            <button className="text-muted-foreground hover:text-primary transition-colors">
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2">
                        <Link href="/aluno/pagamentos">
                          <button className="w-full py-2.5 rounded-xl text-xs font-black text-primary hover:bg-primary/5 transition-colors uppercase tracking-widest">
                            Ver histórico financeiro
                          </button>
                        </Link>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mensagens Section */}
            <motion.div variants={item}>
              <Card className="border-none shadow-xl bg-white dark:bg-card/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-primary" />
                    <CardTitle className="text-lg font-black">Mensagens</CardTitle>
                  </div>
                  <Link href="/aluno/mensagens">
                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver todos</button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {dashboard?.messages.map((msg: any) => (
                    <Link key={msg.id} href="/aluno/mensagens">
                      <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0 border border-border/50">
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-primary font-bold text-xs">
                            {msg.senderName.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-foreground truncate">{msg.senderName}</p>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), "HH:mm")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate font-medium">{msg.content}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <div className="pt-2">
                    <Link href="/aluno/mensagens">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black text-primary hover:bg-primary/5 transition-colors uppercase tracking-widest">
                        Abrir mensagens
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Exercícios Pendentes Section */}
          <motion.div variants={item}>
            <Card className="border-none shadow-xl bg-white dark:bg-card/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-primary" />
                  <CardTitle className="text-lg font-black">Exercícios Pendentes</CardTitle>
                </div>
                <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver todos</button>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs defaultValue="pendentes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/50 p-1 rounded-xl mb-4 h-10">
                    <TabsTrigger value="pendentes" className="rounded-lg text-[9px] font-black uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-sm px-1">Pendentes</TabsTrigger>
                    <TabsTrigger value="enviados" className="rounded-lg text-[9px] font-black uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-sm px-1">Enviados</TabsTrigger>
                    <TabsTrigger value="concluidos" className="rounded-lg text-[9px] font-black uppercase tracking-tighter data-[state=active]:bg-white data-[state=active]:shadow-sm px-1">Concluídos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pendentes" className="space-y-3">
                    {dashboard?.pendingGoals?.length === 0 ? (
                      <div className="text-center py-6">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs font-bold text-muted-foreground">Nenhum exercício pendente</p>
                      </div>
                    ) : dashboard?.pendingGoals?.map((ex: any) => (
                      <div key={ex.id} className="p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                               <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{ex.title}</p>
                              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                Enviado em {format(new Date(ex.createdAt), "dd/MM")}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Pendente</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2">
                      <button className="w-full py-2.5 rounded-xl text-xs font-black text-primary hover:bg-primary/5 transition-colors uppercase tracking-widest">
                        Ver todos os exercícios
                      </button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Atalhos Section */}
          <motion.div variants={item}>
            <Card className="border-none shadow-xl bg-white dark:bg-card/50 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <LayoutDashboard size={18} className="text-primary" />
                  <CardTitle className="text-lg font-black">Atalhos</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all group">
                   <div className="flex items-center gap-3 text-left">
                     <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                       <PlusCircle size={18} />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-foreground">Solicitar Reposição</p>
                       <p className="text-[10px] text-muted-foreground font-medium">Solicite reposição de aulas</p>
                     </div>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all group">
                   <div className="flex items-center gap-3 text-left">
                     <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                       <Clock size={18} />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-foreground">Solicitar Remarcação</p>
                       <p className="text-[10px] text-muted-foreground font-medium">Solicite remarcação de aulas</p>
                     </div>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all group">
                   <div className="flex items-center gap-3 text-left">
                     <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                       <Calendar size={18} />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-foreground">Ver Agenda</p>
                       <p className="text-[10px] text-muted-foreground font-medium">Consulte seus próximos horários</p>
                     </div>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Próximas Aulas (Simplified Card) */}
          <motion.div variants={item}>
             {dashboard?.upcomingLessons[0] && (
               <Card className="border-none shadow-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white overflow-hidden relative group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Music size={120} strokeWidth={1} />
                 </div>
                 <CardContent className="p-6 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Sua Próxima Aula</p>
                    <h3 className="text-2xl font-black mt-2">
                       {format(new Date(dashboard.upcomingLessons[0].scheduledAt), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="mt-6 flex items-center gap-6">
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Horário</p>
                          <p className="text-lg font-bold">{format(new Date(dashboard.upcomingLessons[0].scheduledAt), "HH:mm")}</p>
                       </div>
                       <div className="w-px h-8 bg-white/20" />
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Professor</p>
                          <p className="text-lg font-bold">{dashboard.teacherName}</p>
                       </div>
                    </div>
                    <button className="w-full mt-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                       Ver detalhes da aula
                    </button>
                 </CardContent>
               </Card>
             )}
          </motion.div>

        </div>

      </div>

      {/* Security Footer Card */}
      <motion.div variants={item} className="pt-4">
        <Card className="border-none shadow-lg bg-primary/5 border-l-4 border-l-primary rounded-xl overflow-hidden">
           <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-primary">Acesso Restrito</p>
                <p className="text-xs text-muted-foreground font-medium">Você está acessando sua área exclusiva. Seus dados estão protegidos e apenas você pode visualizar suas informações.</p>
              </div>
           </CardContent>
        </Card>
      </motion.div>

    </motion.div>
  );
}
