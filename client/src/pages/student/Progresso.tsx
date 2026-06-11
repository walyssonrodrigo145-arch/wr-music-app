import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, CheckCircle2, Star, Award, Loader2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function StudentProgress() {
  const { data: activePlan, isLoading: isPlanLoading, refetch: refetchPlan } = trpc.progress.getActiveStudyPlan.useQuery();

  const toggleDayMutation = trpc.progress.toggleStudyPlanDay.useMutation({
    onSuccess: (data) => {
      refetchPlan();
      if (data.allCompleted) {
        toast.success("Parabéns! Você gabaritou a semana! 🎉 Seu professor foi notificado do seu esforço!");
      } else {
        toast.success("Treino do dia marcado como concluído! Continue assim!");
      }
    },
    onError: (e) => toast.error("Erro ao registrar treino: " + e.message)
  });

  if (isPlanLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Plano de Estudo Diário</h1>

        <p className="text-muted-foreground font-medium">Acompanhe as instruções do seu professor e registre o seu treino da semana.</p>
      </div>

      {!activePlan ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center p-12 bg-card border border-border border-dashed rounded-[3rem] shadow-sm mt-8"
        >
           <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mb-6">
              <BookOpen size={40} className="text-indigo-400" />
           </div>
           <h3 className="text-xl font-black tracking-tight text-foreground mb-2">Nenhum plano ativo</h3>
           <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              O seu professor ainda não gerou o seu plano de estudos para esta semana. Assim que ele criar, as instruções aparecerão aqui para você treinar e marcar a conclusão!
           </p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 overflow-hidden relative rounded-[2.5rem]">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
               <Star size={180} />
            </div>
            <CardHeader className="pb-6 border-b border-white/10 px-8 pt-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
                  <Target size={24} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-white uppercase tracking-tight">O que treinar essa semana</CardTitle>
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mt-1">Plano Estratégico do seu Professor</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-card text-foreground flex flex-col lg:flex-row">
               {/* Lado Esquerdo: Conteúdo do Markdown */}
               <div className="flex-1 p-8 border-b lg:border-b-0 lg:border-r border-border">
                 <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none max-h-[500px] overflow-y-auto subtle-scrollbar pr-4">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activePlan.planText}
                   </ReactMarkdown>
                 </div>
               </div>
               
               {/* Lado Direito: Ações (Botões de Dias) */}
               <div className="w-full lg:w-[400px] bg-muted/30 p-8 flex flex-col justify-center items-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/10 mb-6 border border-slate-100">
                     <CheckCircle2 size={32} className="text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-center text-foreground">Registro de Treino</h3>
                  <p className="text-xs text-muted-foreground text-center mb-8 font-medium">
                    Ao finalizar o treino de cada dia, marque abaixo. Seu professor será notificado automaticamente!
                  </p>
                  
                  <div className="flex justify-center gap-3 flex-wrap">
                    {[1, 2, 3, 4, 5].map((dayNum, index) => {
                      const daysCompleted = JSON.parse(activePlan.daysCompleted as string);
                      const isCompleted = daysCompleted[index];
                      return (
                        <button
                          key={dayNum}
                          onClick={() => toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: index })}
                          disabled={toggleDayMutation.isPending}
                          className={cn(
                            "flex flex-col items-center justify-center w-14 h-20 rounded-2xl border-2 transition-all group shadow-sm relative overflow-hidden",
                            isCompleted 
                              ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600" 
                              : "bg-card border-border text-muted-foreground hover:border-indigo-400 hover:text-indigo-600"
                          )}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest mb-1 relative z-10">Dia</span>
                          <span className="text-2xl font-black leading-none relative z-10">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {activePlan.status === 'inativo' && (
                     <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center shadow-sm">
                        <p className="text-emerald-600 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                           <Award size={18} /> Semana Gabaritada!
                        </p>
                     </motion.div>
                  )}
               </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
