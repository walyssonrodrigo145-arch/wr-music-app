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
  AlertCircle
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
  setHours,
  setMinutes,
  differenceInMinutes,
  startOfDay,
  setMonth,
  setYear
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AgendarModal from "@/components/modals/AgendarModal";
import LessonDetailModal from "@/components/modals/LessonDetailModal";
import LessonCard from "@/components/LessonCard";
import LessonsFilter from "@/components/LessonsFilter";
import DayLessonsModal from "@/components/modals/DayLessonsModal";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CalendarView = "mes" | "semana" | "dia" | "eventos";

interface Lesson {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  status: "agendada" | "concluida" | "cancelada" | "remarcada" | "falta";
  studentName?: string | null;
  studentId?: number | null;
  studentPhone?: string | null;
  isExperimental?: boolean;
  experimentalName?: string | null;
  instrumentId?: number | null;
  instrumentName?: string | null;
  instrumentColor?: string | null;
  instrumentIcon?: string | null;
  description?: string | null;
  notes?: string | null;
  rating?: number | null;
}

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

// ─── Sub-Components ─────────────────────────────────────────────────────────

function PixelTabSelector({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const tabs = [
    { id: "mes", label: "Mês", icon: CalendarDays },
    { id: "semana", label: "Semana", icon: CalendarRange },
    { id: "dia", label: "Dia", icon: CalendarCheck },
    { id: "eventos", label: "Eventos", icon: LayoutList },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-0 w-full mb-4 border-b border-border/10 pb-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = view === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-1.5 py-2 transition-all relative"
          >
            <div className={cn(
              "w-8 h-8 flex items-center justify-center transition-all rounded-xl",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"
            )}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[9px] font-bold tracking-[0.1em] uppercase transition-colors",
              isActive ? "text-primary" : "text-muted-foreground/30"
            )}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function MonthYearPicker({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={(date.getMonth() + 1).toString()} 
        onValueChange={(val) => {
          const newDate = setMonth(date, parseInt(val) - 1);
          onChange(newDate);
        }}
      >
        <SelectTrigger className="w-[120px] h-9 rounded-full bg-muted/5 border-border/20 text-[10px] font-black uppercase tracking-wider focus:ring-1 focus:ring-primary/20">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m, i) => (
            <SelectItem key={m} value={(i + 1).toString()} className="text-[10px] font-bold uppercase pointer-events-auto">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={date.getFullYear().toString()} 
        onValueChange={(val) => {
          const newDate = setYear(date, parseInt(val));
          onChange(newDate);
        }}
      >
        <SelectTrigger className="w-[90px] h-9 rounded-full bg-muted/5 border-border/20 text-[10px] font-black uppercase tracking-wider focus:ring-1 focus:ring-primary/20">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()} className="text-[10px] font-bold uppercase pointer-events-auto">
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Aulas() {
  const utils = trpc.useUtils();
  const [view, setView] = useState<CalendarView>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [novaOpen, setNovaOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDayLessonsOpen, setIsDayLessonsOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{ instrumentId?: number; status?: string }>({});

  const { isMobile, isDesktop } = useBreakpoint();

  // Range calculation based on view
  const range = useMemo(() => {
    let start, end;
    if (view === "eventos") {
      start = startOfDay(new Date());
      end = addMonths(start, 3);
    } else if (view === "semana") {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else if (view === "dia") {
      start = startOfDay(currentDate);
      end = endOfMonth(addMonths(start, 1)); // Fetch more for safety
    } else {
      start = startOfWeek(startOfMonth(currentDate));
      end = endOfWeek(endOfMonth(currentDate));
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }, [view, currentDate]);

  const { data: lessonsData = [] } = trpc.lessons.listRange.useQuery(range);

  // Apply Frontend Search & Filter
  const filteredLessons = useMemo(() => {
    return (lessonsData as Lesson[]).filter(l => {
      const name = l.isExperimental ? l.experimentalName : l.studentName;
      const matchSearch = !searchQuery || name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchInstrument = !filters.instrumentId || l.instrumentId === filters.instrumentId;
      const matchStatus = !filters.status || l.status === filters.status;
      return matchSearch && matchInstrument && matchStatus;
    });
  }, [lessonsData, searchQuery, filters]);

  // Mutations
  const updateStatusMutation = trpc.lessons.updateStatus.useMutation({
    onSuccess: () => { 
      utils.lessons.listRange.invalidate(); 
      utils.dashboard.stats.invalidate(); 
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      utils.lessons.listRange.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Aula removida.");
    },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  const handleStatusChange = (id: number, status: string, newDate?: string) => {
    updateStatusMutation.mutate({ 
      id, 
      status: status as any,
      scheduledAt: newDate
    });
  };

  const handleOpenDetail = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setDetailOpen(true);
  };

  const monthGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekGrid = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const dayLessons = useMemo(() => {
    return filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), selectedDay));
  }, [filteredLessons, selectedDay]);

  const activeHours = useMemo(() => {
    const currentLessons = view === "semana" ? filteredLessons.filter(l => {
      const d = new Date(l.scheduledAt);
      return d >= weekGrid[0] && d <= weekGrid[6];
    }) : (view === "dia" ? dayLessons : []);

    const hoursSet = new Set<number>();
    
    currentLessons.forEach(l => {
      const startDate = new Date(l.scheduledAt);
      const endDate = new Date(startDate.getTime() + l.duration * 60000);
      
      const startH = startDate.getHours();
      let endH = endDate.getHours();
      
      // If ends at 00 mins of an hour, it's really the previous hour for the grid
      if (endDate.getMinutes() === 0) endH -= 1;
      
      // Handle cases where it might wrap to next day (cap at 23 for simplicity in grid)
      if (endDate.getDate() !== startDate.getDate()) endH = 23;

      for (let h = startH; h <= endH; h++) {
        hoursSet.add(h);
      }
    });

    if (hoursSet.size === 0) {
      return Array.from({ length: 10 }, (_, i) => i + 9);
    }

    return Array.from(hoursSet).sort((a, b) => a - b);
  }, [filteredLessons, dayLessons, view, weekGrid]);

  // Helper for positioning blocks in timeline
  const getPosition = (dateStr: string, duration: number) => {
    const date = new Date(dateStr);
    const hour = date.getHours();
    const mins = date.getMinutes();
    
    const hourIndex = activeHours.indexOf(hour);
    if (hourIndex === -1) {
      // If hour is not in list but lesson is visible (e.g. spans from previous hour), 
      // handle gracefully or find closest. For simplicity, we ensure all lesson hours are in activeHours.
      return { top: -1000, height: 0 }; 
    }

    const top = hourIndex * 80 + (mins / 60) * 80;
    const height = (duration / 60) * 80;
    
    return { top, height };
  };

  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground pb-24">
      <div className={cn(
        "w-[98%] max-w-none mx-auto px-2 md:px-4 pt-10"
      )}>
        
        {/* ── Left Column (Main Content) ── */}
        <div className={cn(
          "flex flex-col bg-card rounded-[1.5rem] md:rounded-[2.5rem] border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden w-full"
        )}>
          {/* ── Header Area ── */}
          <div className="px-3 md:px-6 pt-10 pb-6 bg-gradient-to-b from-primary/5 to-transparent">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                   <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase leading-none">
                     {view === "dia" ? format(selectedDay, "dd 'de' MMMM", { locale: ptBR }) : format(currentDate, "MMMM", { locale: ptBR })}
                   </h1>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] mt-1">
                      <span>{format(currentDate, "yyyy")}</span>
                      <div className="w-1 h-1 rounded-full bg-primary/20" />
                      <span>{filteredLessons.length} Compromissos</span>
                   </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <MonthYearPicker 
                   date={view === "dia" ? selectedDay : currentDate} 
                   onChange={(d) => {
                     setCurrentDate(d);
                     setSelectedDay(d);
                   }} 
                 />
                 <button 
                   onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}
                   className="px-4 py-2 rounded-full border border-border/40 text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all active:scale-95 ml-2"
                 >
                   Hoje
                 </button>
                 <div className="flex items-center gap-1 ml-2">
                    <button 
                      onClick={() => {
                        const move = view === "mes" ? subMonths : (view === "semana" ? (d: Date, n: number) => addDays(d, -7 * n) : (d: Date, n: number) => addDays(d, -n));
                        const next = move(view === "dia" ? selectedDay : currentDate, 1);
                        if (view === "dia") setSelectedDay(next);
                        setCurrentDate(next);
                      }} 
                      className="p-2 hover:bg-muted rounded-full text-muted-foreground/50 transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        const move = view === "mes" ? addMonths : (view === "semana" ? (d: Date, n: number) => addDays(d, 7 * n) : (d: Date, n: number) => addDays(d, n));
                        const next = move(view === "dia" ? selectedDay : currentDate, 1);
                        if (view === "dia") setSelectedDay(next);
                        setCurrentDate(next);
                      }} 
                      className="p-2 hover:bg-muted rounded-full text-muted-foreground/50 transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                 </div>
              </div>
            </div>

            <LessonsFilter onSearch={setSearchQuery} onFilterChange={setFilters} />
            <PixelTabSelector view={view} onChange={setView} />
          </div>

          <div className="flex-1 px-2 md:px-6 pb-10 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={view + (view === "dia" ? selectedDay.toISOString() : currentDate.toISOString())}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.02, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
            {view === "mes" ? (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-7 gap-0 mb-4 px-2">
                   {DAYS_SHORT.map(d => (
                     <div key={d} className="text-center font-black text-[10px] text-muted-foreground/20 uppercase tracking-[0.2em]">{d}</div>
                   ))}
                </div>

                <div className="grid grid-cols-7 gap-y-4">
                     {monthGrid.map((day) => {
                       const isSelected = isSameDay(day, selectedDay);
                       const isToday = isSameDay(day, new Date());
                       const inCurrentMonth = isSameMonth(day, currentDate);
                       const lessonsForDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));

                       return (
                         <div 
                           key={day.toISOString()}
                           onClick={() => {
                             setSelectedDay(day); setIsDayLessonsOpen(true);
                             if (!inCurrentMonth) setCurrentDate(day);
                           }}
                           className="flex flex-col items-center justify-center relative cursor-pointer py-1"
                         >
                            <div className={cn(
                              "w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500",
                              isSelected ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/30 scale-110" : 
                              isToday ? "text-primary font-black border-2 border-primary/10 bg-primary/[0.03]" :
                              inCurrentMonth ? "text-foreground/80 hover:bg-muted/80" : "text-muted-foreground/10"
                            )}>
                              {day.getDate()}
                            </div>
                            {lessonsForDay.length > 0 && (
                               <div className="absolute bottom-0 flex gap-0.5">
                                 {lessonsForDay.slice(0, 3).map((l, idx) => (
                                   <div key={l.id} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-primary-foreground/40" : "bg-primary/40")} />
                                 ))}
                                 {lessonsForDay.length > 3 && <div className="w-1 h-1 rounded-full bg-primary/20" />}
                               </div>
                            )}
                         </div>
                       );
                     })}
                </div>


              </div>
            ) : view === "semana" ? (
              <div className="pt-6 relative">
                 {!isDesktop ? (
                   // Mobile/Tablet Weekly View: List of Days
                   <div className="space-y-8">
                     {weekGrid.map((day) => {
                       const lForDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                       const isToday = isSameDay(day, new Date());
                       
                       return (
                         <div key={day.toISOString()} className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex flex-col items-center justify-center",
                                 isToday ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted/10 text-muted-foreground/60"
                               )}>
                                  <span className="text-[8px] font-black uppercase leading-none">{format(day, "eee", { locale: ptBR })}</span>
                                  <span className="text-sm font-black">{day.getDate()}</span>
                               </div>
                               <div className="flex-1 h-[1px] bg-border/20" />
                               <span className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-widest">{lForDay.length} Aulas</span>
                            </div>

                            <div className="space-y-3 pl-3 border-l-[1px] border-border/10 ml-2">
                               {lForDay.length > 0 ? (
                                 lForDay.map(l => (
                                   <LessonCard 
                                     key={l.id} 
                                     lesson={l} 
                                     onStatusChange={handleStatusChange} 
                                     onClick={() => handleOpenDetail(l)} 
                                   />
                                 ))
                               ) : (
                                 <p className="text-[10px] font-bold text-muted-foreground/20 uppercase py-2">Nenhuma aula agendada</p>
                               )}
                            </div>
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   // Desktop Weekly View: Grid Timeline
                   <div className="flex bg-card/50 overflow-hidden border-t border-border/40 min-h-[400px]">
                      <div className="flex-1 flex overflow-y-auto scrollbar-none h-[calc(100vh-280px)] min-h-[600px] relative">
                         {/* Time labels axis */}
                         <div className="w-12 flex-shrink-0 bg-background/50 border-r border-border/40 sticky left-0 z-30">
                            {activeHours.map((hour) => (
                              <div key={hour} className="h-20 flex justify-center pt-2">
                                 <span className="text-[9px] font-black text-muted-foreground/20 uppercase">{hour}:00</span>
                              </div>
                            ))}
                         </div>
 
                         {/* Days Columns */}
                         <div className="flex-1 grid grid-cols-7 relative w-full">
                            {/* Grid lines background */}
                            <div className="absolute inset-0 pointer-events-none">
                               {activeHours.map((hour) => (
                                 <div key={hour} className="h-20 border-b border-border/5" />
                               ))}
                            </div>
 
                            {weekGrid.map((day) => {
                              const lForDay = filteredLessons.filter(l => isSameDay(new Date(l.scheduledAt), day));
                              const isToday = isSameDay(day, new Date());
                              
                              return (
                                <div key={day.toISOString()} className={cn(
                                  "relative border-r border-border/5 last:border-r-0 min-w-[60px]",
                                  isToday && "bg-primary/[0.02]"
                                )}>
                                   {/* Day Header Inside Grid */}
                                   <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md py-2 border-b border-border/40 text-center">
                                      <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-tighter">{format(day, "eee", { locale: ptBR })}</p>
                                      <p className={cn("text-xs font-black", isToday ? "text-primary" : "text-foreground/60")}>{day.getDate()}</p>
                                   </div>
 
                                   {/* Lesson Blocks */}
                                   <div className="relative" style={{ height: activeHours.length * 80 }}>
                                     {lForDay.map(l => {
                                        const pos = getPosition(l.scheduledAt, l.duration);
                                        if (pos.top < 0) return null;
                                        
                                        return (
                                          <div 
                                            key={l.id}
                                            onClick={() => handleOpenDetail(l)}
                                            className={cn(
                                              "absolute left-1 right-1 rounded-xl border-l-4 p-2 overflow-hidden cursor-pointer transition-all z-10 shadow-sm",
                                              l.isExperimental 
                                                ? "bg-yellow-500/10 border-yellow-500 hover:bg-yellow-500/20" 
                                                : "bg-primary/10 border-primary hover:bg-primary/20"
                                            )}
                                            style={{ top: pos.top + 40, height: pos.height }}
                                          >
                                             <p className={cn(
                                               "text-[9px] font-black uppercase truncate leading-none mb-1",
                                               l.isExperimental ? "text-yellow-700" : "text-primary"
                                             )}>
                                               {l.isExperimental ? l.experimentalName : l.studentName}
                                             </p>
                                             <div className={cn(
                                               "flex items-center gap-0.5 text-[8px] font-bold",
                                               l.isExperimental ? "text-yellow-600/60" : "text-primary/60"
                                             )}>
                                                <Clock size={8} />
                                                {format(new Date(l.scheduledAt), "HH:mm")}
                                             </div>
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
                 )}
              </div>
            ) : view === "dia" ? (
              <div className="pt-6 relative">
                 <div className="flex items-center justify-between mb-8 bg-muted/10 p-6 rounded-[2rem] border border-border/20">
                    <div className="flex items-center gap-6">
                       <div className="flex flex-col items-center justify-center w-16 h-16 bg-primary text-primary-foreground rounded-[1.5rem] shadow-xl shadow-primary/20">
                          <span className="text-[10px] font-black uppercase tracking-tighter">{format(selectedDay, "eee", { locale: ptBR })}</span>
                          <span className="text-2xl font-black">{format(selectedDay, "dd")}</span>
                       </div>
                       <div>
                          <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{format(selectedDay, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <CheckCircle size={14} className="text-emerald-500" />
                             <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{dayLessons.length} Aulas Agendadas</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="flex h-[800px] overflow-y-auto scrollbar-none border-t border-border/40 pr-2">
                    <div className="w-16 flex-shrink-0 border-r border-border/40">
                        {activeHours.map((hour) => (
                          <div key={hour} className="h-24 flex justify-end pr-4 pt-2">
                             <span className="text-[10px] font-black text-muted-foreground/20 uppercase">{hour}:00</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex-1 relative ml-6">
                       <div className="absolute inset-0 pointer-events-none">
                          {activeHours.map((hour) => (
                            <div key={hour} className="h-24 border-b border-border/5" />
                          ))}
                       </div>

                       {dayLessons.map(l => {
                          const pos = getPosition(l.scheduledAt, l.duration);
                          return (
                            <motion.div 
                              key={l.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              onClick={() => handleOpenDetail(l)}
                              className={cn(
                                "absolute left-0 right-0 rounded-[1.5rem] bg-card border shadow-xl p-4 overflow-hidden cursor-pointer group transition-all z-10",
                                l.isExperimental ? "bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500" : "border-border/40 hover:border-primary/40"
                              )}
                              style={{ top: (pos.top / 80) * 96, height: (pos.height / 80) * 96 }}
                            >
                               <div className="flex justify-between items-start gap-4 h-full">
                                  <div className="flex-1 min-w-0">
                                     <div className="flex items-center gap-2 mb-1">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", l.isExperimental ? "bg-yellow-500" : "bg-primary")} />
                                        <h4 className={cn("font-bold text-sm truncate uppercase tracking-tight", l.isExperimental && "text-yellow-900")}>{l.title}</h4>
                                     </div>
                                     <div className={cn("flex items-center gap-4 text-xs font-bold uppercase", l.isExperimental ? "text-yellow-700/40" : "text-muted-foreground/40")}>
                                        <div className="flex items-center gap-1"><Clock size={12} /> {format(new Date(l.scheduledAt), "HH:mm")}</div>
                                        <div className="flex items-center gap-1"><Music size={12} /> {l.instrumentName || "Aulas"}</div>
                                     </div>
                                  </div>
                                  <div className={cn(
                                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase",
                                    l.isExperimental ? "bg-yellow-500/20 text-yellow-700" : "bg-primary/5 text-primary/60"
                                  )}>
                                     {l.duration}min
                                  </div>
                               </div>
                            </motion.div>
                          );
                       })}

                       {dayLessons.length === 0 && (
                         <div className="flex flex-col items-center justify-center h-full opacity-10">
                            <CalendarIcon size={64} className="mb-4" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Agenda Vazia</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            ) : (
              <div className="space-y-12 pt-4">
                <div className="flex flex-col gap-2 px-2">
                    <h3 className="text-4xl font-black tracking-tighter uppercase leading-none">Próximas Aulas</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{filteredLessons.length} Eventos Agendados</span>
                      <div className="flex-1 h-[2px] bg-primary/10 rounded-full" />
                    </div>
                </div>

                <div className="space-y-10">
                   {filteredLessons.length > 0 ? (
                     filteredLessons.sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).map((l, idx) => {
                        const lDate = new Date(l.scheduledAt);
                        const prevL = idx > 0 ? filteredLessons[idx-1] : null;
                        const showDate = !prevL || !isSameDay(new Date(prevL.scheduledAt), lDate);
                        
                        return (
                          <div key={l.id} className="space-y-4">
                            {showDate && (
                              <div className="flex items-center gap-4 pl-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 py-3 rounded-full border border-border/10">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20">
                                   <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{format(lDate, "eee", { locale: ptBR })}</span>
                                   <span className="text-xl font-black">{format(lDate, "d")}</span>
                                </div>
                                <div>
                                   <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/80">{format(lDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
                                   <div className="flex items-center gap-1.5 mt-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">Agregado por dia</span>
                                   </div>
                                </div>
                              </div>
                            )}
                            <div className="pl-6 group">
                               <LessonCard 
                                 lesson={l} 
                                 onStatusChange={handleStatusChange} 
                                 onClick={() => handleOpenDetail(l)}
                                 onEdit={() => handleOpenDetail(l)}
                               />
                            </div>
                          </div>
                        );
                     })
                   ) : (
                     <div className="py-32 text-center opacity-20 border-4 border-dashed border-border/40 rounded-[4rem] flex flex-col items-center gap-6">
                        <LayoutList size={64} className="text-primary/20" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">Sua agenda está limpa</p>
                     </div>
                   )}
                </div>
              </div>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* ── Fixed FAB ── */}
      <div className="fixed bottom-10 right-8 z-50">
          <motion.button 
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setNovaOpen(true)}
            className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center transition-all overflow-hidden"
          >
            <Plus size={32} strokeWidth={4} />
          </motion.button>
      </div>

      <AgendarModal 
        open={novaOpen} 
        onOpenChange={setNovaOpen} 
        initialDate={selectedDay} 
      />

      <LessonDetailModal
        lesson={selectedLesson}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onEdit={(id) => {
          const lesson = filteredLessons.find(l => l.id === id);
          if (lesson) {
            setSelectedLesson(lesson);
            setDetailOpen(false);
            setIsEditOpen(true);
          }
        }}
        onDelete={(id) => deleteMutation.mutate({ id })}
      />

      <DayLessonsModal
        open={isDayLessonsOpen}
        onOpenChange={setIsDayLessonsOpen}
        day={selectedDay}
        lessons={dayLessons}
        onStatusChange={handleStatusChange}
        onOpenDetail={handleOpenDetail}
        onAddLesson={() => setNovaOpen(true)}
      />

      <AgendarModal 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        editingLesson={selectedLesson} 
      />
    </div>
  );
}
