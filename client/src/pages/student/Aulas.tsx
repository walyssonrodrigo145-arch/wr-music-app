import { trpc } from "@/lib/trpc";
import { 
  Calendar, 
  Clock, 
  User,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  History,
  LayoutGrid
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function StudentLessons() {
  const { data: lessons, isLoading } = trpc.studentPortal.getLessons.useQuery();
  const [activeTab, setActiveTab] = useState("proximas");

  if (isLoading) return <div>Carregando aulas...</div>;

  const now = new Date();
  const upcoming = lessons?.filter(l => new Date(l.scheduledAt) >= now && l.status === 'agendada') || [];
  const completed = lessons?.filter(l => new Date(l.scheduledAt) < now || l.status !== 'agendada') || [];

  const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { label: string, color: string }> = {
      agendada: { label: 'Confirmada', color: 'bg-blue-500/10 text-blue-600' },
      concluida: { label: 'Concluída', color: 'bg-green-500/10 text-green-600' },
      cancelada: { label: 'Cancelada', color: 'bg-red-500/10 text-red-600' },
      falta: { label: 'Falta', color: 'bg-orange-500/10 text-orange-600' },
    };
    const config = configs[status] || configs.agendada;
    return (
      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full", config.color)}>
        {config.label}
      </span>
    );
  };

  const LessonCard = ({ lesson }: { lesson: any }) => (
    <Card className="border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-xl transition-all group overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center p-4 gap-4">
          {/* Date Column */}
          <div className="flex flex-row sm:flex-col items-center justify-center sm:w-20 sm:border-r border-slate-200 dark:border-slate-800 pr-4 gap-2">
            <span className="text-2xl font-black text-foreground">
              {format(new Date(lesson.scheduledAt), "dd")}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {format(new Date(lesson.scheduledAt), "MMM", { locale: ptBR })}
            </span>
          </div>

          {/* Info Column */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Clock size={12} />
              <span>{format(new Date(lesson.scheduledAt), "HH:mm")} — {format(new Date(new Date(lesson.scheduledAt).getTime() + (lesson.duration || 60) * 60000), "HH:mm")}</span>
            </div>
            <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors">{lesson.title}</h3>
            <p className="text-xs font-medium text-muted-foreground">Prof. Eduardo Silva</p> {/* Mock professor name */}
          </div>

          {/* Action Column */}
          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-none pt-4 sm:pt-0">
            <StatusBadge status={lesson.status} />
            <button className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-primary hover:opacity-80 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 transition-all">
              Ver Detalhes
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Minhas Aulas</h1>
          <p className="text-muted-foreground font-medium">Acompanhe suas aulas e revise conteúdos.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          Ver Agenda
        </button>
      </div>

      <Tabs defaultValue="proximas" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6">
          <TabsTrigger value="proximas" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all">
            Próximas
          </TabsTrigger>
          <TabsTrigger value="concluidas" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all">
            Concluídas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proximas" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {upcoming.length > 0 ? (
            upcoming.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)
          ) : (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Calendar className="mx-auto text-muted-foreground mb-4" size={40} />
              <p className="text-muted-foreground font-bold">Nenhuma aula agendada para os próximos dias.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidas" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {completed.length > 0 ? (
            completed.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)
          ) : (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <History className="mx-auto text-muted-foreground mb-4" size={40} />
              <p className="text-muted-foreground font-bold">Você ainda não possui aulas concluídas.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
