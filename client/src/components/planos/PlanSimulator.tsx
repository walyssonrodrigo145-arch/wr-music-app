import { useId, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatBRL, parseBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  UNLIMITED_STUDENTS,
  computePlanRange,
  normalizeStudentCount,
  planExcessCap,
  planMaxAllowedStudents,
  recommendPlan,
  simulateMonthly,
  type SimPlan,
} from "@shared/planPricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MessageCircle, Sparkles, Users } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5533984055949?text=ola%20gostaria%20de%20um%20plano%20sob%20medida%20para%20minha%20escola";

const studentNumberFormatter = new Intl.NumberFormat("pt-BR");

function formatStudents(value: number): string {
  return studentNumberFormatter.format(value);
}

function limitLabel(plan: SimPlan): string {
  return plan.maxStudents >= UNLIMITED_STUDENTS ? "Alunos ilimitados" : `Até ${plan.maxStudents} alunos`;
}

function cardTotalLabel(plan: SimPlan, simulation: ReturnType<typeof simulateMonthly>, students: number): string {
  if (simulation.needsNegotiation) {
    return `Acima de ${formatStudents(planMaxAllowedStudents(plan))} alunos: negociação`;
  }
  if (simulation.exceedsLimit && !simulation.isExcessAllowed) {
    return `Não cobre ${formatStudents(students)} alunos`;
  }
  if (simulation.isUnlimited) {
    return `Total: ${formatBRL(simulation.total)}/mês`;
  }
  return `Total com ${formatStudents(students)} alunos: ${formatBRL(simulation.total)}/mês`;
}

function excessLabel(plan: SimPlan): string {
  return plan.allowExtraStudents
    ? `+ ${formatBRL(plan.extraStudentPrice)}/aluno excedente`
    : "Não aceita alunos excedentes";
}

function SimulatorSkeleton() {
  return (
    <section className="mt-12" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-8 w-96 max-w-full" />
      <div className="mt-6 overflow-hidden rounded-3xl border border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-5 w-64 max-w-full" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-14 w-28 rounded-2xl" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-4 border-t border-border/60 p-6 sm:p-8 md:border-l md:border-t-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

export default function PlanSimulator() {
  const inputId = useId();
  const { data: dbPlans, isLoading, isError, isFetching, refetch } = trpc.publicData.getSignupPlans.useQuery();

  const plans = useMemo<SimPlan[]>(
    () =>
      (dbPlans ?? [])
        .map((p) => ({
          id: p.id,
          name: p.name,
          priceMonthly: parseBRL(p.priceMonthly),
          maxStudents: Number(p.maxStudents) || 0,
          allowExtraStudents: Boolean(p.allowExtraStudents ?? true),
          extraStudentPrice: parseBRL(p.extraStudentPrice ?? 1.49),
          isPopular: Boolean(p.isPopular),
          order: p.order ?? 0,
        }))
        .filter((p) => p.maxStudents > 0 && p.priceMonthly > 0),
    [dbPlans]
  );

  const range = useMemo(() => computePlanRange(plans), [plans]);
  const [students, setStudents] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const studentCount = normalizeStudentCount(students ?? range.initial, range);

  const recommendation = useMemo(() => recommendPlan(plans, studentCount), [plans, studentCount]);
  const pinnedPlan = pinnedId ? plans.find((p) => p.id === pinnedId) ?? null : null;
  const selectedPlan = pinnedPlan ?? recommendation.plan;
  const selectedSimulation = selectedPlan ? simulateMonthly(selectedPlan, studentCount) : null;
  const blocked = Boolean(selectedPlan && selectedSimulation?.exceedsLimit && !selectedSimulation.isExcessAllowed);
  const needsNegotiation = Boolean(selectedSimulation?.needsNegotiation);
  const needsCustomQuote = needsNegotiation || (blocked && recommendation.needsCustomQuote);
  const ctaPlan = blocked ? recommendation.plan : selectedPlan;
  const inputValue = draft !== "" ? draft : String(studentCount);

  if (isLoading) return <SimulatorSkeleton />;

  if (isError) {
    return (
      <section className="mt-12 space-y-3 rounded-3xl border border-border/60 bg-card/50 p-6 text-center sm:p-8">
        <AlertCircle size={20} className="mx-auto text-muted-foreground" />
        <p className="text-sm font-bold">Não foi possível carregar os planos agora.</p>
        <Button
          variant="outline"
          className="rounded-xl font-bold"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
          Tentar novamente
        </Button>
      </section>
    );
  }

  if (plans.length === 0) return null;
  if (!selectedPlan || !selectedSimulation) return null;

  const handleInputChange = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === "") return;
    const parsed = Number(raw.replace(",", "."));
    if (Number.isFinite(parsed)) setStudents(normalizeStudentCount(parsed, range));
  };

  const handleSliderChange = (values: number[]) => {
    setDraft("");
    if (values.length > 0) setStudents(normalizeStudentCount(values[0], range));
  };

  return (
    <section className="mt-12" aria-labelledby="simulador-titulo">
      <div className="flex items-center gap-2 text-primary">
        <Users size={15} />
        <span className="text-[10px] font-black uppercase tracking-widest">Simulador de preços</span>
      </div>
      <h2 id="simulador-titulo" className="mt-2 font-outfit text-2xl font-extrabold tracking-tight sm:text-3xl">
        Calcule o valor para o tamanho da sua escola
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Informe quantos alunos ativos pagantes a escola tem e veja o valor mensal do plano — incluindo os alunos que
        passam do limite.
      </p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-xl shadow-primary/5">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 sm:p-8">
            <label htmlFor={inputId} className="font-outfit text-base font-extrabold sm:text-lg">
              Quantos alunos ativos pagantes sua escola tem?
            </label>
            <p className="mt-1 text-xs text-muted-foreground">Alunos bolsistas não entram na conta.</p>

            <div className="mt-5 flex items-end gap-2">
              <Input
                id={inputId}
                inputMode="numeric"
                autoComplete="off"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={() => setDraft("")}
                className="h-14 w-28 rounded-2xl border-border/70 bg-background/70 text-center font-outfit text-3xl font-extrabold"
                aria-describedby={`${inputId}-help`}
              />
              <span id={`${inputId}-help`} className="pb-3 text-sm font-bold text-muted-foreground">
                alunos
              </span>
            </div>

            <div className="mt-7">
              <Slider
                value={[studentCount]}
                min={range.min}
                max={range.max}
                step={range.step}
                onValueChange={handleSliderChange}
                aria-label="Quantidade de alunos ativos pagantes"
                aria-valuetext={`${studentCount} alunos`}
              />
              <div className="mt-2 flex justify-between text-[11px] font-bold text-muted-foreground">
                <span>{range.min}</span>
                <span>{range.max}+</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/20 p-6 sm:p-8 md:border-l md:border-t-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                Faixa: {limitLabel(selectedPlan).toLowerCase()}
              </span>
              {selectedPlan.isPopular ? <Badge>Mais escolhido</Badge> : null}
              {pinnedPlan && recommendation.plan && pinnedPlan.id !== recommendation.plan.id ? (
                <button
                  type="button"
                  onClick={() => setPinnedId(null)}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Usar plano recomendado ({recommendation.plan.name})
                </button>
              ) : null}
            </div>

            <p className="mt-2 font-outfit text-xl font-extrabold tracking-tight">{selectedPlan.name}</p>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              {needsNegotiation ? (
                <span className="font-outfit text-4xl font-black tracking-tight sm:text-5xl">Sob medida</span>
              ) : (
                <>
                  <span className="font-outfit text-4xl font-black tracking-tight sm:text-5xl">
                    {formatBRL(selectedSimulation.total)}
                  </span>
                  <span className="pb-1.5 text-sm font-bold text-muted-foreground">/mês</span>
                </>
              )}
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <p>
                Plano: <strong className="text-foreground">{formatBRL(selectedSimulation.basePrice)}</strong>/mês
              </p>
              {needsNegotiation ? (
                <p>Acima do limite de excedentes deste plano — proposta sob medida para a sua escola.</p>
              ) : selectedSimulation.isUnlimited ? (
                <p>Alunos ilimitados — sem cobrança por excedente.</p>
              ) : selectedSimulation.excessCount > 0 && selectedSimulation.isExcessAllowed ? (
                <p>
                  {selectedSimulation.excessCount}{" "}
                  {selectedSimulation.excessCount === 1 ? "aluno excedente" : "alunos excedentes"} ×{" "}
                  {formatBRL(selectedPlan.extraStudentPrice)} ={" "}
                  <strong className="text-foreground">{formatBRL(selectedSimulation.excessSubtotal)}</strong>/mês
                </p>
              ) : selectedSimulation.exceedsLimit && !selectedSimulation.isExcessAllowed ? (
                <p>Este plano não cobre essa quantidade de alunos.</p>
              ) : (
                <p>Dentro do limite do plano — sem alunos excedentes.</p>
              )}
              {planExcessCap(selectedPlan) !== null && selectedPlan.allowExtraStudents ? (
                <p>
                  Limite de excedentes deste plano: {formatStudents(planExcessCap(selectedPlan) as number)} alunos (até{" "}
                  {formatStudents(planMaxAllowedStudents(selectedPlan))} no total).
                </p>
              ) : null}
            </div>

            {needsNegotiation ? (
              <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-black text-primary">
                  Mais de {formatStudents(planMaxAllowedStudents(selectedPlan))} alunos neste plano
                </p>
                <p className="mt-1 text-muted-foreground">
                  Para esse tamanho, montamos um plano sob medida com condições especiais. Fale com um especialista
                  para negociar.
                </p>
              </div>
            ) : blocked ? (
              <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="font-black text-amber-700 dark:text-amber-400">
                  O plano {selectedPlan.name} não aceita alunos excedentes.
                </p>
                {recommendation.plan && !recommendation.needsCustomQuote ? (
                  <p className="mt-1 text-muted-foreground">
                    Plano recomendado:{" "}
                    <strong className="text-foreground">{recommendation.plan.name}</strong> —{" "}
                    {formatBRL(recommendation.plan.priceMonthly)}/mês ({limitLabel(recommendation.plan).toLowerCase()}).
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">Sua escola precisa de um plano sob medida.</p>
                )}
              </div>
            ) : null}

            <div className="mt-5">
              {ctaPlan && !needsCustomQuote ? (
                <Link href={`/cadastro?plan=${encodeURIComponent(ctaPlan.id)}`} className="block">
                  <Button className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                    Criar conta e testar grátis <ArrowRight size={15} className="ml-2" />
                  </Button>
                </Link>
              ) : (
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="block">
                  <Button variant="outline" className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-widest">
                    <MessageCircle size={15} className="mr-2" /> Falar com um especialista
                  </Button>
                </a>
              )}
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
              <li className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <CheckCircle2 size={13} className="shrink-0 text-primary" /> Sem taxa de implantação
              </li>
              <li className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <CheckCircle2 size={13} className="shrink-0 text-primary" /> Sem contrato — cancele quando quiser
              </li>
              <li className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <Sparkles size={13} className="shrink-0 text-primary" /> 7 dias grátis, sem cartão de crédito
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
        <h3 className="font-outfit text-lg font-extrabold tracking-tight">Todos os planos</h3>
        <p className="text-xs text-muted-foreground">Clique em um plano para simular com ele.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = selectedPlan.id === plan.id;
          const sim = simulateMonthly(plan, studentCount);
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPinnedId((current) => (current === plan.id ? null : plan.id))}
              aria-pressed={isSelected}
              className={cn(
                "rounded-2xl border bg-card/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50",
                isSelected ? "border-primary/60 ring-2 ring-primary/25" : "border-border/70"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-outfit text-sm font-extrabold">{plan.name}</p>
                {plan.isPopular ? <Badge>Mais escolhido</Badge> : null}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-outfit text-2xl font-black tracking-tight">
                  {formatBRL(plan.priceMonthly)}
                </span>
                <span className="pb-0.5 text-xs font-bold text-muted-foreground">/mês</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{limitLabel(plan)}</p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{excessLabel(plan)}</p>
              <p
                className={cn(
                  "mt-3 text-[11px] font-black uppercase tracking-widest",
                  sim.needsNegotiation || (sim.exceedsLimit && !sim.isExcessAllowed)
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                )}
              >
                {cardTotalLabel(plan, sim, studentCount)}
              </p>
              {sim.excessCount > 0 && sim.isExcessAllowed && !sim.needsNegotiation ? (
                <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                  {sim.excessCount} {sim.excessCount === 1 ? "excedente" : "excedentes"} ×{" "}
                  {formatBRL(plan.extraStudentPrice)}
                </p>
              ) : null}
              <p
                className={cn(
                  "mt-2 text-[10px] font-black uppercase tracking-widest",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isSelected ? "Selecionado" : "Simular este plano"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
