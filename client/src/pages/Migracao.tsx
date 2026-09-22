// ═══════════════════════════════════════════════════════════════════════════════
// MIGRAÇÃO ASSISTIDA — escolas que vêm de outro sistema
//   • Aulas: séries semanais em lote (quantidade individual por aluno)
//   • Mensalidades: plano INDIVIDUAL por aluno (padrão da operação como fallback),
//     valor do plano, saldo de meses e pendências passadas + próximos meses
//   • Importar: planilha CSV de aulas e de mensalidades (com prévia e relatório)
// Toda validação crítica acontece no backend; aqui só montamos a prévia.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseBRL } from "@/lib/money";
import { computeRemainingMonths, periodicityStep, resolveEffectivePlanId } from "@shared/billing";
import {
  Upload, CalendarPlus, Wallet, FileSpreadsheet, Download, Loader2,
  CheckCircle2, AlertTriangle, ArrowRight, Users, Sparkles, Copy,
} from "lucide-react";

type TabId = "aulas" | "mensalidades" | "importar";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

// Cartão premium padrão da página (glass + sombra suave da primária)
const CARD = "rounded-3xl border border-border/60 bg-card/40 backdrop-blur-xl shadow-xl shadow-primary/5";
const LABEL = "text-[10px] font-black uppercase tracking-widest text-muted-foreground";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function brl(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

interface SkipItem {
  studentId: number | null;
  studentName: string | null;
  scheduledAt?: string;
  month?: number | null;
  year?: number | null;
  reason: string;
}

// ─── Blocos visuais reutilizáveis ────────────────────────────────────────────
function StepHeader({ n, icon, title, hint }: { n: number; icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-6 w-6 shrink-0 rounded-lg bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center border border-primary/20">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-tight flex items-center gap-2">
          {icon}{title}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "primary" | "emerald" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest",
        tone === "primary" && "border-primary/25 bg-primary/5 text-primary",
        tone === "emerald" && "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
        tone === "default" && "border-border/60 bg-card/50 text-muted-foreground"
      )}
    >
      {label}
      <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}

function ResultPanel({ title, created, skipped, totalRequested }: {
  title: string;
  created: number;
  skipped: SkipItem[];
  totalRequested: number;
}) {
  const hasSkips = skipped.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl border p-5 space-y-3 backdrop-blur-xl shadow-xl",
        hasSkips
          ? "border-amber-500/25 bg-amber-500/[0.04] shadow-amber-500/5"
          : "border-emerald-500/25 bg-emerald-500/[0.04] shadow-emerald-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className={hasSkips ? "text-amber-500" : "text-emerald-500"} />
        <span className="text-sm font-black">{title}</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{created} criado(s)</span>
        <span className="text-muted-foreground">{skipped.length} pulado(s)</span>
        <span className="text-muted-foreground">de {totalRequested} solicitado(s)</span>
      </div>
      {hasSkips && (
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-amber-500/20 bg-amber-500/5 divide-y divide-border/40">
          {skipped.slice(0, 100).map((s, i) => (
            <div key={i} className="px-3 py-2 text-xs flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">{s.studentName || (s.studentId ? `Aluno #${s.studentId}` : "Item")}</strong>
                {s.scheduledAt ? ` · ${new Date(s.scheduledAt).toLocaleString("pt-BR")}` : ""}
                {s.month && s.year ? ` · ${String(s.month).padStart(2, "0")}/${s.year}` : ""}
                {" — "}{s.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Aba: Aulas (assistente em lote) ─────────────────────────────────────────
interface LessonConfig {
  weekday: number;
  time: string;
  duration: number;
  weeks: number;
}

function LessonsTab({ students }: { students: any[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [config, setConfig] = useState<Record<number, LessonConfig>>({});
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(12); // padrão global (fallback)
  const [result, setResult] = useState<any>(null);

  const [defaultWeekday, setDefaultWeekday] = useState(1);
  const [defaultTime, setDefaultTime] = useState("19:00");
  const [defaultDuration, setDefaultDuration] = useState(60);

  const filtered = useMemo(() => {
    const q = normName(search);
    return students.filter((s) => !q || normName(s.name).includes(q));
  }, [students, search]);

  const activeCount = students.filter((s) => s.status === "ativo").length;

  const mutation = trpc.lessons.migrateLessonsBatch.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      toast.success(`Migração concluída: ${data.created} aula(s) criada(s).`);
    },
    onError: (e) => toast.error("Erro na migração: " + e.message),
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 100) {
          toast.info("Limite de 100 alunos por operação — desmarque algum antes de adicionar outro.");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
    setConfig((prev) => prev[id] ? prev : { ...prev, [id]: { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration, weeks } });
  };

  const applyDefaultsToAll = () => {
    const next: Record<number, LessonConfig> = {};
    Array.from(selected).forEach((id) => {
      next[id] = { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration, weeks };
    });
    setConfig(next);
    toast.success("Padrão aplicado aos alunos selecionados.");
  };

  // Total = soma das quantidades INDIVIDUAIS (fallback no padrão global)
  const totalLessons = useMemo(() => {
    let total = 0;
    Array.from(selected).forEach((id) => {
      total += Math.max(1, Math.min(104, Math.floor(config[id]?.weeks ?? weeks)));
    });
    return total;
  }, [selected, config, weeks]);

  const handleGenerate = () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um aluno.");
    if (totalLessons > 500) return toast.error(`Esta operação geraria ${totalLessons} aulas (limite: 500). Reduza as semanas ou os alunos.`);
    setResult(null);
    mutation.mutate({
      items: Array.from(selected).map((id) => ({
        studentId: id,
        weekday: config[id]?.weekday ?? defaultWeekday,
        time: config[id]?.time ?? defaultTime,
        duration: config[id]?.duration ?? defaultDuration,
        weeks: Math.max(1, Math.min(104, Math.floor(config[id]?.weeks ?? weeks))),
      })),
      startDate,
      weeks: Math.min(104, Math.max(1, Math.floor(weeks) || 1)),
    });
  };

  return (
    <div className="space-y-5">
      <div className={cn(CARD, "p-5 space-y-4")}>
        <StepHeader
          n={1}
          icon={<Sparkles size={13} className="text-primary" />}
          title="Padrão das aulas"
          hint="O padrão só é aplicado ao marcar o aluno ou ao clicar em “Aplicar padrão aos selecionados”."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className={LABEL}>Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 sm:h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL}>Semanas (padrão)</Label>
            <Input type="number" min={1} max={104} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-11 sm:h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL}>Dia padrão</Label>
            <select
              value={defaultWeekday}
              onChange={(e) => setDefaultWeekday(Number(e.target.value))}
              className="w-full h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
            >
              {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL}>Hora / Duração</Label>
            <div className="flex gap-2">
              <Input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} className="h-11 sm:h-10 rounded-xl font-bold" />
              <Input type="number" min={15} max={240} value={defaultDuration} onChange={(e) => setDefaultDuration(Number(e.target.value))} className="h-11 sm:h-10 rounded-xl font-bold w-[4.5rem]" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={applyDefaultsToAll} className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest">
            Aplicar padrão aos selecionados
          </Button>
          <StatPill label="Alunos" value={students.length} />
          <StatPill label="Ativos" value={activeCount} tone="emerald" />
          <StatPill label="Selecionados" value={selected.size} tone="primary" />
          <StatPill label="Aulas previstas" value={totalLessons} />
        </div>
      </div>

      <div className={cn(CARD, "overflow-hidden")}>
        <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap bg-card/30">
          <Users size={15} className="text-primary" />
          <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-xl max-w-xs" />
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set(filtered.slice(0, 100).map((s) => s.id)))} className="h-10 text-[10px] font-black uppercase tracking-widest">
            Selecionar todos
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="h-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Limpar
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : filtered.map((s) => {
            const isSelected = selected.has(s.id);
            const cfg = config[s.id] ?? { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration, weeks };
            return (
              <div key={s.id} className={cn("p-3 sm:p-4 transition-colors", isSelected ? "bg-primary/[0.04]" : "hover:bg-muted/30")}>
                <div className="flex items-center gap-3 flex-wrap">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(s.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {s.status !== "ativo" ? "INATIVO · " : ""}
                      {isSelected ? `${Math.max(1, Math.min(104, Math.floor(cfg.weeks)))} aula(s)` : (s.phone || "sem telefone")}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
                      <select
                        value={cfg.weekday}
                        onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, weekday: Number(e.target.value) } }))}
                        className="h-10 rounded-xl border border-border bg-background px-2 text-xs font-bold"
                      >
                        {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <Input type="time" value={cfg.time} onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, time: e.target.value } }))} className="h-10 rounded-xl w-28 text-xs font-bold" />
                      <Input type="number" min={15} max={240} value={cfg.duration} onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, duration: Number(e.target.value) } }))} className="h-10 rounded-xl w-20 text-xs font-bold" title="Duração (min)" />
                      <Input
                        type="number" min={1} max={104}
                        value={cfg.weeks}
                        onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, weeks: Number(e.target.value) } }))}
                        className="h-10 rounded-xl w-20 text-xs font-bold"
                        title="Semanas/aulas deste aluno"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={mutation.isPending || selected.size === 0 || totalLessons > 500}
        className="h-12 w-full sm:w-auto px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/25"
      >
        {mutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CalendarPlus size={16} className="mr-2" />}
        Gerar {totalLessons > 0 ? `${totalLessons} ` : ""}aula(s)
      </Button>

      {result && (
        <>
          {Array.isArray(result.perStudent) && result.perStudent.length > 0 && (
            <div className={cn(CARD, "overflow-hidden")}>
              <div className="px-5 py-3 border-b border-border/50 bg-card/30">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumo por aluno</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Aluno", "Definido (aulas)", "Gerado"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.perStudent.map((p: any) => (
                      <tr key={p.studentId} className="border-b border-border/50">
                        <td className="px-4 py-2.5 font-medium">{p.studentName}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.requested}</td>
                        <td className="px-4 py-2.5 tabular-nums font-black text-emerald-600 dark:text-emerald-400">{p.generated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ResultPanel title="Aulas geradas" created={result.created} skipped={result.skipped || []} totalRequested={result.totalRequested} />
        </>
      )}
    </div>
  );
}

// ─── Aba: Mensalidades (assistente em lote) ──────────────────────────────────
function DuesTab({ students }: { students: any[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const now = new Date();
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [monthsCount, setMonthsCount] = useState(12);
  const [dueDay, setDueDay] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [planId, setPlanId] = useState<number | "">("");
  const [monthsTouched, setMonthsTouched] = useState(false);
  // Quantidade INDIVIDUAL por aluno (fallback: `monthsCount` global)
  const [monthsByStudent, setMonthsByStudent] = useState<Record<number, number>>({});
  // Plano INDIVIDUAL por aluno (ausente = herda o plano padrão da operação)
  const [planByStudent, setPlanByStudent] = useState<Record<number, number | "">>({});
  const [result, setResult] = useState<any>(null);

  const utils = trpc.useUtils();
  // Todos os planos: os ATIVOS entram nos selects; os arquivados servem para
  // exibir o "plano atual" do aluno na lista.
  const { data: plans = [], isError: plansError } = trpc.schoolPlans.list.useQuery();
  const activePlans = useMemo(() => (plans as any[]).filter((p) => p.ativo !== false), [plans]);
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const planById = useMemo(() => {
    const map = new Map<number, any>();
    for (const p of plans as any[]) map.set(Number(p.id), p);
    return map;
  }, [plans]);

  const studentById = useMemo(() => {
    const map = new Map<number, any>();
    for (const s of students) map.set(Number(s.id), s);
    return map;
  }, [students]);

  // Mensalidades já lançadas por aluno (para o saldo de meses do plano)
  const { data: counts = [], isLoading: countsLoading, isError: countsError } = trpc.paymentDues.countByStudents.useQuery(
    { studentIds: selectedIds },
    { enabled: selectedIds.length > 0 }
  );
  const countByStudent = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of counts as any[]) map.set(Number(c.studentId), Number(c.count));
    return map;
  }, [counts]);

  // Plano EFETIVO do aluno: escolha individual (inclusive "sem plano") > padrão
  const effectivePlanFor = (id: number): any | null => {
    const hasChoice = Object.prototype.hasOwnProperty.call(planByStudent, id);
    const choice = planByStudent[id];
    const planIdForStudent = resolveEffectivePlanId(
      hasChoice,
      choice == null || choice === "" ? null : Number(choice),
      planId === "" ? null : Number(planId)
    );
    return planIdForStudent != null ? planById.get(planIdForStudent) ?? null : null;
  };

  // Saldo de meses por aluno conforme o plano efetivo
  const remainingByStudent = useMemo(() => {
    const map = new Map<number, number>();
    for (const id of selectedIds) {
      const hasChoice = Object.prototype.hasOwnProperty.call(planByStudent, id);
      const choice = planByStudent[id];
      const effectiveId = resolveEffectivePlanId(
        hasChoice,
        choice == null || choice === "" ? null : Number(choice),
        planId === "" ? null : Number(planId)
      );
      const plan = effectiveId != null ? planById.get(effectiveId) ?? null : null;
      if (!plan) continue;
      const student = studentById.get(Number(id));
      const launched = countByStudent.get(Number(id)) ?? 0;
      const step = periodicityStep(student?.billingPeriodicity);
      map.set(Number(id), computeRemainingMonths(plan.duracaoMeses, launched, step));
    }
    return map;
  }, [selectedIds, planByStudent, planId, planById, countByStudent, studentById]);

  const allPlansComplete = useMemo(() => {
    if (selectedIds.length === 0) return false;
    return selectedIds.every((id) => remainingByStudent.get(Number(id)) === 0);
  }, [selectedIds, remainingByStudent]);

  // Sugere "mensalidades a gerar" pelo maior restante (não sobrescreve ajuste manual)
  useEffect(() => {
    if (monthsTouched) return;
    if (remainingByStudent.size === 0) return;
    let max = 0;
    remainingByStudent.forEach((v) => { if (v > max) max = v; });
    if (max <= 0) return;
    setMonthsCount(Math.min(12, Math.max(1, max)));
  }, [remainingByStudent, monthsTouched]);

  // Quantidade SUGERIDA por aluno: com plano → restante do plano; sem plano → padrão
  const suggestedMonths = (id: number): number => {
    const remaining = remainingByStudent.get(Number(id));
    if (remaining != null) return Math.min(12, Math.max(1, remaining));
    return Math.min(12, Math.max(1, monthsCount));
  };

  const applyMonthsToAll = () => {
    const value = Math.min(12, Math.max(1, monthsCount));
    const next: Record<number, number> = {};
    selectedIds.forEach((id) => { next[id] = value; });
    setMonthsByStudent(next);
    toast.success(`Aplicado ${value} mensalidade(s) a todos os selecionados.`);
  };

  const applyPlanToAll = () => {
    const next: Record<number, number | ""> = {};
    selectedIds.forEach((id) => { next[id] = planId; });
    setPlanByStudent(next);
    setMonthsByStudent({});
    toast.success(
      planId === ""
        ? "Padrão removido: cada aluno usa a própria mensalidade/plano."
        : "Plano padrão aplicado a todos os selecionados."
    );
  };

  const totalDuesPreview = useMemo(() => {
    let total = 0;
    for (const id of selectedIds) {
      const remaining = remainingByStudent.get(Number(id));
      // Plano completo não gera nada — não entra na prévia
      if (remaining === 0) continue;
      const suggested = remaining != null
        ? Math.min(12, Math.max(1, remaining))
        : Math.min(12, Math.max(1, monthsCount));
      const value = monthsByStudent[id] ?? suggested;
      total += Math.max(1, Math.min(12, Math.floor(value) || 1));
    }
    return total;
  }, [selectedIds, monthsByStudent, remainingByStudent, monthsCount]);

  const filtered = useMemo(() => {
    const q = normName(search);
    return students.filter((s) => !q || normName(s.name).includes(q));
  }, [students, search]);

  const mutation = trpc.paymentDues.migratePaymentDuesBatch.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      // Atualiza o saldo de meses exibido (as contagens mudaram)
      utils.paymentDues.countByStudents.invalidate();
      toast.success(`Migração concluída: ${data.created} mensalidade(s) criada(s).`);
    },
    onError: (e) => toast.error("Erro na migração: " + e.message),
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um aluno.");
    setResult(null);
    mutation.mutate({
      studentIds: Array.from(selected),
      startMonth,
      startYear,
      monthsCount: Math.min(12, Math.max(1, Math.floor(monthsCount) || 1)),
      dueDay: dueDay === "" ? undefined : Number(dueDay),
      amount: amount ? parseBRL(amount) : undefined,
      planId: planId === "" ? undefined : Number(planId),
      applyPlanToStudents: true,
      // Quantidade individual por aluno (ajustada ou sugerida)
      studentMonths: Array.from(selected).map((id) => ({
        studentId: id,
        monthsCount: Math.max(1, Math.min(12, Math.floor(monthsByStudent[id] ?? suggestedMonths(id)))),
      })),
      // Plano individual por aluno (null = sem plano → usa mensalidade/plano atual)
      studentPlans: Array.from(selected).map((id) => {
        const plan = effectivePlanFor(id);
        return { studentId: id, planId: plan ? Number(plan.id) : null };
      }),
    });
  };

  const planLabel = (p: any) => `${p.nome} — R$ ${brl(p.valorMensal)} · ${p.duracaoMeses} mês(es)`;

  return (
    <div className="space-y-5">
      <div className={cn(CARD, "p-5 space-y-4")}>
        <StepHeader
          n={1}
          icon={<Wallet size={13} className="text-primary" />}
          title="Plano padrão e período"
          hint="O plano individual de cada aluno (na lista abaixo) vence este padrão."
        />

        <div className="grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-4">
          <div className="space-y-1.5">
            <Label className={LABEL}>Plano padrão da operação (opcional)</Label>
            <div className="flex gap-2">
              <select
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value === "" ? "" : Number(e.target.value));
                  setMonthsTouched(false);
                  // Recalcula sugestões individuais; escolhas de plano por aluno permanecem
                  setMonthsByStudent({});
                }}
                className="w-full h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Sem plano padrão (usar mensalidade/plano de cada aluno)</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>{planLabel(p)}</option>
                ))}
              </select>
              <Button
                type="button" variant="outline"
                onClick={applyPlanToAll}
                disabled={selected.size === 0}
                className="h-11 sm:h-10 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
              >
                Aplicar a todos
              </Button>
            </div>
            {plansError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                Não foi possível carregar os planos. Recarregue a página e tente novamente.
              </p>
            )}
            {!plansError && activePlans.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                Nenhum plano ativo. Cadastre em Configurações → Planos e Bolsas para vincular os alunos.
              </p>
            )}
            {allPlansComplete && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                Todos os alunos selecionados já completaram o plano — não há mensalidades a gerar.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className={LABEL}>Mês inicial</Label>
              <Input type="number" min={1} max={12} value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="h-11 sm:h-10 rounded-xl font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Ano inicial</Label>
              <Input type="number" min={2000} max={2100} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className="h-11 sm:h-10 rounded-xl font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Mensalidades (padrão)</Label>
              <Input
                type="number" min={1} max={12} value={monthsCount}
                onChange={(e) => { setMonthsCount(Number(e.target.value)); setMonthsTouched(true); }}
                className="h-11 sm:h-10 rounded-xl font-bold"
              />
              <button
                type="button"
                onClick={applyMonthsToAll}
                disabled={selected.size === 0}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Aplicar a todos
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Vencimento (opcional)</Label>
              <Input type="number" min={1} max={31} placeholder="do aluno" value={dueDay} onChange={(e) => setDueDay(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 sm:h-10 rounded-xl font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Valor (opcional)</Label>
              <Input placeholder={planId === "" ? "do plano/aluno" : "do plano"} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 sm:h-10 rounded-xl font-bold" inputMode="decimal" />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Sparkles size={12} className="mt-0.5 shrink-0" />
          Com plano: o valor do plano vence e as mensalidades param ao completar a duração. Sem plano: mensalidade cadastrada → plano atual → valor informado. Competências já lançadas são ignoradas e nenhuma cobrança é emitida automaticamente.
        </p>
      </div>

      <div className={cn(CARD, "overflow-hidden")}>
        <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap bg-card/30">
          <StepHeader n={2} icon={<Users size={13} className="text-primary" />} title="Alunos e planos individuais" hint="Marque os alunos e escolha o plano de cada um na própria linha (abaixo do nome)." />
        </div>
        <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap">
          <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-xl max-w-xs" />
          <Button
            type="button" variant="ghost"
            onClick={() => {
              const ids = filtered.slice(0, 200).map((s) => s.id);
              setSelected(new Set(ids));
              if (filtered.length > 200) toast.info("Selecionados os primeiros 200 alunos (limite por operação).");
            }}
            className="h-10 text-[10px] font-black uppercase tracking-widest"
          >
            Selecionar todos
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="h-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Limpar
          </Button>
          <StatPill label="Selecionados" value={selected.size} tone="primary" />
          <StatPill label="Mensalidades previstas" value={totalDuesPreview} />
        </div>
        <div className="max-h-[480px] overflow-y-auto divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : filtered.map((s) => {
            const isSelected = selected.has(s.id);
            const fee = Number(s.monthlyFee) || 0;
            const launched = countByStudent.get(s.id) ?? 0;
            const remaining = remainingByStudent.get(Number(s.id));
            const choice = planByStudent[s.id];
            const shownPlanValue = choice !== undefined ? choice : (planId === "" ? "" : Number(planId));
            const currentPlan = s.schoolPlanId ? planById.get(Number(s.schoolPlanId)) : undefined;
            return (
              <div key={s.id} className={cn("p-3 sm:p-4 transition-colors", isSelected ? "bg-primary/[0.04]" : "hover:bg-muted/30")}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-bold truncate", s.status !== "ativo" && "text-muted-foreground")}>{s.name}</p>
                      {s.status !== "ativo" && (
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Inativo
                        </span>
                      )}
                      {currentPlan && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/25 bg-violet-500/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">
                          Atual: {currentPlan.nome}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                      {isSelected
                        ? countsError
                          ? "Não foi possível carregar as mensalidades"
                          : countsLoading
                            ? "Calculando mensalidades…"
                            : remaining != null
                              ? `Lançadas: ${launched} · ${remaining === 0 ? "PLANO COMPLETO" : `faltam ${remaining}`}`
                              : "Sem plano selecionado (usará mensalidade/valor informado)"
                        : fee > 0
                          ? `Mensalidade: R$ ${fee.toFixed(2)}${s.billingPeriodicity ? ` · ${s.billingPeriodicity}` : ""}`
                          : "Sem mensalidade cadastrada (usará o plano)"}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-3 sm:pl-8 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem] gap-3 sm:items-end">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label className={LABEL}>Plano individual</Label>
                        {choice === undefined && planId !== "" && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-violet-500">Herdando padrão</span>
                        )}
                      </div>
                      <select
                        value={shownPlanValue}
                        onChange={(e) => {
                          const value = e.target.value === "" ? "" : Number(e.target.value);
                          setPlanByStudent((prev) => ({ ...prev, [s.id]: value }));
                          setMonthsByStudent((prev) => {
                            const next = { ...prev };
                            delete next[s.id];
                            return next;
                          });
                        }}
                        className="w-full h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Sem plano (usar mensalidade/plano atual)</option>
                        {activePlans.map((p) => (
                          <option key={p.id} value={p.id}>{planLabel(p)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL}>Mensalidades</Label>
                      <Input
                        type="number" min={1} max={12}
                        value={remaining === 0 ? 0 : (monthsByStudent[s.id] ?? suggestedMonths(s.id))}
                        disabled={remaining === 0}
                        onChange={(e) => setMonthsByStudent((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                        className="h-11 sm:h-10 rounded-xl font-bold disabled:opacity-50"
                        title={remaining === 0 ? "Plano já completo — nada a gerar" : "Mensalidades a gerar para este aluno"}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={mutation.isPending || selected.size === 0 || allPlansComplete}
        className="h-12 w-full sm:w-auto px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/25"
      >
        {mutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Wallet size={16} className="mr-2" />}
        Gerar {totalDuesPreview > 0 ? `${totalDuesPreview} ` : ""}mensalidade(s)
      </Button>

      {result && (
        <>
          {Array.isArray((result as any).plansApplied) && (result as any).plansApplied.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-violet-500/25 bg-violet-500/[0.05] p-5 space-y-3 backdrop-blur-xl shadow-xl shadow-violet-500/5"
            >
              <p className="text-sm font-black text-violet-700 dark:text-violet-300 flex items-center gap-2">
                <Sparkles size={14} /> Plano(s) aplicado(s)
              </p>
              <div className="flex flex-wrap gap-2">
                {(result as any).plansApplied.map((p: any) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-background/60 px-3 py-1.5 text-[11px] font-bold">
                    <span className="text-violet-700 dark:text-violet-300">{p.nome}</span>
                    <span className="text-muted-foreground">R$ {brl(p.valorMensal)} · {p.duracaoMeses} mês(es)</span>
                    <span className="text-muted-foreground">· {p.students} aluno(s)</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {Array.isArray(result.perStudent) && result.perStudent.length > 0 && (
            <div className={cn(CARD, "overflow-hidden")}>
              <div className="px-5 py-3 border-b border-border/50 bg-card/30">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumo por aluno</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Aluno", "Plano", "Lançadas antes", "Restantes", "Definido", "Geradas"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.perStudent.map((p: any) => (
                      <tr key={p.studentId} className="border-b border-border/50">
                        <td className="px-4 py-2.5 font-medium">{p.studentName}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.planNome || "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.launchedBefore}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.remaining ?? "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.requested ?? "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums font-black text-emerald-600 dark:text-emerald-400">{p.generated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ResultPanel title="Mensalidades geradas" created={result.created} skipped={result.skipped || []} totalRequested={result.totalRequested} />
        </>
      )}
    </div>
  );
}

// ─── Aba: Importar planilhas ─────────────────────────────────────────────────
// Separador oficial: ponto e vírgula (como no modelo). Também aceita tabulação.
// NUNCA vírgula — evita quebrar valores decimais ("180,00") e nomes com vírgula.
function parseCsv(text: string): string[][] {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(line.includes(";") ? ";" : "\t").map((c) => c.trim()));
}

function isHeaderRow(parts: string[], expected: string[]): boolean {
  const first = normName(parts[0] || "");
  return expected.some((e) => first === normName(e));
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportTab({ students }: { students: any[] }) {
  const [lessonCsv, setLessonCsv] = useState("");
  const [duesCsv, setDuesCsv] = useState("");
  const [lessonResult, setLessonResult] = useState<any>(null);
  const [duesResult, setDuesResult] = useState<any>(null);
  // Linhas inválidas detectadas no cliente (mescladas ao relatório do backend)
  const lessonInvalidRef = useRef<SkipItem[]>([]);
  const duesInvalidRef = useRef<SkipItem[]>([]);

  const studentByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of students) {
      map.set(normName(s.name), s);
      if (s.email) map.set(String(s.email).toLowerCase().trim(), s);
      if (s.phone) map.set(String(s.phone).replace(/\D/g, ""), s);
    }
    return map;
  }, [students]);

  const findStudent = (key: string) => {
    const raw = String(key || "").trim();
    if (!raw) return null;
    return studentByKey.get(normName(raw)) || studentByKey.get(raw.toLowerCase()) || studentByKey.get(raw.replace(/\D/g, "")) || null;
  };

  const lessonsMutation = trpc.lessons.importLessonsRows.useMutation({
    onSuccess: (data: any) => {
      setLessonResult({ ...data, skipped: [...lessonInvalidRef.current, ...(data.skipped || [])] });
      toast.success(`Importação concluída: ${data.created} aula(s).`);
    },
    onError: (e) => toast.error("Erro na importação: " + e.message),
  });

  const duesMutation = trpc.paymentDues.importPaymentDuesRows.useMutation({
    onSuccess: (data: any) => {
      setDuesResult({ ...data, skipped: [...duesInvalidRef.current, ...(data.skipped || [])] });
      toast.success(`Importação concluída: ${data.created} mensalidade(s).`);
    },
    onError: (e) => toast.error("Erro na importação: " + e.message),
  });

  const importLessons = () => {
    const rows = parseCsv(lessonCsv);
    if (rows.length === 0) return toast.error("Cole ou envie a planilha de aulas.");
    const invalid: SkipItem[] = [];
    const payload: any[] = [];
    for (const parts of rows) {
      const [aluno, data, hora, duracao, titulo] = parts;
      if (isHeaderRow(parts, ["aluno", "aluno(a)"])) continue;
      if (parts.length < 3) { invalid.push({ studentId: null, studentName: aluno || null, reason: "Linha incompleta — use ; (ponto e vírgula) como separador." }); continue; }
      const student = findStudent(aluno || "");
      if (!student) { invalid.push({ studentId: null, studentName: aluno || null, reason: "Aluno não encontrado." }); continue; }
      if (!data || !hora) { invalid.push({ studentId: student.id, studentName: student.name, reason: "Data/hora ausente." }); continue; }
      const iso = `${data}T${hora.length === 5 ? hora : `${hora}:00`}:00-03:00`;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) { invalid.push({ studentId: student.id, studentName: student.name, reason: "Data/hora inválida." }); continue; }
      payload.push({
        studentId: student.id,
        scheduledAt: parsed.toISOString(),
        duration: Number(duracao) || 60,
        title: titulo || "Aula de Música",
      });
    }
    lessonInvalidRef.current = invalid;
    if (payload.length === 0) {
      setLessonResult({ created: 0, skipped: invalid, totalRequested: rows.length });
      return toast.error("Nenhuma linha válida para importar.");
    }
    setLessonResult(null);
    lessonsMutation.mutate({ rows: payload });
  };

  const importDues = () => {
    const rows = parseCsv(duesCsv);
    if (rows.length === 0) return toast.error("Cole ou envie a planilha de mensalidades.");
    const invalid: SkipItem[] = [];
    const payload: any[] = [];
    for (const parts of rows) {
      const [aluno, mes, ano, valor, vencimento, status] = parts;
      if (isHeaderRow(parts, ["aluno", "aluno(a)"])) continue;
      if (parts.length < 5) { invalid.push({ studentId: null, studentName: aluno || null, reason: "Linha incompleta — use ; (ponto e vírgula) como separador." }); continue; }
      const student = findStudent(aluno || "");
      if (!student) { invalid.push({ studentId: null, studentName: aluno || null, reason: "Aluno não encontrado." }); continue; }
      const m = Number(mes);
      const y = Number(ano);
      const amount = parseBRL(valor);
      if (!m || m < 1 || m > 12 || !y) { invalid.push({ studentId: student.id, studentName: student.name, reason: "Competência inválida (mês/ano)." }); continue; }
      if (amount <= 0) { invalid.push({ studentId: student.id, studentName: student.name, month: m, year: y, reason: "Valor inválido." }); continue; }
      const due = String(vencimento || "").includes("/")
        ? (() => { const [d, mm, yy] = String(vencimento).split("/"); return `${yy}-${mm}-${d}`; })()
        : String(vencimento);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { invalid.push({ studentId: student.id, studentName: student.name, month: m, year: y, reason: "Vencimento inválido (use AAAA-MM-DD)." }); continue; }
      payload.push({
        studentId: student.id,
        month: m,
        year: y,
        amount,
        dueDate: due,
        status: normName(status || "pendente") === "pago" ? "pago" : "pendente",
      });
    }
    duesInvalidRef.current = invalid;
    if (payload.length === 0) {
      setDuesResult({ created: 0, skipped: invalid, totalRequested: rows.length });
      return toast.error("Nenhuma linha válida para importar.");
    }
    setDuesResult(null);
    duesMutation.mutate({ rows: payload });
  };

  return (
    <div className="space-y-6">
      {/* Aulas */}
      <div className={cn(CARD, "p-5 space-y-4")}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <StepHeader n={1} icon={<FileSpreadsheet size={13} className="text-primary" />} title="Planilha de aulas" hint="Importa aulas já agendadas, com data e hora, para os alunos existentes." />
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="outline"
              onClick={() => downloadCsv("modelo-aulas.csv", "aluno;data;hora;duracao;titulo\nJoão Silva;2026-10-05;19:00;60;Aula de Violão\n")}
              className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <Download size={13} className="mr-2" /> Modelo
            </Button>
            <label className="h-10 px-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload size={13} /> Enviar CSV
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setLessonCsv(String(reader.result || ""));
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Colunas: <strong>aluno;data(AAAA-MM-DD);hora(HH:MM);duracao(min);titulo</strong> — o aluno pode ser identificado pelo nome, e-mail ou telefone.
        </p>
        <textarea
          value={lessonCsv}
          onChange={(e) => setLessonCsv(e.target.value)}
          placeholder={"João Silva;2026-10-05;19:00;60;Aula de Violão\nMaria Souza;2026-10-06;18:30;50;"}
          className="w-full min-h-28 rounded-2xl border border-border bg-background/60 p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button onClick={importLessons} disabled={lessonsMutation.isPending} className="h-11 w-full sm:w-auto px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20">
          {lessonsMutation.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          Importar aulas
        </Button>
        {lessonResult && <ResultPanel title="Aulas importadas" created={lessonResult.created} skipped={lessonResult.skipped || []} totalRequested={lessonResult.totalRequested} />}
      </div>

      {/* Mensalidades */}
      <div className={cn(CARD, "p-5 space-y-4")}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <StepHeader n={2} icon={<FileSpreadsheet size={13} className="text-primary" />} title="Planilha de mensalidades" hint="Migra o histórico financeiro, inclusive competências já pagas." />
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="outline"
              onClick={() => downloadCsv("modelo-mensalidades.csv", "aluno;mes;ano;valor;vencimento;status\nJoão Silva;9;2026;180,00;2026-09-10;pendente\nMaria Souza;8;2026;150,00;2026-08-10;pago\n")}
              className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <Download size={13} className="mr-2" /> Modelo
            </Button>
            <label className="h-10 px-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload size={13} /> Enviar CSV
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setDuesCsv(String(reader.result || ""));
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Colunas: <strong>aluno;mes;ano;valor;vencimento(AAAA-MM-DD);status(pendente|pago)</strong> — use para migrar o histórico (inclusive pagas).
        </p>
        <textarea
          value={duesCsv}
          onChange={(e) => setDuesCsv(e.target.value)}
          placeholder={"João Silva;9;2026;180,00;2026-09-10;pendente\nMaria Souza;8;2026;150,00;2026-08-10;pago"}
          className="w-full min-h-28 rounded-2xl border border-border bg-background/60 p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button onClick={importDues} disabled={duesMutation.isPending} className="h-11 w-full sm:w-auto px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20">
          {duesMutation.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          Importar mensalidades
        </Button>
        {duesResult && <ResultPanel title="Mensalidades importadas" created={duesResult.created} skipped={duesResult.skipped || []} totalRequested={duesResult.totalRequested} />}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function Migracao() {
  const [tab, setTab] = useState<TabId>("aulas");
  const { data: students = [], isLoading, isError } = trpc.students.list.useQuery();

  const activeCount = students.filter((s: any) => s.status === "ativo").length;

  const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "aulas", label: "Aulas (lote)", icon: <CalendarPlus size={15} /> },
    { id: "mensalidades", label: "Mensalidades (lote)", icon: <Wallet size={15} /> },
    { id: "importar", label: "Importar planilha", icon: <FileSpreadsheet size={15} /> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho premium */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl p-5 sm:p-7 shadow-2xl shadow-primary/5">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white flex items-center justify-center shadow-lg shadow-primary/30">
            <Upload size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Importação inteligente</p>
            <h1 className="font-outfit text-2xl md:text-3xl font-black tracking-tight mt-0.5">Migração de sistema</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Traga do seu sistema anterior as aulas agendadas e as mensalidades — em lote, com plano individual por aluno, sem digitar aluno por aluno.
            </p>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2 mt-4">
          <StatPill label="Alunos" value={students.length} />
          <StatPill label="Ativos" value={activeCount} tone="emerald" />
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
            <Sparkles size={11} /> Operação auditada
          </span>
        </div>
      </div>

      {/* Navegação segmentada */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl shadow-lg shadow-primary/5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
              tab === t.id
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Carregando alunos…</p>
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-rose-500/25 bg-rose-500/[0.04] p-8 text-center space-y-2 backdrop-blur-xl">
          <AlertTriangle className="mx-auto text-rose-500" size={28} />
          <p className="text-sm font-bold">Não foi possível carregar os alunos</p>
          <p className="text-xs text-muted-foreground">Verifique sua conexão e recarregue a página.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-3xl border border-border/60 bg-card/40 p-10 text-center space-y-2 backdrop-blur-xl">
          <Users className="mx-auto text-muted-foreground/40" size={32} />
          <p className="text-sm font-bold">Nenhum aluno cadastrado ainda</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">Cadastre ou importe os alunos primeiro (Alunos → Importar CSV) para depois migrar aulas e mensalidades.</p>
        </div>
      ) : (
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === "aulas" && <LessonsTab students={students} />}
          {tab === "mensalidades" && <DuesTab students={students} />}
          {tab === "importar" && <ImportTab students={students} />}
        </motion.div>
      )}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-2">
        <Copy size={11} /> As operações de migração ficam registradas para auditoria. Nenhuma cobrança é enviada automaticamente aos alunos.
      </p>
    </div>
  );
}
