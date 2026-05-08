import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { format, isSameDay, startOfDay } from "date-fns";
import {
  Users, Search, Plus, Pencil, Trash2,
  CheckCircle2, X, Loader2, ChevronDown, Clock, Filter, MoreVertical, Bell, TrendingUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StudentDetailsModal } from "@/components/modals/StudentDetailsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
    iniciante: { label: "Iniciante", className: "bg-muted text-muted-foreground border-border" },
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
  const [generatePortalAccess, setGeneratePortalAccess] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const enableAccessMutation = trpc.students.enablePortalAccess.useMutation({
    onSuccess: (data) => {
      setCredentials(data);
      utils.students.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao liberar acesso: " + e.message),
  });

  const createMutation = trpc.students.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Aluno cadastrado!");
      if (generatePortalAccess && data.studentId) {
        enableAccessMutation.mutate({ studentId: data.studentId });
      } else {
        utils.students.list.invalidate();
        onClose();
      }
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

          {!editData && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between group cursor-pointer" onClick={() => setGeneratePortalAccess(!generatePortalAccess)}>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Liberar Portal?</p>
                <p className="text-[9px] text-muted-foreground font-medium">Gera e-mail e senha automaticamente</p>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full p-1 transition-all duration-300",
                generatePortalAccess ? "bg-indigo-600" : "bg-slate-200"
              )}>
                <div className={cn(
                  "w-3 h-3 bg-white rounded-full transition-all duration-300",
                  generatePortalAccess ? "translate-x-5" : "translate-x-0"
                )} />
              </div>
            </div>
          )}
        </div>

        {/* Credentials Feedback */}
        {credentials && (
          <div className="absolute inset-0 z-[60] bg-background flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
             <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
             </div>
             <h4 className="text-lg font-black text-foreground">Acesso Criado!</h4>
             <p className="text-xs text-muted-foreground mt-2 mb-6">O aluno foi cadastrado e o acesso ao portal liberado.</p>
             
             <div className="w-full bg-muted/50 p-4 rounded-2xl border border-border text-left space-y-3 mb-6">
                <div>
                   <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">E-mail</p>
                   <p className="text-xs font-black text-foreground">{credentials.email}</p>
                </div>
                <div>
                   <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Senha</p>
                   <p className="text-base font-black text-primary tracking-widest">{credentials.password}</p>
                </div>
             </div>
             
             <Button className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest" onClick={onClose}>
                Concluir Cadastro
             </Button>
          </div>
        )}
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
  const { data: dashboardStats } = trpc.dashboard.stats.useQuery();
  const { data: overduePayments = [] } = trpc.paymentDues.overdue.useQuery();
  const { data: upcomingLessons = [] } = trpc.lessons.upcoming.useQuery();

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
      .filter((s: StudentRow) => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.instrumentName ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "todos" || s.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a: StudentRow, b: StudentRow) => a.name.localeCompare(b.name));
  }, [students, search, statusFilter]);

  const stats = {
    total: students.length,
    ativos: students.filter((s: any) => s.status === "ativo").length,
    pausados: students.filter((s: any) => s.status === "pausado").length,
    inativos: students.length - students.filter((s: any) => s.status === "ativo").length - students.filter((s: any) => s.status === "pausado").length,
  };

  const newStudentsLast30Days = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return students.filter((s: any) => s.startDate && new Date(s.startDate) >= thirtyDaysAgo).length;
  }, [students]);

  const lessonsToday = useMemo(() => {
    const today = startOfDay(new Date());
    return upcomingLessons.filter(l => isSameDay(new Date(l.scheduledAt), today)).length;
  }, [upcomingLessons]);

  const activeRate = stats.total > 0 ? Math.round((stats.ativos / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-[#f8faff] relative">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 scrollbar-thin no-scrollbar">
        {/* SECTION HEADER: Alunos & Action */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-6">
          <div className="flex items-center gap-3 lg:gap-4 w-full md:w-auto">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shadow-sm shrink-0">
              <Users size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight leading-none">Alunos</h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium mt-1 lg:mt-2">
                {stats.total} matrículas • {stats.ativos} ativos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-9 h-10 border-border bg-card rounded-xl shadow-sm text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             <Button 
               onClick={() => { setEditStudent(null); setModalOpen(true); }}
               className="h-10 rounded-xl px-4 lg:px-5 bg-primary hover:bg-primary/90 text-white text-xs font-bold gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 shrink-0"
             >
               <Plus size={18} />
               <span className="hidden sm:inline">Novo aluno</span>
             </Button>
          </div>
        </div>

        {/* METRICS CARDS - Horizontal Scroll on Mobile */}
        <div className="flex overflow-x-auto lg:grid lg:grid-cols-4 gap-4 lg:gap-6 pb-2 lg:pb-0 no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
          {[
            { label: "Total", count: stats.total, sub: "Matrículas", icon: Users, color: "text-blue-600", bg: "from-blue-50 to-white", border: "border-blue-100/50" },
            { label: "Ativos", count: stats.ativos, sub: "Regulares", icon: CheckCircle2, color: "text-purple-600", bg: "from-purple-50 to-white", border: "border-purple-100/50" },
            { label: "Pausados", count: stats.pausados, sub: "Em pausa", icon: Clock, color: "text-red-600", bg: "from-red-50 to-white", border: "border-red-100/50" },
            { label: "Inativos", count: stats.inativos, sub: "Desligados", icon: X, color: "text-emerald-600", bg: "from-emerald-50 to-white", border: "border-emerald-100/50" },
          ].map((item, i) => (
            <div key={i} className={cn("relative min-w-[140px] flex-1 lg:h-32 p-4 lg:p-6 rounded-2xl bg-gradient-to-br border shadow-sm overflow-hidden group shrink-0", item.bg, item.border)}>
              <div className="relative z-10">
                <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-4">
                  <div className={cn("w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center bg-card shadow-sm shrink-0", item.color)}>
                    <item.icon size={16} />
                  </div>
                  <div>
                    <p className={cn("text-[8px] lg:text-[10px] font-bold uppercase tracking-wider opacity-60", item.color)}>{item.label}</p>
                    <p className="text-lg lg:text-2xl font-black text-foreground leading-none">{item.count}</p>
                  </div>
                </div>
                <p className="text-[8px] lg:text-[10px] text-muted-foreground font-medium">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* TABLE / CARD SECTION */}
          <div className="xl:col-span-9 bg-card lg:rounded-[2rem] border-0 lg:border border-border lg:shadow-sm overflow-hidden flex flex-col -mx-4 lg:mx-0">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aluno</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Instrumento / Nível</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mensalidade</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 size={32} className="animate-spin text-primary/20 mx-auto" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-xs text-muted-foreground font-medium italic">Nenhum aluno encontrado.</td></tr>
                  ) : (
                    filtered.map((student: StudentRow) => (
                      <tr key={student.id} className="group hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setDetailsStudentId(student.id)}>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm shrink-0">
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold uppercase">
                                {student.name.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{student.name}</p>
                              <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: student.instrumentColor || "#6366f1" }} />
                              <span className="text-xs font-semibold text-muted-foreground">{student.instrumentName}</span>
                            </div>
                            <LevelBadge level={student.level} />
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <p className="text-sm font-bold text-foreground leading-none">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium mt-1.5 uppercase">Dia {student.dueDay || 10}</p>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <StatusBadge
                            status={student.status}
                            id={student.id}
                            onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as any })}
                          />
                        </td>
                        <td className="px-8 py-4 text-right" onClick={e => e.stopPropagation()}>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-muted-foreground">
                                    <MoreVertical size={18} />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                 <DropdownMenuItem onClick={() => { setEditStudent(student); setModalOpen(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    <span>Editar</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem variant="destructive" onClick={() => setDeleteStudent(student)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Excluir</span>
                                 </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 gap-4 p-4">
              {isLoading ? (
                <div className="py-10 text-center"><Loader2 size={32} className="animate-spin text-primary/20 mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground font-medium italic">Nenhum aluno encontrado.</div>
              ) : (
                filtered.map((student: StudentRow) => (
                  <div 
                    key={student.id} 
                    className="bg-card rounded-2xl p-4 border border-border shadow-sm active:scale-[0.98] transition-all"
                    onClick={() => setDetailsStudentId(student.id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm shrink-0">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold uppercase">
                            {student.name.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{student.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: student.instrumentColor || "#6366f1" }} />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{student.instrumentName}</span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge
                        status={student.status}
                        id={student.id}
                        onUpdate={(id, s) => updateStatusMutation.mutate({ id, status: s as any })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-border">
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Mensalidade</p>
                        <p className="text-xs font-black text-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nível</p>
                        <LevelBadge level={student.level} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Vencimento: Dia {student.dueDay || 10}</p>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground" onClick={() => { setEditStudent(student); setModalOpen(true); }}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => setDeleteStudent(student)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Pagination UI - Adjusted for mobile */}
            <div className="p-4 lg:p-6 border-t border-border flex items-center justify-between bg-muted/20">
               <p className="hidden sm:block text-[11px] text-muted-foreground font-medium">Mostrando 1 a {filtered.length} de {stats.total} alunos</p>
               <p className="sm:hidden text-[11px] text-muted-foreground font-medium">{filtered.length} registros</p>
               <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => toast.info("Funcionalidade em desenvolvimento")}><ChevronDown className="rotate-90" size={14} /></Button>
                  <Button variant="ghost" className="h-8 w-8 text-xs font-bold bg-primary text-white hover:bg-primary">1</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => toast.info("Funcionalidade em desenvolvimento")}><ChevronDown className="-rotate-90" size={14} /></Button>
               </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR Area - Adjusted for mobile (stacks at bottom) */}
          <div className="xl:col-span-3 space-y-6 lg:sticky lg:top-8">
             {/* Resumo Rápido Card */}
             <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8 blur-2xl" />
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  Resumo rápido
                </h3>
                <div className="space-y-6 relative z-10">
                   <div className="h-16 w-full relative">
                      <svg viewBox="0 0 200 60" className="w-full h-full text-primary" preserveAspectRatio="none">
                        <path d="M0 60 C 20 50, 40 40, 60 45 S 80 20, 100 30 S 140 10, 160 15 S 180 30, 200 20 V 60 H 0 Z" fill="currentColor" fillOpacity="0.05" />
                        <path d="M0 60 C 20 50, 40 40, 60 45 S 80 20, 100 30 S 140 10, 160 15 S 180 30, 200 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                   </div>
                   
                   <div className="grid grid-cols-2 xl:grid-cols-1 gap-4 pt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Novos (30 dias)</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-black text-foreground">{newStudentsLast30Days}</span>
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-bold px-1.5 h-4">+12%</Badge>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Ativos (%)</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-black text-foreground">{activeRate}%</span>
                        </div>
                        <div className="w-full h-1 bg-muted rounded-full mt-2 overflow-hidden">
                           <div className="h-full bg-primary" style={{ width: `${activeRate}%` }} />
                        </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Lembretes Card */}
             <div className="bg-card rounded-[2rem] border border-border p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Bell size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Alertas</h3>
                </div>
                <div className="space-y-3">
                   <div className="p-3 bg-rose-50/50 border border-rose-100/50 rounded-2xl group cursor-pointer hover:bg-rose-50 transition-colors">
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-card shadow-sm flex items-center justify-center text-rose-500 shrink-0">
                            <Plus size={16} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate">Mensalidades em atraso</p>
                            <p className="text-[10px] text-rose-500 font-bold mt-0.5">
                              {overduePayments.length} {overduePayments.length === 1 ? 'pendência' : 'pendências'}
                            </p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-2xl group cursor-pointer hover:bg-blue-50 transition-colors">
                      <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-lg bg-card shadow-sm flex items-center justify-center text-blue-500 shrink-0">
                            <Users size={16} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[11px] font-bold text-foreground truncate">Aulas hoje</p>
                            <p className="text-[10px] text-blue-500 font-bold mt-0.5">
                              {lessonsToday} {lessonsToday === 1 ? 'aula agendada' : 'aulas agendadas'}
                            </p>
                         </div>
                      </div>
                   </div>
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
          const s = (students as StudentRow[]).find(st => st.id === detailsStudentId);
          if (s) { setEditStudent(s); setModalOpen(true); setDetailsStudentId(null); }
        }}
        onDelete={() => {
          const s = (students as StudentRow[]).find(st => st.id === detailsStudentId);
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



