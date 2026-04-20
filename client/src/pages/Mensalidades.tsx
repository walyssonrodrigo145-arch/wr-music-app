import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Plus, X,
  Loader2, Trash2, Lock, Info, Calendar, ChevronLeft, ChevronRight, Pencil, BarChart3
} from "lucide-react";
import { EditMensalidadeModal } from "@/components/modals/EditMensalidadeModal";
import { VencimentosReportModal } from "@/components/modals/VencimentosReportModal";
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
    pago:     { label: "Pago",     cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", icon: CheckCircle2 },
    pendente: { label: "Pendente", cls: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",   icon: Clock },
    atrasado: { label: "Atrasado", cls: "bg-red-500/10 border-red-500/20 text-red-600 dark:bg-red-500/10 dark:text-red-400",           icon: AlertCircle },
  };
  const c = map[status] ?? map.pendente;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border", c.cls)}>
      <Icon size={12} strokeWidth={3} /> {c.label}
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
  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

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
    <div className="space-y-8 max-w-[1400px] mb-24 lg:mb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent p-6 md:p-8 rounded-[2rem] border border-border/40 shadow-sm relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20 flex-shrink-0">
            <DollarSign size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Mensalidades</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Controle financeiro</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 relative z-10">
          <Button 
            variant="outline" 
            className="h-14 w-full md:w-auto px-6 gap-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border-border/40 hover:bg-muted/50 transition-all hover:-translate-y-1 shadow-sm"
            onClick={() => setReportOpen(true)}
          >
            <BarChart3 size={18} strokeWidth={2.5} className="text-primary" /> Relatório
          </Button>
          <Button className="h-14 w-full md:w-auto px-8 gap-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-1"
            onClick={() => setNovaOpen(true)}>
            <Plus size={18} strokeWidth={3} /> Nova Mensalidade
          </Button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-card rounded-[2rem] border border-border/40 p-5 shadow-lg shadow-black/5">
        <button onClick={prevMonth} className="w-12 h-12 rounded-2xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95 border border-transparent hover:border-border/40">
          <ChevronLeft size={20} strokeWidth={3} />
        </button>
        <div className="text-center flex-1">
          <p className="text-2xl lg:text-3xl font-black text-foreground uppercase tracking-tighter">
            {MONTHS_FULL[viewMonth - 1]} <span className="text-muted-foreground/30 ml-2">{viewYear}</span>
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.3em]">{totals.total} registros encontrados</p>
          </div>
        </div>
        <button onClick={nextMonth} className="w-12 h-12 rounded-2xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95 border border-transparent hover:border-border/40">
          <ChevronRight size={20} strokeWidth={3} />
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {[
          { label: "Recebido", value: `R$ ${totals.recebido.toFixed(2).replace(".", ",")}`, icon: CheckCircle2, color: "emerald", sub: `${totals.pago} pagas`, gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20" },
          { label: "Previsto", value: `R$ ${totals.previsto.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "blue", sub: `${totals.total} total`, gradient: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20" },
          { label: "Pendentes", value: String(totals.pendente), icon: Clock, color: "amber", sub: "aguardando", gradient: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20" },
          { label: "Atrasadas", value: String(totals.atrasado), icon: AlertCircle, color: "red", sub: "em atraso", gradient: "from-red-500/20 via-red-500/5 to-transparent", border: "border-red-500/20" },
        ].map(card => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = {
            emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/10",
            blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/10",
            amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/10",
            red: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/10",
          };
          const textColorMap: Record<string, string> = {
            emerald: "text-emerald-700 dark:text-emerald-400",
            blue: "text-blue-700 dark:text-blue-400",
            amber: "text-amber-700 dark:text-amber-400",
            red: "text-red-700 dark:text-red-400",
          };
          return (
            <div key={card.label} className={cn("relative group overflow-hidden bg-card rounded-[2rem] border p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-opacity-50 shadow-sm", card.border)}>
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 z-0 transition-opacity group-hover:opacity-100", card.gradient)} />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-6">
                  <div className={cn("w-12 h-12 rounded-[1rem] flex items-center justify-center border shadow-inner backdrop-blur-md transition-transform group-hover:scale-110 group-hover:rotate-3", colorMap[card.color])}>
                    <Icon size={24} strokeWidth={2.5} />
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl bg-background/60 backdrop-blur-md border border-border/20 shadow-sm", textColorMap[card.color])}>
                    {card.label}
                  </span>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-black tracking-tighter text-foreground leading-none">{card.value}</p>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mt-3 bg-muted/40 inline-block px-2 py-1 rounded-md">{card.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap bg-muted/20 p-2 rounded-3xl border border-border/20">
        {(["todas", "pendente", "pago", "atrasado"] as const).map(s => {
           let colors = "";
           if (filterStatus === s) {
             if (s === "todas") colors = "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100 border-primary";
             if (s === "pendente") colors = "bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-100 border-amber-500";
             if (s === "pago") colors = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-100 border-emerald-500";
             if (s === "atrasado") colors = "bg-red-500 text-white shadow-lg shadow-red-500/20 scale-100 border-red-500";
           } else {
             colors = "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5";
           }
           
           return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border flex-1 md:flex-none text-center", colors)}>
              {s === "todas" ? "Todas" : s}
              <span className="ml-2 opacity-60">({s === "todas" ? totals.total : totals[s as keyof typeof totals] as number})</span>
            </button>
          )
        })}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 bg-card rounded-[2rem] border border-border/40 shadow-sm">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-[2rem] border border-border/40 p-24 flex flex-col items-center text-muted-foreground shadow-sm">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <DollarSign size={40} strokeWidth={2} className="opacity-30" />
          </div>
          <p className="text-xl font-black uppercase tracking-tight text-foreground">Aba vazia</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
            {filterStatus === "todas"
              ? 'Nenhuma mensalidade neste mês'
              : "Não há mensalidades com este status"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-[2rem] border border-border/40 overflow-hidden shadow-2xl shadow-primary/5">
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Aluno</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Valor</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Datas</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Status</th>
                  <th className="text-right text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((p: PaymentRow) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-base font-black text-primary border border-primary/10 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                          {(p.studentName ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground uppercase tracking-tight">{p.studentName ?? "—"}</p>
                          {p.notes && <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1 max-w-[150px] truncate">{p.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-base font-black text-foreground tracking-tighter">
                        R$ {Number(p.amount).toFixed(2).replace(".", ",")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                          <span className="w-14 text-muted-foreground/40">Vence:</span>
                          <Calendar size={12} className="text-primary/40" />
                          <span className="text-foreground">{new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR").slice(0,5)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                          <span className="w-14 text-muted-foreground/40">Pgto:</span>
                          <CheckCircle2 size={12} className={p.paidAt ? "text-emerald-500/60" : "text-border"} />
                          <span className={p.paidAt ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString("pt-BR").slice(0,5) : "—"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {p.status !== "pago" && (
                          <button
                            onClick={() => markPaidMutation.mutate({ id: p.id })}
                            disabled={markPaidMutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 border border-emerald-500/20"
                          >
                            <CheckCircle2 size={14} /> Pago
                          </button>
                        )}
                        <button
                          onClick={() => setEditPayment(p)}
                          className="flex items-center gap-1.5 w-10 h-10 justify-center rounded-xl text-[10px] font-black text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-blue-500/20"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate({ id: p.id })}
                          disabled={deleteMutation.isPending}
                          className="flex items-center gap-1.5 w-10 h-10 justify-center rounded-xl text-[10px] font-black text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
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

      {editPayment && (
        <EditMensalidadeModal 
          open={!!editPayment} 
          onClose={() => setEditPayment(null)} 
          payment={editPayment} 
        />
      )}

      {reportOpen && (
        <VencimentosReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          month={viewMonth}
          year={viewYear}
        />
      )}
    </div>
  );
}
