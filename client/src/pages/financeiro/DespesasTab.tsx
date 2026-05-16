import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { DollarSign, Plus, X, Loader2, Trash2, Pencil, Search, MoreVertical, CreditCard, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago:     { label: "Paga",     cls: "bg-emerald-500/10 text-emerald-600" },
    pendente: { label: "A vencer", cls: "bg-amber-500/10 text-amber-600" },
    atrasado: { label: "Em atraso", cls: "bg-rose-500/10 text-rose-600" },
  };
  const c = map[status] ?? map.pendente;
  return (
    <span className={cn("inline-flex items-center justify-center text-[10px] font-bold px-3 py-1.5 rounded-lg", c.cls)}>
      {c.label}
    </span>
  );
}

function NovaDespesaModal({ open, onClose }: { open: boolean; onClose: () => void; }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    category: "Outros",
    status: "pendente" as any
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success(`Despesa registrada com sucesso!`);
      utils.expenses.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = () => {
    if (!form.description || !form.amount || !form.date || !form.category) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createMutation.mutate({
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
      category: form.category,
      status: form.status,
    });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-card rounded-[2rem] border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/100/10 text-rose-600 flex items-center justify-center">
                 <DollarSign size={20} />
              </div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">Nova Despesa</h3>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto scrollbar-none">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Descrição</label>
              <Input value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Ex: Conta de Luz" className="h-12 text-sm font-bold rounded-xl border-border bg-muted/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Valor (R$)</label>
                  <Input value={form.amount} onChange={e => set("amount", e.target.value)}
                    type="number" className="h-12 text-sm font-bold rounded-xl border-border bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Data</label>
                  <Input value={form.date} onChange={e => set("date", e.target.value)}
                    type="date" className="h-12 text-sm font-semibold rounded-xl border-border bg-muted/50 px-4" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Categoria</label>
                <select value={form.category} onChange={e => set("category", e.target.value)}
                  className="w-full h-12 text-sm font-semibold rounded-xl border border-border bg-muted/50 px-4 focus:outline-none focus:ring-2 focus:ring-rose-500/10">
                  {["Aluguel", "Equipamentos", "Impostos", "Salários", "Marketing", "Outros"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className="w-full h-12 text-sm font-semibold rounded-xl border border-border bg-muted/50 px-4 focus:outline-none focus:ring-2 focus:ring-rose-500/10">
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
            </div>
        </div>

        <div className="p-6 border-t border-border bg-muted/30 flex gap-4">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-rose-500/10 gap-3 bg-rose-600 hover:bg-rose-700"
            onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Registrar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function DespesasTab({ viewMonth, viewYear, expenses, isLoading }: { viewMonth: number, viewYear: number, expenses: any[], isLoading: boolean }) {
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => { 
      toast.success("Status atualizado!"); 
      utils.expenses.invalidate();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Despesa removida!");
      utils.expenses.invalidate();
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });

  const filtered = useMemo(() => {
    return expenses.filter((p: any) => {
      const nameMatch = p.description?.toLowerCase().includes(search.toLowerCase());
      const statusMatch = filterStatus === "todas" || p.status === filterStatus;
      return nameMatch && statusMatch;
    });
  }, [expenses, search, filterStatus]);

  const stats = useMemo(() => {
    const sum = (arr: any[]) => arr.reduce((acc, p) => acc + Number(p.amount), 0);
    return {
      pago: sum(expenses.filter(p => p.status === "pago")),
      pendente: sum(expenses.filter(p => p.status === "pendente")),
      atrasado: sum(expenses.filter(p => p.status === "atrasado")),
      total: sum(expenses)
    };
  }, [expenses]);

  const currencyFormat = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6 lg:space-y-8">
      <NovaDespesaModal open={novaOpen} onClose={() => setNovaOpen(false)} />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input 
                placeholder="Buscar despesa..." 
                className="pl-9 h-10 border-border bg-card rounded-xl shadow-sm text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button 
              onClick={() => setNovaOpen(true)}
              className="h-10 rounded-xl px-4 lg:px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-2 shadow-lg shadow-rose-500/20 transition-all active:scale-95 shrink-0"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nova Despesa</span>
            </Button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="flex overflow-x-auto lg:grid lg:grid-cols-4 gap-4 lg:gap-6 pb-2 lg:pb-0 no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
          {[
            { label: "Pago", amount: stats.pago, color: "text-emerald-600", bg: "from-emerald-500/10 to-background", border: "border-emerald-100/50" },
            { label: "Pendente", amount: stats.pendente, color: "text-amber-600", bg: "from-amber-500/10 to-background", border: "border-amber-100/50" },
            { label: "Atrasado", amount: stats.atrasado, color: "text-rose-600", bg: "from-rose-500/10 to-background", border: "border-rose-100/50" },
            { label: "Total de Saídas", amount: stats.total, color: "text-rose-600", bg: "from-rose-500/10 to-background", border: "border-rose-500/20/50" },
          ].map((item, i) => (
            <div key={i} className={cn("relative min-w-[140px] flex-1 lg:h-32 p-4 lg:p-6 rounded-2xl bg-gradient-to-br border shadow-sm overflow-hidden shrink-0", item.bg, item.border)}>
              <div className="relative z-10">
                <p className={cn("text-[8px] lg:text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1 lg:mb-2", item.color)}>{item.label}</p>
                <p className="text-sm lg:text-2xl font-black text-foreground leading-none">
                  {currencyFormat(item.amount)}
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* FILTERS SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Status</p>
            <div className="flex bg-muted/50 p-1 rounded-xl">
                {["todas", "pendente", "pago", "atrasado"].map(st => (
                  <button key={st} onClick={() => setFilterStatus(st)} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", filterStatus === st ? "bg-rose-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {st}
                  </button>
                ))}
            </div>
          </div>
      </div>

      {/* MAIN CONTENT SECTION */}
      <div className="bg-card lg:rounded-[2rem] border-0 lg:border border-border lg:shadow-sm overflow-hidden flex flex-col -mx-4 lg:mx-0">
          <div className="hidden lg:block overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Categoria</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Data</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-20 text-center"><Loader2 size={32} className="animate-spin text-primary/20 mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-xs text-muted-foreground font-medium italic">Nenhuma despesa encontrada.</td></tr>
                ) : (
                  filtered.map((expense: any) => (
                    <tr key={expense.id} className="group hover:bg-muted/50 transition-colors cursor-pointer">
                      <td className="px-8 py-4">
                        <p className="text-sm font-bold text-foreground truncate">{expense.description}</p>
                      </td>
                      <td className="px-8 py-4">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <p className="text-sm font-black text-foreground">
                            {currencyFormat(Number(expense.amount))}
                        </p>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <div className="flex flex-col items-center">
                            <p className="text-xs font-bold text-muted-foreground">{format(new Date(expense.date + "T12:00:00"), "dd/MM")}</p>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center">
                          <StatusBadge status={expense.status} />
                      </td>
                      <td className="px-8 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-muted-foreground">
                                  <MoreVertical size={16} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl p-2 border-border">
                                {expense.status !== "pago" && (
                                  <DropdownMenuItem className="gap-2 rounded-lg" onClick={() => updateMutation.mutate({ id: expense.id, status: "pago" })}>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-bold text-muted-foreground">Marcar como Pago</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-muted" />
                                <DropdownMenuItem className="gap-2 rounded-lg text-rose-500" onClick={() => {
                                  if(confirm("Deseja excluir esta despesa?")) {
                                    deleteMutation.mutate({ id: expense.id });
                                  }
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                  <span className="text-xs font-bold">Excluir</span>
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

          <div className="lg:hidden grid grid-cols-1 gap-4 p-4">
            {isLoading ? (
              <div className="py-10 text-center"><Loader2 size={32} className="animate-spin text-primary/20 mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground font-medium italic">Nenhuma despesa encontrada.</div>
            ) : (
              filtered.map((expense: any) => (
                <div key={expense.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{expense.description}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{expense.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 border-border">
                          {expense.status !== "pago" && (
                            <DropdownMenuItem className="gap-2 rounded-lg" onClick={() => updateMutation.mutate({ id: expense.id, status: "pago" })}>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold text-muted-foreground">Marcar Pago</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2 rounded-lg text-rose-500" onClick={() => {
                            if(confirm("Deseja excluir?")) deleteMutation.mutate({ id: expense.id });
                          }}>
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs font-bold">Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data</p>
                      <p className="text-xs font-bold text-foreground">{format(new Date(expense.date + "T12:00:00"), "dd/MM")}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor</p>
                      <p className="text-sm font-black text-foreground">{currencyFormat(Number(expense.amount))}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center">
                    <StatusBadge status={expense.status} />
                  </div>
                </div>
              ))
            )}
          </div>
      </div>
    </div>
  );
}
