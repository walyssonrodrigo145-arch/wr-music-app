import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
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

export default function Progresso() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

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

  const createEventMutation = trpc.progress.createTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro adicionado!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateEventMutation = trpc.progress.updateTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro atualizado!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteEventMutation = trpc.progress.deleteTimelineEvent.useMutation({
    onSuccess: () => {
      toast.success("Registro excluído!");
      utils.progress.getTimeline.invalidate({ studentId: selectedStudentId! });
      utils.progress.getSummary.invalidate({ studentId: selectedStudentId! });
    },
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

  const filteredStudents = useMemo(() => {
    return students
      .filter((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s: any) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      category: event.category,
      grade: event.grade?.toString() || "",
      achievedAt: format(new Date(event.achievedAt), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) return toast.error("Título é obrigatório");
    
    if (editingEvent) {
      updateEventMutation.mutate({
        id: editingEvent.id,
        ...formData,
      });
    } else {
      createEventMutation.mutate({
        studentId: selectedStudentId!,
        ...formData,
      });
    }
  };

  const getStatusColor = (grade: number) => {
    if (grade >= 8) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (grade >= 6) return "text-blue-600 bg-blue-50 border-blue-100";
    return "text-amber-600 bg-amber-50 border-amber-100";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "tecnica": return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case "teoria": return "bg-amber-50 text-amber-600 border-amber-100";
      case "repertorio": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] gap-0 lg:gap-0 overflow-hidden -m-4 sm:-m-6 bg-[#F8FAFC]">
      {/* Sidebar de Alunos */}
      <div className={cn(
        "w-full lg:w-80 flex flex-col bg-card border-r border-border transition-all",
        selectedStudentId && "hidden lg:flex"
      )}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">Progresso</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Timeline dos alunos</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Buscar aluno..."
              className="pl-9 h-11 text-xs rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 scrollbar-thin no-scrollbar">
          {studentsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-200" /></div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Search size={20} />
              </div>
              <p className="text-xs text-muted-foreground font-medium italic">Nenhum aluno encontrado</p>
            </div>
          ) : (
            filteredStudents.map((student: any) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group",
                  selectedStudentId === student.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Avatar className="w-9 h-9 border-2 border-white/20 shrink-0">
                  <AvatarFallback className={cn(
                    "text-[10px] font-black uppercase",
                    selectedStudentId === student.id ? "bg-card/20 text-white" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {student.name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-bold truncate leading-none mb-1">{student.name}</p>
                  <p className={cn(
                    "text-[10px] font-medium truncate uppercase tracking-widest",
                    selectedStudentId === student.id ? "text-white/60" : "text-muted-foreground"
                  )}>
                    {student.level || "Iniciante"}
                  </p>
                </div>
                
                <ChevronRight size={14} className={cn(
                  "transition-all shrink-0",
                  selectedStudentId === student.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0"
                )} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-[#F8FAFC] overflow-hidden",
        !selectedStudentId && "hidden lg:flex"
      )}>
        {!selectedStudentId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 rounded-[2rem] bg-card border border-border shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
              <Activity size={32} className="text-indigo-200" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acompanhe a Evolução</h2>
            <p className="text-sm text-muted-foreground max-w-[280px] mt-2 font-medium">
              Selecione um aluno para ver o histórico completo de desempenho e conquistas.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStudentId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* HEADER COMPACTO */}
              <div className="bg-card border-b border-border px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-4 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden shrink-0 h-10 w-10 rounded-xl bg-muted border border-border"
                  onClick={() => setSelectedStudentId(null)}
                >
                  <ChevronRight size={18} className="rotate-180" />
                </Button>

                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="w-10 h-10 lg:w-14 lg:h-14 border-4 border-border shrink-0 shadow-sm">
                    <AvatarFallback className="bg-indigo-600 text-white text-xs lg:text-base font-black uppercase">
                      {selectedStudent?.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 lg:mb-2">
                      <h2 className="text-base lg:text-2xl font-black text-foreground truncate leading-none">{selectedStudent?.name}</h2>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-[8px] lg:text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100/50">
                        {selectedStudent?.level || "Nível I"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 lg:w-48 h-2 bg-muted rounded-full overflow-hidden shrink-0 border border-border/50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${summary?.frequency || 0}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                        />
                      </div>
                      <span className="text-[10px] lg:text-xs text-muted-foreground font-bold uppercase tracking-wider">
                        {summary?.frequency || 0}% Frequência
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden xl:flex items-center gap-4 bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-[1.25rem]">
                   <TrendingUp size={20} className="text-emerald-600" />
                   <div>
                     <p className="text-[10px] font-black text-emerald-800/50 uppercase tracking-widest">Status da Evolução</p>
                     <p className="text-xs text-emerald-900 font-bold">Excelente Desempenho</p>
                   </div>
                </div>
              </div>

              {/* CARDS DE MÉTRICAS */}
              <div className="px-4 py-4 lg:px-8 lg:py-8 overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
                  {[
                    { label: "Média Geral", value: summary?.averageGrade ? Number(summary.averageGrade).toFixed(1) : "0.0", icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
                    { label: "Aulas Concluídas", value: summary?.completedCount || 0, icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50" },
                    { label: "Última Aula", value: summary?.lastLesson ? format(new Date(summary.lastLesson), "dd MMM", { locale: ptBR }) : "N/A", icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-50" },
                    { label: "Tempo Total", value: "12h 40m", icon: Clock, color: "text-indigo-500", bg: "bg-indigo-50" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-card p-4 lg:p-6 rounded-[1.5rem] border border-border shadow-sm w-36 lg:w-full group hover:shadow-md transition-all">
                      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3 lg:mb-4 transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-base lg:text-xl font-black text-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIMELINE */}
              <div className="flex-1 px-4 lg:px-8 pb-6 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6 shrink-0">
                   <div className="flex items-center gap-3">
                     <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                     <h3 className="text-sm lg:text-base font-black text-foreground uppercase tracking-widest">Jornada Musical</h3>
                   </div>
                   
                   <Button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="h-10 rounded-xl px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Novo Registro</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-6">
                  {timelineLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-200" /></div>
                  ) : timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card border-2 border-dashed border-border rounded-[2rem]">
                      <Activity size={40} className="text-slate-100 mb-4" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhuma atividade registrada</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l-2 border-border ml-3 space-y-8 pb-10">
                      {timeline.map((event) => (
                        <div key={event.id} className="relative">
                          {/* Dot */}
                          <div className={cn(
                            "absolute -left-[35px] top-4 w-5 h-5 rounded-full border-4 border-white shadow-md z-10",
                            event.category === 'tecnica' ? 'bg-indigo-500' :
                            event.category === 'teoria' ? 'bg-amber-500' :
                            event.category === 'repertorio' ? 'bg-emerald-500' :
                            'bg-slate-400'
                          )} />
                          
                          <motion.div 
                            whileHover={{ y: -2 }}
                            className="bg-card p-5 lg:p-6 rounded-[1.5rem] border border-border shadow-sm hover:shadow-lg transition-all group"
                          >
                            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded-md">
                                    {format(new Date(event.achievedAt), "dd MMM yyyy", { locale: ptBR })}
                                  </span>
                                  <span className={cn("px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border", getCategoryColor(event.category))}>
                                    {event.category}
                                  </span>
                                </div>
                                <h4 className="text-sm lg:text-base font-black text-foreground mb-2">{event.title}</h4>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{event.description}</p>
                              </div>
                              
                              <div className="flex items-center gap-6 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-none pt-4 md:pt-0 border-border">
                                {event.grade && (
                                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border font-black text-xs shadow-sm", getStatusColor(Number(event.grade)))}>
                                    <Star size={14} className="fill-current" />
                                    {Number(event.grade).toFixed(1)}
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleEdit(event)}>
                                    <Edit2 size={16} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteEventMutation.mutate({ id: event.id })}>
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 border-none shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="px-8 py-8 border-b border-border bg-muted/50">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground uppercase tracking-widest">
                {editingEvent ? "Editar Registro" : "Novo Registro"}
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                Documente a evolução musical
              </p>
            </DialogHeader>
          </div>
          
          <div className="px-8 py-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data</label>
                <Input
                  type="datetime-local"
                  className="rounded-xl h-12 text-xs border-border bg-muted font-bold text-foreground"
                  value={formData.achievedAt}
                  onChange={(e) => setFormData({ ...formData, achievedAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoria</label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val as any })}
                >
                  <SelectTrigger className="rounded-xl h-12 text-xs border-border bg-muted font-bold text-foreground">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="tecnica" className="text-xs font-bold py-3">Técnica</SelectItem>
                    <SelectItem value="teoria" className="text-xs font-bold py-3">Teoria</SelectItem>
                    <SelectItem value="repertorio" className="text-xs font-bold py-3">Repertório</SelectItem>
                    <SelectItem value="geral" className="text-xs font-bold py-3">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título da Atividade</label>
              <Input
                placeholder="Ex: Escala Pentatônica de Am"
                className="rounded-xl h-12 text-xs border-border bg-muted font-bold text-foreground"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Observações</label>
              <Textarea
                placeholder="Detalhes sobre o desempenho..."
                className="rounded-xl text-xs border-border bg-muted font-bold text-foreground min-h-[100px] resize-none p-4"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Avaliação (0-10)</label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  className="rounded-xl h-12 text-sm border-border bg-muted font-black text-foreground w-24 text-center"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
                <div className="flex gap-2 flex-wrap">
                  {[7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, grade: n.toString() })}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-black border transition-all active:scale-90",
                        formData.grade === n.toString() ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200" : "bg-card text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-8 py-6 bg-muted flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEventMutation.isPending || updateEventMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
            >
              {createEventMutation.isPending || updateEventMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                editingEvent ? "Atualizar" : "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



