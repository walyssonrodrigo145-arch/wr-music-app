import { trpc } from "@/lib/trpc";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function StudentAgenda() {
  const { data: lessons } = trpc.studentPortal.getLessons.useQuery();
  const [currentDate] = useState(new Date());

  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  // Weekly view logic
  const startDate = startOfWeek(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDays(startDate, i));

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Minha Agenda</h1>
          <p className="text-muted-foreground font-medium">Visualize todos os seus horários e eventos.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
           <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Mês</button>
           <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-primary text-white rounded-xl shadow-lg shadow-primary/20">Semana</button>
           <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Dia</button>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><ChevronLeft size={20} /></button>
                <h2 className="text-lg font-black">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</h2>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><ChevronRight size={20} /></button>
             </div>
             <button className="text-xs font-black uppercase tracking-widest text-primary px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">Hoje</button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
             {days.map(day => (
               <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{day}</div>
             ))}
          </div>

          <div className="grid grid-cols-7 h-[600px]">
             {weekDays.map(day => {
               const dayLessons = lessons?.filter(l => isSameDay(new Date(l.scheduledAt), day)) || [];
               return (
                 <div key={day.toString()} className="border-r border-slate-100 dark:border-slate-800 p-2 space-y-2 last:border-r-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black mx-auto mb-4",
                      isSameDay(day, new Date()) ? "bg-primary text-white shadow-lg shadow-primary/30" : "text-foreground"
                    )}>
                       {format(day, "dd")}
                    </div>
                    {dayLessons.map(lesson => (
                      <div key={lesson.id} className="p-2 rounded-xl bg-primary/10 border-l-4 border-primary text-[10px] font-bold group cursor-pointer hover:scale-[1.02] transition-all">
                         <div className="flex items-center gap-1 text-primary mb-1">
                            <Clock size={10} />
                            <span>{format(new Date(lesson.scheduledAt), "HH:mm")}</span>
                         </div>
                         <p className="text-foreground truncate">{lesson.title}</p>
                      </div>
                    ))}
                 </div>
               );
             })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
