import { useState, useMemo } from "react";
import { 
  Plus, 
  Clock, 
  Filter,
  MoreVertical,
  ChevronRight,
  Music,
  Users,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  format, 
  addDays, 
  isSameDay, 
  startOfWeek, 
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import AgendarModal from "@/components/modals/AgendarModal";
import LessonDetailModal from "@/components/modals/LessonDetailModal";

const statusConfig = {
  agendada: { label: "Agendada", color: "bg-blue-600", text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  concluida: { label: "Concluída", color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  cancelada: { label: "Cancelada", color: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
  remarcada: { label: "Remarcada", color: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
  falta: { label: "Falta", color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
};

export default function Aulas() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [detailLessonId, setDetailLessonId] = useState<number | null>(null);

  const { data: lessons = [], isLoading } = trpc.lessons.list.useQuery();

  // Week selector logic
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const isDayMatch = isSameDay(new Date(l.scheduledAt), selectedDate);
      const matchesStatus = statusFilter === "Todas" || 
                           (statusFilter === "Hoje" && isToday(new Date(l.scheduledAt))) ||
                           l.status.toLowerCase() === statusFilter.toLowerCase().replace("í", "i");
      return isDayMatch && matchesStatus;
    });
  }, [lessons, selectedDate, statusFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* DATE SELECTOR STRIP */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{format(selectedDate, "MMMM yyyy", { locale: ptBR })}</h2>
           <div className="flex gap-2">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"><ChevronRight className="rotate-180" size={16} /></button>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"><ChevronRight size={16} /></button>
           </div>
        </div>
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar bg-white p-2 rounded-[2rem] shadow-sm border border-slate-50">
          {weekDays.map((day, i) => {
            const isActive = isSameDay(day, selectedDate);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center gap-2 min-w-[55px] flex-1 py-4 rounded-2xl transition-all relative group",
                  isActive ? "bg-blue-600 text-white shadow-xl shadow-blue-200" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-white/80" : "text-slate-400")}>
                  {format(day, "eee", { locale: ptBR }).slice(0, 3)}
                </span>
                <span className="text-lg font-black tracking-tight">{format(day, "d")}</span>
                {isActive && <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff]" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* FILTER CHIPS */}
      <section className="flex flex-wrap items-center gap-2">
        {["Todas", "Hoje", "Agendadas", "Concluídas", "Canceladas"].map(chip => (
          <button
            key={chip}
            onClick={() => setStatusFilter(chip)}
            className={cn(
              "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
              statusFilter === chip 
                ? "bg-blue-600 text-white border-blue-600 shadow-blue-200" 
                : "bg-white text-slate-400 border-slate-100 hover:border-blue-200 hover:text-blue-600"
            )}
          >
            {chip}
          </button>
        ))}
        <button className="ml-auto w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors shadow-sm">
          <Filter size={18} />
        </button>
      </section>

      {/* LESSONS LIST / GRID */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
             Aulas de {isToday(selectedDate) ? "hoje" : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
           </h3>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-full shadow-sm">
             {filteredLessons.length} aulas
           </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 lg:gap-8">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 rounded-[2.5rem] bg-white border border-slate-100 animate-pulse" />
              ))
            ) : filteredLessons.length === 0 ? (
              <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                 <Calendar size={48} className="mx-auto text-slate-100 mb-4" />
                 <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Nenhuma aula encontrada</p>
              </div>
            ) : (
              filteredLessons
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map(lesson => {
                  const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
                  return (
                    <motion.div
                      key={lesson.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ scale: 1.01, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)" }}
                      className="group bg-white rounded-[2.5rem] p-6 lg:p-8 border border-slate-100 shadow-sm transition-all cursor-pointer flex flex-col justify-between min-h-[200px]"
                      onClick={() => setDetailLessonId(lesson.id)}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-1.5 h-8 rounded-full", config.color)} />
                          <span className="text-3xl font-black text-slate-800 tracking-tighter">
                            {format(new Date(lesson.scheduledAt), "HH:mm")}
                          </span>
                        </div>
                        <span className={cn("px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", config.bg, config.text, config.border)}>
                          {config.label}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                          {lesson.studentName || lesson.experimentalName}
                        </h4>
                        <div className="flex items-center gap-4 flex-wrap">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <Music size={14} className="text-blue-500" /> {lesson.instrumentName}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <Users size={14} className="text-purple-500" /> {(lesson as any).teacherName || "Professor"}
                           </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                         <button className="text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1.5">
                            Detalhes da aula <ChevronRight size={14} />
                         </button>
                         <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-300 transition-colors">
                            <MoreVertical size={20} />
                         </button>
                      </div>
                    </motion.div>
                  );
                })
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-8 right-8 z-50">
        <motion.button 
          whileHover={{ scale: 1.05, boxShadow: "0 25px 50px rgba(37,99,235,0.4)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setAgendarOpen(true)}
          className="bg-[#2563EB] text-white px-8 py-5 rounded-full flex items-center gap-4 shadow-[0_20px_40px_rgba(37,99,235,0.3)] group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Plus size={24} strokeWidth={3} className="relative z-10" />
          <span className="text-sm font-black uppercase tracking-widest relative z-10">Nova Aula</span>
        </motion.button>
      </div>

      {/* MODALS */}
      <AgendarModal 
        open={agendarOpen} 
        onOpenChange={(open) => {
          setAgendarOpen(open);
        }} 
      />
      <LessonDetailModal
        open={!!detailLessonId}
        lesson={lessons.find(l => l.id === detailLessonId)}
        onOpenChange={(open) => { if (!open) setDetailLessonId(null); }}
        onStatusChange={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />
    </div>
  );
}
