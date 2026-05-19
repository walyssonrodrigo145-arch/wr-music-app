import { useState, useMemo } from "react";
import { Link } from "wouter";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Calendar as CalendarIcon,
  LayoutList,
  CalendarRange,
  CalendarCheck,
  Music,
  CheckCircle,
  AlertCircle,
  Search,
  Bell,
  Filter,
  Users,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Calendar,
  Maximize2,
  Minimize2,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type CalendarView = "mes" | "semana" | "dia" | "eventos";
const DAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const statusConfig = {
  agendada: { label: "Agendada", color: "bg-blue-600", text: "text-blue-600", bg: "bg-blue-500/100/10", border: "border-blue-500/20" },
  concluida: { label: "Concluída", color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  cancelada: { label: "Cancelada", color: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  remarcada: { label: "Remarcada", color: "bg-purple-500/100", text: "text-purple-600", bg: "bg-purple-500/100/10", border: "border-purple-500/20" },
  falta: { label: "Falta", color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const LessonCardDesktop = ({ lesson, onClick }: { lesson: any, onClick: () => void }) => {
    const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
    return (
      <motion.div
        layoutId={`lesson-${lesson.id}`}
        onClick={onClick}
        className={cn(
          "p-3.5 rounded-xl border-l-4 bg-card border-border transition-all cursor-pointer shadow-sm mb-2",
          config.border
        )}
        style={{ borderLeftColor: config.color.replace('bg-', '') }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
            {format(new Date(lesson.scheduledAt), "HH:mm")}
          </span>
          <div className={cn("w-2 h-2 rounded-full", config.color)} />
        </div>
        <p className="text-xs font-black text-foreground truncate leading-tight">
          {lesson.studentName || lesson.experimentalName}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
           <Music size={10} className="text-muted-foreground" />
           <p className="text-[9px] text-muted-foreground font-bold truncate uppercase">{lesson.instrumentName}</p>
        </div>
        {lesson.lessonType === 'turma' && (
          <div className="mt-2 py-0.5 px-2 bg-purple-500/10 rounded-full w-fit">
            <p className="text-[8px] font-black text-purple-600 uppercase tracking-widest">Aula em Turma</p>
          </div>
        )}
      </motion.div>
    );
};

export default function Aulas() {
  const { isDesktop } = useBreakpoint();
  
  // Desktop specific states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("mes");
  const [animateToday, setAnimateToday] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState("todos");
  const [statusFilterDesktop, setStatusFilterDesktop] = useState("geral");
  const [lessonTypeFilter, setLessonTypeFilter] = useState("todos");
  const [isExpanded, setIsExpanded] = useState(false);

  // Mobile specific states
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilterMobile, setStatusFilterMobile] = useState("Todas");
  const [search, setSearch] = useState("");

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
    },
    onError: (e) => toast.error("Erro ao atualizar status: " + e.message)
  });

  const deleteMutation = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Aula removida!");
      utils.lessons.list.invalidate();
      setDetailLessonId(null);
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message)
  });

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      if (isDesktop) {
        const matchesSearch = (l.studentName || l.experimentalName || "").toLowerCase().includes(search.toLowerCase());
        const matchesInstrument = instrumentFilter === "todos" || String(l.instrumentId) === instrumentFilter;
        const matchesStatus = statusFilterDesktop === "geral" || l.status === statusFilterDesktop;
        const matchesLessonType = lessonTypeFilter === "todos" || l.lessonType === lessonTypeFilter;
        return matchesSearch && matchesInstrument && matchesStatus && matchesLessonType;
      } else {
        const isDayMatch = isSameDay(new Date(l.scheduledAt), selectedDate);
        const matchesSearch = (l.studentName || l.experimentalName || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilterMobile === "Todas" || 
                             (statusFilterMobile === "Hoje" && isToday(new Date(l.scheduledAt))) ||
                             l.status.toLowerCase() === statusFilterMobile.toLowerCase().replace("í", "i");
        const matchesLessonType = lessonTypeFilter === "todos" || l.lessonType === lessonTypeFilter;
        return isDayMatch && matchesSearch && matchesStatus && matchesLessonType;
      }
    });
  }, [lessons, isDesktop, search, instrumentFilter, statusFilterDesktop, selectedDate, statusFilterMobile, lessonTypeFilter]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDaysMobile = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  // Unused stats removed for expanded calendar layout

  const handleStatusChange = (id: number, status: string, newDate?: string) => {
    updateStatusMutation.mutate({ id, status: status as any, scheduledAt: newDate });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT (NOTEBOOK)
  // ──────────────────────────────────────────────────────────────────────────
  if (isDesktop) {

    return (
      <div className={cn(
        "flex flex-col bg-background overflow-hidden transition-all duration-300",
        isExpanded 
          ? "fixed inset-0 z-[45] p-6 lg:p-10 overflow-y-auto m-0 h-screen max-w-none animate-in fade-in zoom-in-95 duration-300" 
          : "h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] -m-4 sm:-m-6"
      )}>
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden no-scrollbar">
          <div className={cn("flex-1 overflow-y-auto space-y-8 no-scrollbar", isExpanded ? "p-0" : "p-8")}>
            {/* Desktop Filters */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Instrumentos</p>
                  <div className="flex flex-wrap gap-2">
                     {["todos", ...instruments.map(i => String(i.id))].map((id) => {
                       const inst = instruments.find(i => String(i.id) === id);
                       const label = id === "todos" ? "Todos" : inst?.name;
                       const isActive = instrumentFilter === id;
                       return (
                         <button key={id} onClick={() => setInstrumentFilter(id)} className={cn("px-4 py-2 rounded-xl text-[11px] font-black transition-all border shadow-sm", isActive ? "bg-blue-600 text-white border-blue-600" : "bg-card text-muted-foreground border-border")}>{label}</button>
                       );
                     })}
                  </div>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                     {["geral", "agendada", "concluida", "cancelada", "remarcada", "falta"].map((st) => (
                       <button key={st} onClick={() => setStatusFilterDesktop(st)} className={cn("px-4 py-2 rounded-xl text-[11px] font-black transition-all border shadow-sm capitalize", statusFilterDesktop === st ? "bg-blue-600 text-white border-slate-800" : "bg-card text-muted-foreground border-border")}>{st}</button>
                     ))}
                  </div>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Modalidade</p>
                  <div className="flex flex-wrap gap-2">
                     {[
                       { id: "todos", label: "Todas" },
                       { id: "individual", label: "Individual" },
                       { id: "turma", label: "Turma" }
                     ].map((t) => (
                       <button key={t.id} onClick={() => setLessonTypeFilter(t.id)} className={cn("px-4 py-2 rounded-xl text-[11px] font-black transition-all border shadow-sm", lessonTypeFilter === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-card text-muted-foreground border-border")}>{t.label}</button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Desktop Calendar Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
               <div className="flex p-1 bg-muted/40 rounded-xl shadow-sm border border-border/30">
                  {(["mes", "semana", "dia", "eventos"] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} className={cn("px-5 py-2 rounded-lg text-[11px] font-black transition-all capitalize", view === v ? "bg-blue-600 text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}>{v}</button>
                  ))}
               </div>
               <div className="flex items-center gap-3 flex-wrap">
                  {/* Month/Year filter — visible in mes/eventos view */}
                  {(view === "mes" || view === "eventos") && (
                    <div className="flex items-center gap-2">
                      <select
                        value={currentDate.getMonth()}
                        onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), Number(e.target.value), 1))}
                        className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                      >
                        {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={currentDate.getFullYear()}
                        onChange={e => setCurrentDate(new Date(Number(e.target.value), currentDate.getMonth(), 1))}
                        className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button onClick={() => {
                     if (view === "dia") setCurrentDate(addDays(currentDate, -1));
                     else if (view === "semana") setCurrentDate(addDays(currentDate, -7));
                     else setCurrentDate(subMonths(currentDate, 1));
                   }} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"><ChevronLeft size={18} /></button>
                   
                   <div className="min-w-[200px] text-center">
                      <h3 className="text-lg font-black text-foreground leading-tight">
                         {view === "dia"
                           ? format(currentDate, "dd 'de' MMMM", { locale: ptBR })
                           : view === "semana"
                           ? `${format(startOfWeek(currentDate), "dd/MM", { locale: ptBR })} – ${format(endOfWeek(currentDate), "dd/MM", { locale: ptBR })}`
                           : format(currentDate, "MMMM yyyy", { locale: ptBR })}
                      </h3>
                      {view === "dia" && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{format(currentDate, "EEEE • yyyy", { locale: ptBR })}</p>}
                      {view === "semana" && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{format(currentDate, "yyyy", { locale: ptBR })}</p>}
                   </div>

                   <button onClick={() => {
                     if (view === "dia") setCurrentDate(addDays(currentDate, 1));
                     else if (view === "semana") setCurrentDate(addDays(currentDate, 7));
                     else setCurrentDate(addMonths(currentDate, 1));
                   }} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"><ChevronRight size={18} /></button>

                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-4 text-xs font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                    onClick={() => {
                      setCurrentDate(new Date());
                      setAnimateToday(true);
                      setTimeout(() => setAnimateToday(false), 1000);
                    }}
                  >
                    Hoje
                  </Button>

                  <Button
                    variant={isExpanded ? "default" : "outline"}
                    className={cn(
                      "h-10 rounded-xl px-4 text-xs font-bold transition-all flex items-center gap-2 shadow-sm",
                      isExpanded 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : "hover:bg-blue-600 hover:text-white hover:border-blue-600"
                    )}
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <>
                        <Minimize2 size={16} />
                        Restaurar
                      </>
                    ) : (
                      <>
                        <Maximize2 size={16} />
                        Expandir
                      </>
                    )}
                  </Button>
               </div>
            </div>

            {/* Desktop View Content */}
            <div className="relative min-h-[600px]">
               <AnimatePresence mode="wait">
                  {view === "mes" && (
                    <motion.div key="month" className="bg-card rounded-[2rem] border border-border shadow-xl overflow-hidden">
                       <div className="grid grid-cols-7 border-b border-border bg-muted/50">
                          {DAYS_SHORT.map(day => <div key={day} className="py-4 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">{day}</div>)}
                       </div>
                       <div className="grid grid-cols-7 min-h-[600px]">
                          {monthDays.map((day, idx) => {
                            const lessonsInDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                            const isCurrMonth = isSameMonth(day, currentDate);
                            return (
                               <div 
                                 key={idx} 
                                 onClick={() => {
                                   setCurrentDate(day);
                                   setView("dia");
                                 }}
                                 className={cn(
                                   "p-2 border-r border-b border-border min-h-[140px] relative cursor-pointer hover:bg-muted transition-colors", 
                                   !isCurrMonth && "opacity-20 bg-muted/50", 
                                   isToday(day) && "bg-blue-500/10/30"
                                 )}
                               >
                                 <motion.span 
                                   layout={false}
                                   animate={animateToday && isToday(day) ? { 
                                     scale: [1, 1.4, 1],
                                     transition: { duration: 0.5, repeat: 1 }
                                   } : {}}
                                   className={cn("w-8 h-8 flex items-center justify-center rounded-full text-xs font-black mb-2", isToday(day) ? "bg-blue-600 text-white shadow-lg" : "text-muted-foreground")}
                                 >
                                   {format(day, "d")}
                                 </motion.span>
                                <div className="space-y-1">
                                   {lessonsInDay.slice(0, 3).map(l => <LessonCardDesktop key={l.id} lesson={l} onClick={() => setDetailLessonId(l.id)} />)}
                                  {lessonsInDay.length > 3 && <p className="text-[9px] font-black text-blue-600 text-center">+ {lessonsInDay.length - 3} aulas</p>}
                                </div>
                              </div>
                            );
                          })}
                       </div>
                    </motion.div>
                  )}
                  {view === "semana" && (
                    <motion.div key="week" className="grid grid-cols-7 gap-4">
                      {eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }).map((day, i) => (
                        <div key={i} className="flex flex-col gap-4">
                           <div className={cn("p-4 rounded-3xl border text-center", isToday(day) ? "bg-blue-600 border-blue-600 text-white shadow-xl" : "bg-card border-border")}>
                              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{DAYS_SHORT[i]}</p>
                              <p className="text-2xl font-black">{format(day, "d")}</p>
                           </div>
                           <div className="space-y-3">
                              {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day)).map(l => <LessonCardDesktop key={l.id} lesson={l} onClick={() => setDetailLessonId(l.id)} />)}
                           </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                  {view === "dia" && (
                    <motion.div key="day" className="space-y-6">
                       <div className="flex items-center justify-between bg-card p-6 rounded-3xl border border-border shadow-sm">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-xl">
                                {format(currentDate, "d")}
                             </div>
                             <div>
                                <h3 className="text-lg font-black text-foreground tracking-tight">{format(currentDate, "EEEE", { locale: ptBR })}</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{format(currentDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                             </div>
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-4 py-2 rounded-full border border-border">
                             {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), currentDate)).length} aulas
                          </span>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredLessons
                            .filter(l => isSameDay(new Date(l.scheduledAt), currentDate))
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map(l => <LessonCardDesktop key={l.id} lesson={l} onClick={() => setDetailLessonId(l.id)} />)}
                       </div>
                    </motion.div>
                  )}
                  {view === "eventos" && (
                    <motion.div key="events" className="space-y-8">
                       {/* Group by month or just a list */}
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {filteredLessons
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map(l => (
                              <div key={l.id} className="relative">
                                <div className="absolute -top-3 left-6 z-10 px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg">
                                   {format(new Date(l.scheduledAt), "dd/MM")}
                                </div>
                                <LessonCardDesktop lesson={l} onClick={() => setDetailLessonId(l.id)} />
                              </div>
                            ))}
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="fixed bottom-12 right-12 z-[48]">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setAgendarOpen(true)} className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl relative overflow-hidden group">
            <Plus size={36} strokeWidth={3} />
            <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping opacity-75" />
          </motion.button>
        </div>

        <AgendarModal open={agendarOpen} onOpenChange={(open) => { setAgendarOpen(open); if (!open) setEditingLesson(null); }} editingLesson={editingLesson} />
        <LessonDetailModal open={!!detailLessonId} lesson={lessons.find(l => l.id === detailLessonId)} onOpenChange={(open) => !open && setDetailLessonId(null)} onStatusChange={handleStatusChange} onDelete={() => { if (detailLessonId) deleteMutation.mutate({ id: detailLessonId }); }} onEdit={() => { setEditingLesson(lessons.find(l => l.id === detailLessonId)); setAgendarOpen(true); setDetailLessonId(null); }} />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE / TABLET LAYOUT (PREMIUM DESIGN)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Date Selector Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{format(selectedDate, "MMMM yyyy", { locale: ptBR })}</h2>
           <div className="flex gap-2">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-blue-600 transition-colors"><ChevronRight className="rotate-180" size={16} /></button>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-blue-600 transition-colors"><ChevronRight size={16} /></button>
           </div>
        </div>
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar bg-card p-2 rounded-[2rem] shadow-sm border border-border">
          {weekDaysMobile.map((day, i) => {
            const isActive = isSameDay(day, selectedDate);
            return (
              <button key={i} onClick={() => setSelectedDate(day)} className={cn("flex flex-col items-center gap-2 min-w-[55px] flex-1 py-4 rounded-2xl transition-all relative", isActive ? "bg-blue-600 text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
                <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-white/80" : "text-muted-foreground")}>{format(day, "eee", { locale: ptBR }).slice(0, 3)}</span>
                <span className="text-sm font-black tracking-tight">{format(day, "d")}</span>
                {isActive && <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-card rounded-full shadow-[0_0_10px_#fff]" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter Chips */}
      <section className="flex flex-wrap items-center gap-2">
        {["Todas", "Hoje", "Agendadas", "Concluídas", "Canceladas"].map(chip => (
          <button key={chip} onClick={() => setStatusFilterMobile(chip)} className={cn("px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border", statusFilterMobile === chip ? "bg-blue-600 text-white border-blue-600 shadow-blue-200" : "bg-card text-muted-foreground border-border hover:border-blue-200 hover:text-blue-600")}>{chip}</button>
        ))}
        <div className="h-6 w-[1px] bg-border mx-1" />
        {[
          { id: "todos", label: "Modalidades" },
          { id: "individual", label: "Indiv." },
          { id: "turma", label: "Turma" }
        ].map(t => (
          <button key={t.id} onClick={() => setLessonTypeFilter(t.id)} className={cn("px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border", lessonTypeFilter === t.id ? "bg-purple-600 text-white border-purple-600" : "bg-card text-muted-foreground border-border hover:border-purple-200 hover:text-purple-600")}>{t.label}</button>
        ))}
      </section>

      {/* Lesson Grid (1 col mobile, 2 cols tablet) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">Aulas de {isToday(selectedDate) ? "hoje" : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</h3>
           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-card border border-border px-3 py-1 rounded-full shadow-sm">{filteredLessons.length} aulas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
          <AnimatePresence mode="popLayout">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 rounded-[2.5rem] bg-card border border-border animate-pulse" />) : filteredLessons.length === 0 ? (
              <div className="col-span-full py-24 text-center bg-card rounded-[2.5rem] border border-dashed border-border"><Calendar size={48} className="mx-auto text-slate-100 mb-4" /><p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Nenhuma aula encontrada</p></div>
            ) : (
              filteredLessons.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).map(lesson => {
                const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
                return (
                  <motion.div key={lesson.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} whileHover={{ scale: 1.01 }} className="group bg-card rounded-[2.5rem] p-6 lg:p-8 border border-border shadow-sm transition-all cursor-pointer flex flex-col justify-between min-h-[180px]" onClick={() => setDetailLessonId(lesson.id)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3"><div className={cn("w-1.5 h-6 rounded-full", config.color)} /><span className="text-lg font-black text-foreground tracking-tighter">{format(new Date(lesson.scheduledAt), "HH:mm")}</span></div>
                      <span className={cn("px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", config.bg, config.text, config.border)}>{config.label}</span>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-foreground leading-tight group-hover:text-blue-600 transition-colors">{lesson.studentName || lesson.experimentalName}</h4>
                      <div className="flex items-center gap-4 flex-wrap">
                         <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest"><Music size={14} className="text-blue-500" /> {lesson.instrumentName}</div>
                         <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest"><Users size={14} className="text-purple-500" /> {(lesson as any).teacherName || "Professor"}</div>
                         {lesson.lessonType === 'turma' && (
                           <div className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-[8px] font-black uppercase rounded-full border border-purple-500/20">Turma</div>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                       <button className="text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1.5">Detalhes <ChevronRight size={14} /></button>
                       <button className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"><MoreVertical size={20} /></button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="fixed bottom-8 right-8 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setAgendarOpen(true)} className="bg-[#2563EB] text-white px-8 py-5 rounded-full flex items-center gap-4 shadow-2xl group relative overflow-hidden">
          <Plus size={24} strokeWidth={3} className="relative z-10" /><span className="text-sm font-black uppercase tracking-widest relative z-10">Nova Aula</span>
        </motion.button>
      </div>

      <AgendarModal open={agendarOpen} onOpenChange={(open) => { setAgendarOpen(open); if (!open) setEditingLesson(null); }} editingLesson={editingLesson} />
      <LessonDetailModal open={!!detailLessonId} lesson={lessons.find(l => l.id === detailLessonId)} onOpenChange={(open) => !open && setDetailLessonId(null)} onStatusChange={handleStatusChange} onDelete={() => { if (detailLessonId) deleteMutation.mutate({ id: detailLessonId }); }} onEdit={() => { setEditingLesson(lessons.find(l => l.id === detailLessonId)); setAgendarOpen(true); setDetailLessonId(null); }} />
    </div>
  );
}


