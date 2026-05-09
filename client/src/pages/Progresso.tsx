import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Star,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Activity,
  Edit2,
  Trash2,
  ChevronRight,
  TrendingUp,
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Folder,
  UploadCloud,
  File,
  Download,
  Filter,
  LayoutGrid,
  MoreVertical,
  CheckCircle2,
  Trophy,
  Target,
  Zap,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// --- Components ---

export default function Progresso() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"jornada" | "biblioteca" | "observacoes" | "metas" | "desempenho">("jornada");

  const utils = trpc.useUtils();

  const { data: students = [], isLoading: studentsLoading } = trpc.students.list.useQuery();
  
  const { data: timeline = [], isLoading: timelineLoading } = trpc.progress.getTimeline.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );
  
  const { data: summary, isLoading: summaryLoading } = trpc.progress.getSummary.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const { data: goals = [], isLoading: goalsLoading } = trpc.progress.getGoals.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const { data: upcomingLessons = [] } = trpc.lessons.upcoming.useQuery();

  const [insight, setInsight] = useState<string | null>(null);
  const aiInsightMutation = trpc.progress.generateAIInsight.useMutation({
    onSuccess: (data) => setInsight(data.insight),
    onError: (e) => toast.error("Erro ao gerar insight: " + e.message)
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "geral" as any,
    grade: "",
    achievedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "geral",
      grade: "",
      achievedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setEditingEvent(null);
  };

  const createMutation = trpc.progress.createTimelineEvent.useMutation({
    onSuccess: () => {
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      toast.success("Registro adicionado com sucesso!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const updateMutation = trpc.progress.updateTimelineEvent.useMutation({
    onSuccess: () => {
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      toast.success("Registro atualizado com sucesso!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = trpc.progress.deleteTimelineEvent.useMutation({
    onSuccess: () => {
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      toast.success("Registro removido");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const createGoalMutation = trpc.progress.createGoal.useMutation({
    onSuccess: () => {
      utils.progress.getGoals.invalidate({ studentId: selectedStudentId! });
      toast.success("Meta adicionada com sucesso!");
    },
    onError: (e) => toast.error("Erro ao adicionar meta: " + e.message)
  });

  const updateGoalMutation = trpc.progress.updateGoal.useMutation({
    onSuccess: () => {
      utils.progress.getGoals.invalidate({ studentId: selectedStudentId! });
    },
    onError: (e) => toast.error("Erro ao atualizar meta: " + e.message)
  });

  const deleteGoalMutation = trpc.progress.deleteGoal.useMutation({
    onSuccess: () => {
      utils.progress.getGoals.invalidate({ studentId: selectedStudentId! });
      toast.success("Meta removida");
    },
    onError: (e) => toast.error("Erro ao remover meta: " + e.message)
  });

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      category: event.category,
      grade: event.grade || "",
      achievedAt: format(new Date(event.achievedAt), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Deseja realmente excluir este registro?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSubmit = () => {
    if (!selectedStudentId) return;
    if (!formData.title) return toast.error("Título é obrigatório");

    const data = {
      studentId: selectedStudentId,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      grade: formData.grade,
      achievedAt: formData.achievedAt,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s: any) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-[#F8FAFC]">
      <div className="flex flex-1 overflow-hidden">
        
        {/* COLUNA 1: TIMELINE ALUNOS (22%) */}
        <div className={cn(
          "w-full lg:w-[22%] flex flex-col bg-white border-r border-slate-200/60 z-20 transition-all",
          selectedStudentId && "hidden lg:flex"
        )}>
          <div className="p-6 pb-4">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Progresso</h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Timeline dos Alunos</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shadow-inner">
                   <Activity size={20} />
                </div>
             </div>
             
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                <Input
                  placeholder="Buscar aluno..."
                  className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-none">
            {studentsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-200" /></div>
            ) : filteredStudents.map((student: any) => (
              <motion.button
                key={student.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedStudentId(student.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 relative group overflow-hidden",
                  selectedStudentId === student.id
                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20"
                    : "hover:bg-slate-100/80 text-slate-600"
                )}
              >
                {selectedStudentId === student.id && (
                  <motion.div 
                    layoutId="activeGlow"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 z-0"
                  />
                )}
                
                <div className="relative z-10 shrink-0">
                  <Avatar className="w-10 h-10 border-2 border-white/20">
                    <AvatarFallback className={cn(
                      "text-[10px] font-black uppercase",
                      selectedStudentId === student.id ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600"
                    )}>
                      {student.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                    student.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-300'
                  )} />
                </div>
                
                <div className="flex-1 text-left min-w-0 relative z-10">
                  <p className="text-xs font-black truncate mb-1 tracking-tight">{student.name}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                      selectedStudentId === student.id ? "bg-white/10 text-white/80" : "bg-slate-200/50 text-slate-500"
                    )}>
                      {student.level || "Iniciante"}
                    </span>
                    <span className={cn(
                      "text-[8px] font-bold",
                      selectedStudentId === student.id ? "text-white/40" : "text-slate-300"
                    )}>
                      • {student.instrumentName || "Voz"}
                    </span>
                  </div>
                </div>
                
                <ChevronRight size={14} className={cn(
                  "relative z-10 transition-all shrink-0",
                  selectedStudentId === student.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"
                )} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* COLUNA 2: CONTEÚDO PRINCIPAL (53%) */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-slate-50/30 overflow-hidden relative",
          !selectedStudentId && "hidden lg:flex"
        )}>
          {!selectedStudentId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[2.5rem] bg-white border border-slate-200/60 shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8 relative"
              >
                <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full" />
                <Activity size={40} className="text-indigo-400 relative z-10" />
              </motion.div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Evolução Musical</h2>
              <p className="text-sm text-slate-500 max-w-[320px] mt-3 font-medium leading-relaxed">
                Selecione um aluno na lista lateral para visualizar sua jornada, biblioteca de materiais e métricas de desempenho.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* TOP HEADER PANEL */}
              <div className="bg-white border-b border-slate-200/60 px-8 py-6 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <Avatar className="w-16 h-16 border-4 border-slate-50 shadow-xl shadow-indigo-500/10">
                        <AvatarFallback className="bg-indigo-600 text-white text-xl font-black uppercase">
                          {selectedStudent?.name.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        onClick={() => toast.info("Funcionalidade de troca de foto em breve!")}
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white border border-slate-100 shadow-md flex items-center justify-center text-indigo-600 cursor-pointer z-10"
                      >
                        <Edit2 size={12} />
                      </motion.div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{selectedStudent?.name}</h2>
                        <span className="px-3 py-1 rounded-xl bg-indigo-50 text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] border border-indigo-100">
                          {selectedStudent?.level || "Nível Iniciante"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                           <div className="w-32 lg:w-48 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${summary?.frequency || 0}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]" 
                              />
                           </div>
                           <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                             {summary?.frequency || 0}% Frequência
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden xl:flex flex-col items-end">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status de Evolução</span>
                       <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                          <Zap size={14} className="text-emerald-500 fill-emerald-500/20" />
                          <span className="text-xs font-black text-emerald-600 uppercase tracking-tight">Excelente Desempenho</span>
                       </div>
                    </div>
                    <Button 
                      onClick={() => { resetForm(); setIsModalOpen(true); }}
                      className="h-12 w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 border-none"
                    >
                       <Plus size={24} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* INTERNAL HEADER - TABS */}
               <div className="px-8 mt-8 shrink-0">
                  <div className="flex items-center gap-8 overflow-x-auto no-scrollbar border-b border-slate-200/60">
                    {[
                      { id: "jornada", label: "Jornada Musical", icon: Activity },
                      { id: "biblioteca", label: "Biblioteca Musical", icon: Folder },
                      { id: "observacoes", label: "Observações", icon: BookOpen },
                      { id: "metas", label: "Metas", icon: Target },
                      { id: "desempenho", label: "Desempenho", icon: TrendingUp },
                    ].map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap",
                            isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <tab.icon size={16} className={cn("transition-colors", isActive ? "text-indigo-500" : "text-slate-300")} />
                          {tab.label}
                          {isActive && (
                            <motion.div 
                              layoutId="activeIndicator"
                              className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-600 rounded-t-full shadow-[0_-4px_12px_rgba(79,70,229,0.3)]"
                            />
                          )}
                        </button>
                      );
                    })}
                 </div>
              </div>

              {/* CONTENT AREA */}
              <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                 <AnimatePresence mode="wait">
                    {activeTab === "jornada" && (
                      <motion.div 
                        key="jornada"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                      >
                         {/* GRID DE CARDS SUPERIORES */}
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                              { label: "Média Geral", value: summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0", icon: Star, color: "text-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/10" },
                              { label: "Aulas Concluídas", value: summary?.completedCount || 0, icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/5", border: "border-indigo-500/10" },
                              { label: "Última Aula", value: summary?.lastLesson ? format(new Date(summary.lastLesson), "dd MMM", { locale: ptBR }) : "—", icon: Calendar, color: "text-rose-500", bg: "bg-rose-500/5", border: "border-rose-500/10" },
                              { label: "Tempo Total", value: "12h 40m", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/10" },
                            ].map((stat, i) => (
                              <motion.div 
                                key={i}
                                whileHover={{ y: -5, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)" }}
                                className={cn("bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm transition-all group relative overflow-hidden", stat.border)}
                              >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm relative z-10", stat.bg, stat.color)}>
                                  <stat.icon size={20} />
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 relative z-10">{stat.label}</p>
                                <p className="text-xl font-black text-slate-900 relative z-10">{stat.value}</p>
                              </motion.div>
                            ))}
                         </div>

                         {/* LISTA DE REGISTROS (TIMELINE) */}
                         <div className="space-y-6 pt-4">
                            <div className="flex items-center justify-between mb-8">
                               <div className="flex items-center gap-3">
                                  <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Timeline de Evolução</h3>
                               </div>
                               <Button 
                                 onClick={() => { resetForm(); setIsModalOpen(true); }}
                                 className="h-10 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2"
                               >
                                 <Plus size={16} /> Novo Registro
                               </Button>
                            </div>

                            <div className="space-y-6">
                               {timelineLoading ? (
                                 <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500/20" /></div>
                               ) : timeline.length === 0 ? (
                                 <div className="py-20 bg-white border border-dashed border-slate-200 rounded-[3rem] text-center">
                                    <Activity size={40} className="mx-auto text-slate-100 mb-4" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</p>
                                 </div>
                               ) : (
                                 timeline.map((event) => (
                                   <motion.div 
                                      key={event.id}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="group flex gap-6"
                                   >
                                      <div className="flex flex-col items-center gap-2 mt-2 shrink-0">
                                         <div className={cn(
                                           "w-3 h-3 rounded-full border-2 border-white ring-4 shadow-sm",
                                           event.category === 'tecnica' ? 'bg-indigo-500 ring-indigo-500/10' :
                                           event.category === 'teoria' ? 'bg-amber-500 ring-amber-500/10' :
                                           event.category === 'repertorio' ? 'bg-emerald-500 ring-emerald-500/10' :
                                           'bg-slate-400 ring-slate-100'
                                         )} />
                                         <div className="w-0.5 h-full bg-slate-100 group-last:bg-transparent" />
                                      </div>

                                      <div className="flex-1 bg-white border border-slate-200/60 p-6 rounded-[2.5rem] shadow-sm group-hover:shadow-md transition-all">
                                         <div className="flex items-start justify-between mb-4">
                                            <div>
                                               <div className="flex items-center gap-3 mb-2">
                                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50">
                                                    {format(new Date(event.achievedAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                                  </span>
                                                  <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                                                    event.category === 'tecnica' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                    event.category === 'teoria' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                  )}>
                                                    {event.category}
                                                  </span>
                                               </div>
                                               <h4 className="text-base font-black text-slate-900 tracking-tight">{event.title}</h4>
                                            </div>
                                            {event.grade && (
                                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                                                 <Star size={14} className="text-amber-500 fill-amber-500" />
                                                 <span className="text-xs font-black text-slate-900">{Number(event.grade).toFixed(1)}</span>
                                              </div>
                                            )}
                                         </div>
                                         <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">{event.description}</p>
                                         
                                         <div className="flex items-center justify-between pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-bold text-slate-400">Registrado por: Professor Aladim</span>
                                            <div className="flex gap-2">
                                                <Button 
                                                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                  onClick={() => handleEdit(event)}
                                                >
                                                   <Edit2 size={14} />
                                                </Button>
                                                <Button 
                                                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                  onClick={() => handleDelete(event.id)}
                                                >
                                                   <Trash2 size={14} />
                                                </Button>
                                            </div>
                                         </div>
                                      </div>
                                   </motion.div>
                                 ))
                               )}
                            </div>
                         </div>
                      </motion.div>
                    )}

                    {activeTab === "biblioteca" && (
                      <motion.div 
                        key="biblioteca"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                         <BibliotecaMusical studentId={selectedStudentId!} />
                      </motion.div>
                    )}

                    {activeTab === "metas" && (
                      <motion.div 
                        key="metas"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                         <MetasMusicais 
                           studentId={selectedStudentId!} 
                           goals={goals} 
                           createGoalMutation={createGoalMutation} 
                           updateGoalMutation={updateGoalMutation} 
                           deleteGoalMutation={deleteGoalMutation} 
                         />
                      </motion.div>
                    )}

                    {activeTab === "observacoes" && (
                      <motion.div 
                        key="observacoes"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                         <Observacoes timeline={timeline} />
                      </motion.div>
                    )}

                    {activeTab === "desempenho" && (
                      <motion.div 
                        key="desempenho"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                         <DesempenhoIA 
                           studentId={selectedStudentId!} 
                           summary={summary} 
                           insight={insight} 
                           aiInsightMutation={aiInsightMutation} 
                         />
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA 3: PAINEL INTELIGENTE (25%) */}
        <div className={cn(
          "hidden xl:flex flex-col w-[25%] bg-white border-l border-slate-200/60 overflow-y-auto no-scrollbar p-8 space-y-8",
          !selectedStudentId && "opacity-20 pointer-events-none grayscale"
        )}>
           <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 tracking-tighter uppercase">Insights Inteligentes</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Resumo automático do aluno</p>
           </div>

           {/* WIDGET DESEMPENHO */}
           <WidgetCard title="Desempenho Geral" icon={Trophy} color="text-amber-500" bg="bg-amber-500/5">
              <div className="flex items-center justify-between mt-6">
                 <div className="relative w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                       <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                       <motion.circle 
                          cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                          strokeDasharray={251.2}
                          initial={{ strokeDashoffset: 251.2 }}
                          animate={{ strokeDashoffset: 251.2 * (1 - (summary?.averageGrade || 0) / 10) }}
                          className="text-amber-500" 
                       />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <span className="text-xl font-black text-slate-900">{summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0"}</span>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nível Atual</p>
                       <p className="text-sm font-black text-slate-900">Intermediário</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Próxima Meta</p>
                       <p className="text-sm font-black text-slate-900">{goals.find((g: any) => g.status !== 'concluida')?.title || "Nenhuma meta pendente"}</p>
                    </div>
                 </div>
              </div>
           </WidgetCard>

           {/* WIDGET METAS */}
           <WidgetCard title="Metas Musicais" icon={Target} color="text-indigo-500" bg="bg-indigo-500/5">
              <div className="mt-6 space-y-4">
                 {goals.length === 0 ? (
                   <p className="text-xs text-slate-400 italic">Nenhuma meta cadastrada.</p>
                 ) : goals.slice(0, 3).map((meta: any) => (
                   <div key={meta.id} className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer",
                        meta.status === 'concluida' ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 bg-slate-50 hover:border-indigo-300"
                      )} onClick={() => updateGoalMutation.mutate({ id: meta.id, status: meta.status === 'concluida' ? 'pendente' : 'concluida' })}>
                         {meta.status === 'concluida' && <CheckCircle2 size={12} />}
                      </div>
                      <span className={cn("text-xs font-bold", meta.status === 'concluida' ? "text-slate-400 line-through" : "text-slate-700")}>
                        {meta.title}
                      </span>
                   </div>
                 ))}
                 <Button 
                   variant="ghost" 
                   className="w-full h-8 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 border-none"
                   onClick={() => setActiveTab('metas')}
                 >
                    Ver todas as metas
                 </Button>
              </div>
           </WidgetCard>

           {/* WIDGET CALENDÁRIO COMPACTO */}
           <WidgetCard title="Agenda Próximas Aulas" icon={Calendar} color="text-rose-500" bg="bg-rose-500/5">
              <div className="mt-4">
                 <div className="grid grid-cols-7 gap-1 mb-4">
                    {['D','S','T','Q','Q','S','S'].map(d => (
                      <span key={d} className="text-[8px] font-black text-slate-300 text-center">{d}</span>
                    ))}
                    {eachDayOfInterval({
                      start: startOfMonth(new Date()),
                      end: endOfMonth(new Date()),
                    }).slice(0, 14).map((day, i) => {
                      const hasLesson = upcomingLessons.some((l: any) => l.studentId === selectedStudentId && isSameDay(new Date(l.scheduledAt), day));
                      return (
                      <div key={i} className={cn(
                        "aspect-square rounded-lg flex items-center justify-center text-[9px] font-black transition-all",
                        isSameDay(day, new Date()) ? "bg-indigo-600 text-white shadow-lg" : 
                        hasLesson ? "bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold" : "text-slate-400 hover:bg-slate-100"
                      )}>
                        {day.getDate()}
                      </div>
                    )})}
                 </div>
                 {(() => {
                   const nextLesson = upcomingLessons.find((l: any) => l.studentId === selectedStudentId);
                   return (
                     <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Próxima Aula</p>
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-black text-slate-900">
                             {nextLesson ? format(new Date(nextLesson.scheduledAt), "EEEE, HH:mm", { locale: ptBR }) : "Nenhuma aula agendada"}
                           </span>
                           {nextLesson && isSameDay(new Date(nextLesson.scheduledAt), new Date()) && (
                             <span className="text-[10px] font-bold text-rose-500">Hoje</span>
                           )}
                        </div>
                     </div>
                   );
                 })()}
              </div>
           </WidgetCard>

           {/* WIDGET OBSERVAÇÕES RÁPIDAS */}
           <WidgetCard title="Notas Rápidas" icon={Edit2} color="text-emerald-500" bg="bg-emerald-500/5">
              <div className="mt-4">
                 <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setActiveTab('observacoes')}>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic line-clamp-3">
                      {timeline.find((e: any) => e.category === 'geral')?.description || '"Nenhuma anotação recente encontrada. Clique aqui para registrar uma observação."'}
                    </p>
                 </div>
              </div>
           </WidgetCard>
        </div>
      </div>

      {/* MODAL PARA NOVO REGISTRO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
          <div className="px-8 py-8 border-b border-slate-200/60 bg-slate-50/50">
             <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                   {editingEvent ? "Editar Registro" : "Novo Registro de Evolução"}
                </DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Documente o desempenho e feedback do aluno</p>
             </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 bg-white">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data da Atividade</label>
                   <Input 
                     type="datetime-local" 
                     className="rounded-2xl h-12 bg-slate-50 border-slate-200 text-xs font-bold"
                     value={formData.achievedAt}
                     onChange={e => setFormData({...formData, achievedAt: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                   <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v as any})}>
                      <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-slate-200 text-xs font-bold">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-200">
                         <SelectItem value="tecnica">Técnica</SelectItem>
                         <SelectItem value="teoria">Teoria</SelectItem>
                         <SelectItem value="repertorio">Repertório</SelectItem>
                         <SelectItem value="geral">Geral</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Evento</label>
                <Input 
                  placeholder="Ex: Escala Pentatônica Am" 
                  className="rounded-2xl h-12 bg-slate-50 border-slate-200 text-xs font-bold"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Feedback</label>
                <Textarea 
                  placeholder="Detalhes sobre o progresso..." 
                  className="rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold min-h-[100px] p-4 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Avaliação Final (0-10)</label>
                <div className="flex items-center gap-3">
                   <Input 
                     type="number" 
                     min="0" max="10" step="0.5"
                     className="rounded-2xl h-12 w-24 bg-slate-50 border-slate-200 text-center font-black text-lg"
                     value={formData.grade}
                     onChange={e => setFormData({...formData, grade: e.target.value})}
                   />
                   <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${Number(formData.grade) * 10}%` }} />
                   </div>
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-200 flex gap-3">
             <Button variant="ghost" className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
             <Button 
               className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
               onClick={handleSubmit}
               disabled={createMutation.isPending || updateMutation.isPending}
             >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : null}
                {editingEvent ? "Salvar Alterações" : "Registrar Progresso"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-Components ---

function WidgetCard({ title, icon: Icon, color, bg, children }: any) {
   return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
         <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shadow-sm", bg, color)}>
               <Icon size={16} />
            </div>
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{title}</h4>
         </div>
         {children}
      </motion.div>
   );
}

function BibliotecaMusical({ studentId }: { studentId: number }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  
  const utils = trpc.useUtils();
  const { data: files = [], isLoading } = trpc.musicLibrary.list.useQuery({ studentId, category, search });
  
  const createMutation = trpc.musicLibrary.create.useMutation({
    onSuccess: () => {
      utils.musicLibrary.list.invalidate({ studentId });
      toast.success("Material adicionado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao adicionar material: " + e.message)
  });

  const deleteMutation = trpc.musicLibrary.delete.useMutation({
    onSuccess: () => {
      utils.musicLibrary.list.invalidate({ studentId });
      toast.success("Material excluído!");
    },
    onError: (e) => toast.error("Erro ao excluir material: " + e.message)
  });

  const handleSimulateUpload = (cat: 'imagem' | 'video' | 'pdf' | 'audio' = 'pdf') => {
    createMutation.mutate({
      studentId,
      fileName: `Material de Apoio ${format(new Date(), "HH:mm")}`,
      fileType: cat,
      category: cat,
      fileUrl: "https://example.com/mock-file.pdf",
      size: Math.floor(Math.random() * 5 * 1024 * 1024) + 1024 * 1024,
    });
  };

  const categories = [
    { id: "imagem", label: "Imagens", icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-50" },
    { id: "video", label: "Vídeos", icon: Video, color: "text-rose-500", bg: "bg-rose-50" },
    { id: "pdf", label: "PDFs", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "audio", label: "Áudios", icon: Music, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
       {/* HEADER DA BIBLIOTECA */}
       <div className="flex items-center justify-between">
          <div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Biblioteca Musical</h3>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Central de Mídia e Materiais de Apoio</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex flex-col items-end mr-4">
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Armazenamento</span>
                   <span className="text-[9px] font-black text-indigo-600">12.4 GB / ILIMITADO</span>
                </div>
                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                   <div className="h-full bg-indigo-600 w-1/3" />
                </div>
             </div>
             <Button 
               onClick={() => handleSimulateUpload('pdf')}
               disabled={createMutation.isPending}
               className="h-11 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-xl shadow-indigo-500/20 border-none"
             >
                {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Novo Material
             </Button>
          </div>
       </div>

       {/* ÁREA DE UPLOAD (DRAG & DROP) */}
        <motion.div 
          onClick={() => handleSimulateUpload('pdf')}
          whileHover={{ borderColor: "#6366F1", backgroundColor: "rgba(99, 102, 241, 0.02)" }}
          className="relative p-12 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white flex flex-col items-center justify-center text-center group cursor-pointer transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/40 relative z-10 group-hover:scale-110 transition-transform">
             <UploadCloud size={36} />
          </div>
          <h4 className="text-lg font-black text-slate-900 tracking-tight relative z-10 mb-2">Upload de Arquivos</h4>
          <p className="text-xs text-slate-400 font-medium max-w-[240px] relative z-10">
            Arraste seus PDFs, Vídeos ou Áudios aqui ou <span className="text-indigo-600 font-bold underline">clique para selecionar</span>
          </p>
          
          <div className="flex gap-4 mt-8 opacity-40 group-hover:opacity-100 transition-opacity relative z-10">
             {[ImageIcon, Video, FileText, Music].map((Icon, i) => (
               <div key={i} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all">
                  <Icon size={18} />
               </div>
             ))}
          </div>
       </motion.div>

       {/* CATEGORIAS E FILTROS */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <motion.div 
              key={cat.id}
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4 group cursor-pointer"
            >
               <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:rotate-12", cat.bg, cat.color)}>
                  <cat.icon size={24} />
               </div>
               <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{cat.label}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">24 arquivos</p>
               </div>
            </motion.div>
          ))}
       </div>

       {/* BUSCA E RESULTADOS */}
       <div className="space-y-8">
          <div className="flex items-center justify-between">
             <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                <Input 
                  placeholder="Pesquisar na biblioteca..." 
                  className="pl-12 h-12 bg-white border-slate-200 rounded-2xl text-xs font-bold"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-slate-200 bg-white text-slate-400"><Filter size={18} /></Button>
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-slate-200 bg-white text-slate-400"><LayoutGrid size={18} /></Button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {isLoading ? (
               <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500/20" /></div>
             ) : files.length === 0 ? (
               <div className="col-span-full py-20 text-center border border-dashed border-slate-200 rounded-[3rem]">
                  <Folder size={40} className="mx-auto text-slate-100 mb-4" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sua biblioteca está vazia</p>
               </div>
             ) : (
               files.map((file) => (
                 <motion.div 
                   key={file.id}
                   whileHover={{ y: -8 }}
                   className="bg-white border border-slate-200/60 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all"
                 >
                    <div className="aspect-[4/3] bg-slate-50 relative flex items-center justify-center group-hover:bg-indigo-50/50 transition-colors overflow-hidden">
                       <div className="text-slate-200 group-hover:text-indigo-200 transition-colors group-hover:scale-125 transition-transform duration-700">
                          {file.category === 'imagem' && <ImageIcon size={64} />}
                          {file.category === 'video' && <Video size={64} />}
                          {file.category === 'pdf' && <FileText size={64} />}
                          {file.category === 'audio' && <Music size={64} />}
                       </div>
                       
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" className="h-10 px-4 rounded-xl bg-white text-slate-900 font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-xl">
                             <Download size={14} className="mr-2" /> Download
                          </Button>
                          <Button 
                            variant="ghost" 
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: file.id }) }}
                            disabled={deleteMutation.isPending}
                            className="h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-rose-500 hover:text-white backdrop-blur-md"
                          >
                             {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </Button>
                       </div>
                       
                       <div className="absolute top-5 left-5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm">
                          {format(new Date(file.createdAt), "dd MMM")}
                       </div>
                    </div>
                    
                    <div className="p-6">
                       <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                             <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{file.fileName}</h4>
                             <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100">
                                   {file.category}
                                </span>
                                <span className="text-[9px] font-bold text-slate-300">
                                   {(file.size ? (file.size / (1024 * 1024)).toFixed(1) : "0.5")} MB
                                </span>
                             </div>
                          </div>
                          <div className="shrink-0 h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                             <ExternalLink size={14} />
                          </div>
                       </div>
                    </div>
                 </motion.div>
               ))
             )}
          </div>
       </div>
    </div>
  );
}

function MetasMusicais({ studentId, goals, createGoalMutation, updateGoalMutation, deleteGoalMutation }: any) {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Metas Musicais</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Acompanhamento de Objetivos</p>
         </div>
      </div>
      <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div className="flex gap-4">
          <Input 
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Aprender o solo de Hotel California"
            className="flex-1 rounded-2xl h-12 bg-slate-50 border-slate-200 text-xs font-bold px-4"
          />
          <Button 
            onClick={() => {
              if(!title) return;
              createGoalMutation.mutate({ studentId, title });
              setTitle("");
            }}
            disabled={createGoalMutation.isPending}
            className="h-12 rounded-2xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
          >
            {createGoalMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
          </Button>
        </div>
        <div className="space-y-3">
          {goals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-3xl">
               <Target size={32} className="mx-auto text-slate-200 mb-3" />
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma meta cadastrada</p>
            </div>
          ) : goals.map((meta: any) => (
            <div key={meta.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 group">
               <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                    meta.status === 'concluida' ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white hover:border-indigo-400"
                  )} onClick={() => updateGoalMutation.mutate({ id: meta.id, status: meta.status === 'concluida' ? 'pendente' : 'concluida' })}>
                     {meta.status === 'concluida' && <CheckCircle2 size={14} />}
                  </div>
                  <span className={cn("text-sm font-bold", meta.status === 'concluida' ? "text-slate-400 line-through" : "text-slate-700")}>
                    {meta.title}
                  </span>
               </div>
               <Button 
                 variant="ghost" 
                 size="icon"
                 onClick={() => deleteGoalMutation.mutate({ id: meta.id })}
                 disabled={deleteGoalMutation.isPending}
                 className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
               >
                 <Trash2 size={16} />
               </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Observacoes({ timeline }: any) {
  const notes = timeline.filter((e: any) => e.category === 'geral');
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
         <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Observações</h3>
         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Anotações Gerais do Aluno</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {notes.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-slate-200 rounded-3xl bg-white">
             <BookOpen size={32} className="mx-auto text-slate-200 mb-3" />
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma anotação registrada</p>
          </div>
        ) : notes.map((note: any) => (
          <div key={note.id} className="bg-yellow-50 border border-yellow-200/50 p-6 rounded-3xl shadow-sm relative">
             <div className="absolute top-4 right-4 text-yellow-600/20">
               <Edit2 size={24} />
             </div>
             <p className="text-[10px] font-black text-yellow-600/60 uppercase tracking-widest mb-3">
               {format(new Date(note.achievedAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
             </p>
             <h4 className="text-sm font-black text-yellow-900 mb-2">{note.title}</h4>
             <p className="text-xs font-medium text-yellow-900/80 leading-relaxed whitespace-pre-wrap">{note.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesempenhoIA({ studentId, summary, insight, aiInsightMutation }: any) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Desempenho & IA</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Análise Inteligente de Progresso</p>
         </div>
         <Button 
           onClick={() => aiInsightMutation.mutate({ studentId })}
           disabled={aiInsightMutation.isPending}
           className="h-11 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-xl shadow-indigo-500/20 border-none"
         >
            {aiInsightMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} Gerar Insight
         </Button>
      </div>
      
      {insight && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
               <Zap size={24} className="text-white" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-indigo-200 mb-2">Análise Concluída</h4>
              <p className="text-sm font-medium leading-relaxed text-indigo-50">{insight}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white border border-slate-200/60 p-8 rounded-[2.5rem] shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Métricas Gerais</h4>
            <div className="space-y-6">
               <div>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Frequência</span>
                     <span className="text-xs font-black text-slate-900">{summary?.frequency || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                     <motion.div initial={{width:0}} animate={{width: `${summary?.frequency || 0}%`}} className="h-full bg-emerald-500" />
                  </div>
               </div>
               <div>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nota Média</span>
                     <span className="text-xs font-black text-slate-900">{summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0"}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                     <motion.div initial={{width:0}} animate={{width: `${Number(summary?.averageGrade || 0) * 10}%`}} className="h-full bg-amber-500" />
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
