import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Award, Loader2, BookOpen,
  ChevronLeft, ChevronRight, CalendarDays, Music,
  Timer, Guitar, PenTool, Star, Play, MessageCircle,
  AlertTriangle, X, Sparkles, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  } catch (e) {
    console.error("Erro ao fazer parse do plano:", e);
    return null;
  }
}

function parseDaysCompleted(raw: any): boolean[] {
  if (!raw) return [false, false, false, false, false];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      const arr = parsed.map(Boolean);
      while (arr.length < 5) arr.push(false);
      if (arr.length > 5) arr.length = 5;
      return arr;
    }
  } catch { /* noop */ }
  return [false, false, false, false, false];
}

function ExerciseIcon({ icon }: { icon?: string }) {
  const cls = "text-indigo-600";
  const sz = 22;
  switch (icon) {
    case "metronome": return <Timer size={sz} className={cls} />;
    case "guitar":   return <Guitar size={sz} className={cls} />;
    case "pen":      return <PenTool size={sz} className={cls} />;
    case "star":     return <Star size={sz} className={cls} />;
    case "play":     return <Play size={sz} className={cls} />;
    default:         return <Music size={sz} className={cls} />;
  }
}

// ─── Modal de Detalhes do Exercício ──────────────────────────────────────────
interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  dayFocus?: string;
  onClose: () => void;
}

function ExerciseDetailModal({ exercise, dayFocus, onClose }: ExerciseDetailModalProps) {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const detailsMutation = trpc.studentPortal.getExerciseDetails.useMutation({
    onSuccess: (data) => setAiExplanation(data.explanation),
    onError: (e) => toast.error("Não foi possível gerar a explicação: " + e.message),
  });

  // Reset ao abrir um novo exercício
  useEffect(() => {
    setAiExplanation(null);
  }, [exercise?.title]);

  if (!exercise) return null;

  const handleGenerateDetails = () => {
    detailsMutation.mutate({
      exerciseTitle: exercise.title,
      exerciseSubtitle: exercise.subtitle,
      exercisePoints: exercise.points,
      dayFocus: dayFocus,
    });
  };

  return (
    <Dialog open={!!exercise} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Star size={120} className="translate-x-8 -translate-y-8" />
          </div>
          <DialogHeader>
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                <ExerciseIcon icon={exercise.icon} />
              </div>
              <div>
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">
                  Detalhes do Exercício
                </p>
                <DialogTitle className="text-white font-black text-xl leading-tight">
                  {exercise.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Instrução base */}
          {exercise.subtitle && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Instrução</p>
              <p className="text-slate-700 font-medium leading-relaxed">{exercise.subtitle}</p>
            </div>
          )}

          {/* Pontos de atenção */}
          {exercise.points && exercise.points.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pontos de atenção</p>
              <ul className="space-y-2">
                {exercise.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duração */}
          {exercise.duration && (
            <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
              <Timer size={18} className="text-indigo-500 shrink-0" />
              <p className="text-sm font-bold text-indigo-700">
                Tempo sugerido: <span className="text-indigo-600">{exercise.duration}</span>
              </p>
            </div>
          )}

          {/* Explicação da IA (Chat Bubble Style) */}
          <AnimatePresence>
            {aiExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-6 flex flex-col gap-2"
              >
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-md">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Professor IA</p>
                </div>
                <div className="bg-white border border-slate-200/60 shadow-lg shadow-slate-200/20 rounded-[2rem] rounded-tl-sm p-6 relative">
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-[15px]">
                    {aiExplanation.replace(/\*\*/g, '').replace(/\*/g, '')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão de gerar explicação IA */}
          {!aiExplanation && (
            <Button
              onClick={handleGenerateDetails}
              disabled={detailsMutation.isPending}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              {detailsMutation.isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando explicação...</>
              ) : (
                <><Sparkles size={16} className="mr-2" /> Gerar explicação detalhada com IA</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StudentProgress() {
  const { data: activePlan, isLoading: isPlanLoading, refetch: refetchPlan } =
    trpc.progress.getActiveStudyPlan.useQuery();

  const { data: professorContact } = trpc.studentPortal.getProfessorContact.useQuery();

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Reset do dia quando o plano muda
  useEffect(() => { setSelectedDay(0); }, [activePlan?.id]);

  const toggleDayMutation = trpc.progress.toggleStudyPlanDay.useMutation({
    onSuccess: (data) => {
      refetchPlan();
      if (data.allCompleted) toast.success("Parabéns! Você gabaritou a semana! 🎉 Seu professor foi notificado!");
      else toast.success("Treino do dia atualizado!");
    },
    onError: (e) => toast.error("Erro ao registrar treino: " + e.message),
  });

  const planData = useMemo(() => parsePlanData(activePlan?.planText), [activePlan?.planText]);
  const daysCompleted = useMemo(
    () => parseDaysCompleted(activePlan?.daysCompleted as string | undefined),
    [activePlan?.daysCompleted]
  );

  const handleContactProfessor = () => {
    if (!professorContact?.phone) {
      toast.error("O professor ainda não cadastrou um número de WhatsApp no sistema.");
      return;
    }
    const phone = professorContact.phone.replace(/\D/g, "");
    const msg = encodeURIComponent("Olá professor! Tenho uma dúvida sobre o meu plano de estudos. 📚");
    window.open("https://wa.me/55" + phone + "?text=" + msg, "_blank");
  };

  if (isPlanLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!activePlan || !planData) {
    return (
      <div className="space-y-8 pb-10 max-w-5xl mx-auto px-4 md:px-0">
        <PageHeader />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center p-12 bg-card border border-border border-dashed rounded-[3rem] shadow-sm mt-8"
        >
          <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mb-6">
            <BookOpen size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-foreground mb-2">Nenhum plano ativo</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            O seu professor ainda não gerou o seu plano de estudos para esta semana. Assim que ele criar, as instruções aparecerão aqui!
          </p>
          <Button onClick={handleContactProfessor} className="mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl">
            <MessageCircle size={17} className="mr-2" /> Falar com o professor
          </Button>
        </motion.div>
      </div>
    );
  }

  const totalDays = planData.days.length;
  const safeDayIndex = Math.min(selectedDay, totalDays - 1);
  const currentDayData = planData.days[safeDayIndex];
  const isCurrentDayCompleted = Boolean(daysCompleted[safeDayIndex]);
  const isPlanFinished = activePlan.status === "inativo";

  const handleToggleDay = (markAs: boolean) => {
    if (isPlanFinished || toggleDayMutation.isPending) return;
    if (markAs !== isCurrentDayCompleted) {
      toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: safeDayIndex });
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto px-4 md:px-0">

      {/* Modal de detalhes */}
      <ExerciseDetailModal
        exercise={selectedExercise}
        dayFocus={currentDayData?.focus?.title}
        onClose={() => setSelectedExercise(null)}
      />

      {/* Header + seletor de dia */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader />
        <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-xl shadow-sm self-start md:self-auto">
          <div className="flex items-center gap-2 px-3">
            <CalendarDays size={17} className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-sm text-foreground">
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

      {/* Banner semana concluída */}
      {isPlanFinished && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <Award size={22} className="text-emerald-500 shrink-0" />
          <p className="text-sm font-bold text-emerald-700">
            Semana Gabaritada! 🎉 Você concluiu todos os dias desta semana. Aguarde o próximo plano do seu professor.
          </p>
        </motion.div>
      )}

      {/* Foco do dia + botões */}
      <AnimatePresence mode="wait">
        <motion.div key={"focus-" + safeDayIndex}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between gap-8 items-center shadow-sm">
            <div className="flex gap-5 items-center flex-1">
              <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0 relative overflow-hidden">
                <Music size={32} className="relative z-10" />
                <Star size={13} className="absolute top-3 left-3 opacity-40" />
                <Star size={9} className="absolute bottom-4 right-4 opacity-40" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">Foco do dia</p>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight mb-2">
                  {currentDayData?.focus?.title || "Treino Prático"}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-md">
                  {currentDayData?.focus?.description || "Siga os exercícios abaixo para concluir sua rotina de hoje."}
                </p>
              </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm w-full md:w-auto min-w-[300px]">
              <h3 className="text-center font-black text-foreground mb-1">Treinou hoje?</h3>
              <p className="text-xs text-center text-muted-foreground mb-4 font-medium">Marque abaixo após concluir seu plano de estudo.</p>
              {isPlanFinished ? (
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-bold py-2">✅ Semana concluída com sucesso!</p>
              ) : (
                <div className="flex gap-3">
                  <Button
                    className={cn("flex-1 h-12 font-bold rounded-xl transition-all border-2",
                      isCurrentDayCompleted
                        ? "bg-emerald-500 border-emerald-500 text-white cursor-default"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100")}
                    onClick={() => handleToggleDay(true)}
                    disabled={toggleDayMutation.isPending || isCurrentDayCompleted}
                  >
                    <CheckCircle2 size={17} className="mr-2" /> SIM, TREINEI
                  </Button>
                  <Button variant="outline"
                    className={cn("h-12 font-bold rounded-xl border-2 px-5",
                      isCurrentDayCompleted
                        ? "border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100"
                        : "border-slate-200 text-slate-300 cursor-not-allowed")}
                    onClick={() => handleToggleDay(false)}
                    disabled={toggleDayMutation.isPending || !isCurrentDayCompleted}
                  >
                    NÃO TREINEI
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-3 text-center">
                ℹ️ Marque até o final do dia para manter seu acompanhamento em dia.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Lista de exercícios */}
      <AnimatePresence mode="wait">
        <motion.div key={"list-" + safeDayIndex}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
          className="pt-2">
          <div className="flex items-center gap-2 mb-5 px-1">
            <Music size={17} className="text-indigo-400" />
            <h3 className="font-bold text-slate-700">Seu plano de estudo</h3>
          </div>

          {!currentDayData?.exercises || currentDayData.exercises.length === 0 ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-5 rounded-2xl text-amber-700">
              <AlertTriangle size={20} className="shrink-0" />
              <p className="text-sm font-medium">Nenhum exercício foi registrado para este dia. Aguarde o professor atualizar o plano.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {currentDayData.exercises.map((exercise, idx) => (
                <div key={idx}
                  className="bg-card dark:bg-slate-800/50 border border-border p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 w-full md:w-auto md:flex-1">
                    <span className="text-slate-300 dark:text-slate-600 font-black text-xl w-8 text-center shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <ExerciseIcon icon={exercise.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-foreground">{exercise.title}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{exercise.subtitle}</p>
                    </div>
                  </div>

                  {exercise.duration && (
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg text-sm font-bold shrink-0 self-start md:self-auto">
                      ⏱ {exercise.duration}
                    </div>
                  )}

                  {exercise.points && exercise.points.length > 0 && (
                    <div className="flex-1 text-sm text-slate-600 self-start min-w-[180px]">
                      <ul className="list-disc pl-4 space-y-1">
                        {exercise.points.map((point, pIdx) => (
                          <li key={pIdx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Botão Ver detalhes → abre modal */}
                  <div className="shrink-0 self-end md:self-auto">
                    <Button
                      variant="ghost"
                      className="text-indigo-600 hover:text-indigo-700 font-bold hover:bg-indigo-50 rounded-xl"
                      onClick={() => setSelectedExercise(exercise)}
                    >
                      Ver detalhes &gt;
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Banner Importante + botão Falar com o professor */}
      {planData?.importantMessage && (
        <div className="mt-6 bg-violet-50 border border-violet-100 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-violet-500 shadow-sm shrink-0">
              <Award size={19} />
            </div>
            <div>
              <h4 className="font-bold text-violet-900 mb-1">Importante</h4>
              <p className="text-sm text-violet-700/80 font-medium">{planData.importantMessage}</p>
            </div>
          </div>
          <Button
            onClick={handleContactProfessor}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm shrink-0 gap-2"
          >
            <MessageCircle size={17} />
            Falar com o professor
            {professorContact?.phone && <ExternalLink size={14} className="opacity-70" />}
          </Button>
        </div>
      )}

    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex gap-4 items-center">
      <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
        <CalendarDays size={27} />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Plano de Estudo Diário</h1>
        <p className="text-sm text-muted-foreground font-medium">
          Acompanhe as instruções do seu professor e registre o seu treino da semana.
        </p>
      </div>
    </div>
  );
}
