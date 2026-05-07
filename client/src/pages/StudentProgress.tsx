import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Brain, CheckCircle2, ChevronLeft, Circle, Clock,
  Loader2, Plus, Sparkles, Target, Trophy, Music, ListTodo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function StudentProgress() {
  const [match, params] = useRoute("/alunos/:id/progresso");
  const studentId = Number(params?.id);

  const utils = trpc.useUtils();
  const [insightLoading, setInsightLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const { data: student, isLoading: studentLoading } = trpc.students.getDetails.useQuery({ id: studentId }, { enabled: !!studentId });
  const { data: goals, isLoading: goalsLoading } = trpc.progress.getGoals.useQuery({ studentId }, { enabled: !!studentId });
  const { data: timeline, isLoading: timelineLoading } = trpc.progress.getTimeline.useQuery({ studentId }, { enabled: !!studentId });

  const createGoalMutation = trpc.progress.createGoal.useMutation({
    onSuccess: () => {
      toast.success("Meta adicionada!");
      utils.progress.getGoals.invalidate({ studentId });
      setNewGoalTitle("");
    }
  });

  const updateGoalMutation = trpc.progress.updateGoal.useMutation({
    onSuccess: () => utils.progress.getGoals.invalidate({ studentId })
  });

  const generateInsightMutation = trpc.progress.generateAIInsight.useMutation({
    onSuccess: (data) => setAiInsight(data.insight),
    onError: () => toast.error("Erro ao gerar insight"),
    onSettled: () => setInsightLoading(false)
  });

  const [newGoalTitle, setNewGoalTitle] = useState("");

  if (studentLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!student) return <div className="p-12 text-center text-muted-foreground font-bold">Aluno não encontrado</div>;

  return (
    <div className="space-y-8 max-w-[1400px] mb-24 lg:mb-0">
      <div className="flex flex-col gap-6 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent p-6 md:p-8 rounded-[2rem] border border-border/40 shadow-sm relative overflow-hidden">
        <Link href="/alunos">
          <Button variant="ghost" size="sm" className="w-fit text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} className="mr-1" /> Voltar para Alunos
          </Button>
        </Link>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-[1.5rem] bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20 text-2xl font-black">
            {student.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">
              Progresso de {student.name.split(" ")[0]}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{student.level} • {student.instrumentName || "Música"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Metas Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card rounded-[2rem] border border-border/40 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <Target size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Metas</h3>
            </div>
            
            <div className="flex gap-2 mb-6">
              <Input 
                value={newGoalTitle} 
                onChange={(e) => setNewGoalTitle(e.target.value)} 
                placeholder="Nova meta..." 
                className="h-10 rounded-xl text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGoalTitle.trim()) {
                    createGoalMutation.mutate({ studentId, title: newGoalTitle });
                  }
                }}
              />
              <Button 
                onClick={() => newGoalTitle.trim() && createGoalMutation.mutate({ studentId, title: newGoalTitle })}
                disabled={!newGoalTitle.trim() || createGoalMutation.isPending}
                className="h-10 w-10 p-0 rounded-xl bg-primary"
              >
                {createGoalMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </Button>
            </div>

            <div className="space-y-3">
              {goalsLoading ? (
                <Loader2 className="animate-spin text-muted-foreground mx-auto" />
              ) : goals?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">Nenhuma meta definida.</p>
              ) : (
                goals?.map(goal => (
                  <div key={goal.id} className={cn("p-3 rounded-xl border flex items-start gap-3 transition-colors", goal.status === 'concluida' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-background hover:bg-muted/50 border-border/40')}>
                    <button 
                      onClick={() => updateGoalMutation.mutate({ id: goal.id, status: goal.status === 'concluida' ? 'pendente' : 'concluida' })}
                      className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors"
                    >
                      {goal.status === 'concluida' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                    </button>
                    <div className="flex-1">
                      <p className={cn("text-sm font-bold", goal.status === 'concluida' && "line-through text-muted-foreground/60")}>{goal.title}</p>
                      {goal.completedAt && (
                        <p className="text-[10px] uppercase tracking-widest text-emerald-600/70 mt-1">Concluída em {format(new Date(goal.completedAt), "dd/MM/yyyy")}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-600/10 to-primary/5 rounded-[2rem] border border-primary/20 p-6 shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/20">
                <Sparkles size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Insight IA</h3>
            </div>
            
            <div className="relative z-10">
              {aiInsight ? (
                <div className="text-sm leading-relaxed text-foreground/80 font-medium bg-background/50 p-4 rounded-xl border border-border/40 backdrop-blur-sm">
                  {aiInsight}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">Gere uma análise pedagógica automática com base nas aulas e metas recentes do aluno.</p>
              )}
              
              <Button 
                onClick={() => { setInsightLoading(true); generateInsightMutation.mutate({ studentId }); }}
                disabled={insightLoading}
                className="w-full mt-4 h-12 rounded-xl font-bold gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-95"
              >
                {insightLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                {aiInsight ? "Regerar Análise" : "Analisar Progresso"}
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline Column */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-[2rem] border border-border/40 p-6 shadow-sm min-h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <ListTodo size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Linha do Tempo</h3>
              </div>
            </div>

            <div className="relative pl-6 border-l-2 border-border/40 space-y-8">
              {timelineLoading ? (
                <Loader2 className="animate-spin text-muted-foreground ml-4" />
              ) : timeline?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic ml-4">Nenhum marco registrado.</p>
              ) : (
                timeline?.map(event => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[35px] top-1 w-4 h-4 rounded-full border-4 border-card bg-primary ring-2 ring-primary/20" />
                    <div className="bg-muted/30 p-4 rounded-2xl border border-border/40">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className="text-base font-bold text-foreground leading-tight">{event.title}</h4>
                        <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap bg-background px-2 py-1 rounded-lg border border-border/40">
                          {format(new Date(event.achievedAt), "MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                      <div className="mt-3">
                        <span className="text-[9px] font-black text-primary/70 uppercase tracking-[0.2em] bg-primary/10 px-2 py-1 rounded-md">
                          {event.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

