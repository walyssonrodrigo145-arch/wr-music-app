import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Target, CheckCircle2, Award, Loader2, BookOpen, ChevronLeft, ChevronRight, CalendarDays, Music, Timer, Guitar, PenTool, Star, Play, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function StudentProgress() {
  const { data: activePlan, isLoading: isPlanLoading, refetch: refetchPlan } = trpc.progress.getActiveStudyPlan.useQuery();
  const [selectedDay, setSelectedDay] = useState(0);

  const toggleDayMutation = trpc.progress.toggleStudyPlanDay.useMutation({
    onSuccess: (data) => {
      refetchPlan();
      if (data.allCompleted) {
        toast.success("Parabéns! Você gabaritou a semana! 🎉 Seu professor foi notificado do seu esforço!");
      } else {
        toast.success("Treino do dia atualizado!");
      }
    },
    onError: (e) => toast.error("Erro ao registrar treino: " + e.message)
  });

  if (isPlanLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  let planData = null;
  if (activePlan?.planText) {
    try {
      planData = JSON.parse(activePlan.planText);
    } catch (e) {
      console.error("Erro ao fazer parse do plano", e);
    }
  }

  const handleNextDay = () => {
    if (planData && selectedDay < planData.days.length - 1) setSelectedDay(selectedDay + 1);
  };

  const handlePrevDay = () => {
    if (selectedDay > 0) setSelectedDay(selectedDay - 1);
  };

  // Ícones mapeados
  const getIcon = (iconStr: string) => {
    switch (iconStr) {
      case "metronome": return <Timer size={24} className="text-indigo-600" />;
      case "guitar": return <Guitar size={24} className="text-indigo-600" />;
      case "pen": return <PenTool size={24} className="text-indigo-600" />;
      case "star": return <Star size={24} className="text-indigo-600" />;
      case "play": return <Play size={24} className="text-indigo-600" />;
      case "music":
      default: return <Music size={24} className="text-indigo-600" />;
    }
  };

  if (!activePlan || !planData || !planData.days || planData.days.length === 0) {
    return (
      <div className="space-y-8 pb-10 max-w-5xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Plano de Estudo Diário</h1>
          <p className="text-muted-foreground font-medium">Acompanhe as instruções do seu professor e registre o seu treino da semana.</p>
        </div>
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
              O seu professor ainda não gerou o seu plano de estudos para esta semana (ou o formato do plano antigo não é compatível). Aguarde um novo plano!
           </p>
        </motion.div>
      </div>
    );
  }

  const daysCompleted = JSON.parse(activePlan.daysCompleted as string || "[false,false,false,false,false]");
  const currentDayData = planData.days[selectedDay];
  const isCurrentDayCompleted = daysCompleted[selectedDay];

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto px-4 md:px-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-4 items-center">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <CalendarDays size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Plano de Estudo Diário</h1>
            <p className="text-sm text-muted-foreground font-medium">Acompanhe as instruções do seu professor e registre o seu treino da semana.</p>
          </div>
        </div>
        
        {/* Seletor de Dia */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-3">
            <CalendarDays size={18} className="text-indigo-600" />
            <span className="font-bold text-sm text-slate-800">{currentDayData?.dayName || `Dia ${selectedDay + 1}`}</span>
          </div>
          <div className="flex gap-1 ml-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevDay} disabled={selectedDay === 0}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextDay} disabled={selectedDay === planData.days.length - 1}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Card Principal: Foco do Dia e Botões de Ação */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`focus-${selectedDay}`}>
        <div className="bg-indigo-50/50 border border-indigo-100 p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between gap-8 items-center shadow-sm">
          
          <div className="flex gap-5 items-center flex-1">
             <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0 relative overflow-hidden">
               <Music size={32} className="relative z-10" />
               <Star size={14} className="absolute top-3 left-3 opacity-50" />
               <Star size={10} className="absolute bottom-4 right-4 opacity-50" />
             </div>
             <div>
               <p className="text-sm font-bold text-indigo-600 mb-1">Foco do dia</p>
               <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">{currentDayData?.focus?.title || "Treino Prático"}</h2>
               <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-md">
                 {currentDayData?.focus?.description || "Siga os exercícios abaixo para concluir sua rotina de hoje."}
               </p>
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto min-w-[320px]">
             <h3 className="text-center font-black text-slate-900 mb-1">Treinou hoje?</h3>
             <p className="text-xs text-center text-slate-500 mb-4 font-medium">Marque abaixo após concluir seu plano de estudo.</p>
             
             <div className="flex gap-3">
                <Button 
                  className={cn(
                    "flex-1 h-12 font-bold rounded-xl transition-all border-2",
                    isCurrentDayCompleted 
                      ? "bg-emerald-500 border-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                  )}
                  onClick={() => { if (!isCurrentDayCompleted) toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: selectedDay }) }}
                  disabled={toggleDayMutation.isPending || isCurrentDayCompleted}
                >
                  <CheckCircle2 size={18} className="mr-2" /> SIM, TREINEI
                </Button>
                
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 font-bold rounded-xl border-2 px-6",
                    !isCurrentDayCompleted && toggleDayMutation.isPending ? "opacity-50" : "",
                    isCurrentDayCompleted ? "border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100" : "border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                  )}
                  onClick={() => { if (isCurrentDayCompleted) toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: selectedDay }) }}
                  disabled={toggleDayMutation.isPending || !isCurrentDayCompleted}
                >
                  NÃO TREINEI
                </Button>
             </div>
             <p className="text-[10px] text-slate-400 mt-4 text-center">
               ℹ️ Marque até o final do dia para manter seu acompanhamento em dia.
             </p>
          </div>

        </div>
      </motion.div>

      {/* Lista de Exercícios */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`list-${selectedDay}`} className="pt-4">
         <div className="flex items-center gap-2 mb-6 px-2">
            <Music size={18} className="text-indigo-400" />
            <h3 className="font-bold text-slate-700">Seu plano de estudo</h3>
         </div>

         <div className="flex flex-col gap-4">
            {currentDayData?.exercises?.map((exercise: any, idx: number) => (
              <div key={idx} className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-5 w-full md:w-auto md:flex-1">
                    <div className="text-slate-300 font-black text-xl w-8 text-center">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                      {getIcon(exercise.icon)}
                    </div>
                    <div className="flex-1">
                       <h4 className="font-black text-slate-900">{exercise.title}</h4>
                       <p className="text-sm text-slate-500 mt-1 leading-relaxed">{exercise.subtitle}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-bold shrink-0 self-start md:self-auto">
                    ⏱ {exercise.duration}
                 </div>

                 <div className="flex-1 text-sm text-slate-600 self-start md:self-auto min-w-[200px]">
                    <ul className="list-disc pl-4 space-y-1">
                      {exercise.points?.map((point: string, pIdx: number) => (
                        <li key={pIdx}>{point}</li>
                      ))}
                    </ul>
                 </div>

                 <div className="shrink-0 self-end md:self-auto mt-4 md:mt-0">
                    <Button variant="ghost" className="text-indigo-600 hover:text-indigo-700 font-bold hover:bg-indigo-50 rounded-xl">
                      Ver detalhes &gt;
                    </Button>
                 </div>
              </div>
            ))}
         </div>
      </motion.div>

      {/* Banner Importante */}
      {planData?.importantMessage && (
        <div className="mt-12 bg-violet-50 border border-violet-100 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-violet-500 shadow-sm shrink-0">
               <Award size={20} />
            </div>
            <div>
              <h4 className="font-bold text-violet-900 mb-1">Importante</h4>
              <p className="text-sm text-violet-700/80 font-medium">
                {planData.importantMessage}
              </p>
            </div>
          </div>
          <Button className="bg-white text-violet-700 hover:bg-violet-100 border border-violet-200 shadow-sm font-bold rounded-xl shrink-0">
             <MessageCircle size={18} className="mr-2" /> Falar com o professor
          </Button>
        </div>
      )}

    </div>
  );
}
