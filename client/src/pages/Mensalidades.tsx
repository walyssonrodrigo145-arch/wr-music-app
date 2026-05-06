import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Plus, X,
  Loader2, Trash2, Lock, Info, Calendar, ChevronLeft, ChevronRight, Pencil, BarChart3, Filter
} from "lucide-react";
import { EditMensalidadeModal } from "@/components/modals/EditMensalidadeModal";
import { VencimentosReportModal } from "@/components/modals/VencimentosReportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    pago:     { label: "Pago",     cls: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: CheckCircle2 },
    pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-600 border-amber-100",   icon: Clock },
    atrasado: { label: "Atrasado", cls: "bg-red-50 text-red-600 border-red-100",           icon: AlertCircle },
  };
  const c = map[status] ?? map.pendente;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", c.cls)}>
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
  const [monthsCount, setMonthsCount] = useState(3);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleStudentChange = (id: string) => {
    const s = students.find(s => String(s.id) === id);
    set("studentId", id);
    if (s?.monthlyFee) set("amount", String(s.monthlyFee));
  };

  const generateMutation = trpc.paymentDues.generateMonthly.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} mensalidade(s) gerada(s)!`);
      utils.paymentDues.invalidate();
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <h3 className="text-sm font-bold text-foreground">Nova Mensalidade</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Aluno</label>
            <select value={form.studentId} onChange={e => handleStudentChange(e.target.value)}
              className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground">
              <option value="">Selecionar aluno...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Valor (R$)</label>
            <Input value={form.amount} onChange={e => set("amount", e.target.value)}
              type="number" className="h-9 text-xs rounded-lg bg-muted/10" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Dia de Vencimento</label>
            <div className="grid grid-cols-5 gap-2">
              {[5,10,15,20,25].map(d => (
                <button key={d} onClick={() => set("dueDay", String(d))}
                  className={cn(
                    "py-1.5 rounded-lg text-xs font-bold border transition-all",
                    form.dueDay === String(d)
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/40 text-muted-foreground hover:bg-muted/50"
                  )}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Mês inicial</label>
              <select value={form.startMonth} onChange={e => set("startMonth", e.target.value)}
                className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground">
                {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Ano</label>
              <select value={form.startYear} onChange={e => set("startYear", e.target.value)}
                className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground">
                {[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-3">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Geração recorrente (máx. 3 meses)</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setMonthsCount(n)}
                  className={cn(
                    "py-2 rounded-lg text-[10px] font-bold border transition-all",
                    monthsCount === n
                      ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                      : "border-indigo-100 text-indigo-400 hover:bg-indigo-100/50"
                  )}>
                  {n} {n === 1 ? "mês" : "meses"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border/40 bg-muted/5 flex gap-3">
          <Button variant="ghost" className="flex-1 h-9 text-xs font-bold" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-9 text-xs font-bold gap-2"
            onClick={handleSubmit} disabled={generateMutation.isPending}>
            {generateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            Gerar mensalidade
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

  const { data: payments = [], isLoading } = trpc.paymentDues.list.useQuery({ month: viewMonth, year: viewYear });
  const { data: students = [] } = trpc.students.list.useQuery();

  const markPaidMutation = trpc.paymentDues.markPaid.useMutation({
    onSuccess: () => { 
      toast.success("Pago!"); 
      utils.paymentDues.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteMutation = trpc.paymentDues.delete.useMutation({
    onSuccess: () => { 
      toast.success("Removido!"); 
      utils.paymentDues.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filtered = useMemo(() => {
    return payments.filter((p) => filterStatus === "todas" || p.status === filterStatus);
  }, [payments, filterStatus]);

  const totals = {
    total: payments.length,
    pago: payments.filter(p => p.status === "pago").length,
    recebido: payments.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.amount), 0),
    previsto: payments.reduce((acc, p) => acc + Number(p.amount), 0),
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6">
      {/* Header Compacto */}
      <div className="bg-background border-b border-border/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground leading-none">Mensalidades</h2>
            <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
              Controle financeiro mensal
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-muted/10 border border-border/40 rounded-lg p-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft size={14} /></Button>
            <span className="px-3 text-xs font-bold min-w-[100px] text-center">
              {MONTHS_PT[viewMonth - 1]} {viewYear}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight size={14} /></Button>
          </div>
          <div className="h-4 w-px bg-border/40 mx-1 hidden sm:block" />
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setReportOpen(true)}>
            <BarChart3 size={18} />
          </Button>
          <Button 
            onClick={() => setNovaOpen(true)}
            className="h-9 rounded-lg px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus size={16} />
            Gerar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas e Filtros */}
      <div className="px-6 py-6 flex flex-col lg:flex-row gap-6 shrink-0 bg-muted/5">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-1 gap-4">
          {[
            { label: "Recebido", value: totals.recebido, icon: CheckCircle2, bg: "bg-gradient-to-br from-emerald-600 to-emerald-500" },
            { label: "Previsto", value: totals.previsto, icon: DollarSign, bg: "bg-gradient-to-br from-blue-600 to-blue-500" },
            { label: "Atrasado", value: payments.filter(p => p.status === "atrasado").length, icon: AlertCircle, bg: "bg-gradient-to-br from-pink-600 to-pink-500", isCount: true },
            { label: "Pendente", value: payments.filter(p => p.status === "pendente").length, icon: Clock, bg: "bg-gradient-to-br from-purple-600 to-purple-500", isCount: true },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={cn("flex-1 min-w-[140px] p-5 rounded-2xl border-none shadow-lg relative overflow-hidden group", item.bg)}
              >
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20 text-white">
                    <Icon size={16} />
                  </div>
                  {item.label === "Recebido" && <div className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full">+12%</div>}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1 relative z-10">{item.label}</p>
                <p className="text-xl font-black text-white relative z-10">
                  {item.isCount ? item.value : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.value as number)}
                </p>
                
                {/* Visual accent line like in the image */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10" />
                <div className="absolute bottom-0 left-0 w-1/3 h-1 bg-white transition-all group-hover:w-full duration-500" />
              </div>
            );
          })}
        </div>
        
        <div className="lg:w-48 flex flex-col gap-2 justify-center border-l border-border/40 pl-0 lg:pl-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Filtrar status</p>
          <div className="flex flex-wrap lg:flex-col gap-1.5">
            {(["todas", "pendente", "pago", "atrasado"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-left flex items-center justify-between group",
                  filterStatus === s ? "bg-primary/5 text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {s === "todas" ? "Tudo" : s}
                <div className={cn("w-1.5 h-1.5 rounded-full transition-all", filterStatus === s ? "bg-primary scale-100" : "bg-transparent scale-0 group-hover:scale-100 group-hover:bg-muted-foreground/20")} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead className="bg-muted/20 border-b border-border/40 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider hidden sm:table-cell">Vencimento / Pgto</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center"><Loader2 size={24} className="animate-spin text-muted-foreground/20 mx-auto" /></td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-xs text-muted-foreground italic">Nenhuma mensalidade encontrada.</td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="group hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold uppercase">
                              {(p.studentName ?? "?")[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{p.studentName ?? "—"}</p>
                            {p.notes && <p className="text-[10px] text-muted-foreground/60 truncate italic">{p.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.amount))}
                        </p>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                            <Calendar size={11} className="opacity-40" />
                            <span>Vence: {new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR").slice(0,5)}</span>
                          </div>
                          {p.paidAt && (
                            <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-600">
                              <CheckCircle2 size={11} className="opacity-60" />
                              <span>Pago: {new Date(p.paidAt).toLocaleDateString("pt-BR").slice(0,5)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          {p.status !== "pago" && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-[10px] uppercase tracking-wider gap-1.5 border border-emerald-100"
                              onClick={() => markPaidMutation.mutate({ id: p.id })}
                            >
                              <CheckCircle2 size={12} /> Pago
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditPayment(p)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate({ id: p.id })}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {novaOpen && (
        <NovaModal open={novaOpen} onClose={() => setNovaOpen(false)} students={studentList} />
      )}
      {editPayment && (
        <EditMensalidadeModal open={!!editPayment} onClose={() => setEditPayment(null)} payment={editPayment} />
      )}
      {reportOpen && (
        <VencimentosReportModal open={reportOpen} onClose={() => setReportOpen(false)} month={viewMonth} year={viewYear} />
      )}
    </div>
  );
}
