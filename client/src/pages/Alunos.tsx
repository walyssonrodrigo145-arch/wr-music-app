import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, Search, Guitar, Phone, Mail, Plus, Pencil, Trash2,
  CheckCircle2, X, Loader2, ChevronDown,
} from "lucide-react";
import { StudentDetailsModal } from "@/components/modals/StudentDetailsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type StudentRow = {
  id: number; name: string; email: string; phone?: string | null;
  level: string; status: string; monthlyFee: string;
  startDate?: string | null; instrumentName?: string | null;
  instrumentColor?: string | null; instrumentIcon?: string | null;
};

type FormData = {
  name: string; email: string; phone: string;
  instrumentId: string; level: "iniciante" | "intermediario" | "avancado";
  monthlyFee: string; notes: string;
  status: "ativo" | "inativo" | "pausado";
};

const EMPTY_FORM: FormData = {
  name: "", email: "", phone: "", instrumentId: "", level: "iniciante", monthlyFee: "", notes: "", status: "ativo",
};

// ─── Badges ───────────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    iniciante: { label: "Iniciante", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    intermediario: { label: "Intermediário", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    avancado: { label: "Avançado", className: "bg-primary/10 text-primary" },
  };
  const c = config[level] ?? config.iniciante;
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", c.className)}>{c.label}</span>;
}

function StatusBadge({ status, id, onUpdate }: { status: string; id: number; onUpdate: (id: number, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pausado: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    inativo: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity", cfg[status])}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)} <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute z-20 top-6 left-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[110px]">
          {(["ativo", "pausado", "inativo"] as const).map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onUpdate(id, s); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors", s === status && "bg-muted")}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
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
          notes: "",
          status: editData.status as FormData["status"],
        }
      : EMPTY_FORM
  );

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
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      instrumentId: form.instrumentId ? Number(form.instrumentId) : undefined,
      level: form.level,
      monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
      notes: form.notes.trim() || undefined,
      status: form.status,
    };
    if (editData) {
      updateMutation.mutate({ id: editData.id, ...payload });
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
            <label className="text-xs font-semibold text-foreground">E-mail *</label>
            <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="joao@email.com" type="email" className="h-9 text-sm rounded-xl" />
          </div>
          {/* Telefone */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Telefone / WhatsApp</label>
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
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Alunos</h2>
            <p className="text-xs text-muted-foreground">{students?.length ?? 0} alunos cadastrados</p>
          </div>
        </div>
        <Button
          className="gap-2 rounded-xl text-sm"
          onClick={() => { setEditStudent(null); setModalOpen(true); }}
        >
          <Plus size={15} /> Novo Aluno
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou instrumento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm rounded-xl border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["todos", "ativo", "pausado", "inativo"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum aluno encontrado</p>
            <p className="text-xs mt-1">
              {search ? "Tente ajustar a busca" : "Clique em \"Novo Aluno\" para começar"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Aluno</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Contato</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Instrumento</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Nível</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Mensalidade</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((student: StudentRow) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setDetailsStudentId(student.id)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-[10px] font-bold text-white">
                            {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{student.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Desde {student.startDate ? new Date(student.startDate).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Mail size={10} />
                          <span className="truncate max-w-[160px]">{student.email}</span>
                        </div>
                        {student.phone && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Phone size={10} />
                            <span>{student.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: student.instrumentColor ?? "#6366f1" }} />
                        <span className="text-xs text-foreground">{student.instrumentName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <LevelBadge level={student.level} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-semibold text-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={student.status}
                        id={student.id}
                        onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as "ativo" | "inativo" | "pausado" })}
                      />
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditStudent(student); setModalOpen(true); }}
                          className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteStudent(student); }}
                          className="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
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
