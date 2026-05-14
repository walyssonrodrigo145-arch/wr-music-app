import { trpc } from "@/lib/trpc";
import { 
  Calendar, 
  Clock, 
  User,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  History,
  LayoutGrid,
  CalendarDays,
  MoreVertical,
  MapPin,
  ExternalLink
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RescheduleModal } from "@/components/RescheduleModal";
import { motion, AnimatePresence } from "framer-motion";

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

export default function StudentLessons() {
  const { data: lessons, isLoading } = trpc.studentPortal.getLessons.useQuery();
  const { data: profile } = trpc.studentPortal.getProfile.useQuery();
  const [activeTab, setActiveTab] = useState("proximas");
  const [selectedLesson, setSelectedLesson] = useState<{ id: number, title: string } | null>(null);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const upcoming = lessons?.filter(l => new Date(l.scheduledAt) >= now && l.status === 'agendada') || [];
  const completed = lessons?.filter(l => new Date(l.scheduledAt) < now || l.status !== 'agendada') || [];

  const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { label: string, color: string, icon: any }> = {
      agendada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-600', icon: CheckCircle2 },
      concluida: { label: 'Concluída', color: 'bg-green-100 text-green-600', icon: CheckCircle2 },
      cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-600', icon: AlertCircle },
      falta: { label: 'Falta', color: 'bg-orange-100 text-orange-600', icon: AlertCircle },
    };
    const config = configs[status] || configs.agendada;
    return (
      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5", config.color)}>
        <config.icon size={10} />
        {config.label}
      </span>
    );
  };

  const LessonCard = ({ lesson }: { lesson: any }) => (
    <motion.div variants={item}>
      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:shadow-2xl transition-all overflow-hidden relative">
        {lesson.status === 'agendada' && (
           <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        )}
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center p-6 gap-6">
            {/* Date Column */}
            <div className="flex flex-row md:flex-col items-center justify-center md:w-24 md:border-r border-border pr-0 md:pr-6 gap-3">
              <span className="text-4xl font-black text-foreground">
                {format(new Date(lesson.scheduledAt), "dd")}
              </span>
              <div className="flex flex-col items-center md:items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {format(new Date(lesson.scheduledAt), "MMMM", { locale: ptBR })}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {format(new Date(lesson.scheduledAt), "EEEE", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Info Column */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Clock size={12} className="text-primary" />
                  <span>{format(new Date(lesson.scheduledAt), "HH:mm")} — {format(new Date(new Date(lesson.scheduledAt).getTime() + (lesson.duration || 60) * 60000), "HH:mm")}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                   <MapPin size={12} className="text-primary" />
                   <span>Sala Online / Presencial</span>
                </div>
              </div>
              <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors">{lesson.title}</h3>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                   {profile?.teacherName?.slice(0, 2).toUpperCase()}
                 </div>
                 <p className="text-xs font-bold text-muted-foreground">Prof. {profile?.teacherName}</p>
              </div>
            </div>

            {/* Action Column */}
            <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 border-t md:border-none pt-4 md:pt-0">
              <StatusBadge status={lesson.status} />
              <div className="flex items-center gap-2">
                {lesson.status === 'agendada' && (
                  <button 
                    onClick={() => setSelectedLesson({ id: lesson.id, title: lesson.title })}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary px-4 py-2.5 rounded-xl border border-border hover:border-primary/20 transition-all bg-card shadow-sm"
                  >
                    Remarcar
                  </button>
                )}
                <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 transition-all">
                  <ExternalLink size={12} />
                  Detalhes
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Minhas Aulas</h1>
          <p className="text-muted-foreground font-medium">Gerencie seu cronograma e revise seu histórico musical.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
            <LayoutGrid size={18} />
          </button>
          <button className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2">
            <CalendarDays size={16} />
            Ver Agenda Completa
          </button>
        </div>
      </div>

      <Tabs defaultValue="proximas" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border mb-8 max-w-md">
          <TabsTrigger value="proximas" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 data-[state=active]:bg-card data-[state=active]:shadow-md transition-all h-10">
            Próximas Aulas
          </TabsTrigger>
          <TabsTrigger value="concluidas" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 data-[state=active]:bg-card data-[state=active]:shadow-md transition-all h-10">
            Histórico
          </TabsTrigger>
        </TabsList>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          key={activeTab}
        >
          <TabsContent value="proximas" className="space-y-6 outline-none">
            {upcoming.length > 0 ? (
              upcoming.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)
            ) : (
              <div className="text-center py-24 bg-card/30 rounded-[2rem] border-2 border-dashed border-border">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="text-muted-foreground opacity-30" size={40} />
                </div>
                <h3 className="text-xl font-black text-foreground">Tudo em dia!</h3>
                <p className="text-muted-foreground font-medium mt-2">Você não tem aulas agendadas no momento.</p>
                <button className="mt-8 text-primary font-black text-xs uppercase tracking-widest hover:underline">Solicitar aula extra</button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="space-y-6 outline-none">
            {completed.length > 0 ? (
              completed.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)
            ) : (
              <div className="text-center py-24 bg-card/30 rounded-[2rem] border-2 border-dashed border-border">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <History className="text-muted-foreground opacity-30" size={40} />
                </div>
                <h3 className="text-xl font-black text-foreground">Nada por aqui</h3>
                <p className="text-muted-foreground font-medium mt-2">Seu histórico de aulas aparecerá aqui.</p>
              </div>
            )}
          </TabsContent>
        </motion.div>
      </Tabs>

      {selectedLesson && (
        <RescheduleModal 
          open={!!selectedLesson} 
          onOpenChange={(open) => !open && setSelectedLesson(null)}
          lessonId={selectedLesson.id}
          lessonTitle={selectedLesson.title}
        />
      )}
    </div>
  );
}
