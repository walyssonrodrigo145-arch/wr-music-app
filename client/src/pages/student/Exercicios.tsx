import { trpc } from "@/lib/trpc";
import { 
  FileText, 
  Send, 
  CheckCircle2, 
  ClipboardList
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function StudentExercises() {
  const { data: exercises, isLoading } = trpc.studentPortal.getExercises.useQuery();

  if (isLoading) return <div>Carregando exercícios...</div>;

  const pending = exercises?.filter(e => e.status === 'pendente') || [];
  const completed = exercises?.filter(e => e.status === 'concluida') || [];

  const ExerciseCard = ({ exercise, isCompleted }: { exercise: any, isCompleted?: boolean }) => (
    <Card className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm group hover:shadow-xl transition-all overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
            isCompleted ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
          )}>
            <FileText size={20} />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-base font-black text-foreground">{exercise.title}</h3>
            <p className="text-xs font-medium text-muted-foreground">
              {exercise.targetDate ? `Vence em ${format(new Date(exercise.targetDate), "dd/MM/yyyy")}` : "Sem data de entrega"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
              isCompleted ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"
            )}>
              {isCompleted ? "Corrigido" : "Pendente"}
            </span>
            <button className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md",
              isCompleted 
                ? "bg-muted dark:bg-slate-800 text-foreground hover:bg-slate-200" 
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20"
            )}>
              {isCompleted ? "Ver Correção" : "Enviar"}
              {!isCompleted && <Send size={14} />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Meus Exercícios</h1>
        <p className="text-muted-foreground font-medium">Veja e entregue suas atividades práticas.</p>
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="bg-muted bg-muted/50 p-1 rounded-2xl border border-border border-border mb-6">
          <TabsTrigger value="pendentes" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-card dark:data-[state=active]:bg-slate-800 transition-all">
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="entregues" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-card dark:data-[state=active]:bg-slate-800 transition-all">
            Entregues
          </TabsTrigger>
          <TabsTrigger value="corrigidos" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 data-[state=active]:bg-card dark:data-[state=active]:bg-slate-800 transition-all">
            Corrigidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {pending.length > 0 ? (
            pending.map(ex => <ExerciseCard key={ex.id} exercise={ex} />)
          ) : (
            <div className="text-center py-20 bg-muted/50 bg-card/20 rounded-3xl border-2 border-dashed border-border border-border">
              <CheckCircle2 className="mx-auto text-green-500 mb-4 opacity-50" size={50} />
              <p className="text-muted-foreground font-bold">Parabéns! Você não tem exercícios pendentes.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="corrigidos" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {completed.length > 0 ? (
            completed.map(ex => <ExerciseCard key={ex.id} exercise={ex} isCompleted />)
          ) : (
            <div className="text-center py-20 bg-muted/50 bg-card/20 rounded-3xl border-2 border-dashed border-border border-border">
              <ClipboardList className="mx-auto text-muted-foreground mb-4 opacity-20" size={50} />
              <p className="text-muted-foreground font-bold">Ainda não há exercícios corrigidos.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
