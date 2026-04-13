import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Plus, X,
  Loader2, Trash2, Lock, Info, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type PaymentRow = {
  id: number; studentId: number | null; amount: string | number;
  dueDate: string | Date; paidAt?: Date | string | null;
  status: string; month: number; year: number;
  notes?: string | null; studentName?: string | null; studentPhone?: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pago:     { label: "Pago",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: Clock },
    atrasado: { label: "Atrasado", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",           icon: AlertCircle },
  };
  const c = map[status] ?? map.pendente;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", c.cls)}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

// ─── Modal Nova Mensalidade ────────────────────────────────────────────────────
function NovaModal({ open, onClose, students }: {
  open: boolean; onClose: () => void;
  students: { id: number; name: string; monthlyFee?: string | number | null }[];
}) {
  const utils = trpc.useUtils();
  const now = new Date();
  const [form, setForm] = useState({
    studentId: "",
    amount: "",
    dueDay: "10",
    startMonth: String(now.getMonth() + 1),
    startYear: String(now.getFullYear()),
    notes: "",
  });
  const [monthsCount, setMonthsCount] = useState(3); // travado em 3 meses
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-preencher valor ao selecionar aluno
  const handleStudentChange = (id: string) => {
    const s = students.find(s => String(s.id) === id);
    set("studentId", id);
    if (s?.monthlyFee) set("amount", String(s.monthlyFee));
  };

  const generateMutation = trpc.paymentDues.generateMonthly.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} mensalidade(s) gerada(s) com sucesso!`);
      utils.paymentDues.invalidate();
      utils.dashboard.invalidate();
      utils.reminders.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = () => {
    if (!form.studentId || !form.amount || !form.dueDay) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    generateMutation.mutate({
      studentId: Number(form.studentId),
      amount: Number(form.amount),
      dueDay: Number(form.dueDay),
      startMonth: Number(form.startMonth),
      startYear: Number(form.startYear),
      monthsCount,
      notes: form.notes.trim() || undefined,
    });
  };

  // Preview dos meses que serão gerados
  const previewMonths = Array.from({ length: monthsCount }, (_, i) => {
    let m = Number(form.startMonth) - 1 + i;
    const y = Number(form.startYear) + Math.floor(m / 12);
    m = m % 12;
    return `${MONTHS_FULL[m]}/${y}`;
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign size={15} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Nova Mensalidade</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Aluno */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Aluno *</label>
            <select value={form.studentId} onChange={e => handleStudentChange(e.target.value)}
              className="w-full h-10 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
              <option value="">Selecionar aluno...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Valor (R$) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R$</span>
              <Input value={form.amount} onChange={e => set("amount", e.target.value)}
                type="number" min="0" step="0.01" placeholder="0,00"
                className="h-10 text-sm rounded-xl pl-9" />
            </div>
          </div>

          {/* Dia de vencimento */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Dia de Vencimento *</label>
            <div className="grid grid-cols-7 gap-1">
              {[1,5,10,15,20,25,28].map(d => (
                <button key={d} onClick={() => set("dueDay", String(d))}
                  className={cn(
                    "py-2 rounded-xl text-xs font-semibold border transition-all",
                    form.dueDay === String(d)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}>
                  {d}
                </button>
              ))}
            </div>
            <Input value={form.dueDay} onChange={e => set("dueDay", e.target.value)}
              type="number" min="1" max="28" placeholder="Ou digite o dia..."
              className="h-9 text-sm rounded-xl mt-1" />
          </div>

          {/* Mês de início */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Mês inicial</label>
              <select value={form.startMonth} onChange={e => set("startMonth", e.target.value)}
                className="w-full h-10 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
                {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Ano</label>
              <select value={form.startYear} onChange={e => set("startYear", e.target.value)}
                className="w-full h-10 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground">
                {[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Quantidade de meses — TRAVADO em 3 */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Geração automática — máx. 3 meses</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setMonthsCount(n)}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-bold border transition-all",
                    monthsCount === n
                      ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                      : "border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  )}>
                  {n} {n === 1 ? "mês" : "meses"}
                </button>
              ))}
            </div>
            {/* Preview */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Info size={11} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Serão geradas mensalidades para: <strong>{previewMonths.join(", ")}</strong>.
                Duplicatas do mesmo mês/aluno são ignoradas automaticamente.
              </p>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Observações</label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Ex: Desconto aplicado, plano especial..." className="h-10 text-sm rounded-xl" />
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSubmit} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Gerar {monthsCount} {monthsCount === 1 ? "mensalidade" : "mensalidades"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Mensalidades() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState<string>("todas");
  const [novaOpen, setNovaOpen] = useState(false);

  const { data: payments, isLoading } = trpc.paymentDues.list.useQuery({ month: viewMonth, year: viewYear });
  const { data: students } = trpc.students.list.useQuery();

  const markPaidMutation = trpc.paymentDues.markPaid.useMutation({
    onSuccess: () => { 
      toast.success("Mensalidade marcada como paga!"); 
      utils.paymentDues.invalidate();
      utils.dashboard.invalidate();
      utils.reminders.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteMutation = trpc.paymentDues.delete.useMutation({
    onSuccess: () => { 
      toast.success("Mensalidade excluída!"); 
      utils.paymentDues.invalidate();
      utils.dashboard.invalidate();
      utils.reminders.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filtered = (payments ?? []).filter((p: PaymentRow) =>
    filterStatus === "todas" || p.status === filterStatus
  );

  const totals = {
    total: (payments ?? []).length,
    pago: (payments ?? []).filter((p: PaymentRow) => p.status === "pago").length,
    pendente: (payments ?? []).filter((p: PaymentRow) => p.status === "pendente").length,
    atrasado: (payments ?? []).filter((p: PaymentRow) => p.status === "atrasado").length,
    recebido: (payments ?? []).filter((p: PaymentRow) => p.status === "pago")
      .reduce((acc: number, p: PaymentRow) => acc + Number(p.amount), 0),
    previsto: (payments ?? []).reduce((acc: number, p: PaymentRow) => acc + Number(p.amount), 0),
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const studentList = (students ?? []).map((s: { id: number; name: string; monthlyFee?: string | number | null }) => ({
    id: s.id, name: s.name, monthlyFee: s.monthlyFee,
  }));

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <DollarSign size={20} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Mensalidades</h2>
            <p className="text-xs text-muted-foreground">Controle financeiro dos alunos</p>
          </div>
        </div>
        <Button className="gap-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setNovaOpen(true)}>
          <Plus size={15} /> Nova Mensalidade
        </Button>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-4">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-foreground">{MONTHS_FULL[viewMonth - 1]} {viewYear}</p>
          <p className="text-xs text-muted-foreground">{totals.total} mensalidades</p>
        </div>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Recebido", value: `R$ ${totals.recebido.toFixed(2).replace(".", ",")}`, icon: CheckCircle2, color: "emerald", sub: `${totals.pago} pagas` },
          { label: "Previsto", value: `R$ ${totals.previsto.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "blue", sub: `${totals.total} total` },
          { label: "Pendentes", value: String(totals.pendente), icon: Clock, color: "amber", sub: "aguardando" },
          { label: "Atrasadas", value: String(totals.atrasado), icon: AlertCircle, color: "red", sub: "em atraso" },
        ].map(card => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = {
            emerald: "bg-emerald-500/10 text-emerald-500",
            blue: "bg-blue-500/10 text-blue-500",
            amber: "bg-amber-500/10 text-amber-500",
            red: "bg-red-500/10 text-red-500",
          };
          return (
            <div key={card.label} className="bg-card rounded-2xl border border-border p-4">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", colorMap[card.color])}>
                <Icon size={16} />
              </div>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              <p className="text-[10px] text-muted-foreground">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["todas", "pendente", "pago", "atrasado"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              filterStatus === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:bg-muted"
            )}>
            {s === "todas" ? "Todas" : s.charAt(0).toUpperCase() + s.slice(1)}
            {" "}({s === "todas" ? totals.total : totals[s as keyof typeof totals] as number})
          </button>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 flex flex-col items-center text-muted-foreground">
          <DollarSign size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma mensalidade encontrada</p>
          <p className="text-xs mt-1">
            {filterStatus === "todas"
              ? 'Clique em "Nova Mensalidade" para começar'
              : "Tente outro filtro"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Aluno</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Valor</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Vencimento</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Pago em</th>
                  <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p: PaymentRow) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                          {(p.studentName ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{p.studentName ?? "—"}</p>
                          {p.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{p.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-foreground">
                        R$ {Number(p.amount).toFixed(2).replace(".", ",")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={11} />
                        {new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status !== "pago" && (
                          <button
                            onClick={() => markPaidMutation.mutate({ id: p.id })}
                            disabled={markPaidMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                          >
                            <CheckCircle2 size={11} /> Pago
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate({ id: p.id })}
                          disabled={deleteMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {novaOpen && (
        <NovaModal open={novaOpen} onClose={() => setNovaOpen(false)} students={studentList} />
      )}
    </div>
  );
}
