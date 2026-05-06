import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";

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
  isTomorrow,
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
  const [editingLesson, setEditingLesson] = useState<any>(null);

  const utils = trpc.useUtils();

  const { data: lessons = [], isLoading } = trpc.lessons.list.useQuery();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();
  const { data: pendingReminders = [] } = trpc.reminders.list.useQuery({ status: "pendente" });

  const updateStatusMutation = trpc.lessons.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.lessons.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar status: " + e.message)
  });

  const deleteMutation = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Aula removida!");
      utils.lessons.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (e) => toast.error("Erro ao remover aula: " + e.message)
  });

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

  const dynamicAlerts = useMemo(() => {
    const now = new Date();
    const in30Mins = new Date(now.getTime() + 30 * 60000);
    
    const lessonsSoon = lessons.filter(l => 
      l.status === "agendada" && 
      new Date(l.scheduledAt) >= now && 
      new Date(l.scheduledAt) <= in30Mins
    );

    const list = [];
    
    // Alerta 1: Aulas em breve
    if (lessonsSoon.length > 0) {
      list.push({
        label: `${lessonsSoon.length} aula${lessonsSoon.length > 1 ? 's' : ''} em 30 min`,
        sub: lessonsSoon[0].studentName || lessonsSoon[0].experimentalName || "Aula experimental",
        icon: Bell,
        color: "text-orange-500",
        bg: "bg-orange-50/50",
        border: "border-orange-100/50"
      });
    }

    // Alerta 2: Lembretes pendentes do sistema
    if (pendingReminders.length > 0) {
      list.push({
        label: pendingReminders[0].type === "cobranca" ? "Cobrança pendente" : "Lembrete pendente",
        sub: pendingReminders[0].studentName || "Geral",
        icon: LayoutList,
        color: "text-purple-500",
        bg: "bg-purple-50/50",
        border: "border-purple-100/50"
      });
    }

    // Alerta 3: Faltas de hoje
    if (dailyStats.faltas > 0) {
      list.push({
        label: `${dailyStats.faltas} falta${dailyStats.faltas > 1 ? 's' : ''} hoje`,
        sub: "Verifique o diário de classe",
        icon: AlertCircle,
        color: "text-rose-500",
        bg: "bg-rose-50/50",
        border: "border-rose-100/50"
      });
    }

    // Fallback se não houver nada real, mostra um placeholder informativo
    if (list.length === 0) {
      list.push({
        label: "Sem alertas críticos",
        sub: "Tudo em ordem por aqui",
        icon: CheckCircle,
        color: "text-emerald-500",
        bg: "bg-emerald-50/50",
        border: "border-emerald-100/50"
      });
    }

    return list;
  }, [lessons, pendingReminders, dailyStats.faltas]);

  const handleStatusChange = (id: number, status: string, newDate?: string) => {
    updateStatusMutation.mutate({ id, status: status as any, scheduledAt: newDate });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta aula?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (id: number) => {
    const lesson = lessons.find(l => l.id === id);
    if (lesson) {
      setEditingLesson(lesson);
      setAgendarOpen(true);
    }
  };

  // Componente de Card de Aula Premium
  const LessonCard = ({ lesson }: { lesson: any }) => {
    const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
    return (
      <motion.div
        layoutId={`lesson-${lesson.id}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.03, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setDetailLessonId(lesson.id)}
        className={cn(
          "group relative p-3 rounded-2xl border-l-[6px] backdrop-blur-sm transition-all cursor-pointer shadow-sm mb-2 last:mb-0",
          config.bg, config.border
        )}
        style={{ borderLeftColor: config.color === "bg-blue-500" ? "#3b82f6" : config.color === "bg-emerald-500" ? "#10b981" : config.color === "bg-rose-500" ? "#ef4444" : config.color === "bg-purple-500" ? "#a855f7" : "#f59e0b" }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
            {format(new Date(lesson.scheduledAt), "HH:mm")}
          </span>
          <div className={cn("w-2 h-2 rounded-full shadow-sm", config.color)} />
        </div>
        <p className="text-xs font-black text-slate-800 truncate leading-tight group-hover:text-blue-700 transition-colors">
          {lesson.studentName || lesson.experimentalName}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
           <Music size={10} className="text-slate-500" />
           <p className="text-[9px] text-slate-500 font-bold truncate uppercase">{lesson.instrumentName}</p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] -m-4 sm:-m-6 bg-[#F8FAFC] overflow-hidden">
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden scrollbar-thin">
        
        {/* CONTENT WRAPPER */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          
          {/* FILTERS BAR */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Filtros por Instrumento</p>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Status das Aulas</p>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white border-slate-100 text-slate-500 shadow-sm"><Filter size={16} /></Button>
                      </TooltipTrigger>
                      <TooltipContent>Filtros Avançados</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
             </div>
          </div>

          {/* VIEW SWITCHER WITH ANIMATION */}
          <div className="relative min-h-[600px]">
            <AnimatePresence mode="wait">
              {view === "mes" && (
                <motion.div
                  key="month-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden"
                >
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
                        const isAlternativeRow = Math.floor(idx / 7) % 2 === 1;
                        
                        return (
                          <div 
                            key={idx} 
                            className={cn(
                              "p-3 border-r border-b border-slate-50 min-h-[140px] transition-all relative group/day",
                              !isCurrentMonth && "bg-slate-50/10 opacity-30",
                              isCurrentMonth && isAlternativeRow && "bg-slate-50/20",
                              idx % 7 === 6 && "border-r-0"
                            )}
                          >
                            <div className="flex items-center justify-between mb-3 relative z-10">
                              <span className={cn(
                                "w-8 h-8 flex items-center justify-center rounded-full text-xs font-black transition-all",
                                isToday(day) 
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110" 
                                  : "text-slate-400 group-hover/day:text-slate-600"
                              )}>
                                {format(day, "d")}
                              </span>
                              {isToday(day) && (
                                <div className="absolute inset-0 -m-1 bg-blue-50 rounded-full -z-10" />
                              )}
                            </div>

                            <div className="space-y-1 relative z-10">
                              {lessonsInDay.slice(0, 3).map((lesson) => (
                                <LessonCard key={lesson.id} lesson={lesson} />
                              ))}
                              {lessonsInDay.length > 3 && (
                                <p className="text-[9px] font-black text-blue-600 mt-1 uppercase tracking-widest text-center">+ {lessonsInDay.length - 3} aulas</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                   </div>
                </motion.div>
              )}

              {view === "semana" && (
                <motion.div
                  key="week-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-7 gap-4"
                >
                  {eachDayOfInterval({
                    start: startOfWeek(currentDate),
                    end: endOfWeek(currentDate)
                  }).map((day, i) => {
                    const lessonsInDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                    return (
                      <div key={i} className="flex flex-col gap-4">
                        <div className={cn(
                          "p-4 rounded-3xl border text-center transition-all",
                          isToday(day) ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20" : "bg-white border-slate-100"
                        )}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{DAYS_SHORT[i]}</p>
                          <p className="text-2xl font-black">{format(day, "d")}</p>
                        </div>
                        <div className="space-y-3">
                          {lessonsInDay.map(l => (
                            <LessonCard key={l.id} lesson={l} />
                          ))}
                          {lessonsInDay.length === 0 && (
                            <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-3xl opacity-40">
                              <p className="text-[10px] font-bold text-slate-400">Livre</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {view === "dia" && (
                <motion.div
                  key="day-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-8"
                >
                   <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-500/30">
                          {format(currentDate, "d")}
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{format(currentDate, "EEEE", { locale: ptBR })}</h2>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="px-4 py-2 bg-blue-50 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest">
                           {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), currentDate)).length} Aulas Hoje
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      {filteredLessons
                        .filter(l => isSameDay(new Date(l.scheduledAt), currentDate))
                        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                        .map(l => (
                          <div key={l.id} className="flex gap-8 group">
                             <div className="w-16 pt-4 text-right">
                               <p className="text-xs font-black text-slate-400 group-hover:text-blue-600 transition-colors">{format(new Date(l.scheduledAt), "HH:mm")}</p>
                             </div>
                             <div className="flex-1 pb-6 border-l border-slate-100 pl-8 relative">
                                <div className="absolute left-[-5px] top-5 w-2.5 h-2.5 rounded-full bg-slate-200 group-hover:bg-blue-600 transition-colors border-2 border-white" />
                                <LessonCard lesson={l} />
                             </div>
                          </div>
                        ))}
                      {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), currentDate)).length === 0 && (
                        <div className="py-20 text-center opacity-40">
                           <CalendarIcon size={48} className="mx-auto text-slate-200 mb-4" />
                           <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma aula para este dia</p>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}

              {view === "eventos" && (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {filteredLessons
                    .filter(l => new Date(l.scheduledAt) >= startOfDay(new Date()))
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map((l, i) => (
                      <div key={l.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center gap-6">
                           <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none mb-1">{format(new Date(l.scheduledAt), "MMM", { locale: ptBR })}</span>
                              <span className="text-lg font-black text-slate-800 leading-none">{format(new Date(l.scheduledAt), "d")}</span>
                           </div>
                           <div>
                              <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">{l.studentName || l.experimentalName}</p>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest"><Clock size={10} /> {format(new Date(l.scheduledAt), "HH:mm")}</span>
                                 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest"><Music size={10} /> {l.instrumentName}</span>
                              </div>
                           </div>
                        </div>
                        <div className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest", statusConfig[l.status as keyof typeof statusConfig].bg, statusConfig[l.status as keyof typeof statusConfig].text)}>
                           {statusConfig[l.status as keyof typeof statusConfig].label}
                        </div>
                      </div>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR Area */}
      <div className="w-full lg:w-[360px] bg-white border-l border-slate-100 p-8 space-y-12 overflow-y-auto shrink-0 scrollbar-thin">
         {/* Resumo do dia */}
         <div className="space-y-8">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                  <CalendarIcon size={24} />
               </div>
               <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Estatísticas Diárias</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="p-6 bg-[#F8FAFC] rounded-[2.5rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-default">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner"><Calendar size={20} /></div>
                     <div>
                       <p className="text-3xl font-black text-slate-800 leading-none mb-1">{dailyStats.agendadas}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Agendadas</p>
                     </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
               </div>
               <div className="p-6 bg-[#F8FAFC] rounded-[2.5rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-default">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner"><CheckCircle2 size={20} /></div>
                     <div>
                       <p className="text-3xl font-black text-slate-800 leading-none mb-1">{dailyStats.concluidas}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Concluídas</p>
                     </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-200 group-hover:text-emerald-500 transition-colors" />
               </div>
               <div className="p-6 bg-[#F8FAFC] rounded-[2.5rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-default">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner"><AlertCircle size={20} /></div>
                     <div>
                       <p className="text-3xl font-black text-slate-800 leading-none mb-1">{dailyStats.faltas}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faltas</p>
                     </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-200 group-hover:text-orange-500 transition-colors" />
               </div>
            </div>
         </div>

         {/* Próxima aula */}
         <div className="space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                  <Clock size={24} />
               </div>
               <h3 className="text-base font-black text-slate-800 tracking-tight">Próxima Aula</h3>
            </div>
            
            {nextLesson ? (
              <div className="p-6 bg-gradient-to-br from-white to-[#F8FAFC] rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-16 translate-x-16 blur-3xl group-hover:scale-150 transition-transform duration-700" />
                 <p className="relative z-10 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 bg-blue-50 w-fit px-3 py-1 rounded-full">
                   {isToday(new Date(nextLesson.scheduledAt)) ? "Hoje" : isTomorrow(new Date(nextLesson.scheduledAt)) ? "Amanhã" : format(new Date(nextLesson.scheduledAt), "dd/MM")}, {format(new Date(nextLesson.scheduledAt), "HH:mm")}
                 </p>
                 <div className="relative z-10 flex items-center gap-5 mb-8">
                    <Avatar className="w-16 h-16 border-4 border-white shadow-xl group-hover:rotate-6 transition-transform">
                       <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xl">
                         {(nextLesson.studentName || "A")[0]}
                       </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                       <p className="text-lg font-black text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">{nextLesson.studentName || nextLesson.experimentalName}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">{nextLesson.instrumentName}</p>
                    </div>
                 </div>
                 <Button className="relative z-10 w-full h-12 rounded-2xl bg-white border border-slate-100 text-blue-600 font-black text-xs hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all duration-300 group" onClick={() => setDetailLessonId(nextLesson.id)}>
                    Ver Detalhes <ChevronRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </div>
            ) : (
              <div className="py-16 text-center bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                 <CalendarIcon size={32} className="mx-auto text-slate-200 mb-3" />
                 <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Nenhuma aula próxima</p>
              </div>
            )}
         </div>

         {/* Lembretes */}
         <div className="space-y-8">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                  <Bell size={24} />
               </div>
               <h3 className="text-base font-black text-slate-800 tracking-tight">Alertas Rápidos</h3>
            </div>
            
            <div className="space-y-4">
               {dynamicAlerts.map((rem, i) => (
                 <div key={i} className={cn("p-5 rounded-3xl border flex gap-5 hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-500 cursor-pointer", rem.bg, rem.border)}>
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0"><rem.icon size={20} className={rem.color} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-800 leading-tight mb-1">{rem.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{rem.sub}</p>
                    </div>
                 </div>
               ))}
            </div>
            
            <Link href="/">
               <button className="w-full flex items-center justify-between text-[11px] font-black text-blue-600 uppercase tracking-widest px-4 hover:underline transition-all">
                  Ver painel completo <ChevronRight size={14} />
               </button>
            </Link>
         </div>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-12 right-12 z-50">
         <TooltipProvider>
            <Tooltip>
               <TooltipTrigger asChild>
                  <motion.button 
                    whileHover={{ scale: 1.1, boxShadow: "0 25px 50px -12px rgb(37 99 235 / 0.5)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setAgendarOpen(true)}
                    className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-[0_15px_40px_rgba(37,99,235,0.4)] relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full" />
                    <Plus size={36} strokeWidth={3} className="relative z-10" />
                    
                    {/* Pulsing Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping opacity-75" />
                  </motion.button>
               </TooltipTrigger>
               <TooltipContent className="bg-slate-800 text-white border-none rounded-xl font-black text-xs px-6 py-3 mb-2 shadow-2xl">
                  Agendar Aula
               </TooltipContent>
            </Tooltip>
         </TooltipProvider>
      </div>

      {/* MODALS */}
      <AgendarModal 
        open={agendarOpen} 
        onOpenChange={(open) => {
          setAgendarOpen(open);
          if (!open) setEditingLesson(null);
        }} 
        editingLesson={editingLesson}
      />
      <LessonDetailModal
        open={!!detailLessonId}
        lesson={lessons.find(l => l.id === detailLessonId)}
        onOpenChange={(open) => { if (!open) setDetailLessonId(null); }}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </div>
  );
}
