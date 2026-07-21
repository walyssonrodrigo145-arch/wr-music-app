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
  isValid,
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
import DayLessonsModal from "@/components/modals/DayLessonsModal";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type CalendarView = "mes" | "semana" | "dia" | "eventos";
const DAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Map from mobile filter chip label to DB status value
const STATUS_CHIP_MAP: Record<string, string> = {
  "Agendadas": "agendada",
  "Concluídas": "concluida",
  "Canceladas": "cancelada",
  "Remarcadas": "remarcada",
  "Faltas": "falta",
};

// --- FUNÇÃO DE FORMAT SEGURO ---
const safeFormat = (date: any, formatStr: string, options?: any) => {
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!isValid(d)) return "Inválido";
    return format(d, formatStr, options);
  } catch {
    return "Inválido";
  }
};

const statusConfig = {
  agendada: { label: "Agendada", color: "bg-blue-600", text: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  concluida: { label: "Concluída", color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  cancelada: { label: "Cancelada", color: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  remarcada: { label: "Remarcada", color: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  falta: { label: "Falta", color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const LessonCardDesktop = ({ lesson, onClick }: { lesson: any, onClick: (e: React.MouseEvent) => void }) => {
    const isTurma = lesson.lessonType === 'turma';
    const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
    const titleText = isTurma ? (lesson.title || "Turma") : (lesson.studentName || lesson.experimentalName || "Aula");

    return (
      <motion.div
        layoutId={`lesson-${lesson.id}`}
        onClick={onClick}
        className={cn(
          "p-3.5 rounded-xl border-l-4 bg-card border-border transition-all cursor-pointer shadow-sm mb-2 hover:border-purple-500/30",
          config.border
        )}
        style={{ borderLeftColor: isTurma ? '#9333ea' : config.color.replace('bg-', '') }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[10px] font-black uppercase tracking-widest", isTurma ? "text-purple-600" : config.text)}>
            {safeFormat(lesson.scheduledAt, "HH:mm")}
          </span>
          <div className={cn("w-2 h-2 rounded-full", isTurma ? "bg-purple-600" : config.color)} />
        </div>
        <p className="text-xs font-black text-foreground truncate leading-tight">
          {titleText}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
           <Music size={10} className="text-muted-foreground" />
           <p className="text-[9px] text-muted-foreground font-bold truncate uppercase">{lesson.instrumentName || "Geral"}</p>
        </div>
        {isTurma && (
          <div className="mt-2 py-0.5 px-2 bg-purple-500/10 rounded-full w-fit flex items-center gap-1">
            <Users size={10} className="text-purple-600" />
            <p className="text-[8px] font-black text-purple-600 uppercase tracking-widest">
              Turma ({lesson.studentCount || 1} Alunos)
            </p>
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
  const [dayLessonsModalDate, setDayLessonsModalDate] = useState<Date | null>(null);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [recurringAction, setRecurringAction] = useState<{
    type: 'delete' | 'reschedule';
    id: number;
    newDate?: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: lessons = [], isLoading } = trpc.lessons.list.useQuery();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();
  const { data: pendingReminders = [] } = trpc.reminders.list.useQuery({ status: "pendente" });

  const targetLessonForAction = useMemo(() => {
    if (!recurringAction) return null;
    return lessons.find(l => l.id === recurringAction.id);
  }, [recurringAction, lessons]);

  const hasRecurrence = !!targetLessonForAction?.recurringGroupId;

  const updateStatusMutation = trpc.lessons.updateStatus.useMutation({
    onSuccess: (_, vars) => {
      const msg = vars.status === 'remarcada' ? 'Aula remarcada com sucesso!' : 'Status atualizado!';
      toast.success(msg);
      utils.lessons.list.invalidate();
    },
    onError: (e) => toast.error('Erro ao atualizar status: ' + e.message)
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
    const rawFiltered = lessons.filter(l => {
      if (isDesktop) {
        const matchesSearch = (l.title || l.studentName || l.experimentalName || "").toLowerCase().includes(search.toLowerCase());
        const matchesInstrument = instrumentFilter === "todos" || String(l.instrumentId) === instrumentFilter;
        const matchesStatus = statusFilterDesktop === "geral" || l.status === statusFilterDesktop;
        const matchesLessonType = lessonTypeFilter === "todos" || l.lessonType === lessonTypeFilter;
        return matchesSearch && matchesInstrument && matchesStatus && matchesLessonType;
      } else {
        const isDayMatch = isSameDay(new Date(l.scheduledAt), selectedDate);
        const matchesSearch = (l.title || l.studentName || l.experimentalName || "").toLowerCase().includes(search.toLowerCase());
        let matchesStatus = false;
        if (statusFilterMobile === "Todas") {
          matchesStatus = true;
        } else if (statusFilterMobile === "Hoje") {
          matchesStatus = isToday(new Date(l.scheduledAt));
        } else {
          const mappedStatus = STATUS_CHIP_MAP[statusFilterMobile];
          matchesStatus = mappedStatus ? l.status === mappedStatus : true;
        }
        const matchesLessonType = lessonTypeFilter === "todos" || l.lessonType === lessonTypeFilter;
        return isDayMatch && matchesSearch && matchesStatus && matchesLessonType;
      }
    });

    // Agrupar aulas em turma para que apareçam como apenas 1 card representando a turma na agenda
    const grouped: any[] = [];
    const turmaMap = new Map<string, any>();

    for (const lesson of rawFiltered) {
      if (lesson.lessonType === 'turma') {
        const d = safeFormat(lesson.scheduledAt, "yyyy-MM-dd_HH:mm");
        const key = lesson.recurringGroupId ? `group_${lesson.recurringGroupId}_${d}` : `turma_${lesson.title}_${d}`;
        if (!turmaMap.has(key)) {
          const turmaCopy = { 
            ...lesson, 
            studentCount: 1, 
            studentsList: [lesson.studentName || "Aluno"] 
          };
          turmaMap.set(key, turmaCopy);
          grouped.push(turmaCopy);
        } else {
          const existing = turmaMap.get(key);
          existing.studentCount += 1;
          if (lesson.studentName) {
            existing.studentsList.push(lesson.studentName);
          }
        }
      } else {
        grouped.push(lesson);
      }
    }

    return grouped;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeleteRequest = (id: number) => {
    const target = lessons.find(l => l.id === id);
    if (target?.recurringGroupId) {
      setRecurringAction({ type: 'delete', id });
    } else {
      deleteMutation.mutate({ id, deleteSeries: false });
    }
  };

  const handleStatusChange = (id: number, status: string, newDate?: string) => {
    if (status === 'remarcada' && newDate) {
      const target = lessons.find(l => l.id === id);
      setDetailLessonId(null);
      if (target?.recurringGroupId) {
        setTimeout(() => setRecurringAction({ type: 'reschedule', id, newDate }), 150);
      } else {
        updateStatusMutation.mutate({ id, status: status as any, scheduledAt: newDate });
      }
    } else {
      updateStatusMutation.mutate({ id, status: status as any, scheduledAt: newDate });
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT (MODERNO E INSPIRADO NO MODELO)
  // ──────────────────────────────────────────────────────────────────────────
  if (isDesktop) {
    const todayLessons = lessons.filter(l => isToday(new Date(l.scheduledAt)));
    const todayCompleted = todayLessons.filter(l => l.status === 'concluida').length;
    const todayPending = todayLessons.filter(l => l.status === 'agendada').length;
    const todayCancelled = todayLessons.filter(l => l.status === 'cancelada').length;

    // Cálculo estático/dinâmico de ocupação semanal (Domingo a Sábado)
    const weekDays = eachDayOfInterval({ start: startOfWeek(new Date(), { weekStartsOn: 0 }), end: endOfWeek(new Date(), { weekStartsOn: 0 }) });
    const occupancy = weekDays.map(day => {
      const count = lessons.filter(l => isSameDay(new Date(l.scheduledAt), day)).length;
      // considera 8 aulas/dia como 100% de capacidade
      const pct = Math.min(100, Math.round((count / 8) * 100));
      return { dayLabel: DAYS_SHORT[day.getDay()], pct };
    });

    return (
      <div className={cn(
        "flex flex-col bg-background overflow-hidden transition-all duration-300",
        isExpanded 
          ? "fixed inset-0 z-[45] p-6 lg:p-8 overflow-y-auto m-0 h-screen max-w-none animate-in fade-in zoom-in-95 duration-300 bg-background" 
          : "h-[calc(100vh-5rem)] -m-4 sm:-m-6"
      )}>
        {/* Header Superior da Agenda */}
        <div className="p-6 pb-4 border-b border-border/40 bg-card/40 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Agenda</h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">Gerencie suas aulas, horários e compromissos</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input
                type="text"
                placeholder="Buscar aluno, aula, instrumento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-12 rounded-xl bg-card border border-border/60 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded border border-border/40">Ctrl + K</span>
            </div>
            
            <Button
              onClick={() => setAgendarOpen(true)}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Plus size={16} strokeWidth={3} />
              <span>+ Nova</span>
            </Button>
          </div>
        </div>

        {/* Sub-Header de Filtros e Visões */}
        <div className="px-6 py-3 border-b border-border/30 bg-muted/10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Botões de Visão (Mês, Semana, Dia, Eventos/Lista) */}
            <div className="flex p-1 bg-card rounded-xl border border-border/60 shadow-sm">
              {(["mes", "semana", "dia", "eventos"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                    view === v ? "bg-blue-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "eventos" ? "Lista" : v}
                </button>
              ))}
            </div>

            {/* Seletores de Data */}
            <div className="flex items-center gap-2">
              {(view === "mes" || view === "eventos") && (
                <>
                  <select
                    value={currentDate.getMonth()}
                    onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), Number(e.target.value), 1))}
                    className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground focus:outline-none shadow-sm cursor-pointer"
                  >
                    {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={currentDate.getFullYear()}
                    onChange={e => setCurrentDate(new Date(Number(e.target.value), currentDate.getMonth(), 1))}
                    className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground focus:outline-none shadow-sm cursor-pointer"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </>
              )}

              <button
                onClick={() => {
                  setCurrentDate(new Date());
                  setAnimateToday(true);
                  setTimeout(() => setAnimateToday(false), 1000);
                }}
                className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-sm"
              >
                Hoje
              </button>
              
              <div className="flex items-center gap-1 bg-card border border-border/60 rounded-xl p-0.5 shadow-sm">
                <button
                  onClick={() => {
                    if (view === "dia") setCurrentDate(addDays(currentDate, -1));
                    else if (view === "semana") setCurrentDate(addDays(currentDate, -7));
                    else setCurrentDate(subMonths(currentDate, 1));
                  }}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    if (view === "dia") setCurrentDate(addDays(currentDate, 1));
                    else if (view === "semana") setCurrentDate(addDays(currentDate, 7));
                    else setCurrentDate(addMonths(currentDate, 1));
                  }}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Filtros Suspensos de Instrumento, Status e Modalidade */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Instrumento:</span>
              <select
                value={instrumentFilter}
                onChange={e => setInstrumentFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer"
              >
                <option value="todos">Todos</option>
                {instruments.map(i => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Status:</span>
              <select
                value={statusFilterDesktop}
                onChange={e => setStatusFilterDesktop(e.target.value)}
                className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer capitalize"
              >
                <option value="geral">Todos</option>
                <option value="agendada">Agendadas</option>
                <option value="concluida">Concluídas</option>
                <option value="cancelada">Canceladas</option>
                <option value="remarcada">Remarcadas</option>
                <option value="falta">Faltas</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Modalidade:</span>
              <select
                value={lessonTypeFilter}
                onChange={e => setLessonTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer"
              >
                <option value="todos">Todas</option>
                <option value="individual">Individual</option>
                <option value="turma">Turma</option>
              </select>
            </div>

            {(instrumentFilter !== "todos" || statusFilterDesktop !== "geral" || lessonTypeFilter !== "todos") && (
              <button
                onClick={() => { setInstrumentFilter("todos"); setStatusFilterDesktop("geral"); setLessonTypeFilter("todos"); }}
                className="text-xs font-bold text-blue-600 hover:underline px-2"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo Principal Split (Calendário + Painel Direita) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Coluna Esquerda: Calendário Principal */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 no-scrollbar">
            <div id="tour-calendar-view" className="relative min-h-[500px]">
              <AnimatePresence mode="wait">
                {view === "mes" && (
                  <motion.div key="month" className="bg-card rounded-2xl border border-border/60 shadow-xl overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
                      {DAYS_SHORT.map(day => (
                        <div key={day} className="py-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 min-h-[520px]">
                      {monthDays.map((day, idx) => {
                        const lessonsInDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                        const isCurrMonth = isSameMonth(day, currentDate);
                        return (
                          <div 
                            key={idx} 
                            className={cn(
                              "p-2 border-r border-b border-border/40 min-h-[110px] relative transition-colors", 
                              !isCurrMonth && "opacity-25 bg-muted/20", 
                              isToday(day) && "bg-blue-500/5"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span 
                                onClick={(e) => { e.stopPropagation(); setCurrentDate(day); setAgendarOpen(true); }}
                                className={cn(
                                  "text-xs font-bold cursor-pointer hover:text-blue-600 transition-colors",
                                  isToday(day) ? "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black" : "text-muted-foreground"
                                )}
                              >
                                {format(day, "d")}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {lessonsInDay.slice(0, 3).map(l => (
                                <LessonCardDesktop key={l.id} lesson={l} onClick={(e) => { e.stopPropagation(); setDetailLessonId(l.id); }} />
                              ))}
                              {lessonsInDay.length > 3 && (
                                <button
                                  type="button"
                                  className="w-full text-[9px] font-black text-blue-600 text-center cursor-pointer hover:underline py-0.5 bg-transparent"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDayLessonsModalDate(day);
                                  }}
                                >
                                  + {lessonsInDay.length - 3} aulas
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {view === "semana" && (
                  <motion.div key="week" className="grid grid-cols-7 gap-3">
                    {eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }).map((day, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className={cn("p-3 rounded-2xl border text-center", isToday(day) ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-card border-border/60")}>
                          <p className="text-[10px] font-bold uppercase opacity-70 mb-0.5">{DAYS_SHORT[i]}</p>
                          <p className="text-xl font-black">{format(day, "d")}</p>
                        </div>
                        <div className="space-y-2">
                          {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day)).map(l => (
                            <LessonCardDesktop key={l.id} lesson={l} onClick={(e) => { e.stopPropagation(); setDetailLessonId(l.id); }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {view === "dia" && (
                  <motion.div key="day" className="space-y-4">
                    <div className="flex items-center justify-between bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-lg">
                          {format(currentDate, "d")}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">{format(currentDate, "EEEE", { locale: ptBR })}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">{format(currentDate, "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), currentDate)).length} aulas
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredLessons
                        .filter(l => isSameDay(new Date(l.scheduledAt), currentDate))
                        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                        .map(l => <LessonCardDesktop key={l.id} lesson={l} onClick={(e) => { e.stopPropagation(); setDetailLessonId(l.id); }} />)}
                    </div>
                  </motion.div>
                )}

                {view === "eventos" && (
                  <motion.div key="events" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredLessons
                      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                      .map(l => (
                        <div key={l.id} className="relative">
                          <div className="absolute -top-2.5 left-4 z-10 px-2.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase shadow-md">
                            {safeFormat(l.scheduledAt, "dd/MM")}
                          </div>
                          <LessonCardDesktop lesson={l} onClick={(e) => { e.stopPropagation(); setDetailLessonId(l.id); }} />
                        </div>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Legenda de Cores no Rodapé (Como na Imagem) */}
            <div className="flex items-center gap-4 flex-wrap pt-3 border-t border-border/40 text-[10px] font-bold text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Individual</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Turma</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reposição</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Experimental</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Cancelada</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Concluída</div>
            </div>
          </div>

          {/* Coluna Direita (Painel de Resumo do Dia e Ocupação da Semana) */}
          <div className="w-80 border-l border-border/40 bg-card/30 p-5 space-y-6 overflow-y-auto no-scrollbar shrink-0 hidden xl:block">
            {/* Card de Resumo do dia */}
            <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Resumo do dia</span>
                <span className="text-[10px] font-bold text-blue-600">{format(new Date(), "dd/MM")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-muted/20 rounded-xl border border-border/30">
                  <p className="text-base font-black text-foreground">{todayLessons.length}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Aulas</p>
                </div>
                <div className="p-2 bg-muted/20 rounded-xl border border-border/30">
                  <p className="text-base font-black text-emerald-600">{todayCompleted}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Concluídas</p>
                </div>
                <div className="p-2 bg-muted/20 rounded-xl border border-border/30">
                  <p className="text-base font-black text-rose-500">{todayCancelled}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Canceladas</p>
                </div>
                <div className="p-2 bg-muted/20 rounded-xl border border-border/30">
                  <p className="text-base font-black text-blue-600">{todayPending}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Pendentes</p>
                </div>
              </div>
            </div>

            {/* Próximas Aulas de Hoje (Timeline) */}
            <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Próximas aulas hoje</span>
                <span className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => setView('dia')}>Ver todas</span>
              </div>
              <div className="space-y-2.5 max-h-56 overflow-y-auto no-scrollbar">
                {todayLessons.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4">Nenhuma aula agendada para hoje.</p>
                ) : (
                  todayLessons.slice(0, 5).map((l: any) => (
                    <div key={l.id} className="p-2.5 bg-muted/20 rounded-xl border border-border/30 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setDetailLessonId(l.id)}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-600">{safeFormat(l.scheduledAt, "HH:mm")}</span>
                          <span className="text-xs font-bold text-foreground truncate">{l.title || l.studentName}</span>
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{l.instrumentName || "Música"}</p>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        l.status === 'concluida' ? "bg-emerald-500" : l.status === 'falta' ? "bg-rose-500" : "bg-blue-500"
                      )} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ocupação da Semana (Gráfico de Barras) */}
            <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Ocupação da semana</span>
              <div className="flex items-end justify-between gap-1.5 h-28 pt-4 px-1">
                {occupancy.map((occ, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[8px] font-black text-muted-foreground">{occ.pct}%</span>
                    <div className="w-full bg-muted rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: '70px' }}>
                      <div 
                        className={cn(
                          "w-full transition-all duration-500 rounded-t-lg",
                          occ.pct > 75 ? "bg-rose-500" : occ.pct > 40 ? "bg-amber-500" : occ.pct > 0 ? "bg-emerald-500" : "bg-transparent"
                        )} 
                        style={{ height: `${occ.pct}%` }} 
                      />
                    </div>
                    <span className="text-[8px] font-bold text-muted-foreground">{occ.dayLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modais da Agenda */}
        <AgendarModal open={agendarOpen} onOpenChange={(open) => { setAgendarOpen(open); if (!open) setEditingLesson(null); }} editingLesson={editingLesson} initialDate={currentDate} />
        <LessonDetailModal open={!!detailLessonId} lesson={lessons.find(l => l.id === detailLessonId)} onOpenChange={(open) => !open && setDetailLessonId(null)} onStatusChange={handleStatusChange} onDelete={(id) => { setDetailLessonId(null); setTimeout(() => handleDeleteRequest(id), 150); }} onEdit={() => { setEditingLesson(lessons.find(l => l.id === detailLessonId)); setAgendarOpen(true); setDetailLessonId(null); }} />

        <DayLessonsModal
          day={dayLessonsModalDate || new Date()}
          lessons={dayLessonsModalDate ? filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), dayLessonsModalDate)) : []}
          open={!!dayLessonsModalDate}
          onOpenChange={(v) => !v && setDayLessonsModalDate(null)}
          onOpenDetail={(lesson) => {
            setDayLessonsModalDate(null);
            setDetailLessonId(lesson.id);
          }}
          onStatusChange={handleStatusChange}
          onAddLesson={(day) => {
            setSelectedDate(day);
            setAgendarOpen(true);
            setDayLessonsModalDate(null);
          }}
        />

        {/* Dialog de confirmação para ações recorrentes */}
        <ResponsiveDialog
          open={!!recurringAction}
          onOpenChange={(open) => { if (!open) setRecurringAction(null); }}
          title={
            hasRecurrence
              ? (recurringAction?.type === 'delete' ? 'Excluir Aula Recorrente' : 'Remarcar Aula Recorrente')
              : (recurringAction?.type === 'delete' ? 'Confirmar Exclusão' : 'Confirmar Remarcação')
          }
          description={
            hasRecurrence
              ? "Esta aula faz parte de uma série recorrente. Como deseja aplicar esta alteração?"
              : (recurringAction?.type === 'delete' ? 'Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.' : 'Deseja confirmar a remarcação desta aula?')
          }
        >
          <div className="flex flex-col gap-3 pb-8 md:pb-0">
            {hasRecurrence ? (
              <>
                <button
                  onClick={async () => {
                    if (!recurringAction) return;
                    try {
                      if (recurringAction.type === 'delete') {
                        await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: false });
                      } else {
                        await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: false });
                      }
                    } catch (err) {}
                    setRecurringAction(null);
                  }}
                  className="w-full h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                >
                  {recurringAction?.type === 'delete' ? 'Excluir apenas esta aula' : 'Remarcar apenas esta aula'}
                </button>
                <button
                  onClick={async () => {
                    if (!recurringAction) return;
                    try {
                      if (recurringAction.type === 'delete') {
                        await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: true });
                      } else {
                        await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: true });
                      }
                    } catch (err) {}
                    setRecurringAction(null);
                  }}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  {recurringAction?.type === 'delete' ? 'Excluir toda a série (futuras)' : 'Remarcar toda a série (futuras)'}
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  if (!recurringAction) return;
                  try {
                    if (recurringAction.type === 'delete') {
                      await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: false });
                    } else {
                      await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: false });
                    }
                  } catch (err) {}
                  setRecurringAction(null);
                }}
                className={cn(
                  "w-full h-12 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                  recurringAction?.type === 'delete' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                )}
              >
                {recurringAction?.type === 'delete' ? 'Sim, excluir' : 'Sim, remarcar'}
              </button>
            )}
            <button
              onClick={() => setRecurringAction(null)}
              className="w-full h-12 rounded-xl border border-border text-muted-foreground hover:bg-muted/10 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </ResponsiveDialog>
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

      {/* Lesson Grid */}
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
                const isTurma = lesson.lessonType === 'turma';
                const config = statusConfig[lesson.status as keyof typeof statusConfig] || statusConfig.agendada;
                const titleText = isTurma ? (lesson.title || "Turma") : (lesson.studentName || lesson.experimentalName || "Aula");

                return (
                  <motion.div key={lesson.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} whileHover={{ scale: 1.01 }} className="group bg-card rounded-[2.5rem] p-6 lg:p-8 border border-border shadow-sm transition-all cursor-pointer flex flex-col justify-between min-h-[180px]" onClick={() => setDetailLessonId(lesson.id)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-1.5 h-6 rounded-full", isTurma ? "bg-purple-600" : config.color)} />
                        <span className="text-lg font-black text-foreground tracking-tighter">{safeFormat(lesson.scheduledAt, "HH:mm")}</span>
                      </div>
                      <span className={cn("px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", isTurma ? "bg-purple-500/10 text-purple-600 border-purple-500/20" : cn(config.bg, config.text, config.border))}>
                        {isTurma ? `Turma (${lesson.studentCount || 1} Alunos)` : config.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-foreground leading-tight group-hover:text-blue-600 transition-colors">{titleText}</h4>
                      <div className="flex items-center gap-4 flex-wrap">
                         <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest"><Music size={14} className="text-blue-500" /> {lesson.instrumentName || "Geral"}</div>
                         {isTurma && (
                           <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 uppercase tracking-widest"><Users size={14} className="text-purple-500" /> {lesson.studentCount} Alunos na turma</div>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                       <button className="text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1.5">Chamada / Detalhes <ChevronRight size={14} /></button>
                       <button className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"><MoreVertical size={20} /></button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="fixed bottom-[104px] right-6 z-30">
        <motion.button id="tour-new-lesson" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setAgendarOpen(true)} className="bg-[#2563EB] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.5)] group relative overflow-hidden">
          <Plus size={26} strokeWidth={3} className="relative z-10" />
        </motion.button>
      </div>

      <AgendarModal open={agendarOpen} onOpenChange={(open) => { setAgendarOpen(open); if (!open) setEditingLesson(null); }} editingLesson={editingLesson} initialDate={selectedDate} />
      <LessonDetailModal 
        open={!!detailLessonId} 
        lesson={lessons.find(l => l.id === detailLessonId)} 
        onOpenChange={(open) => !open && setDetailLessonId(null)} 
        onStatusChange={handleStatusChange} 
        onDelete={(id) => {
          setDetailLessonId(null);
          setTimeout(() => handleDeleteRequest(id), 150);
        }} 
        onEdit={() => { 
          setEditingLesson(lessons.find(l => l.id === detailLessonId)); 
          setAgendarOpen(true); 
          setDetailLessonId(null); 
        }} 
      />

      {/* ── Dialog de confirmação compartilhado desktop+mobile ──────────────── */}
      <ResponsiveDialog
        open={!!recurringAction}
        onOpenChange={(open) => { if (!open) setRecurringAction(null); }}
        title={
          hasRecurrence
            ? (recurringAction?.type === 'delete' ? 'Excluir Aula Recorrente' : 'Remarcar Aula Recorrente')
            : (recurringAction?.type === 'delete' ? 'Confirmar Exclusão' : 'Confirmar Remarcação')
        }
        description={
          hasRecurrence
            ? "Esta aula faz parte de uma série recorrente. Como deseja aplicar esta alteração?"
            : (recurringAction?.type === 'delete' ? 'Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.' : 'Deseja confirmar a remarcação desta aula?')
        }
      >
        <div className="flex flex-col gap-3 pb-8 md:pb-0">
          {hasRecurrence ? (
            <>
              <button
                onClick={async () => {
                  if (!recurringAction) return;
                  try {
                    if (recurringAction.type === 'delete') {
                      await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: false });
                    } else {
                      await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: false });
                    }
                  } catch (err) {}
                  setRecurringAction(null);
                }}
                className="w-full h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                {recurringAction?.type === 'delete' ? 'Excluir apenas esta aula' : 'Remarcar apenas esta aula'}
              </button>
              <button
                onClick={async () => {
                  if (!recurringAction) return;
                  try {
                    if (recurringAction.type === 'delete') {
                      await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: true });
                    } else {
                      await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: true });
                    }
                  } catch (err) {}
                  setRecurringAction(null);
                }}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                {recurringAction?.type === 'delete' ? 'Excluir toda a série (futuras)' : 'Remarcar toda a série (futuras)'}
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                if (!recurringAction) return;
                try {
                  if (recurringAction.type === 'delete') {
                    await deleteMutation.mutateAsync({ id: recurringAction.id, deleteSeries: false });
                  } else {
                    await updateStatusMutation.mutateAsync({ id: recurringAction.id, status: 'remarcada', scheduledAt: recurringAction.newDate, updateSeries: false });
                  }
                } catch (err) {}
                setRecurringAction(null);
              }}
              className={cn(
                "w-full h-12 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer",
                recurringAction?.type === 'delete' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
              )}
            >
              {recurringAction?.type === 'delete' ? 'Sim, excluir' : 'Sim, remarcar'}
            </button>
          )}
          <button
            onClick={() => setRecurringAction(null)}
            className="w-full h-12 rounded-xl border border-border text-muted-foreground hover:bg-muted/10 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </ResponsiveDialog>

      <DayLessonsModal
        day={dayLessonsModalDate || new Date()}
        lessons={dayLessonsModalDate ? filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), dayLessonsModalDate)) : []}
        open={!!dayLessonsModalDate}
        onOpenChange={(v) => !v && setDayLessonsModalDate(null)}
        onOpenDetail={(lesson) => {
          setDayLessonsModalDate(null);
          setDetailLessonId(lesson.id);
        }}
        onStatusChange={handleStatusChange}
        onAddLesson={(day) => {
          setSelectedDate(day);
          setAgendarOpen(true);
          setDayLessonsModalDate(null);
        }}
      />
    </div>
  );
}
