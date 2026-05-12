import { trpc } from "@/lib/trpc";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Calendar as CalendarIcon,
  Plus,
  MoreVertical,
  Music,
  MapPin,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { y: 10, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function StudentAgenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: lessons, isLoading } = trpc.studentPortal.getSchedule.useQuery();

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = [...Array(7)].map((_, i) => addDays(startDate, i));

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Minha Agenda</h1>
          <p className="text-muted-foreground font-medium">Consulte seus horários de aula e eventos musicais.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-2xl border border-border shadow-sm">
           <button className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-muted rounded-xl transition-all">Mês</button>
           <button className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-primary text-white rounded-xl shadow-lg shadow-primary/20">Semana</button>
           <button className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-muted rounded-xl transition-all">Dia</button>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-6 border-b border-border/50 bg-card/30">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-1">
                  <button onClick={handlePrevWeek} className="p-2.5 hover:bg-muted rounded-xl transition-all active:scale-95"><ChevronLeft size={18} /></button>
                  <button onClick={handleNextWeek} className="p-2.5 hover:bg-muted rounded-xl transition-all active:scale-95"><ChevronRight size={18} /></button>
                </div>
                <h2 className="text-xl font-black tracking-tight first-letter:uppercase">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </h2>
             </div>
             <div className="flex items-center gap-3">
                <button onClick={handleToday} className="text-[10px] font-black uppercase tracking-widest text-primary px-5 py-2.5 bg-primary/5 rounded-xl border border-primary/10 hover:bg-primary/10 transition-colors">Hoje</button>
                <button className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <Plus size={18} />
                </button>
             </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border/50 bg-muted/20">
             {days.map(day => (
               <div key={day} className="py-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{day}</div>
             ))}
          </div>

          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-7 min-h-[600px]"
          >
             {weekDays.map((day, dayIdx) => {
               const dayLessons = lessons?.filter(l => isSameDay(new Date(l.scheduledAt), day)) || [];
               const isToday = isSameDay(day, new Date());
               
               return (
                 <motion.div 
                   variants={item}
                   key={day.toString()} 
                   className={cn(
                     "border-r border-border/50 p-3 space-y-3 last:border-r-0 transition-colors relative group",
                     isToday ? "bg-primary/[0.02]" : "hover:bg-muted/10"
                   )}
                 >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black mx-auto mb-4 transition-transform group-hover:scale-110",
                      isToday ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-foreground bg-muted/30"
                    )}>
                       {format(day, "dd")}
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence>
                        {dayLessons.map(lesson => (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={lesson.id} 
                            className={cn(
                              "p-3 rounded-2xl border-l-4 text-[10px] font-bold cursor-pointer hover:shadow-lg transition-all group/item relative overflow-hidden",
                              lesson.status === 'concluida' 
                                ? "bg-green-500/5 border-green-500/30 text-green-700" 
                                : "bg-primary/5 border-primary text-primary"
                            )}
                          >
                             <div className="flex items-center justify-between mb-1.5">
                               <div className="flex items-center gap-1.5 opacity-80">
                                  <Clock size={10} />
                                  <span>{format(new Date(lesson.scheduledAt), "HH:mm")}</span>
                               </div>
                               {lesson.status === 'concluida' && <CheckCircle2 size={10} />}
                             </div>
                             <p className="text-foreground font-black truncate mb-1">{lesson.title}</p>
                             <div className="flex items-center gap-1.5 opacity-60">
                               <MapPin size={10} />
                               <span className="truncate">Estúdio A</span>
                             </div>
                             
                             <div className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <MoreVertical size={12} className="text-muted-foreground" />
                             </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {dayLessons.length === 0 && (
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                         <Music size={40} />
                      </div>
                    )}
                 </motion.div>
               );
             })}
          </motion.div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
         <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aula Agendada</span>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aula Concluída</span>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Compromisso</span>
         </div>
      </div>
    </div>
  );
}
