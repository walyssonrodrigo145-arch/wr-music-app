import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, Search, Plus, Pencil, Trash2,
  CheckCircle2, X, Loader2, ChevronDown, Clock, Filter,
} from "lucide-react";
import { StudentDetailsModal } from "@/components/modals/StudentDetailsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    iniciante: { label: "Iniciante", className: "bg-slate-50 text-slate-600 border-slate-100" },
    intermediario: { label: "Intermediário", className: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    avancado: { label: "Avançado", className: "bg-primary/5 text-primary border-primary/10" },
  };
  const c = config[level] ?? config.iniciante;
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", c.className)}>
      {c.label}
    </span>
  );
}

function StatusBadge({ status, id, onUpdate }: { status: string; id: number; onUpdate: (id: number, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg: Record<string, { cls: string }> = {
    ativo: { cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    pausado: { cls: "bg-amber-50 text-amber-600 border-amber-100" },
    inativo: { cls: "bg-red-50 text-red-600 border-red-100" },
  };
  const c = cfg[status] ?? cfg.ativo;
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all hover:bg-opacity-80", c.cls)}
      >
        {status} <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 top-8 right-0 bg-background border border-border/40 rounded-xl shadow-xl overflow-hidden min-w-[120px] p-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {(["ativo", "pausado", "inativo"] as const).map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onUpdate(id, s); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all mb-0.5 last:mb-0",
                s === status ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50"
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
      toast.success("Aluno cadastrado!");
      utils.students.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => {
      toast.success("Aluno atualizado!");
      utils.students.list.invalidate();
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
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <h3 className="text-sm font-bold text-foreground">{editData ? "Editar Aluno" : "Novo Aluno"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Nome completo</label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: João da Silva" className="h-9 text-xs rounded-lg bg-muted/10" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">E-mail</label>
              <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="Opcional" type="email" className="h-9 text-xs rounded-lg bg-muted/10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Telefone</label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-xs rounded-lg bg-muted/10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Instrumento</label>
              <select
                value={form.instrumentId}
                onChange={e => set("instrumentId", e.target.value)}
                className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
              >
                <option value="">Selecionar...</option>
                {instruments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Nível</label>
              <select
                value={form.level}
                onChange={e => set("level", e.target.value as FormData["level"])}
                className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Mensalidade (R$)</label>
              <Input
                value={form.monthlyFee}
                onChange={e => set("monthlyFee", e.target.value)}
                type="number"
                className="h-9 text-xs rounded-lg bg-muted/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Vencimento (Dia)</label>
              <select
                value={form.dueDay}
                onChange={e => set("dueDay", e.target.value)}
                className="w-full h-9 text-xs rounded-lg border border-border/40 bg-muted/10 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
              >
                {[5, 10, 15, 20, 25].map(d => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-border/40 bg-muted/5 flex gap-3">
          <Button variant="ghost" className="flex-1 h-9 text-xs font-bold" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-9 text-xs font-bold gap-2" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 size={12} className="animate-spin" />}
            {editData ? "Salvar alterações" : "Cadastrar aluno"}
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
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">Excluir aluno?</h3>
        <p className="text-xs text-muted-foreground mb-6">
          A exclusão de <strong>{name}</strong> é permanente e removerá todo o histórico.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 h-9 text-xs font-bold" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" className="flex-1 h-9 text-xs font-bold gap-2" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
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

  const { data: students = [], isLoading } = trpc.students.list.useQuery();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();

  const updateStatusMutation = trpc.students.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.students.list.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => {
      toast.success("Aluno removido!");
      utils.students.list.invalidate();
      setDeleteStudent(null);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filtered = useMemo(() => {
    return students
      .filter((s) => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.instrumentName ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "todos" || s.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, search, statusFilter]);

  const stats = {
    total: students.length,
    ativos: students.filter(s => s.status === "ativo").length,
    pausados: students.filter(s => s.status === "pausado").length,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6">
      {/* Header Compacto */}
      <div className="bg-background border-b border-border/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground leading-none">Alunos</h2>
            <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
              {stats.total} Matrículas • {stats.ativos} Ativos
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
            <Input
              placeholder="Buscar aluno..."
              className="pl-9 h-9 text-xs rounded-lg border-border/40 bg-muted/10 focus:bg-background transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button 
            onClick={() => { setEditStudent(null); setModalOpen(true); }}
            className="h-9 rounded-lg px-4 bg-primary text-white text-xs font-bold gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus size={16} />
            Novo aluno
          </Button>
        </div>
      </div>

      {/* Metrics Row (Subtle Cards) */}
      <div className="px-6 py-4 flex items-center gap-4 overflow-x-auto scrollbar-none shrink-0 bg-muted/5">
        {[
          { label: "Todos", count: stats.total, color: "text-primary", key: "todos" },
          { label: "Ativos", count: stats.ativos, color: "text-emerald-600", key: "ativo" },
          { label: "Pausados", count: stats.pausados, color: "text-amber-600", key: "pausado" },
          { label: "Inativos", count: students.length - stats.ativos - stats.pausados, color: "text-red-600", key: "inativo" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(item.key)}
            className={cn(
              "px-4 py-2 rounded-xl border transition-all flex items-center gap-3 shrink-0",
              statusFilter === item.key 
                ? "bg-background border-primary/20 shadow-sm ring-2 ring-primary/5" 
                : "bg-transparent border-border/40 text-muted-foreground hover:bg-background"
            )}
          >
            <span className={cn("text-xs font-bold", statusFilter === item.key ? item.color : "text-muted-foreground")}>{item.label}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-bold">{item.count}</span>
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead className="bg-muted/20 border-b border-border/40 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider hidden sm:table-cell">Instrumento / Nível</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider hidden lg:table-cell text-right">Mensalidade</th>
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
                    <td colSpan={5} className="py-16 text-center text-xs text-muted-foreground italic">Nenhum aluno encontrado.</td>
                  </tr>
                ) : (
                  filtered.map((student) => (
                    <tr 
                      key={student.id} 
                      className="group hover:bg-muted/5 transition-colors cursor-pointer"
                      onClick={() => setDetailsStudentId(student.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                              {student.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{student.name}</p>
                            <p className="text-[10px] text-muted-foreground/60 truncate">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: student.instrumentColor ?? "#6366f1" }} />
                            <span className="text-[11px] font-medium text-foreground">{student.instrumentName ?? "—"}</span>
                          </div>
                          <LevelBadge level={student.level} />
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-right">
                        <p className="text-sm font-bold text-foreground leading-none">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                        </p>
                        <p className="text-[9px] text-muted-foreground/40 font-medium mt-1 uppercase tracking-wider">Dia {student.dueDay || 10}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge
                          status={student.status}
                          id={student.id}
                          onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as any })}
                        />
                      </td>
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditStudent(student); setModalOpen(true); }}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteStudent(student)}>
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

      {modalOpen && (
        <StudentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditStudent(null); }}
          editData={editStudent}
          instruments={instruments}
        />
      )}
      <StudentDetailsModal
        open={detailsStudentId !== null}
        onOpenChange={(open) => { if (!open) setDetailsStudentId(null); }}
        studentId={detailsStudentId}
        onEdit={() => {
          const s = students.find(st => st.id === detailsStudentId);
          if (s) { setEditStudent(s); setModalOpen(true); setDetailsStudentId(null); }
        }}
        onDelete={() => {
          const s = students.find(st => st.id === detailsStudentId);
          if (s) { setDeleteStudent(s); setDetailsStudentId(null); }
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
