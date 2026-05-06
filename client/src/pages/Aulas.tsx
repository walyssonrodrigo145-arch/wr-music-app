import { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  CalendarDays,
  Calendar as CalendarIcon,
  LayoutList,
  CalendarRange,
  CalendarCheck,
  Music,
  CheckCircle,
  AlertCircle,
  Trash2,
  Search,
  Bell,
  Moon,
  Filter,
  Users,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  format, 
  addDays, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AgendarModal from "@/components/modals/AgendarModal";
import LessonDetailModal from "@/components/modals/LessonDetailModal";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type CalendarView = "mes" | "semana" | "dia" | "eventos";

const DAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const statusConfig = {
  agendada: { label: "Agendada", color: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50/50", border: "border-blue-100" },
  concluida: { label: "Concluída", color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50/50", border: "border-emerald-100" },
  cancelada: { label: "Cancelada", color: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-50/50", border: "border-rose-100" },
  remarcada: { label: "Remarcada", color: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50/50", border: "border-purple-100" },
  falta: { label: "Falta", color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50/50", border: "border-amber-100" },
};

export default function Aulas() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("mes");
  const [search, setSearch] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("geral");
  
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [detailLessonId, setDetailLessonId] = useState<number | null>(null);

  const { data: lessons = [], isLoading } = trpc.lessons.list.useQuery();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchesSearch = l.studentName?.toLowerCase().includes(search.toLowerCase()) || 
                           l.experimentalName?.toLowerCase().includes(search.toLowerCase());
      const matchesInstrument = instrumentFilter === "todos" || String(l.instrumentId) === instrumentFilter;
      const matchesStatus = statusFilter === "geral" || l.status === statusFilter;
      return matchesSearch && matchesInstrument && matchesStatus;
    });
  }, [lessons, search, instrumentFilter, statusFilter]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const nextLesson = useMemo(() => {
    const now = new Date();
    return lessons
      .filter(l => l.status === "agendada" && new Date(l.scheduledAt) >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  }, [lessons]);

  const dailyStats = useMemo(() => {
    const today = startOfDay(new Date());
    const todays = lessons.filter(l => isSameDay(new Date(l.scheduledAt), today));
    return {
      agendadas: todays.filter(l => l.status === "agendada").length,
      concluidas: todays.filter(l => l.status === "concluida").length,
      faltas: todays.filter(l => l.status === "falta").length,
    };
  }, [lessons]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] -m-4 sm:-m-6 bg-[#F8FAFC] overflow-hidden">
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden scrollbar-thin">
        
        {/* CONTENT WRAPPER */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          
          {/* FILTERS BAR */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Instrumento</p>
                <div className="flex flex-wrap gap-3">
                   {["todos", ...instruments.map(i => String(i.id))].map((id) => {
                     const inst = instruments.find(i => String(i.id) === id);
                     const label = id === "todos" ? "Todos" : inst?.name;
                     const color = id === "todos" ? "bg-slate-800" : (inst?.color || "bg-blue-500");
                     const isActive = instrumentFilter === id;
                     return (
                       <button
                         key={id}
                         onClick={() => setInstrumentFilter(id)}
                         className={cn(
                           "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-300 border hover:scale-105 active:scale-95 shadow-sm",
                           isActive 
                             ? "bg-white border-slate-200 ring-2 ring-offset-2 ring-slate-200" 
                             : "bg-white border-transparent text-slate-400 opacity-60 hover:opacity-100"
                         )}
                       >
                         <span className={cn("w-2 h-2 rounded-full", color)} />
                         {label}
                       </button>
                     );
                   })}
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Status</p>
                <div className="flex flex-wrap gap-3">
                   {["geral", "agendada", "concluida", "cancelada", "remarcada", "falta"].map((st) => {
                     const isActive = statusFilter === st;
                     const config = statusConfig[st as keyof typeof statusConfig] || { label: "Geral", color: "bg-slate-800" };
                     return (
                       <button
                         key={st}
                         onClick={() => setStatusFilter(st)}
                         className={cn(
                           "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-300 border hover:scale-105 active:scale-95 shadow-sm",
                           isActive 
                             ? "bg-white border-slate-200 ring-2 ring-offset-2 ring-slate-200" 
                             : "bg-white border-transparent text-slate-400 opacity-60 hover:opacity-100"
                         )}
                       >
                         <span className={cn("w-2 h-2 rounded-full", config.color)} />
                         {config.label}
                       </button>
                     );
                   })}
                </div>
             </div>
          </div>

          {/* CALENDAR HEADER */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
             <div className="flex p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
                {(["mes", "semana", "dia", "eventos"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all duration-300",
                      view === v ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    {v === "mes" && <CalendarIcon size={14} />}
                    {v === "semana" && <CalendarRange size={14} />}
                    {v === "dia" && <CalendarCheck size={14} />}
                    {v === "eventos" && <LayoutList size={14} />}
                    <span className="capitalize">{v}</span>
                  </button>
                ))}
             </div>

             <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-blue-600 transition-colors shadow-sm"><ChevronLeft size={18} /></button>
                  <h3 className="text-lg font-black text-slate-800 w-36 text-center">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</h3>
                  <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-blue-600 transition-colors shadow-sm"><ChevronRight size={18} /></button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-9 rounded-xl px-4 text-xs font-bold bg-white border-slate-100 text-slate-500 shadow-sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white border-slate-100 text-slate-500 shadow-sm"><Filter size={16} /></Button>
                </div>
             </div>
          </div>

          {/* CALENDAR GRID */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
             {/* Header Dias */}
             <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/30">
                {DAYS_SHORT.map(day => (
                  <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{day}</div>
                ))}
             </div>
             
             {/* Dias do Mês */}
             <div className="grid grid-cols-7 min-h-[600px]">
                {monthDays.map((day, idx) => {
                  const lessonsInDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-3 border-r border-b border-slate-50 min-h-[140px] transition-all",
                        !isCurrentMonth && "bg-slate-50/20 opacity-40",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-full text-xs font-black transition-all",
                          isToday(day) ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400"
                        )}>
                          {format(day, "d")}
                        </span>
                        {isToday(day) && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                      </div>

                      <div className="space-y-2">
                        {lessonsInDay.map((lesson) => {
                          const config = statusConfig[lesson.status] || statusConfig.agendada;
                          return (
                            <div 
                              key={lesson.id}
                              onClick={() => setDetailLessonId(lesson.id)}
                              className={cn(
                                "group p-2.5 rounded-xl border-l-[3px] transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md",
                                config.bg, config.border
                              )}
                              style={{ borderLeftColor: config.color === "bg-blue-500" ? "#3b82f6" : config.color === "bg-emerald-500" ? "#10b981" : config.color === "bg-rose-500" ? "#ef4444" : config.color === "bg-purple-500" ? "#a855f7" : "#f59e0b" }}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-tight", config.text)}>
                                  {format(new Date(lesson.scheduledAt), "HH:mm")}
                                </span>
                                <div className={cn("w-1.5 h-1.5 rounded-full", config.color)} />
                              </div>
                              <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{lesson.studentName || lesson.experimentalName}</p>
                              <p className="text-[9px] text-slate-400 font-medium truncate mt-0.5">{lesson.instrumentName}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR Area */}
      <div className="w-full lg:w-[320px] bg-white border-l border-slate-100 p-8 space-y-10 overflow-y-auto shrink-0 scrollbar-thin">
         {/* Resumo do dia */}
         <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                  <CalendarIcon size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Resumo do dia</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
               <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Calendar size={16} /></div>
                     <p className="text-2xl font-black text-slate-800 leading-none">{dailyStats.agendadas}</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aulas agendadas</p>
               </div>
               <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={16} /></div>
                     <p className="text-2xl font-black text-slate-800 leading-none">{dailyStats.concluidas}</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concluídas</p>
               </div>
               <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center"><AlertCircle size={16} /></div>
                     <p className="text-2xl font-black text-slate-800 leading-none">{dailyStats.faltas}</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Faltas</p>
               </div>
            </div>
         </div>

         {/* Próxima aula */}
         <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                  <Clock size={20} />
               </div>
               <h3 className="text-sm font-black text-slate-800 tracking-tight">Próxima aula</h3>
            </div>
            
            {nextLesson ? (
              <div className="p-5 bg-[#F8FAFC] rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
                 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-4">Hoje, {format(new Date(nextLesson.scheduledAt), "HH:mm")}</p>
                 <div className="flex items-center gap-4 mb-6">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-md">
                       <AvatarFallback className="bg-slate-200 text-slate-600 font-black text-sm">
                         {(nextLesson.studentName || "A")[0]}
                       </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                       <p className="text-sm font-black text-slate-800 truncate leading-tight">{nextLesson.studentName || nextLesson.experimentalName}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{nextLesson.instrumentName}</p>
                    </div>
                 </div>
                 <Button className="w-full h-11 rounded-2xl bg-white border border-slate-100 text-blue-600 font-black text-xs hover:bg-blue-50 hover:border-blue-100 transition-all group" onClick={() => setDetailLessonId(nextLesson.id)}>
                    Ver detalhes <ChevronRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </div>
            ) : (
              <div className="py-10 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                 <p className="text-xs font-bold text-slate-400">Nenhuma aula próxima</p>
              </div>
            )}
         </div>

         {/* Lembretes */}
         <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                  <Bell size={20} />
               </div>
               <h3 className="text-sm font-black text-slate-800 tracking-tight">Lembretes</h3>
            </div>
            
            <div className="space-y-3">
               <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex gap-4 hover:bg-orange-50 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-orange-500 shadow-sm shrink-0"><Bell size={18} /></div>
                  <div>
                    <p className="text-[11px] font-black text-orange-900 leading-tight">2 aulas em 30 min</p>
                    <p className="text-[10px] text-orange-600 font-bold mt-1 uppercase tracking-tighter">Kezia Teixeira - 19:00</p>
                  </div>
               </div>
               <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50 flex gap-4 hover:bg-purple-50 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-purple-500 shadow-sm shrink-0"><LayoutList size={18} /></div>
                  <div>
                    <p className="text-[11px] font-black text-purple-900 leading-tight">Remarcação pendente</p>
                    <p className="text-[10px] text-purple-600 font-bold mt-1 uppercase tracking-tighter">Sirlene Ramalho - Amanhã</p>
                  </div>
               </div>
               <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 flex gap-4 hover:bg-rose-50 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm shrink-0"><AlertCircle size={18} /></div>
                  <div>
                    <p className="text-[11px] font-black text-rose-900 leading-tight">1 falta hoje</p>
                    <p className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-tighter">Pedro Henrique - 18:00</p>
                  </div>
               </div>
            </div>
            
            <button className="w-full flex items-center justify-between text-[11px] font-black text-blue-600 uppercase tracking-widest px-4 hover:underline">
               Ver todos lembretes <ChevronRight size={14} />
            </button>
         </div>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-10 right-10 z-50">
         <TooltipProvider>
            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    onClick={() => setAgendarOpen(true)}
                    className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.4)] hover:scale-110 hover:shadow-[0_15px_40px_rgba(37,99,235,0.6)] active:scale-95 transition-all duration-300"
                  >
                    <Plus size={32} strokeWidth={3} />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-slate-800 text-white border-none rounded-xl font-bold px-4 py-2">
                  Nova aula
               </TooltipContent>
            </Tooltip>
         </TooltipProvider>
      </div>

      {/* MODALS */}
      <AgendarModal open={agendarOpen} onClose={() => setAgendarOpen(false)} />
      <LessonDetailModal
        lessonId={detailLessonId}
        onOpenChange={(open) => { if (!open) setDetailLessonId(null); }}
      />
    </div>
  );
}
