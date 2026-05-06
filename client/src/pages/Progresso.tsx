import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  User,
  Star,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  MoreVertical,
  Activity,
  Edit2,
  Trash2,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  Smile,
  Frown,
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
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

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
    if (grade >= 8) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (grade >= 6) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "tecnica": return "bg-violet-500/10 text-violet-600 border-violet-500/20";
      case "teoria": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "repertorio": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] lg:h-full gap-6 overflow-hidden">
      {/* Lado Esquerdo: Lista de Alunos */}
      <div className={cn(
        "w-full lg:w-80 flex flex-col bg-card rounded-[2rem] border border-border/40 shadow-sm overflow-hidden transition-all",
        selectedStudentId && "hidden lg:flex"
      )}>
        <div className="p-6 pb-4">
          <h3 className="text-xl font-black uppercase tracking-tight mb-4">Alunos</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar aluno..."
              className="pl-10 h-10 rounded-xl border-border/40 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1 scrollbar-thin">
          {studentsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-8 italic">Nenhum aluno encontrado.</p>
          ) : (
            filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group",
                  selectedStudentId === student.id
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                  <AvatarFallback className={cn(
                    "text-xs font-bold",
                    selectedStudentId === student.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  )}>
                    {student.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold truncate leading-tight">{student.name}</p>
                  <p className={cn(
                    "text-[10px] uppercase tracking-widest font-medium opacity-60",
                    selectedStudentId === student.id ? "text-white" : "text-muted-foreground"
                  )}>
                    {student.instrumentName || "Música"}
                  </p>
                </div>
                {selectedStudentId !== student.id && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Lado Direito: Detalhes do Progresso */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all",
        !selectedStudentId && "hidden lg:flex"
      )}>
        {!selectedStudentId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 lg:p-12 bg-card/50 rounded-[2rem] border-2 border-dashed border-border/60">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Activity size={32} />
            </div>
            <h2 className="text-xl lg:text-2xl font-black uppercase tracking-tight text-foreground">Acompanhe a Evolução</h2>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 px-4">
              Selecione um aluno na lista ao lado para visualizar e gerenciar sua linha do tempo pedagógica.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStudentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Botão Voltar (Mobile) */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mb-4 w-fit text-muted-foreground font-bold"
                onClick={() => setSelectedStudentId(null)}
              >
                <ChevronRight size={16} className="rotate-180 mr-1" />
                Voltar para lista
              </Button>

              {/* Topo: Resumo */}
              <div className="bg-card rounded-[2rem] border border-border/40 p-5 lg:p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-5 lg:gap-6">
                <Avatar className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.2rem] lg:rounded-[1.5rem] shadow-xl shadow-primary/10 border-2 border-background">
                  <AvatarFallback className="bg-primary text-white text-xl lg:text-2xl font-black">
                    {selectedStudent?.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left w-full">
                  <div className="flex flex-col md:flex-row items-center gap-2 lg:gap-3 mb-1">
                    <h2 className="text-2xl lg:text-3xl font-black uppercase tracking-tight truncate max-w-[200px] lg:max-w-none">{selectedStudent?.name}</h2>
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] lg:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      Nível: {selectedStudent?.level}
                    </span>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-3 lg:gap-6 mt-3">
                    <div className="flex-1 w-full max-w-xs">
                      <div className="flex justify-between text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        <span>Progresso Geral</span>
                        <span>{summary?.frequency || 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.3)] transition-all duration-1000" 
                          style={{ width: `${summary?.frequency || 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                      <Clock size={12} className="lg:size-[14px]" />
                      <span className="text-[10px] lg:text-xs font-medium">Última aula: {summary?.lastLesson ? format(new Date(summary.lastLesson), "dd/MM/yyyy") : "Sem registro"}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-64 bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Star size={80} className="text-amber-500" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {summary && summary.averageGrade >= 7 ? (
                      <Smile className="text-amber-600" size={16} />
                    ) : (
                      <Frown className="text-amber-600" size={16} />
                    )}
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Insight Pedagógico</p>
                  </div>
                  <p className="text-[11px] lg:text-xs text-amber-800/80 leading-relaxed font-medium">
                    {summaryLoading ? "Analisando..." : (
                      summary && summary.averageGrade >= 8 ? "O aluno está apresentando um ótimo desenvolvimento. Continue incentivando a prática!" :
                      summary && summary.averageGrade >= 6 ? "Evolução constante. Foco na revisão técnica das últimas metas." :
                      "O aluno precisa de uma revisão nos fundamentos. Considere diminuir a velocidade dos novos conteúdos."
                    )}
                  </p>
                </div>
              </div>

              {/* Indicadores */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                {[
                  { label: "Média", value: summary?.averageGrade || "0.0", icon: Star, color: "text-amber-500 bg-amber-500/10" },
                  { label: "Aulas", value: summary?.completedCount || 0, icon: BookOpen, color: "text-blue-500 bg-blue-500/10" },
                  { label: "Frequência", value: `${summary?.frequency || 0}%`, icon: Calendar, color: "text-emerald-500 bg-emerald-500/10" },
                  { label: "Evolução", value: "Boa", icon: TrendingUp, color: "text-violet-500 bg-violet-500/10" },
                ].map((stat, i) => (
                  <div key={i} className="bg-card rounded-2xl border border-border/40 p-3 lg:p-4 shadow-sm flex items-center gap-3 lg:gap-4">
                    <div className={cn("w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0", stat.color)}>
                      <stat.icon size={16} className="lg:size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1 lg:mb-1.5 truncate">{stat.label}</p>
                      <p className="text-base lg:text-xl font-black text-foreground truncate">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline Section */}
              <div className="flex-1 bg-card rounded-[2rem] border border-border/40 p-6 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                      <Activity size={20} />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Linha do Tempo</h3>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase cursor-pointer hover:bg-muted/50 transition-colors">
                      <Filter size={14} />
                      Filtrar por categoria
                    </div>
                    <Button 
                      onClick={() => { resetForm(); setIsModalOpen(true); }}
                      className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                      <Plus size={16} />
                      Novo Registro
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pl-5 lg:pl-8 border-l-2 border-border/40 space-y-4 lg:space-y-6 pb-6 scrollbar-thin">
                  {timelineLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
                  ) : timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="opacity-20 mb-4" size={48} />
                      <p className="text-sm font-medium italic">Nenhum marco registrado para este aluno.</p>
                    </div>
                  ) : (
                    timeline.map((event) => (
                      <div key={event.id} className="relative group">
                        {/* Dot */}
                        <div className={cn(
                          "absolute -left-[30px] lg:-left-[41px] top-4 w-3 h-3 lg:w-4 lg:h-4 rounded-full border-2 lg:border-4 border-card ring-2",
                          event.category === 'tecnica' ? 'bg-violet-500 ring-violet-500/20' :
                          event.category === 'teoria' ? 'bg-amber-500 ring-amber-500/20' :
                          event.category === 'repertorio' ? 'bg-emerald-500 ring-emerald-500/20' :
                          'bg-blue-500 ring-blue-500/20'
                        )} />
                        
                        <div className="bg-background/40 hover:bg-muted/30 p-3 lg:p-5 rounded-2xl border border-border/40 transition-all duration-200 hover:shadow-md">
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 lg:gap-4">
                            <div className="flex items-start gap-3 lg:gap-4 w-full sm:w-auto">
                              <div className="flex flex-col items-center bg-card border border-border/40 px-2 lg:px-3 py-1 lg:py-2 rounded-xl min-w-[50px] lg:min-w-[60px] shadow-sm">
                                <span className="text-[8px] lg:text-[10px] font-black text-muted-foreground uppercase">{format(new Date(event.achievedAt), "MMM", { locale: ptBR })}</span>
                                <span className="text-base lg:text-xl font-black text-foreground">{format(new Date(event.achievedAt), "dd")}</span>
                                <span className="text-[8px] lg:text-[9px] font-bold text-muted-foreground/60">{format(new Date(event.achievedAt), "yyyy")}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="text-sm lg:text-base font-black text-foreground leading-tight truncate">{event.title}</h4>
                                  <span className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border", getCategoryColor(event.category))}>
                                    {event.category}
                                  </span>
                                </div>
                                <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed line-clamp-3">{event.description}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-3 lg:gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/20">
                              {event.grade && (
                                <div className={cn("flex items-center gap-1 px-2 py-0.5 lg:py-1 rounded-lg border font-black text-xs lg:text-sm", getStatusColor(Number(event.grade)))}>
                                  <Star size={12} className="lg:size-[14px] fill-current" />
                                  {Number(event.grade).toFixed(1)}
                                </div>
                              )}
                              
                              <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => handleEdit(event)}>
                                  <Edit2 size={12} className="lg:size-[14px]" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => deleteEventMutation.mutate({ id: event.id })}>
                                  <Trash2 size={12} className="lg:size-[14px]" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex justify-center pt-4">
                    <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                      Carregar mais registros
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Modal: Novo/Editar Registro */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
                {editingEvent ? "Editar Registro" : "Novo Registro de Evolução"}
              </DialogTitle>
              <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">
                Acompanhe os detalhes da aula do dia
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-5 bg-card">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data</label>
                <Input
                  type="datetime-local"
                  className="rounded-xl border-border/40 focus:ring-primary/20 h-11"
                  value={formData.achievedAt}
                  onChange={(e) => setFormData({ ...formData, achievedAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoria</label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val as any })}
                >
                  <SelectTrigger className="rounded-xl border-border/40 focus:ring-primary/20 h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/40">
                    <SelectItem value="tecnica">Técnica</SelectItem>
                    <SelectItem value="teoria">Teoria</SelectItem>
                    <SelectItem value="repertorio">Repertório</SelectItem>
                    <SelectItem value="geral">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título</label>
              <Input
                placeholder="Ex: Escala Maior de Dó, Música X..."
                className="rounded-xl border-border/40 focus:ring-primary/20 h-11"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição</label>
              <Textarea
                placeholder="Detalhes sobre a evolução do aluno..."
                className="rounded-xl border-border/40 focus:ring-primary/20 min-h-[100px] resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nota (0 a 10)</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  placeholder="8.5"
                  className="rounded-xl border-border/40 focus:ring-primary/20 h-11 w-24"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
                <div className="flex-1 flex gap-2">
                  {[4, 6, 8, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, grade: n.toString() })}
                      className="px-3 py-1 rounded-lg bg-muted/50 hover:bg-primary/10 hover:text-primary text-[10px] font-black border border-border/20 transition-colors"
                    >
                      {n.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 flex gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl h-11 px-6 font-black uppercase tracking-widest text-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEventMutation.isPending || updateEventMutation.isPending}
              className="rounded-xl h-11 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
            >
              {createEventMutation.isPending || updateEventMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                editingEvent ? "Salvar Alterações" : "Salvar Registro"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
