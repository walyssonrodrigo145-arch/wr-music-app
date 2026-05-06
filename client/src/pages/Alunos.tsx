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
    inativos: students.length - students.filter(s => s.status === "ativo").length - students.filter(s => s.status === "pausado").length,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-[#f8faff]">
      {/* TOP HEADER: Greeting & Search */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Olá, <span className="text-primary">WR!</span> Bem-vindo de volta.</h1>
          <p className="text-xs text-slate-400 font-medium">Gerencie seus alunos</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <Input 
              placeholder="Buscar aluno..." 
              className="pl-10 h-10 border-slate-100 bg-slate-50/50 rounded-xl focus:bg-white transition-all text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 text-slate-400">
             <button className="hover:text-primary transition-colors"><Clock size={20} /></button>
             <button className="hover:text-primary transition-colors"><X size={20} /></button>
             <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-white text-[10px] font-bold">WR</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-800 leading-none">WR</p>
                  <p className="text-[9px] text-slate-400 font-medium mt-1 uppercase">Admin</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
        {/* SECTION HEADER: Alunos & Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shadow-sm">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight leading-none">Alunos</h2>
              <p className="text-xs text-slate-400 font-medium mt-2">
                {stats.total} matrículas • {stats.ativos} ativos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <Input 
                  placeholder="Buscar aluno..." 
                  className="pl-9 h-10 border-slate-100 bg-white rounded-xl shadow-sm text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             <Button 
               onClick={() => { setEditStudent(null); setModalOpen(true); }}
               className="h-10 rounded-xl px-5 bg-primary hover:bg-primary/90 text-white text-xs font-bold gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
             >
               <Plus size={18} />
               Novo aluno
             </Button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total geral", count: stats.total, sub: "Matrículas", icon: Users, color: "text-blue-600", bg: "from-blue-50 to-white", border: "border-blue-100/50" },
            { label: "Ativos", count: stats.ativos, sub: "Alunos ativos", icon: CheckCircle2, color: "text-purple-600", bg: "from-purple-50 to-white", border: "border-purple-100/50" },
            { label: "Pausados", count: stats.pausados, sub: "Alunos pausados", icon: Clock, color: "text-red-600", bg: "from-red-50 to-white", border: "border-red-100/50" },
            { label: "Inativos", count: stats.inativos, sub: "Alunos inativos", icon: X, color: "text-emerald-600", bg: "from-emerald-50 to-white", border: "border-emerald-100/50" },
          ].map((item, i) => (
            <div key={i} className={cn("relative h-32 p-6 rounded-2xl bg-gradient-to-br border shadow-sm overflow-hidden group", item.bg, item.border)}>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm", item.color)}>
                    <item.icon size={18} />
                  </div>
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider opacity-60", item.color)}>{item.label}</p>
                    <p className="text-2xl font-black text-slate-800 leading-none">{item.count}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{item.sub}</p>
              </div>
              {/* Wave SVG Decorator */}
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-10 group-hover:opacity-20 transition-opacity">
                 <svg viewBox="0 0 100 40" className={cn("w-full h-full", item.color)} preserveAspectRatio="none">
                   <path d="M0 40 C 30 40, 40 10, 70 20 S 90 0, 100 10 V 40 H 0 Z" fill="currentColor" />
                 </svg>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* TABLE SECTION */}
          <div className="xl:col-span-9 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aluno</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instrumento / Nível</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensalidade</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 size={32} className="animate-spin text-primary/20 mx-auto" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-xs text-slate-400 font-medium italic">Nenhum aluno encontrado.</td></tr>
                  ) : (
                    filtered.map((student) => (
                      <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setDetailsStudentId(student.id)}>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm shrink-0">
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold uppercase">
                                {student.name.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-700 truncate">{student.name}</p>
                              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: student.instrumentColor || "#6366f1" }} />
                              <span className="text-xs font-semibold text-slate-600">{student.instrumentName}</span>
                            </div>
                            <LevelBadge level={student.level} />
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <p className="text-sm font-bold text-slate-700 leading-none">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1.5 uppercase">Dia {student.dueDay || 10}</p>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <StatusBadge
                            status={student.status}
                            id={student.id}
                            onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as any })}
                          />
                        </td>
                        <td className="px-8 py-4 text-right" onClick={e => e.stopPropagation()}>
                           <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-600">
                              <Filter size={18} />
                           </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination UI */}
            <div className="p-6 border-t border-slate-50 flex items-center justify-between bg-slate-50/20">
               <p className="text-[11px] text-slate-400 font-medium">Mostrando 1 a {filtered.length} de {stats.total} alunos</p>
               <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><ChevronDown className="rotate-90" size={14} /></Button>
                  <Button variant="ghost" className="h-8 w-8 text-xs font-bold bg-primary text-white hover:bg-primary">1</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><ChevronDown className="-rotate-90" size={14} /></Button>
               </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR Area */}
          <div className="xl:col-span-3 space-y-6">
             {/* Resumo Rápido Card */}
             <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Resumo rápido</h3>
                <div className="space-y-6">
                   <div className="h-20 w-full relative">
                      <svg viewBox="0 0 200 60" className="w-full h-full text-primary" preserveAspectRatio="none">
                        <path d="M0 60 C 20 50, 40 40, 60 45 S 80 20, 100 30 S 140 10, 160 15 S 180 30, 200 20 V 60 H 0 Z" fill="currentColor" fillOpacity="0.05" />
                        <path d="M0 60 C 20 50, 40 40, 60 45 S 80 20, 100 30 S 140 10, 160 15 S 180 30, 200 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                   </div>
                   
                   <div className="space-y-4 pt-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Novos alunos (30 dias)</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-black text-slate-800">2</span>
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">+ 100%</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Recebimentos (mês)</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-black text-slate-800">R$ 1.000,00</span>
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">+ 25%</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Taxa de ativos</p>
                          <span className="text-[11px] font-black text-primary">{stats.total > 0 ? Math.round((stats.ativos/stats.total)*100) : 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-primary" style={{ width: `${stats.total > 0 ? (stats.ativos/stats.total)*100 : 0}%` }} />
                        </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Lembretes Card */}
             <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-slate-800">Lembretes</h3>
                </div>
                <div className="space-y-3">
                   <div className="p-4 bg-red-50/50 border border-red-100/50 rounded-2xl group cursor-pointer hover:bg-red-50 transition-colors">
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-red-500 shrink-0">
                            <Plus size={16} />
                         </div>
                         <div>
                            <p className="text-[11px] font-bold text-slate-800">Mensalidades a receber</p>
                            <p className="text-[10px] text-red-500 font-bold mt-0.5">2 vencem hoje</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl group cursor-pointer hover:bg-blue-50 transition-colors">
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-blue-500 shrink-0">
                            <Users size={16} />
                         </div>
                         <div>
                            <p className="text-[11px] font-bold text-slate-800">Aulas hoje</p>
                            <p className="text-[10px] text-blue-500 font-bold mt-0.5">3 aulas agendadas</p>
                         </div>
                      </div>
                   </div>
                   
                   <button className="w-full py-2 text-[10px] font-bold text-primary hover:underline transition-all">
                     Ver todos lembretes {">"}
                   </button>
                </div>
             </div>
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
