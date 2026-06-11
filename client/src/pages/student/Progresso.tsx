import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Award, Loader2, BookOpen,
  ChevronLeft, ChevronRight, CalendarDays, Music,
  Timer, Guitar, PenTool, Star, Play, MessageCircle, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tenta fazer o parse do JSON do plano de forma segura */
function parsePlanData(planText: string | null | undefined) {
  if (!planText) return null;
  try {
    const parsed = JSON.parse(planText);
    // Valida a estrutura mínima esperada
    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Tenta fazer parse do daysCompleted de forma segura */
function parseDaysCompleted(raw: string | null | undefined): boolean[] {
  if (!raw) return [false, false, false, false, false];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(Boolean);
  } catch { /* noop */ }
  return [false, false, false, false, false];
}

/** Mapeia strings de ícone para componentes */
function ExerciseIcon({ icon }: { icon?: string }) {
  const cls = "text-indigo-600";
  const sz = 22;
  switch (icon) {
    case "metronome": return <Timer size={sz} className={cls} />;
    case "guitar":   return <Guitar size={sz} className={cls} />;
    case "pen":      return <PenTool size={sz} className={cls} />;
    case "star":     return <Star size={sz} className={cls} />;
    case "play":     return <Play size={sz} className={cls} />;
    case "music":
    default:         return <Music size={sz} className={cls} />;
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function StudentProgress() {
  const {
    data: activePlan,
    isLoading: isPlanLoading,
    refetch: refetchPlan,
  } = trpc.progress.getActiveStudyPlan.useQuery();

  const [selectedDay, setSelectedDay] = useState(0);

  // Bug fix #3: reset selectedDay sempre que o plano mudar
  useEffect(() => {
    setSelectedDay(0);
  }, [activePlan?.id]);

  const toggleDayMutation = trpc.progress.toggleStudyPlanDay.useMutation({
    onSuccess: (data) => {
      refetchPlan();
      if (data.allCompleted) {
        toast.success("Parabéns! Você gabaritou a semana! 🎉 Seu professor foi notificado!");
      } else {
        toast.success("Treino do dia atualizado!");
      }
    },
    onError: (e) => toast.error("Erro ao registrar treino: " + e.message),
  });

  // Bug fix #2: parse seguro e memoizado do planData
  const planData = useMemo(() => parsePlanData(activePlan?.planText), [activePlan?.planText]);

  // Bug fix #1: parse seguro do daysCompleted
  const daysCompleted = useMemo(
    () => parseDaysCompleted(activePlan?.daysCompleted as string | undefined),
    [activePlan?.daysCompleted]
  );

  if (isPlanLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Estado: sem plano ou plano em formato inválido ──
  if (!activePlan || !planData) {
    return (
      <div className="space-y-8 pb-10 max-w-5xl mx-auto px-4 md:px-0">
        <PageHeader />
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
            O seu professor ainda não gerou o seu plano de estudos para esta semana.
            Assim que ele criar, as instruções aparecerão aqui!
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Dados do dia selecionado ──
  const totalDays = planData.days.length;
  // Garante que selectedDay está dentro dos limites (segurança extra)
  const safeDayIndex = Math.min(selectedDay, totalDays - 1);
  const currentDayData = planData.days[safeDayIndex];
  const isCurrentDayCompleted = Boolean(daysCompleted[safeDayIndex]);

  // Bug fix #4: bloqueia interação se o plano inteiro está concluído
  const isPlanFinished = activePlan.status === "inativo";

  const handleToggleDay = (markAs: boolean) => {
    if (isPlanFinished) return; // não permite alterar plano já finalizado
    if (toggleDayMutation.isPending) return;
    // Só chama se o estado atual for diferente do desejado
    if (markAs !== isCurrentDayCompleted) {
      toggleDayMutation.mutate({ planId: activePlan.id, dayIndex: safeDayIndex });
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto px-4 md:px-0">

      {/* ── Header + seletor de dia ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader />

        <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-sm self-start md:self-auto">
          <div className="flex items-center gap-2 px-3">
            <CalendarDays size={17} className="text-indigo-600" />
            <span className="font-bold text-sm text-slate-800">
              {currentDayData?.dayName || `Dia ${safeDayIndex + 1}`}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline" size="icon" className="h-8 w-8 rounded-lg"
              onClick={() => setSelectedDay((d) => Math.max(0, d - 1))}
              disabled={safeDayIndex === 0}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline" size="icon" className="h-8 w-8 rounded-lg"
              onClick={() => setSelectedDay((d) => Math.min(totalDays - 1, d + 1))}
              disabled={safeDayIndex === totalDays - 1}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Banner de plano já finalizado ── */}
      {isPlanFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <Award size={22} className="text-emerald-500 shrink-0" />
          <p className="text-sm font-bold text-emerald-700">
            Semana Gabaritada! 🎉 Você concluiu todos os dias desta semana. Aguarde o próximo plano do seu professor.
          </p>
        </motion.div>
      )}

      {/* ── Card: Foco do Dia + Botões ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`focus-${safeDayIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bg-indigo-50/50 border border-indigo-100 p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between gap-8 items-center shadow-sm">

            {/* Foco */}
            <div className="flex gap-5 items-center flex-1">
              <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0 relative overflow-hidden">
                <Music size={32} className="relative z-10" />
                <Star size={13} className="absolute top-3 left-3 opacity-40" />
                <Star size={9} className="absolute bottom-4 right-4 opacity-40" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-600 mb-1">Foco do dia</p>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-2">
                  {currentDayData?.focus?.title || "Treino Prático"}
                </h2>
                <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-md">
                  {currentDayData?.focus?.description || "Siga os exercícios abaixo para concluir sua rotina de hoje."}
                </p>
              </div>
            </div>

            {/* Botões de treino */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto min-w-[300px]">
              <h3 className="text-center font-black text-slate-900 mb-1">Treinou hoje?</h3>
              <p className="text-xs text-center text-slate-500 mb-4 font-medium">
                Marque abaixo após concluir seu plano de estudo.
              </p>

              {isPlanFinished ? (
                <p className="text-center text-sm text-emerald-600 font-bold py-2">
                  ✅ Semana concluída com sucesso!
                </p>
              ) : (
                <div className="flex gap-3">
                  {/* SIM, TREINEI */}
                  <Button
                    className={cn(
                      "flex-1 h-12 font-bold rounded-xl transition-all border-2",
                      isCurrentDayCompleted
                        ? "bg-emerald-500 border-emerald-500 text-white cursor-default"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    )}
                    onClick={() => handleToggleDay(true)}
                    disabled={toggleDayMutation.isPending || isCurrentDayCompleted}
                  >
                    <CheckCircle2 size={17} className="mr-2" /> SIM, TREINEI
                  </Button>

                  {/* NÃO TREINEI — só ativo se o dia já foi marcado */}
                  <Button
                    variant="outline"
                    className={cn(
                      "h-12 font-bold rounded-xl border-2 px-5",
                      isCurrentDayCompleted
                        ? "border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100"
                        : "border-slate-200 text-slate-300 cursor-not-allowed"
                    )}
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

      {/* ── Lista de Exercícios ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`list-${safeDayIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="pt-2"
        >
          <div className="flex items-center gap-2 mb-5 px-1">
            <Music size={17} className="text-indigo-400" />
            <h3 className="font-bold text-slate-700">Seu plano de estudo</h3>
          </div>

          {/* Bug fix #5: guard para exercícios vazios */}
          {!currentDayData?.exercises || currentDayData.exercises.length === 0 ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-5 rounded-2xl text-amber-700">
              <AlertTriangle size={20} className="shrink-0" />
              <p className="text-sm font-medium">
                Nenhum exercício foi registrado para este dia. Aguarde o professor atualizar o plano.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {currentDayData.exercises.map((exercise: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Número + ícone + texto */}
                  <div className="flex items-center gap-4 w-full md:w-auto md:flex-1">
                    <span className="text-slate-300 font-black text-xl w-8 text-center shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                      <ExerciseIcon icon={exercise.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900">{exercise.title || "Exercício"}</h4>
                      <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{exercise.subtitle}</p>
                    </div>
                  </div>

                  {/* Duração */}
                  {exercise.duration && (
                    <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-bold shrink-0 self-start md:self-auto">
                      ⏱ {exercise.duration}
                    </div>
                  )}

                  {/* Pontos */}
                  {exercise.points && exercise.points.length > 0 && (
                    <div className="flex-1 text-sm text-slate-600 self-start min-w-[180px]">
                      <ul className="list-disc pl-4 space-y-1">
                        {exercise.points.map((point: string, pIdx: number) => (
                          <li key={pIdx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Banner Importante ── */}
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
          <Button className="bg-white text-violet-700 hover:bg-violet-100 border border-violet-200 shadow-sm font-bold rounded-xl shrink-0">
            <MessageCircle size={17} className="mr-2" /> Falar com o professor
          </Button>
        </div>
      )}

    </div>
  );
}

// ─── Sub-componente de cabeçalho ─────────────────────────────────────────────
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
