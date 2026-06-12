import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  ChevronLeft,
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
  CalendarDays,
  Award,
  AlertTriangle,
  Play,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // IA Lesson Plan Modal State
  const [isAILessonModalOpen, setIsAILessonModalOpen] = useState(false);
  const [lessonPlanContent, setLessonPlanContent] = useState<string | null>(null);

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

  const generateNextLessonMutation = trpc.progress.generateNextLessonPlan.useMutation({
    onSuccess: (data) => {
      setLessonPlanContent(data.plan);
      toast.success("Plano de aula gerado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao gerar plano: " + e.message)
  });

  const [isStudyPlanModalOpen, setIsStudyPlanModalOpen] = useState(false);
  const [studyPlanContent, setStudyPlanContent] = useState<string | null>(null);
  const [studyPlanId, setStudyPlanId] = useState<number | null>(null);
  const [studyPlanStatus, setStudyPlanStatus] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const { data: planHistory = [], isLoading: historyLoading } = trpc.progress.getStudentPlanHistory.useQuery(
    { studentId: selectedStudentId! },
    { enabled: isStudyPlanModalOpen && !!selectedStudentId }
  );

  const { data: currentTeacherPlan, isLoading: currentPlanLoading } = trpc.progress.getStudentPlanForTeacher.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const publishStudyPlanMutation = trpc.progress.publishStudyPlan.useMutation({
    onSuccess: () => {
      utils.progress.getStudentPlanHistory.invalidate({ studentId: selectedStudentId! });
      utils.progress.getStudentPlanForTeacher.invalidate({ studentId: selectedStudentId! });
      setStudyPlanStatus('publicado');
      toast.success("Plano liberado para o aluno com sucesso!");
    },
    onError: (e) => toast.error("Erro ao liberar plano: " + e.message)
  });

  const deleteStudyPlanMutation = trpc.progress.deleteStudyPlan.useMutation({
    onSuccess: () => {
      utils.progress.getStudentPlanHistory.invalidate({ studentId: selectedStudentId! });
      utils.progress.getStudentPlanForTeacher.invalidate({ studentId: selectedStudentId! });
      setStudyPlanContent(null);
      setStudyPlanId(null);
      setStudyPlanStatus(null);
      toast.success("Plano excluído com sucesso.");
    },
    onError: (e) => toast.error("Erro ao excluir: " + e.message)
  });

  const generateDailyStudyPlanMutation = trpc.progress.generateDailyStudyPlan.useMutation({
    onSuccess: (data) => {
      setStudyPlanContent(data.plan);
      setStudyPlanId(data.planId);
      setStudyPlanStatus('rascunho');
      utils.progress.getStudentPlanHistory.invalidate({ studentId: selectedStudentId! });
      toast.success("Rascunho de plano diário gerado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao gerar plano diário: " + e.message)
  });

  const [isSendingViaBot, setIsSendingViaBot] = useState(false);
  const sendPlanViaWhatsAppMutation = trpc.progress.sendPlanViaWhatsApp.useMutation({
    onSuccess: () => {
      toast.success("Plano enviado para o aluno via WhatsApp com sucesso!");
    },
    onError: (e) => toast.error(e.message)
  });

  const isSendingRef = useRef(false);

  // --- Parsing utils para o Plano ---
  interface Exercise {
    title: string;
    subtitle?: string;
    duration?: string;
    points?: string[];
    icon?: string;
  }
  interface DayPlan {
    dayName: string;
    focus?: { title: string; description: string };
    exercises?: Exercise[];
  }
  interface StudyPlan {
    weeklyGoal?: string;
    importantMessage?: string;
    days: DayPlan[];
  }

  function parsePlanData(planText: string | null | undefined): StudyPlan | null {
    if (!planText) return null;
    try {
      let cleanText = planText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(cleanText);
      if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) return null;
      return parsed as StudyPlan;
    } catch {
      return null;
    }
  }

  function parseDaysCompleted(raw: string | null | undefined): boolean[] {
    if (!raw) return [false, false, false, false, false];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Boolean);
    } catch { /* noop */ }
    return [false, false, false, false, false];
  }

  function ExerciseIcon({ icon }: { icon?: string }) {
    switch (icon) {
      case "play": return <Play size={20} className="text-indigo-600" />;
      case "pen": return <PenTool size={20} className="text-indigo-600" />;
      case "music": return <Music size={20} className="text-indigo-600" />;
      case "metronome": return <Clock size={20} className="text-indigo-600" />;
      case "star": return <Star size={20} className="text-indigo-600" />;
      default: return <BookOpen size={20} className="text-indigo-600" />;
    }
  }

  const activePlanData = useMemo(() => parsePlanData(currentTeacherPlan?.planText), [currentTeacherPlan?.planText]);
  const activeDaysCompleted = useMemo(() => parseDaysCompleted(currentTeacherPlan?.daysCompleted as string | undefined), [currentTeacherPlan?.daysCompleted]);

  // Converte o JSON do plano diário em texto legível para humanos
  const formatPlanAsText = (content: string): string => {
    try {
      const planData = JSON.parse(content);
      if (!planData?.days) return content; // não é JSON do plano
      let text = "";
      if (planData.weeklyGoal) {
        text += `🎯 *Objetivo da semana*: ${planData.weeklyGoal}\n\n`;
      }
      planData.days?.forEach((day: any) => {
        text += `📅 *${day.dayName}*: ${day.focus?.title}\n`;
        if (day.focus?.description) text += `   ${day.focus.description}\n`;
        day.exercises?.forEach((ex: any) => {
          text += `\n  🔹 *${ex.title}* (${ex.duration})\n`;
          text += `   ${ex.subtitle}\n`;
          ex.points?.forEach((p: string) => { text += `   - ${p}\n`; });
        });
        text += `\n`;
      });
      if (planData.importantMessage) {
        text += `💡 *Dica*: ${planData.importantMessage}\n`;
      }
      return text.trim();
    } catch {
      return content; // retorna original se não for JSON válido
    }
  };

  const handleSendManualWhatsApp = (content: string, type: "aula" | "diario") => {
    if (!selectedStudent?.phone) {
      toast.error("Este aluno não possui um telefone cadastrado.");
      return;
    }
    const saudacao = type === "aula" 
      ? `Olá ${selectedStudent.name}! Preparado para a nossa próxima aula? 🎸 Aqui está o que vamos fazer:\n\n`
      : `Olá ${selectedStudent.name}! Aqui está o seu cronograma de treino para arrebentar essa semana! 📅👇\n\n`;
    
    const finalContent = type === "diario" ? formatPlanAsText(content) : content;
    const text = encodeURIComponent(saudacao + finalContent);
    const url = `https://api.whatsapp.com/send?phone=55${selectedStudent.phone.replace(/\D/g, '')}&text=${text}`;
    window.open(url, "_blank");
  };

  const handleSendBotWhatsApp = async (content: string, type: "aula" | "diario") => {
    setIsSendingViaBot(true);
    try {
      await sendPlanViaWhatsAppMutation.mutateAsync({ studentId: selectedStudentId!, planText: content, type });
    } finally {
      setIsSendingViaBot(false);
    }
  };

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
  
  const uploadAvatarMutation = trpc.musicLibrary.upload.useMutation();
  const updateAvatarMutation = trpc.students.updateAvatar.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
      utils.students.getDetails.invalidate({ id: selectedStudentId! });
      toast.success("Foto de perfil atualizada!");
    },
    onError: (e) => toast.error("Erro ao atualizar foto: " + e.message)
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudentId) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("A foto deve ter no máximo 2MB");
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const { url } = await uploadAvatarMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          base64Data: base64
        });
        await updateAvatarMutation.mutateAsync({
          id: selectedStudentId,
          avatar: url
        });
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

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
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">
      <div className="flex flex-1 overflow-hidden">
        
        {/* COLUNA 1: TIMELINE ALUNOS */}
        <div className={cn(
          "flex flex-col bg-card border-r border-border z-20 transition-all duration-500 ease-in-out relative group/sidebar",
          isListCollapsed ? "w-[84px]" : "w-full md:w-[35%] lg:w-[22%]",
          selectedStudentId && "hidden md:flex"
        )}>
          {/* Toggle Button for Column */}
          <button 
            onClick={() => setIsListCollapsed(!isListCollapsed)}
            className="absolute -right-3 top-24 z-30 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover/sidebar:opacity-100 transition-all hover:scale-110"
          >
            {isListCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={cn("p-6 pb-4", isListCollapsed && "px-3")}>
             <div className={cn("flex items-center justify-between mb-6", isListCollapsed && "flex-col gap-4")}>
                {!isListCollapsed && (
                   <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <h2 className="text-xl font-black text-foreground tracking-tight">Progresso</h2>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Timeline</p>
                   </div>
                )}
                <div className={cn("w-10 h-10 rounded-2xl bg-indigo-500/100/10 text-indigo-600 flex items-center justify-center shadow-inner shrink-0", isListCollapsed && "w-12 h-12")}>
                   <Activity size={20} />
                </div>
             </div>
             
             {!isListCollapsed ? (
                <div className="relative group animate-in fade-in duration-300">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" size={14} />
                   <Input
                     placeholder="Buscar..."
                     className="pl-10 h-11 text-xs rounded-xl border-border bg-muted/50 focus:bg-card transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/10"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                </div>
             ) : (
                <button 
                  onClick={() => setIsListCollapsed(false)}
                  className="w-full h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors"
                >
                  <Search size={16} />
                </button>
             )}
          </div>

          <div className={cn("flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-none", isListCollapsed && "px-2")}>
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
                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/10"
                    : "hover:bg-muted/80 text-slate-600",
                  isListCollapsed && "p-2 justify-center"
                )}
                title={isListCollapsed ? student.name : undefined}
              >
                {selectedStudentId === student.id && (
                  <motion.div 
                    layoutId="activeGlow"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 z-0"
                  />
                )}
                
                <div className="relative z-10 shrink-0">
                  <Avatar className={cn("w-10 h-10 border-2 border-white/20", isListCollapsed && "w-12 h-12")}>
                    <AvatarImage src={student.avatar} className="object-cover" />
                    <AvatarFallback className={cn(
                      "text-[10px] font-black uppercase",
                      selectedStudentId === student.id ? "bg-card/20 text-white" : "bg-indigo-500/20 text-indigo-600",
                      isListCollapsed && "text-xs"
                    )}>
                      {student.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                    student.status === 'ativo' ? 'bg-emerald-500/100' : 'bg-slate-300'
                  )} />
                </div>
                
                {!isListCollapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0 relative z-10 animate-in fade-in slide-in-from-left-2 duration-300">
                      <p className="text-xs font-black truncate mb-1 tracking-tight">{student.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                          selectedStudentId === student.id ? "bg-card/10 text-white/80" : "bg-slate-200/50 text-muted-foreground"
                        )}>
                          {student.level || "Iniciante"}
                        </span>
                        <span className={cn(
                          "text-[8px] font-bold",
                          selectedStudentId === student.id ? "text-white/40" : "text-muted-foreground/40"
                        )}>
                          • {student.instrumentName || "Voz"}
                        </span>
                      </div>
                    </div>
                    
                    <ChevronRight size={14} className={cn(
                      "relative z-10 transition-all shrink-0",
                      selectedStudentId === student.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"
                    )} />
                  </>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* COLUNA 2: CONTEÚDO PRINCIPAL (53%) */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-muted/30 overflow-hidden relative",
          !selectedStudentId && "hidden md:flex"
        )}>
          {!selectedStudentId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-[2.5rem] bg-card border border-border shadow-xl shadow-foreground/5 flex items-center justify-center mb-8 relative"
              >
                <div className="absolute inset-0 bg-indigo-500/100/10 blur-2xl rounded-full" />
                <Activity size={40} className="text-indigo-400 relative z-10" />
              </motion.div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Evolução Musical</h2>
              <p className="text-sm text-muted-foreground max-w-[320px] mt-3 font-medium leading-relaxed">
                Selecione um aluno na lista lateral para visualizar sua jornada, biblioteca de materiais e métricas de desempenho.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* TOP HEADER PANEL */}
              <div className="bg-card border-b border-border px-8 py-6 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/100/5 rounded-full blur-3xl -mr-32 -mt-32" />
                
                <div className="flex flex-row items-start justify-between relative z-10 gap-4">
                  <div className="flex items-start gap-3 sm:gap-6 flex-1 min-w-0">
                    <button 
                      onClick={() => setSelectedStudentId(null)}
                      className="md:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-all shrink-0 mt-1 sm:mt-2"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="relative group shrink-0 mt-1 sm:mt-0">
                      <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-4 border-slate-50 shadow-xl shadow-indigo-500/10">
                        <AvatarImage src={selectedStudent?.avatar} className="object-cover" />
                        <AvatarFallback className="bg-indigo-600 text-white text-xl font-black uppercase">
                          {selectedStudent?.name.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                      />
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-card border border-slate-100 shadow-md flex items-center justify-center text-indigo-600 cursor-pointer z-10 hover:bg-indigo-50 transition-colors"
                      >
                        {uploadAvatarMutation.isPending ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Edit2 size={12} />
                        )}
                      </motion.div>
                    </div>
                    
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tighter uppercase break-words leading-tight">{selectedStudent?.name}</h2>
                        <span className="w-fit px-2 sm:px-3 py-1 rounded-xl bg-indigo-500/10 text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] border border-indigo-100">
                          {selectedStudent?.level || "Nível Iniciante"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 w-full">
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                           <div className="flex-1 max-w-[8rem] sm:max-w-none sm:w-32 lg:w-48 h-2 bg-muted rounded-full overflow-hidden border border-border/50">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${summary?.frequency || 0}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]" 
                              />
                           </div>
                           <span className="text-[9px] sm:text-[10px] text-muted-foreground font-black uppercase tracking-widest shrink-0">
                             {summary?.frequency || 0}% <span className="hidden sm:inline">Frequência</span><span className="sm:hidden">Freq.</span>
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pt-1">
                    <div className="hidden xl:flex flex-col items-end">
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status de Evolução</span>
                       <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/100/5 border border-emerald-500/10 rounded-2xl">
                          <Zap size={14} className="text-emerald-500 fill-emerald-500/20" />
                          <span className="text-xs font-black text-emerald-600 uppercase tracking-tight">Excelente Desempenho</span>
                       </div>
                    </div>
                    <Button 
                      onClick={() => { resetForm(); setIsModalOpen(true); }}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 transition-all active:scale-95 border-none"
                    >
                       <Plus size={20} className="sm:hidden" />
                       <Plus size={24} className="hidden sm:block" />
                    </Button>
                  </div>
                </div>
              </div>

               {/* INTERNAL HEADER - TABS */}
               <div className="mt-8 shrink-0 border-b border-border">
                  <div className="flex items-center gap-4 lg:gap-8 overflow-x-auto subtle-scrollbar px-8 pb-1">
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
                            "flex items-center gap-2 px-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap shrink-0",
                            isActive ? "text-indigo-600" : "text-muted-foreground hover:text-slate-600"
                          )}
                        >
                          <tab.icon size={16} className={cn("transition-colors", isActive ? "text-indigo-500" : "text-muted-foreground/40")} />
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
                              { label: "Média Geral", value: summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0", icon: Star, color: "text-amber-500", bg: "bg-amber-500/100/5", border: "border-amber-500/10" },
                              { label: "Aulas Concluídas", value: summary?.completedCount || 0, icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/100/5", border: "border-indigo-500/10" },
                              { label: "Última Aula", value: summary?.lastLesson ? format(new Date(summary.lastLesson), "dd MMM", { locale: ptBR }) : "—", icon: Calendar, color: "text-rose-500", bg: "bg-rose-500/5", border: "border-rose-500/10" },
                              { label: "Tempo Total", value: "12h 40m", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/10" },
                            ].map((stat, i) => (
                              <motion.div 
                                key={i}
                                whileHover={{ y: -5, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)" }}
                                className={cn("bg-card p-6 rounded-[2rem] border border-border shadow-sm transition-all group relative overflow-hidden", stat.border)}
                              >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-muted/50 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm relative z-10", stat.bg, stat.color)}>
                                  <stat.icon size={20} />
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 relative z-10">{stat.label}</p>
                                <p className="text-xl font-black text-foreground relative z-10">{stat.value}</p>
                              </motion.div>
                            ))}
                         </div>

                         {/* PLANO DE ESTUDO ATIVO (VISÃO PROFESSOR) */}
                         <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-6 bg-orange-500 rounded-full shrink-0" />
                                <h3 className="text-base sm:text-lg font-black text-foreground uppercase tracking-tighter leading-tight">Plano Diário Ativo</h3>
                              </div>
                              {currentTeacherPlan && (
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                  currentTeacherPlan.publishedStatus === 'publicado' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {currentTeacherPlan.publishedStatus === 'publicado' ? 'PUBLICADO' : 'RASCUNHO'}
                                </span>
                              )}
                            </div>
                            
                            {currentPlanLoading ? (
                              <div className="flex justify-center p-6"><Loader2 className="animate-spin text-orange-500/20" /></div>
                            ) : currentTeacherPlan ? (
                              <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm">
                                {(() => {
                                  if (!activePlanData) {
                                    return (
                                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-slate-700 whitespace-pre-wrap">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatPlanAsText(currentTeacherPlan.planText)}</ReactMarkdown>
                                      </div>
                                    );
                                  }

                                  const totalDays = activePlanData.days.length;
                                  const safeDayIndex = Math.min(selectedDay, totalDays - 1);
                                  const currentDayData = activePlanData.days[safeDayIndex];
                                  const isCurrentDayCompleted = Boolean(activeDaysCompleted[safeDayIndex]);

                                  return (
                                    <div className="space-y-6">
                                      {/* Objetivo Semanal */}
                                      {activePlanData.weeklyGoal && (
                                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                          <Target size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                                          <div>
                                            <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Objetivo da Semana</p>
                                            <p className="text-sm text-slate-700 leading-relaxed">{activePlanData.weeklyGoal}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Header + Seletor de dia */}
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
                                          <div className="flex items-center gap-2 px-3">
                                            <CalendarDays size={17} className="text-indigo-600" />
                                            <span className="font-bold text-sm text-slate-800">
                                              {currentDayData?.dayName || "Dia " + (safeDayIndex + 1)}
                                            </span>
                                          </div>
                                          <div className="flex gap-1">
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                                              onClick={() => setSelectedDay((d) => Math.max(0, d - 1))} disabled={safeDayIndex === 0}>
                                              <ChevronLeft size={16} />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                                              onClick={() => setSelectedDay((d) => Math.min(totalDays - 1, d + 1))} disabled={safeDayIndex === totalDays - 1}>
                                              <ChevronRight size={16} />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Foco do dia */}
                                      <AnimatePresence mode="wait">
                                        <motion.div key={"focus-" + safeDayIndex}
                                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                                          <div className="bg-indigo-50/30 border border-indigo-100/50 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6 items-center shadow-sm">
                                            <div className="flex gap-4 items-center flex-1">
                                              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
                                                <Music size={28} />
                                              </div>
                                              <div>
                                                <p className="text-xs font-bold text-indigo-600 mb-1">FOCO DO DIA</p>
                                                <h2 className="text-lg font-black text-slate-900 leading-tight mb-1">
                                                  {currentDayData?.focus?.title || "Treino Prático"}
                                                </h2>
                                                <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-sm">
                                                  {currentDayData?.focus?.description || "Siga os exercícios para concluir a rotina de hoje."}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm w-full md:w-auto min-w-[200px] text-center">
                                              <h3 className="font-bold text-slate-800 mb-1">Status do Aluno</h3>
                                              {isCurrentDayCompleted ? (
                                                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-2 rounded-lg font-bold text-sm">
                                                  <CheckCircle2 size={16} /> Treino Concluído
                                                </div>
                                              ) : (
                                                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 py-2 rounded-lg font-bold text-sm">
                                                  <AlertTriangle size={16} /> Pendente
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </motion.div>
                                      </AnimatePresence>

                                      {/* Lista de exercícios */}
                                      <AnimatePresence mode="wait">
                                        <motion.div key={"list-" + safeDayIndex}
                                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                                          {!currentDayData?.exercises || currentDayData.exercises.length === 0 ? (
                                            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-700">
                                              <AlertTriangle size={18} className="shrink-0" />
                                              <p className="text-sm font-medium">Nenhum exercício registrado.</p>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col gap-3">
                                              {currentDayData.exercises.map((exercise, idx) => (
                                                <div key={idx} className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
                                                  <div className="flex items-center gap-3 flex-1">
                                                    <span className="text-slate-300 font-black text-lg w-6 text-center shrink-0">
                                                      {String(idx + 1).padStart(2, "0")}
                                                    </span>
                                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                                      <ExerciseIcon icon={exercise.icon} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <h4 className="font-bold text-slate-900 text-sm">{exercise.title}</h4>
                                                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{exercise.subtitle}</p>
                                                    </div>
                                                  </div>
                                                  {exercise.duration && (
                                                    <div className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md text-xs font-bold shrink-0">
                                                      ⏱ {exercise.duration}
                                                    </div>
                                                  )}
                                                  {exercise.points && exercise.points.length > 0 && (
                                                    <div className="flex-1 text-xs text-slate-600 min-w-[150px]">
                                                      <ul className="list-disc pl-3 space-y-0.5">
                                                        {exercise.points.map((point, pIdx) => <li key={pIdx}>{point}</li>)}
                                                      </ul>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </motion.div>
                                      </AnimatePresence>
                                    </div>
                                  );
                                })()}
                                
                                <div className="mt-6 pt-4 border-t border-border flex flex-wrap justify-end gap-2">
                                  {currentTeacherPlan.publishedStatus === 'rascunho' ? (
                                    <Button 
                                      onClick={() => publishStudyPlanMutation.mutate({ planId: currentTeacherPlan.id, studentId: selectedStudentId! })}
                                      className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20 h-8 rounded-lg px-3"
                                      disabled={publishStudyPlanMutation.isPending}
                                    >
                                      {publishStudyPlanMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                                      Liberar para o Aluno
                                    </Button>
                                  ) : (
                                    <>
                                      <Button 
                                        variant="outline"
                                        onClick={() => {
                                          if (!selectedStudent?.phone) {
                                            toast.error("Este aluno não possui um telefone cadastrado.");
                                            return;
                                          }
                                          const text = encodeURIComponent(`Olá ${selectedStudent.name}! Passando para lembrar você de treinar os exercícios do seu plano de estudo diário hoje! Bora praticar? 🎸🚀`);
                                          window.open(`https://api.whatsapp.com/send?phone=55${selectedStudent.phone.replace(/\D/g, '')}&text=${text}`, "_blank");
                                        }}
                                        className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                      >
                                        <Zap size={14} className="mr-2" /> Lembrar de Praticar
                                      </Button>
                                      <Button 
                                        variant="destructive"
                                        onClick={() => deleteStudyPlanMutation.mutate({ planId: currentTeacherPlan.id })}
                                        disabled={deleteStudyPlanMutation.isPending}
                                        className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest"
                                      >
                                        {deleteStudyPlanMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
                                        Excluir Plano
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 bg-muted/30 border border-dashed border-border rounded-[2rem] text-center flex flex-col items-center justify-center">
                                <Calendar size={32} className="text-muted-foreground/30 mb-2" />
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhum plano publicado no momento</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Gere ou libere um rascunho no botão Plano de Estudo Diário.</p>
                              </div>
                            )}
                         </div>

                         {/* LISTA DE REGISTROS (TIMELINE) */}
                         <div className="space-y-6 pt-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                               <div className="flex items-center gap-3">
                                  <div className="w-2 h-6 bg-indigo-600 rounded-full shrink-0" />
                                  <h3 className="text-base sm:text-lg font-black text-foreground uppercase tracking-tighter leading-tight">Timeline de Evolução</h3>
                               </div>
                               <div className="flex flex-col sm:flex-row gap-3">
                                  <Button 
                                    onClick={() => {
                                      setIsAILessonModalOpen(true);
                                      setLessonPlanContent(null);
                                      generateNextLessonMutation.mutate({ studentId: selectedStudentId! });
                                    }}
                                    className="w-full sm:w-auto h-10 rounded-xl px-5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-violet-500/20"
                                    disabled={generateNextLessonMutation.isPending}
                                  >
                                    {generateNextLessonMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                    Sugerir Próxima Aula
                                  </Button>
                                  <Button 
                                    onClick={() => {
                                      setIsStudyPlanModalOpen(true);
                                      // If there's a draft or published plan, we should show it instead of auto-generating
                                      // The modal itself will show the history and a 'Gerar Novo' button
                                    }}
                                    className="w-full sm:w-auto h-10 rounded-xl px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-amber-500/20"
                                  >
                                    <Calendar size={16} />
                                    Plano de Estudo Diário
                                  </Button>
                                  <Button 
                                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                                    className="w-full sm:w-auto h-10 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2"
                                  >
                                    <Plus size={16} /> Novo Registro
                                  </Button>
                               </div>
                            </div>

                            <div className="space-y-6">
                               {timelineLoading ? (
                                 <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500/20" /></div>
                               ) : timeline.length === 0 ? (
                                 <div className="py-20 bg-card border border-dashed border-border rounded-[3rem] text-center">
                                    <Activity size={40} className="mx-auto text-slate-100 mb-4" />
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhum registro encontrado</p>
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
                                           event.category === 'tecnica' ? 'bg-indigo-500/100 ring-indigo-500/10' :
                                           event.category === 'teoria' ? 'bg-amber-500/100 ring-amber-500/10' :
                                           event.category === 'repertorio' ? 'bg-emerald-500/100 ring-emerald-500/10' :
                                           'bg-slate-400 ring-slate-100'
                                         )} />
                                         <div className="w-0.5 h-full bg-muted group-last:bg-transparent" />
                                      </div>

                                      <div className="flex-1 bg-card border border-border p-6 rounded-[2.5rem] shadow-sm group-hover:shadow-md transition-all">
                                         <div className="flex items-start justify-between mb-4">
                                            <div>
                                               <div className="flex items-center gap-3 mb-2">
                                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-lg border border-border/50">
                                                    {format(new Date(event.achievedAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                                  </span>
                                                  <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                                                    event.category === 'tecnica' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-100' :
                                                    event.category === 'teoria' ? 'bg-amber-500/10 text-amber-600 border-amber-100' :
                                                    'bg-emerald-500/10 text-emerald-600 border-emerald-100'
                                                  )}>
                                                    {event.category}
                                                  </span>
                                               </div>
                                               <h4 className="text-base font-black text-foreground tracking-tight">{event.title}</h4>
                                            </div>
                                            {event.grade && (
                                              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-xl">
                                                 <Star size={14} className="text-amber-500 fill-amber-500" />
                                                 <span className="text-xs font-black text-foreground">{Number(event.grade).toFixed(1)}</span>
                                              </div>
                                            )}
                                         </div>
                                         <p className="text-xs text-muted-foreground font-medium leading-relaxed mb-6">{event.description}</p>
                                         
                                         <div className="flex items-center justify-between pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-bold text-muted-foreground">Registrado por: Professor Aladim</span>
                                            <div className="flex gap-2">
                                                <Button 
                                                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10"
                                                  onClick={() => handleEdit(event)}
                                                >
                                                   <Edit2 size={14} />
                                                </Button>
                                                <Button 
                                                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
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


      </div>

      {/* MODAL PARA NOVO REGISTRO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
          <div className="px-8 py-8 border-b border-border bg-muted/50">
             <DialogHeader>
                <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tighter">
                   {editingEvent ? "Editar Registro" : "Novo Registro de Evolução"}
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Documente o desempenho e feedback do aluno</p>
             </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 bg-card">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Data da Atividade</label>
                   <Input 
                     type="datetime-local" 
                     className="rounded-2xl h-12 bg-muted/50 border-border text-xs font-bold"
                     value={formData.achievedAt}
                     onChange={e => setFormData({...formData, achievedAt: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Categoria</label>
                   <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v as any})}>
                      <SelectTrigger className="rounded-2xl h-12 bg-muted/50 border-border text-xs font-bold">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border">
                         <SelectItem value="tecnica">Técnica</SelectItem>
                         <SelectItem value="teoria">Teoria</SelectItem>
                         <SelectItem value="repertorio">Repertório</SelectItem>
                         <SelectItem value="geral">Geral</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Título do Evento</label>
                <Input 
                  placeholder="Ex: Escala Pentatônica Am" 
                  className="rounded-2xl h-12 bg-muted/50 border-border text-xs font-bold"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Observações / Feedback</label>
                <Textarea 
                  placeholder="Detalhes sobre o progresso..." 
                  className="rounded-2xl bg-muted/50 border-border text-xs font-bold min-h-[100px] p-4 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Avaliação Final (0-10)</label>
                <div className="flex items-center gap-3">
                   <Input 
                     type="number" 
                     min="0" max="10" step="0.5"
                     className="rounded-2xl h-12 w-24 bg-muted/50 border-border text-center font-black text-lg"
                     value={formData.grade}
                     onChange={e => setFormData({...formData, grade: e.target.value})}
                   />
                   <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${Number(formData.grade) * 10}%` }} />
                   </div>
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-muted/50 border-t border-border flex gap-3">
             <Button variant="ghost" className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
             <Button 
               className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/10"
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
        {/* MODAL PLANO DE AULA IA */}
        <Dialog open={isAILessonModalOpen} onOpenChange={setIsAILessonModalOpen}>
          <DialogContent className="sm:max-w-[700px] bg-card p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
            <div className="p-8 pb-4 bg-gradient-to-r from-violet-600 to-indigo-600">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                     <Zap size={20} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Sua Próxima Aula</DialogTitle>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Plano gerado pela Inteligência Artificial</p>
                  </div>
               </div>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto subtle-scrollbar">
               {generateNextLessonMutation.isPending ? (
                 <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <Loader2 size={40} className="animate-spin text-indigo-500/50" />
                    <p className="text-sm font-bold text-muted-foreground animate-pulse">Analisando histórico e metas do aluno...</p>
                 </div>
               ) : lessonPlanContent ? (
                 <div className="prose prose-sm dark:prose-invert max-w-none prose-h1:text-xl prose-h1:font-black prose-h2:text-lg prose-h2:text-indigo-600 prose-h2:font-black prose-h3:text-base prose-strong:text-indigo-500">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                       {lessonPlanContent}
                    </ReactMarkdown>
                 </div>
               ) : (
                 <p className="text-center text-muted-foreground py-8">Nenhum plano gerado ainda.</p>
               )}
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between gap-3">
               <div className="flex gap-2">
                 <Button type="button" variant="ghost" onClick={() => setIsAILessonModalOpen(false)} className="h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest hover:bg-slate-200">
                    Fechar
                 </Button>
                 {lessonPlanContent && (
                   <Button 
                     onClick={() => {
                       navigator.clipboard.writeText(lessonPlanContent);
                       toast.success("Copiado para a área de transferência!");
                     }}
                     className="h-11 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                   >
                      Copiar Plano
                   </Button>
                 )}
               </div>
               
               {lessonPlanContent && (
                 <div className="flex gap-2">
                   <Button 
                     onClick={() => handleSendManualWhatsApp(lessonPlanContent, "aula")}
                     className="h-11 rounded-xl px-4 bg-green-500 hover:bg-green-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-green-500/20"
                   >
                      WhatsApp Manual
                   </Button>
                   <Button 
                     onClick={() => handleSendBotWhatsApp(lessonPlanContent, "aula")}
                     disabled={isSendingViaBot}
                     className="h-11 rounded-xl px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                   >
                      {isSendingViaBot ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      WhatsApp Robô
                   </Button>
                 </div>
               )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

         {/* MODAL PLANO DE ESTUDO IA */}
        <Dialog open={isStudyPlanModalOpen} onOpenChange={setIsStudyPlanModalOpen}>
          <DialogContent className="sm:max-w-[800px] bg-card p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col md:flex-row">
            
            {/* Lado Esquerdo: Lista de Histórico */}
            <div className="w-full md:w-1/3 bg-muted/20 border-r border-border flex flex-col">
              <div className="p-4 border-b border-border bg-muted/40 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Histórico de Planos</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[30vh] md:max-h-[70vh] subtle-scrollbar">
                {historyLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-orange-500/50" /></div>
                ) : planHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum plano gerado.</p>
                ) : (
                  planHistory.map((plan: any) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setStudyPlanContent(plan.planText);
                        setStudyPlanId(plan.id);
                        setStudyPlanStatus(plan.publishedStatus);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-sm transition-all",
                        studyPlanId === plan.id 
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10 shadow-sm" 
                          : "border-border bg-card hover:border-orange-200"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-foreground">
                          {format(new Date(plan.createdAt), "dd MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                        plan.publishedStatus === 'publicado' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {plan.publishedStatus}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border">
                <Button 
                  onClick={() => {
                    setStudyPlanContent(null);
                    setStudyPlanId(null);
                    setStudyPlanStatus(null);
                    generateDailyStudyPlanMutation.mutate({ studentId: selectedStudentId! });
                  }}
                  disabled={generateDailyStudyPlanMutation.isPending}
                  className="w-full h-10 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-black uppercase tracking-widest"
                >
                  {generateDailyStudyPlanMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                  Gerar Novo
                </Button>
              </div>
            </div>

            {/* Lado Direito: Visualização do Plano */}
            <div className="w-full md:w-2/3 flex flex-col max-h-[60vh] md:max-h-[70vh]">
              <div className="p-6 pb-4 bg-gradient-to-r from-amber-500 to-orange-500 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                        <Calendar size={20} />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Plano de Estudo Diário</DialogTitle>
                      <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Sugerido pela Inteligência Artificial</p>
                    </div>
                  </div>
                  {studyPlanStatus === 'rascunho' && (
                    <span className="bg-amber-900/50 text-amber-100 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/50">
                      RASCUNHO
                    </span>
                  )}
                  {studyPlanStatus === 'publicado' && (
                    <span className="bg-green-900/50 text-green-100 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-green-500/50">
                      PUBLICADO
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto subtle-scrollbar">
                {generateDailyStudyPlanMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                      <Loader2 size={40} className="animate-spin text-orange-500/50" />
                      <p className="text-sm font-bold text-muted-foreground animate-pulse">Analisando histórico e criando cronograma diário...</p>
                  </div>
                ) : studyPlanContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-slate-700 whitespace-pre-wrap">
                      {(() => {
                          return <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatPlanAsText(studyPlanContent)}</ReactMarkdown>;
                      })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Calendar size={48} className="text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm font-medium">Nenhum plano selecionado.</p>
                    <p className="text-xs text-muted-foreground mt-2">Selecione um plano no histórico ou gere um novo.</p>
                  </div>
                )}
              </div>

              {studyPlanContent && (
                <DialogFooter className="p-4 bg-muted/30 border-t border-border flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2">
                    {studyPlanStatus === 'rascunho' && (
                      <Button 
                        onClick={() => publishStudyPlanMutation.mutate({ planId: studyPlanId!, studentId: selectedStudentId! })}
                        disabled={publishStudyPlanMutation.isPending}
                        className="h-10 rounded-xl px-4 bg-green-500 hover:bg-green-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-green-500/20"
                      >
                        {publishStudyPlanMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                        Liberar para o Aluno
                      </Button>
                    )}
                    <Button 
                      variant="destructive"
                      onClick={() => deleteStudyPlanMutation.mutate({ planId: studyPlanId! })}
                      disabled={deleteStudyPlanMutation.isPending}
                      className="h-10 rounded-xl px-4 text-xs font-black uppercase tracking-widest"
                    >
                      {deleteStudyPlanMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Trash2 size={16} className="mr-2" />}
                      Excluir Plano
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 ml-auto">
                    <Button 
                      variant="outline"
                      onClick={() => handleSendManualWhatsApp(studyPlanContent, "diario")}
                      className="h-10 rounded-xl px-3 text-xs font-black uppercase tracking-widest"
                      title="Enviar via WhatsApp Manual"
                    >
                      <ExternalLink size={16} />
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleSendBotWhatsApp(studyPlanContent, "diario")}
                      disabled={isSendingViaBot}
                      className="h-10 rounded-xl px-3 text-xs font-black uppercase tracking-widest"
                      title="Enviar via WhatsApp Robô"
                    >
                      {isSendingViaBot ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                    </Button>
                  </div>
                </DialogFooter>
              )}
            </div>
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
            <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">{title}</h4>
         </div>
         {children}
      </motion.div>
   );
}

function BibliotecaMusical({ studentId }: { studentId: number }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [previewFile, setPreviewFile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();
  const { data: allFiles = [] } = trpc.musicLibrary.list.useQuery({ studentId, category: 'todos', search: '' });
  const { data: files = [], isLoading } = trpc.musicLibrary.list.useQuery({ studentId, category, search });
  
  const uploadMutation = trpc.musicLibrary.upload.useMutation();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading(`Enviando ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          
          let fileCategory: 'imagem' | 'video' | 'pdf' | 'audio' = 'pdf';
          if (file.type.startsWith('image/')) fileCategory = 'imagem';
          else if (file.type.startsWith('video/')) fileCategory = 'video';
          else if (file.type.startsWith('audio/')) fileCategory = 'audio';
          else if (file.type === 'application/pdf') fileCategory = 'pdf';

          const { url } = await uploadMutation.mutateAsync({
            fileName: file.name,
            fileType: file.type,
            base64Data,
          });

          await createMutation.mutateAsync({
            studentId,
            fileName: file.name,
            fileType: file.type,
            category: fileCategory,
            fileUrl: url,
            size: file.size,
          });

          toast.dismiss(toastId);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
          toast.error("Erro no processamento: " + err.message, { id: toastId });
        }
      };
      reader.onerror = () => toast.error("Erro ao ler arquivo", { id: toastId });
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Falha no upload: " + error.message, { id: toastId });
    }
  };

  const categories = [
    { id: "imagem", label: "Imagens", icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-50" },
    { id: "video", label: "Vídeos", icon: Video, color: "text-rose-500", bg: "bg-rose-50" },
    { id: "pdf", label: "PDFs", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "audio", label: "Áudios", icon: Music, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
       {/* HEADER DA BIBLIOTECA */}
       <div className="flex items-center justify-between">
          <div>
             <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Biblioteca Musical</h3>
             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Central de Mídia e Materiais de Apoio</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex flex-col items-end mr-4">
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Armazenamento</span>
                   <span className="text-[9px] font-black text-indigo-600">12.4 GB / ILIMITADO</span>
                </div>
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
                   <div className="h-full bg-indigo-600 w-1/3" />
                </div>
             </div>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               onChange={handleFileUpload}
               accept="image/*,video/*,audio/*,.pdf"
             />
             <Button 
               onClick={() => fileInputRef.current?.click()}
               disabled={createMutation.isPending || uploadMutation.isPending}
               className="h-11 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-xl shadow-indigo-500/10 border-none"
             >
                {(createMutation.isPending || uploadMutation.isPending) ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Novo Material
             </Button>
          </div>
       </div>

       {/* ÁREA DE UPLOAD (DRAG & DROP) */}
        <motion.div 
          onClick={() => fileInputRef.current?.click()}
          whileHover={{ borderColor: "#6366F1", backgroundColor: "rgba(99, 102, 241, 0.02)" }}
          className="relative p-12 border-2 border-dashed border-border rounded-[3rem] bg-card flex flex-col items-center justify-center text-center group cursor-pointer transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/40 relative z-10 group-hover:scale-110 transition-transform">
             <UploadCloud size={36} />
          </div>
          <h4 className="text-lg font-black text-foreground tracking-tight relative z-10 mb-2">Upload de Arquivos</h4>
          <p className="text-xs text-muted-foreground font-medium max-w-[240px] relative z-10">
            Arraste seus PDFs, Vídeos ou Áudios aqui ou <span className="text-indigo-600 font-bold underline">clique para selecionar</span>
          </p>
          
          <div className="flex gap-4 mt-8 opacity-40 group-hover:opacity-100 transition-opacity relative z-10">
             {[ImageIcon, Video, FileText, Music].map((Icon, i) => (
               <div key={i} className="w-10 h-10 rounded-xl bg-muted/50 border border-slate-100 flex items-center justify-center text-muted-foreground group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all">
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
              onClick={() => setCategory(cat.id === category ? 'todos' : cat.id)}
              className={cn(
                "bg-card p-6 rounded-[2.5rem] border transition-all flex items-center gap-4 group cursor-pointer",
                category === cat.id ? "border-indigo-600 shadow-lg ring-2 ring-indigo-500/10" : "border-border shadow-sm"
              )}
            >
               <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:rotate-12", cat.bg, cat.color)}>
                  <cat.icon size={24} />
               </div>
               <div>
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                    {allFiles.filter((f: any) => f.category === cat.id).length} arquivos
                  </p>
               </div>
            </motion.div>
          ))}
       </div>

       {/* BUSCA E RESULTADOS */}
       <div className="space-y-8">
          <div className="flex items-center justify-between">
             <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-600 transition-colors" size={16} />
                <Input 
                  placeholder="Pesquisar na biblioteca..." 
                  className="pl-12 h-12 bg-card border-border rounded-2xl text-xs font-bold"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-border bg-card text-muted-foreground"><Filter size={18} /></Button>
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-border bg-card text-muted-foreground"><LayoutGrid size={18} /></Button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {isLoading ? (
               <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500/20" /></div>
             ) : files.length === 0 ? (
               <div className="col-span-full py-20 text-center border border-dashed border-border rounded-[3rem]">
                  <Folder size={40} className="mx-auto text-slate-100 mb-4" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sua biblioteca está vazia</p>
               </div>
             ) : (
               files.map((file) => (
                 <motion.div 
                   key={file.id}
                   whileHover={{ y: -8 }}
                   className="bg-card border border-border rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all"
                 >
                    <div className="aspect-[4/3] bg-muted/50 relative flex items-center justify-center group-hover:bg-indigo-500/10/50 transition-colors overflow-hidden">
                       <div className="text-slate-200 group-hover:text-indigo-200 transition-colors group-hover:scale-125 transition-transform duration-700">
                          {file.category === 'imagem' && <ImageIcon size={64} />}
                          {file.category === 'video' && <Video size={64} />}
                          {file.category === 'pdf' && <FileText size={64} />}
                          {file.category === 'audio' && <Music size={64} />}
                       </div>
                       
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 p-4 text-center">
                          <div className="flex gap-2">
                             <Button 
                               onClick={() => setPreviewFile(file)}
                               className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl border-none"
                             >
                                <Activity size={14} className="mr-2" /> Visualizar
                             </Button>
                             <Button 
                               asChild
                               variant="ghost" 
                               className="h-10 px-4 rounded-xl bg-card text-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-500/10 transition-all shadow-xl border-none"
                             >
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download={file.fileName}>
                                   <Download size={14} className="mr-2" /> Download
                                </a>
                             </Button>
                          </div>
                          <Button 
                             variant="ghost" 
                             onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: file.id }) }}
                             disabled={deleteMutation.isPending}
                             className="h-10 w-10 rounded-xl bg-card/10 text-white hover:bg-rose-500 hover:text-white backdrop-blur-md"
                          >
                             {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </Button>
                       </div>
                       
                       <div className="absolute top-5 left-5 px-3 py-1.5 bg-card/90 backdrop-blur rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm">
                          {format(new Date(file.createdAt), "dd MMM")}
                       </div>
                    </div>
                    
                    <div className="p-6">
                       <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                             <h4 className="text-[11px] font-black text-foreground uppercase tracking-tight truncate">{file.fileName}</h4>
                             <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-muted/50 border border-slate-100">
                                   {file.category}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground/40">
                                   {(file.size ? (file.size / (1024 * 1024)).toFixed(1) : "0.5")} MB
                                </span>
                             </div>
                          </div>
                          <div className="shrink-0 h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                             <ExternalLink size={14} />
                          </div>
                       </div>
                    </div>
                 </motion.div>
               ))
             )}
          </div>
       </div>

       {/* MODAL DE PREVIEW DE ARQUIVOS */}
       <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none rounded-[2rem]">
             <DialogHeader className="p-6 bg-card border-b border-border">
                <div className="flex items-center justify-between">
                   <div>
                      <DialogTitle className="text-lg font-black text-foreground uppercase tracking-tight truncate max-w-[400px]">
                         {previewFile?.fileName}
                      </DialogTitle>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                         Visualização de Material • {previewFile?.category}
                      </p>
                   </div>
                   <Button 
                     asChild
                     className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-5"
                   >
                      <a href={previewFile?.fileUrl} target="_blank" rel="noopener noreferrer" download={previewFile?.fileName}>
                         <Download size={14} className="mr-2" /> Baixar Arquivo
                      </a>
                   </Button>
                </div>
             </DialogHeader>

             <div className="aspect-video w-full flex items-center justify-center bg-black/40 relative overflow-hidden">
                {previewFile?.category === 'video' && (
                   <video 
                     src={previewFile.fileUrl} 
                     controls 
                     className="max-h-full max-w-full z-10"
                     autoPlay
                   />
                )}
                {previewFile?.category === 'audio' && (
                   <div className="flex flex-col items-center gap-6 z-10 w-full px-12">
                      <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40">
                         <Music size={48} />
                      </div>
                      <audio 
                        src={previewFile.fileUrl} 
                        controls 
                        className="w-full h-14"
                        autoPlay
                      />
                   </div>
                )}
                {previewFile?.category === 'pdf' && (
                   <iframe 
                     src={`${previewFile.fileUrl}#toolbar=0`} 
                     className="w-full h-full border-none z-10"
                     title={previewFile.fileName}
                   />
                )}
                {previewFile?.category === 'imagem' && (
                   <img 
                     src={previewFile.fileUrl} 
                     alt={previewFile.fileName}
                     className="max-h-full max-w-full object-contain z-10 shadow-2xl"
                   />
                )}
             </div>
          </DialogContent>
       </Dialog>
    </div>
  );
}

function MetasMusicais({ studentId, goals, createGoalMutation, updateGoalMutation, deleteGoalMutation }: any) {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Metas Musicais</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Acompanhamento de Objetivos</p>
         </div>
      </div>
      <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div className="flex gap-4">
          <Input 
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Aprender o solo de Hotel California"
            className="flex-1 rounded-2xl h-12 bg-muted/50 border-border text-xs font-bold px-4"
          />
          <Button 
            onClick={() => {
              if(!title) return;
              createGoalMutation.mutate({ studentId, title });
              setTitle("");
            }}
            disabled={createGoalMutation.isPending}
            className="h-12 rounded-2xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10"
          >
            {createGoalMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
          </Button>
        </div>
        <div className="space-y-3">
          {goals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-border rounded-3xl">
               <Target size={32} className="mx-auto text-slate-200 mb-3" />
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhuma meta cadastrada</p>
            </div>
          ) : goals.map((meta: any) => (
            <div key={meta.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-muted/50 group">
               <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                    meta.status === 'concluida' ? "bg-emerald-500/100 border-emerald-500 text-white" : "border-slate-300 bg-card hover:border-indigo-400"
                  )} onClick={() => updateGoalMutation.mutate({ id: meta.id, status: meta.status === 'concluida' ? 'pendente' : 'concluida' })}>
                     {meta.status === 'concluida' && <CheckCircle2 size={14} />}
                  </div>
                  <span className={cn("text-sm font-bold", meta.status === 'concluida' ? "text-muted-foreground line-through" : "text-slate-700")}>
                    {meta.title}
                  </span>
               </div>
               <Button 
                 variant="ghost" 
                 size="icon"
                 onClick={() => deleteGoalMutation.mutate({ id: meta.id })}
                 disabled={deleteGoalMutation.isPending}
                 className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
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
         <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Observações</h3>
         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Anotações Gerais do Aluno</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {notes.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-3xl bg-card">
             <BookOpen size={32} className="mx-auto text-slate-200 mb-3" />
             <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhuma anotação registrada</p>
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
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Desempenho & IA</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Análise Inteligente de Progresso</p>
         </div>
         <Button 
           onClick={() => aiInsightMutation.mutate({ studentId })}
           disabled={aiInsightMutation.isPending}
           className="h-11 rounded-xl px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-xl shadow-indigo-500/10 border-none"
         >
            {aiInsightMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} Gerar Insight
         </Button>
      </div>
      
      {insight && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-card/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-card/20 flex items-center justify-center shrink-0">
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
         <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-sm">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6">Métricas Gerais</h4>
            <div className="space-y-6">
               <div>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Frequência</span>
                     <span className="text-xs font-black text-foreground">{summary?.frequency || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                     <motion.div initial={{width:0}} animate={{width: `${summary?.frequency || 0}%`}} className="h-full bg-emerald-500/100" />
                  </div>
               </div>
               <div>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nota Média</span>
                     <span className="text-xs font-black text-foreground">{summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0"}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                     <motion.div initial={{width:0}} animate={{width: `${Number(summary?.averageGrade || 0) * 10}%`}} className="h-full bg-amber-500/100" />
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
