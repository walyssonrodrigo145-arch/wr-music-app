// ═══════════════════════════════════════════════════════════════════════════════
// MIGRAÇÃO ASSISTIDA — escolas que vêm de outro sistema
//   • Aulas: séries semanais em lote (vários alunos de uma vez)
//   • Mensalidades: pendências passadas + próximos meses (valor do plano/fallback)
//   • Importar: planilha CSV de aulas e de mensalidades (com prévia e relatório)
// Toda validação crítica acontece no backend; aqui só montamos a prévia.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseBRL } from "@/lib/money";
import { periodicityStep } from "@shared/billing";
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

interface SkipItem {
  studentId: number | null;
  studentName: string | null;
  scheduledAt?: string;
  month?: number | null;
  year?: number | null;
  reason: string;
}

function ResultPanel({ title, created, skipped, totalRequested }: {
  title: string;
  created: number;
  skipped: SkipItem[];
  totalRequested: number;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-500" />
        <span className="text-sm font-black">{title}</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{created} criado(s)</span>
        <span className="text-muted-foreground">{skipped.length} pulado(s)</span>
        <span className="text-muted-foreground">de {totalRequested} solicitado(s)</span>
      </div>
      {skipped.length > 0 && (
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
    </div>
  );
}

// ─── Aba: Aulas (assistente em lote) ─────────────────────────────────────────
function LessonsTab({ students }: { students: any[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [config, setConfig] = useState<Record<number, { weekday: number; time: string; duration: number }>>({});
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(12);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfig((prev) => prev[id] ? prev : { ...prev, [id]: { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration } });
  };

  const applyDefaultsToAll = () => {
    const next: Record<number, { weekday: number; time: string; duration: number }> = {};
    Array.from(selected).forEach((id) => {
      next[id] = { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration };
    });
    setConfig(next);
    toast.success("Horário padrão aplicado aos alunos selecionados.");
  };

  const totalLessons = selected.size * weeks;

  const handleGenerate = () => {
    if (selected.size === 0) return toast.error("Selecione pelo menos um aluno.");
    if (totalLessons > 500) return toast.error(`Esta operação geraria ${totalLessons} aulas (limite: 500). Reduza os alunos ou as semanas.`);
    setResult(null);
    mutation.mutate({
      items: Array.from(selected).map((id) => ({
        studentId: id,
        weekday: config[id]?.weekday ?? defaultWeekday,
        time: config[id]?.time ?? defaultTime,
        duration: config[id]?.duration ?? defaultDuration,
      })),
      startDate,
      weeks,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Semanas</Label>
            <Input type="number" min={1} max={104} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dia padrão</Label>
            <select
              value={defaultWeekday}
              onChange={(e) => setDefaultWeekday(Number(e.target.value))}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
            >
              {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hora / Duração</Label>
            <div className="flex gap-2">
              <Input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} className="h-10 rounded-xl font-bold" />
              <Input type="number" min={15} max={240} value={defaultDuration} onChange={(e) => setDefaultDuration(Number(e.target.value))} className="h-10 rounded-xl font-bold w-20" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={applyDefaultsToAll} className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest">
            Aplicar padrão aos selecionados
          </Button>
          <span className="text-xs text-muted-foreground">
            {students.length} aluno(s) ({activeCount} ativos) · {selected.size} selecionado(s) · {totalLessons} aula(s) previstas
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center gap-3 flex-wrap">
          <Users size={15} className="text-primary" />
          <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 rounded-xl max-w-xs" />
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set(filtered.map((s) => s.id)))} className="h-9 text-[10px] font-black uppercase tracking-widest">
            Selecionar todos
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="h-9 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Limpar
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : filtered.map((s) => {
            const isSelected = selected.has(s.id);
            const cfg = config[s.id] ?? { weekday: defaultWeekday, time: defaultTime, duration: defaultDuration };
            return (
              <div key={s.id} className={cn("p-3 sm:p-4 transition-colors", isSelected && "bg-primary/5")}>
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(s.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {s.status !== "ativo" ? "INATIVO · " : ""}{s.phone || "sem telefone"}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <select
                        value={cfg.weekday}
                        onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, weekday: Number(e.target.value) } }))}
                        className="h-9 rounded-xl border border-border bg-background px-2 text-xs font-bold"
                      >
                        {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <Input type="time" value={cfg.time} onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, time: e.target.value } }))} className="h-9 rounded-xl w-28 text-xs font-bold" />
                      <Input type="number" min={15} max={240} value={cfg.duration} onChange={(e) => setConfig((prev) => ({ ...prev, [s.id]: { ...cfg, duration: Number(e.target.value) } }))} className="h-9 rounded-xl w-20 text-xs font-bold" />
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
        disabled={mutation.isPending || selected.size === 0}
        className="h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest"
      >
        {mutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CalendarPlus size={16} className="mr-2" />}
        Gerar {totalLessons > 0 ? `${totalLessons} ` : ""}aula(s)
      </Button>

      {result && (
        <ResultPanel title="Aulas geradas" created={result.created} skipped={result.skipped || []} totalRequested={result.totalRequested} />
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
  const [result, setResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: plans = [], isError: plansError } = trpc.schoolPlans.list.useQuery({ somenteAtivos: true });
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

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

  const selectedPlan = useMemo(
    () => (plans as any[]).find((p) => Number(p.id) === Number(planId)) || null,
    [plans, planId]
  );

  const remainingByStudent = useMemo(() => {
    const map = new Map<number, number>();
    if (!selectedPlan) return map;
    const duration = Number(selectedPlan.duracaoMeses) || 0;
    for (const id of selectedIds) {
      const student = students.find((s) => Number(s.id) === id);
      const launched = countByStudent.get(id) ?? 0;
      // Cada fatura lançada cobre N meses conforme a periodicidade do aluno
      const step = periodicityStep(student?.billingPeriodicity);
      map.set(id, Math.max(0, duration - launched * step));
    }
    return map;
  }, [selectedPlan, selectedIds, countByStudent, students]);

  const allPlansComplete = useMemo(() => {
    if (!selectedPlan || selectedIds.length === 0) return false;
    return selectedIds.every((id) => (remainingByStudent.get(id) ?? 0) === 0);
  }, [selectedPlan, selectedIds, remainingByStudent]);

  // Sugere "mensalidades a gerar" pelo maior restante (não sobrescreve ajuste manual)
  useEffect(() => {
    if (!selectedPlan || monthsTouched) return;
    if (remainingByStudent.size === 0) return;
    let max = 0;
    remainingByStudent.forEach((v) => { if (v > max) max = v; });
    setMonthsCount(Math.min(12, Math.max(1, max)));
  }, [selectedPlan, remainingByStudent, monthsTouched]);

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
      monthsCount,
      dueDay: dueDay === "" ? undefined : Number(dueDay),
      amount: amount ? parseBRL(amount) : undefined,
      planId: planId === "" ? undefined : Number(planId),
      applyPlanToStudents: true,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        {/* Plano do aluno (vincula os selecionados e define valor/duração) */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plano do aluno (opcional)</Label>
          <select
            value={planId}
            onChange={(e) => { setPlanId(e.target.value === "" ? "" : Number(e.target.value)); setMonthsTouched(false); }}
            className="w-full sm:max-w-md h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Não vincular plano (usar mensalidade/plano atual do aluno)</option>
            {(plans as any[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} — R$ {Number(p.valorMensal).toFixed(2)} · {p.duracaoMeses} mês(es)
              </option>
            ))}
          </select>
          {selectedPlan && (
            <p className="text-[11px] text-violet-600 dark:text-violet-400 font-bold flex items-center gap-1.5">
              <Sparkles size={12} />
              Os alunos selecionados serão vinculados a este plano e as mensalidades sairão por R$ {Number(selectedPlan.valorMensal).toFixed(2)}.
            </p>
          )}
          {plansError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
              Não foi possível carregar os planos. Recarregue a página e tente novamente.
            </p>
          )}
          {!plansError && !selectedPlan && (plans as any[]).length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              Nenhum plano ativo. Cadastre em Configurações → Planos e Bolsas para vincular os alunos.
            </p>
          )}
          {allPlansComplete && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              Todos os alunos selecionados já completaram a duração deste plano — não há mensalidades a gerar.
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mês inicial</Label>
            <Input type="number" min={1} max={12} value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ano inicial</Label>
            <Input type="number" min={2000} max={2100} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className="h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {selectedPlan ? "Mensalidades a gerar" : "Meses"}
            </Label>
            <Input
              type="number" min={1} max={12} value={monthsCount}
              onChange={(e) => { setMonthsCount(Number(e.target.value)); setMonthsTouched(true); }}
              className="h-10 rounded-xl font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vencimento (opcional)</Label>
            <Input type="number" min={1} max={31} placeholder="do aluno" value={dueDay} onChange={(e) => setDueDay(e.target.value === "" ? "" : Number(e.target.value))} className="h-10 rounded-xl font-bold" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor (opcional)</Label>
            <Input placeholder={selectedPlan ? "do plano" : "do plano/aluno"} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-xl font-bold" inputMode="decimal" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Sparkles size={12} className="mt-0.5 shrink-0" />
          {selectedPlan
            ? `Com plano selecionado: o valor do plano vence, os alunos são vinculados a ele e só são geradas as mensalidades que faltam para completar a duração (${selectedPlan.duracaoMeses} meses).`
            : "Sem plano: o valor de cada aluno segue mensalidade cadastrada → plano atual → valor informado. Competências já lançadas são ignoradas."}
          {" "}Nenhuma cobrança é emitida automaticamente.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center gap-3 flex-wrap">
          <Wallet size={15} className="text-primary" />
          <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 rounded-xl max-w-xs" />
          <Button
            type="button" variant="ghost"
            onClick={() => {
              const ids = filtered.slice(0, 200).map((s) => s.id);
              setSelected(new Set(ids));
              if (filtered.length > 200) toast.info("Selecionados os primeiros 200 alunos (limite por operação).");
            }}
            className="h-9 text-[10px] font-black uppercase tracking-widest"
          >
            Selecionar todos
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="h-9 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Limpar
          </Button>
          <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : filtered.map((s) => {
            const isSelected = selected.has(s.id);
            const fee = Number(s.monthlyFee) || 0;
            const launched = countByStudent.get(s.id) ?? 0;
            const remaining = remainingByStudent.get(s.id);
            return (
              <label key={s.id} className={cn("flex items-center gap-3 p-3 sm:p-4 cursor-pointer transition-colors", isSelected && "bg-primary/5")}>
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(s.id)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {s.status !== "ativo" ? "INATIVO · " : ""}
                    {selectedPlan
                      ? countsError
                        ? "Não foi possível carregar as mensalidades"
                        : countsLoading
                          ? "Calculando mensalidades…"
                          : `Lançadas: ${launched} · ${remaining === 0 ? "PLANO COMPLETO" : `faltam ${remaining}`}`
                      : fee > 0
                        ? `Mensalidade: R$ ${fee.toFixed(2)}`
                        : "Sem mensalidade cadastrada (usará o plano)"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={mutation.isPending || selected.size === 0 || allPlansComplete}
        className="h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest"
      >
        {mutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Wallet size={16} className="mr-2" />}
        Gerar mensalidades
      </Button>

      {result && (
        <>
          {result.planApplied && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm">
              <p className="font-black text-violet-700 dark:text-violet-300">
                Plano aplicado: {result.planApplied.nome}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valor R$ {Number(result.planApplied.valorMensal).toFixed(2)} · {result.planApplied.duracaoMeses} mês(es) — alunos vinculados ao plano.
              </p>
            </div>
          )}

          {Array.isArray(result.perStudent) && result.perStudent.length > 0 && (
            <div className="rounded-3xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumo por aluno</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Aluno", "Lançadas antes", "Restantes", "Geradas"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.perStudent.map((p: any) => (
                      <tr key={p.studentId} className="border-b border-border/50">
                        <td className="px-4 py-2.5 font-medium">{p.studentName}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.launchedBefore}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.remaining ?? "—"}</td>
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
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            <span className="text-sm font-black">Planilha de aulas</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="outline"
              onClick={() => downloadCsv("modelo-aulas.csv", "aluno;data;hora;duracao;titulo\nJoão Silva;2026-10-05;19:00;60;Aula de Violão\n")}
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <Download size={13} className="mr-2" /> Modelo
            </Button>
            <label className="h-9 px-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-muted/40">
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
          className="w-full min-h-28 rounded-2xl border border-border bg-background p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button onClick={importLessons} disabled={lessonsMutation.isPending} className="h-11 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest">
          {lessonsMutation.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          Importar aulas
        </Button>
        {lessonResult && <ResultPanel title="Aulas importadas" created={lessonResult.created} skipped={lessonResult.skipped || []} totalRequested={lessonResult.totalRequested} />}
      </div>

      {/* Mensalidades */}
      <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            <span className="text-sm font-black">Planilha de mensalidades</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="outline"
              onClick={() => downloadCsv("modelo-mensalidades.csv", "aluno;mes;ano;valor;vencimento;status\nJoão Silva;9;2026;180,00;2026-09-10;pendente\nMaria Souza;8;2026;150,00;2026-08-10;pago\n")}
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <Download size={13} className="mr-2" /> Modelo
            </Button>
            <label className="h-9 px-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:bg-muted/40">
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
          className="w-full min-h-28 rounded-2xl border border-border bg-background p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button onClick={importDues} disabled={duesMutation.isPending} className="h-11 px-5 rounded-2xl font-black text-[11px] uppercase tracking-widest">
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

  const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "aulas", label: "Aulas (lote)", icon: <CalendarPlus size={15} /> },
    { id: "mensalidades", label: "Mensalidades (lote)", icon: <Wallet size={15} /> },
    { id: "importar", label: "Importar planilha", icon: <FileSpreadsheet size={15} /> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Upload className="text-primary" /> Migração de sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Traga do seu sistema anterior as aulas já agendadas e as mensalidades em aberto/futuras — em lote, sem digitar aluno por aluno.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-colors",
              tab === t.id ? "bg-primary text-white border-primary shadow" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center space-y-2">
          <AlertTriangle className="mx-auto text-rose-500" size={28} />
          <p className="text-sm font-bold">Não foi possível carregar os alunos</p>
          <p className="text-xs text-muted-foreground">Verifique sua conexão e recarregue a página.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center space-y-2">
          <Users className="mx-auto text-muted-foreground/40" size={32} />
          <p className="text-sm font-bold">Nenhum aluno cadastrado ainda</p>
          <p className="text-xs text-muted-foreground">Cadastre ou importe os alunos primeiro (Alunos → Importar CSV) para depois migrar aulas e mensalidades.</p>
        </div>
      ) : (
        <>
          {tab === "aulas" && <LessonsTab students={students} />}
          {tab === "mensalidades" && <DuesTab students={students} />}
          {tab === "importar" && <ImportTab students={students} />}
        </>
      )}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-2">
        <Copy size={11} /> As operações de migração ficam registradas para auditoria. Nenhuma cobrança é enviada automaticamente aos alunos.
      </p>
    </div>
  );
}
