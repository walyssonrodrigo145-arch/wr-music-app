import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, Search, Guitar, Phone, Mail, Plus, Pencil, Trash2,
  CheckCircle2, X, Loader2, ChevronDown, Clock,
} from "lucide-react";
import { StudentDetailsModal } from "@/components/modals/StudentDetailsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type StudentRow = {
  id: number; name: string; email: string; phone?: string | null;
  level: string; status: string; monthlyFee: string; dueDay?: number | null;
  startDate?: string | null; instrumentName?: string | null;
  instrumentColor?: string | null; instrumentIcon?: string | null;
};

interface FormData {
  name: string;
  email: string;
  phone: string;
  instrumentId: string;
  level: "iniciante" | "intermediario" | "avancado";
  monthlyFee: string;
  dueDay: string;
  notes: string;
  status: "ativo" | "inativo" | "pausado";
}

const EMPTY_FORM: FormData = {
  name: "",
  email: "",
  phone: "",
  instrumentId: "",
  level: "iniciante",
  monthlyFee: "0",
  dueDay: "10",
  notes: "",
  status: "ativo",
};

// ─── Badges ───────────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    iniciante: { label: "Iniciante", className: "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400" },
    intermediario: { label: "Intermediário", className: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400" },
    avancado: { label: "Avançado", className: "bg-primary/10 border-primary/20 text-primary" },
  };
  const c = config[level] ?? config.iniciante;
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border", c.className)}>
      {c.label}
    </span>
  );
}

function StatusBadge({ status, id, onUpdate }: { status: string; id: number; onUpdate: (id: number, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg: Record<string, { cls: string; icon: any }> = {
    ativo: { cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
    pausado: { cls: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400", icon: Clock },
    inativo: { cls: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400", icon: X },
  };
  const c = cfg[status] ?? cfg.ativo;
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all active:scale-95 group/btn", c.cls)}
      >
        {status} <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 top-10 left-0 bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden min-w-[130px] p-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {(["ativo", "pausado", "inativo"] as const).map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onUpdate(id, s); setOpen(false); }}
              className={cn(
                "w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all mb-0.5 last:mb-0",
                s === status ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function StudentModal({
  open, onClose, editData, instruments,
}: {
  open: boolean;
  onClose: () => void;
  editData?: StudentRow | null;
  instruments: { id: number; name: string; color?: string | null }[];
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormData>(() =>
    editData
      ? {
          name: editData.name,
          email: editData.email,
          phone: editData.phone ?? "",
          instrumentId: "", 
          level: editData.level as FormData["level"],
          monthlyFee: String(Number(editData.monthlyFee)),
          dueDay: String(editData.dueDay || 10),
          notes: "",
          status: editData.status as FormData["status"],
        }
      : EMPTY_FORM
  );

  const [updateFutureDues, setUpdateFutureDues] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => {
      toast.success("Aluno cadastrado com sucesso!");
      utils.students.list.invalidate();
      utils.students.recent.invalidate();
      utils.dashboard.stats.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => {
      toast.success("Aluno atualizado com sucesso!");
      utils.students.list.invalidate();
      utils.students.recent.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim(),
      instrumentId: form.instrumentId ? Number(form.instrumentId) : undefined,
      level: form.level,
      monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
      dueDay: Number(form.dueDay),
      notes: form.notes.trim() || undefined,
      status: form.status,
    };
    if (editData) {
      updateMutation.mutate({ 
        id: editData.id, 
        ...payload,
        updateFutureDues 
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">{editData ? "Editar Aluno" : "Novo Aluno"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Nome completo *</label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: João da Silva" className="h-9 text-sm rounded-xl" />
          </div>
          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">E-mail</label>
            <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="joao@email.com (opcional)" type="email" className="h-9 text-sm rounded-xl" />
          </div>
          {/* Telefone */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Telefone / WhatsApp *</label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-sm rounded-xl" />
          </div>
          {/* Instrumento */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Instrumento</label>
            <select
              value={form.instrumentId}
              onChange={e => set("instrumentId", e.target.value)}
              className="w-full h-9 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
            >
              <option value="">Selecionar instrumento</option>
              {instruments.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          {/* Nível */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Nível</label>
            <select
              value={form.level}
              onChange={e => set("level", e.target.value as FormData["level"])}
              className="w-full h-9 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
            >
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Status do Aluno</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value as FormData["status"])}
              className="w-full h-9 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
            >
              <option value="ativo">Ativa / Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Mensalidade */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Mensalidade (R$)</label>
              <Input
                value={form.monthlyFee}
                onChange={e => set("monthlyFee", e.target.value)}
                placeholder="Ex: 150"
                type="number"
                min="0"
                step="0.01"
                className="h-9 text-sm rounded-xl"
              />
            </div>
            {/* Dia de Vencimento */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Dia de Vencimento</label>
              <select
                value={form.dueDay}
                onChange={e => set("dueDay", e.target.value)}
                className="w-full h-9 text-sm rounded-xl border border-border bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground font-bold"
              >
                <option value="5">Dia 05</option>
                <option value="10">Dia 10</option>
                <option value="15">Dia 15</option>
                <option value="20">Dia 20</option>
              </select>
            </div>
          </div>

          {/* Sincronização de Vencimentos Futuros */}
          {editData && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-primary italic uppercase tracking-wider">Sincronizar Vencimentos</p>
                <p className="text-[9px] text-muted-foreground leading-tight">Aplicar novo dia para meses futuros?</p>
              </div>
              <input 
                type="checkbox" 
                checked={updateFutureDues} 
                onChange={e => setUpdateFutureDues(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary outline-none"
              />
            </div>
          )}
          {/* Observações */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Anotações sobre o aluno..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 rounded-xl gap-2" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {editData ? "Salvar Alterações" : "Cadastrar Aluno"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel, isPending }: {
  name: string; onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">Excluir aluno?</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Tem certeza que deseja excluir <strong>{name}</strong>? Todas as aulas associadas também serão removidas. Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" className="flex-1 rounded-xl gap-2" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Alunos() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsStudentId, setDetailsStudentId] = useState<number | null>(null);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentRow | null>(null);

  const { data: students, isLoading } = trpc.students.list.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();

  const updateStatusMutation = trpc.students.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.students.list.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => {
      toast.success("Aluno excluído com sucesso!");
      utils.students.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDeleteStudent(null);
    },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  const filtered = (students ?? []).filter((s: StudentRow) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.instrumentName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    todos: students?.length ?? 0,
    ativo: students?.filter((s: StudentRow) => s.status === "ativo").length ?? 0,
    pausado: students?.filter((s: StudentRow) => s.status === "pausado").length ?? 0,
    inativo: students?.filter((s: StudentRow) => s.status === "inativo").length ?? 0,
  };

  const instrumentList = (instruments ?? []).map(i => ({
    id: i.id,
    name: i.name,
    color: i.color,
  }));

  return (
    <div className="space-y-8 max-w-[1400px] mb-24 lg:mb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent p-6 md:p-8 rounded-[2rem] border border-border/40 shadow-sm relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-[1.5rem] bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20 flex-shrink-0">
            <Users size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Alunos</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{students?.length ?? 0} Matrículas</p>
            </div>
          </div>
        </div>
        <Button
          className="h-14 w-full md:w-auto px-8 gap-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary hover:bg-primary/80 text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 relative z-10"
          onClick={() => { setEditStudent(null); setModalOpen(true); }}
        >
          <Plus size={18} strokeWidth={3} /> Novo Aluno
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {[
          { label: "Total Geral", value: String(statusCounts.todos), icon: Users, color: "primary", gradient: "from-primary/20 via-primary/5 to-transparent", border: "border-primary/20" },
          { label: "Ativos", value: String(statusCounts.ativo), icon: CheckCircle2, color: "emerald", gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20" },
          { label: "Pausados", value: String(statusCounts.pausado), icon: Clock, color: "amber", gradient: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20" },
          { label: "Inativos", value: String(statusCounts.inativo), icon: X, color: "red", gradient: "from-red-500/20 via-red-500/5 to-transparent", border: "border-red-500/20" },
        ].map(card => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = {
            primary: "bg-primary/20 text-primary border-primary/10",
            emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/10",
            amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/10",
            red: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/10",
          };
          const textColorMap: Record<string, string> = {
            primary: "text-primary",
            emerald: "text-emerald-700 dark:text-emerald-400",
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
                  <p className="text-3xl font-black tracking-tighter text-foreground leading-none">{card.value}</p>
                  <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-3">Registrados</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center w-full">
        <div className="relative flex-1 group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors">
            <Search size={20} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BUSCAR ALUNO..."
            className="w-full h-14 pl-14 pr-4 bg-card border border-border/40 rounded-2xl text-xs font-bold tracking-tight placeholder:text-muted-foreground/20 placeholder:font-black focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-lg shadow-primary/[0.01]"
          />
        </div>

        <div className="flex gap-2 flex-wrap bg-muted/20 p-2 rounded-[1.5rem] border border-border/20">
          {(["todos", "ativo", "pausado", "inativo"] as const).map(s => {
            let colors = "";
            if (statusFilter === s) {
              if (s === "todos") colors = "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100 border-primary";
              if (s === "pausado") colors = "bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-100 border-amber-500";
              if (s === "ativo") colors = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-100 border-emerald-500";
              if (s === "inativo") colors = "bg-red-500 text-white shadow-lg shadow-red-500/20 scale-100 border-red-500";
            } else {
              colors = "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5";
            }
            
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border flex-1 md:flex-none text-center", colors)}>
                {s === "todos" ? "Todos" : s}
                <span className="ml-2 opacity-60">({statusCounts[s]})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Student List */}
      <div className="bg-card rounded-[2rem] border border-border/40 overflow-hidden shadow-2xl shadow-primary/5">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-muted-foreground">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Users size={40} className="opacity-30" />
            </div>
            <p className="text-xl font-black uppercase tracking-tight text-foreground">Ninguém aqui</p>
            <p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
              {search ? "Tente ajustar a busca" : "Ainda nenhum aluno cadastrado"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Aluno</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5 hidden sm:table-cell">Instrumento & Nível</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5 hidden lg:table-cell">Financeiro</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Status</th>
                  <th className="text-right text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-6 py-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((student: StudentRow) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => setDetailsStudentId(student.id)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-base font-black text-white border border-primary/10 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10">
                          {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground uppercase tracking-tight">{student.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest truncate max-w-[120px]">{student.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden sm:table-cell">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: student.instrumentColor ?? "#6366f1" }} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{student.instrumentName ?? "—"}</span>
                        </div>
                        <LevelBadge level={student.level} />
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden lg:table-cell">
                      <div className="flex flex-col">
                        <span className="text-base font-black text-foreground tracking-tighter">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">Mensalidade</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge
                        status={student.status}
                        id={student.id}
                        onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as "ativo" | "inativo" | "pausado" })}
                      />
                    </td>
                    <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditStudent(student); setModalOpen(true); }}
                          className="w-10 h-10 rounded-xl bg-primary/5 hover:bg-primary hover:text-white text-primary transition-all active:scale-95 flex items-center justify-center border border-primary/10"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteStudent(student); }}
                          className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 transition-all active:scale-95 flex items-center justify-center border border-red-500/10"
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
        )}
      </div>

      {modalOpen && (
        <StudentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditStudent(null); }}
          editData={editStudent}
          instruments={instrumentList}
        />
      )}
      <StudentDetailsModal
        open={detailsStudentId !== null}
        onOpenChange={(open) => { 
          if (!open) setDetailsStudentId(null); 
        }}
        studentId={detailsStudentId}
        onEdit={() => {
          const s = students?.find(st => st.id === detailsStudentId);
          if (s) {
            setEditStudent(s);
            setModalOpen(true);
            setDetailsStudentId(null);
          }
        }}
        onDelete={() => {
          const s = students?.find(st => st.id === detailsStudentId);
          if (s) {
            setDeleteStudent(s);
            setDetailsStudentId(null);
          }
        }}
      />
      {deleteStudent && (
        <DeleteConfirm
          name={deleteStudent.name}
          onConfirm={() => deleteMutation.mutate({ id: deleteStudent.id })}
          onCancel={() => setDeleteStudent(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
