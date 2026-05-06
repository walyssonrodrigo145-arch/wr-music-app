import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Plus, X,
  Loader2, Trash2, Calendar, ChevronLeft, ChevronRight, Pencil, 
  Filter, Search, Bell, Moon, MoreVertical, CreditCard, Wallet, 
  ArrowUpRight, ArrowDownRight, TrendingUp, User, Music, ExternalLink,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isPast, isFuture, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditMensalidadeModal } from "@/components/modals/EditMensalidadeModal";
import { VencimentosReportModal } from "@/components/modals/VencimentosReportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type PaymentRow = {
  id: number; studentId: number | null; amount: string | number;
  dueDate: string | Date; paidAt?: Date | string | null;
  status: string; month: number; year: number;
  notes?: string | null; studentName?: string | null; studentPhone?: string | null;
  email?: string | null;
};

// ─── Componentes Auxiliares ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    pago:     { label: "Pago",     cls: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
    pendente: { label: "A vencer", cls: "bg-amber-50 text-amber-600 border-amber-100",   dot: "bg-amber-500" },
    atrasado: { label: "Em atraso", cls: "bg-rose-50 text-rose-600 border-rose-100",       dot: "bg-rose-500" },
    agendada: { label: "Agendada", cls: "bg-blue-50 text-blue-600 border-blue-100",       dot: "bg-blue-500" },
  };
  const c = map[status] ?? map.pendente;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm", c.cls)}>
      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", c.dot)} />
      {c.label}
    </span>
  );
}

// ─── Modal Nova Mensalidade ────────────────────────────────────────────────────
function NovaModal({ open, onClose, students }: {
  open: boolean; onClose: () => void;
  students: any[];
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
  const [monthsCount, setMonthsCount] = useState(1);
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-8 border-b border-slate-100">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                 <DollarSign size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Nova Mensalidade</h3>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto scrollbar-none">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Selecione o Aluno</label>
            <select value={form.studentId} onChange={e => handleStudentChange(e.target.value)}
              className="w-full h-14 text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 transition-all cursor-pointer">
              <option value="">Selecionar aluno...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Valor (R$)</label>
               <Input value={form.amount} onChange={e => set("amount", e.target.value)}
                 type="number" className="h-14 text-sm font-black rounded-2xl border-slate-200 bg-slate-50/50" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Dia Vencimento</label>
               <select value={form.dueDay} onChange={e => set("dueDay", e.target.value)}
                 className="w-full h-14 text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 cursor-pointer">
                 {[5,10,15,20,25].map(d => <option key={d} value={String(d)}>{d}</option>)}
               </select>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Mês inicial</label>
              <select value={form.startMonth} onChange={e => set("startMonth", e.target.value)}
                className="w-full h-14 text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Ano</label>
              <select value={form.startYear} onChange={e => set("startYear", e.target.value)}
                className="w-full h-14 text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50/50 px-4">
                {[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 space-y-4">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Geração em Lote</p>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setMonthsCount(n)}
                  className={cn(
                    "h-12 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm",
                    monthsCount === n
                      ? "bg-blue-600 text-white shadow-blue-500/20 scale-105"
                      : "bg-white text-blue-400 border border-blue-100 hover:bg-blue-50"
                  )}>
                  {n} {n === 1 ? "mês" : "meses"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex gap-4">
          <Button variant="ghost" className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 gap-3"
            onClick={handleSubmit} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Gerar Mensalidades
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Mensalidades() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: payments = [], isLoading } = trpc.paymentDues.list.useQuery({ month: viewMonth, year: viewYear });
  const { data: students = [] } = trpc.students.list.useQuery();

  const markPaidMutation = trpc.paymentDues.markPaid.useMutation({
    onSuccess: () => { 
      toast.success("Pago com sucesso!"); 
      utils.paymentDues.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  
  const deleteMutation = trpc.paymentDues.delete.useMutation({
    onSuccess: () => { 
      toast.success("Mensalidade removida!"); 
      utils.paymentDues.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch = p.studentName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "todas" || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [payments, search, filterStatus]);

  const stats = useMemo(() => {
    const paid = payments.filter(p => p.status === "pago");
    const overdue = payments.filter(p => p.status === "atrasado");
    const upcoming = payments.filter(p => p.status === "pendente");
    const scheduled = payments.filter(p => p.status === "agendada");
    
    return {
      totalToReceive: upcoming.reduce((acc, p) => acc + Number(p.amount), 0) + overdue.reduce((acc, p) => acc + Number(p.amount), 0),
      received: paid.reduce((acc, p) => acc + Number(p.amount), 0),
      upcoming: upcoming.reduce((acc, p) => acc + Number(p.amount), 0),
      overdue: overdue.reduce((acc, p) => acc + Number(p.amount), 0),
      distribution: [
        { name: 'Recebidas', value: paid.length, color: '#10B981' },
        { name: 'A vencer', value: upcoming.length, color: '#F59E0B' },
        { name: 'Em atraso', value: overdue.length, color: '#EF4444' },
        { name: 'Agendadas', value: scheduled.length, color: '#2563EB' },
      ].filter(d => d.value > 0)
    };
  }, [payments]);

  const upcomingDues = useMemo(() => {
    return payments
      .filter(p => p.status === "pendente")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [payments]);

  const overdueList = useMemo(() => {
    return payments
      .filter(p => p.status === "atrasado")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .map(p => {
        const diff = Math.floor((new Date().getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysOverdue: diff };
      });
  }, [payments]);

  const currencyFormat = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] -m-4 sm:-m-6 bg-[#F5F7FB] overflow-hidden">
      
      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-hidden scrollbar-thin">
        
        {/* HEADER AREA */}
        <div className="p-8 pb-0 space-y-8 shrink-0">
          <div className="flex items-center justify-between gap-8">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Olá, WR! Bem-vindo de volta.</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Controle e histórico de mensalidades</p>
            </div>
            <div className="hidden md:flex items-center gap-4">
               <div className="relative group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    placeholder="Procurar mensalidade..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[280px] h-12 pl-12 rounded-2xl bg-white border-slate-100 shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 transition-all font-medium text-xs" 
                  />
               </div>
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white border-slate-100 text-slate-400 shadow-sm"><Moon size={18} /></Button>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white border-slate-100 text-slate-400 shadow-sm relative">
                    <Bell size={18} />
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
                  </Button>
               </div>
            </div>
          </div>

          {/* TOP METRICS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { label: "Total a receber", value: stats.totalToReceive, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50/50", sub: "Este mês" },
              { label: "Recebidas", value: stats.received, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50/50", sub: "Este mês" },
              { label: "A vencer", value: stats.upcoming, icon: Clock, color: "text-orange-600", bg: "bg-orange-50/50", sub: "Próximos 7 dias" },
              { label: "Em atraso", value: stats.overdue, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50/50", sub: "Atrasadas" }
            ].map((card, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02, translateY: -4 }}
                className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:border-blue-100 transition-all duration-500"
              >
                <div className="flex flex-col">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12", card.bg, card.color)}>
                    <card.icon size={22} strokeWidth={2.5} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tighter">{currencyFormat(card.value)}</h4>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">{card.sub}</p>
                </div>
                {/* Mini Graph Placeholder (Visual) */}
                <div className="w-16 h-16 flex items-end justify-between px-1">
                  {[40, 70, 45, 90, 60, 85].map((h, idx) => (
                    <div key={idx} className={cn("w-1.5 rounded-full transition-all duration-700", card.color.replace('text-', 'bg-').replace('600', '400/20'))} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CONTENT AREA: FILTERS + TABLE */}
        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 scrollbar-thin">
           
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
             
             {/* TABLE HEADER & FILTERS */}
             <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                      <CreditCard size={24} />
                   </div>
                   <h3 className="text-lg font-black text-slate-800 tracking-tight">Mensalidades</h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                   <div className="relative group">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <Input 
                        placeholder="Buscar aluno..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-[200px] h-11 pl-10 rounded-xl bg-slate-50/50 border-slate-100 text-xs font-bold" 
                      />
                   </div>
                   
                   <select 
                     value={filterStatus}
                     onChange={(e) => setFilterStatus(e.target.value)}
                     className="h-11 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer outline-none focus:ring-4 focus:ring-blue-500/5"
                   >
                     <option value="todas">Todos os status</option>
                     <option value="pago">Pago</option>
                     <option value="pendente">A vencer</option>
                     <option value="atrasado">Em atraso</option>
                     <option value="agendada">Agendada</option>
                   </select>

                   <div className="flex items-center bg-slate-50/80 border border-slate-100 rounded-xl p-1">
                      <button onClick={prevMonth} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"><ChevronLeft size={16} /></button>
                      <span className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 min-w-[100px] text-center">
                        {MONTHS_PT[viewMonth - 1]} {viewYear}
                      </span>
                      <button onClick={nextMonth} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"><ChevronRight size={16} /></button>
                   </div>

                   <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl bg-slate-50/50 border-slate-100 text-slate-400" onClick={() => setReportOpen(true)}>
                     <Filter size={16} />
                   </Button>

                   <Button 
                     onClick={() => setNovaOpen(true)}
                     className="h-11 px-6 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                   >
                     <Plus size={16} strokeWidth={3} /> Nova Mensalidade
                   </Button>
                </div>
             </div>

             {/* DATA TABLE */}
             <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-50">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aluno</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Referência</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vencimento</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Valor</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      <tr><td colSpan={7} className="py-20 text-center"><Loader2 size={32} className="animate-spin text-blue-500/20 mx-auto" /></td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Nenhuma mensalidade encontrada</td></tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-4">
                               <Avatar className="w-10 h-10 border-2 border-white shadow-md">
                                 <AvatarFallback className="bg-blue-600 text-white text-[10px] font-black uppercase">
                                   {(p.studentName ?? "?")[0]}
                                 </AvatarFallback>
                               </Avatar>
                               <div className="min-w-0">
                                 <p className="text-sm font-black text-slate-800 truncate tracking-tight">{p.studentName || "—"}</p>
                                 <p className="text-[10px] text-slate-400 font-bold truncate tracking-tighter mt-0.5">{p.email || "Sem e-mail cadastrado"}</p>
                               </div>
                             </div>
                          </td>
                          <td className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-wider">{MONTHS_PT[p.month-1]}/{p.year}</td>
                          <td className="px-8 py-5">
                             <span className={cn("text-[11px] font-black uppercase tracking-wider", p.status === "atrasado" ? "text-rose-500" : "text-slate-600")}>
                               {format(new Date(p.dueDate + "T12:00:00"), "dd/MM/yyyy")}
                             </span>
                          </td>
                          <td className="px-8 py-5 text-sm font-black text-slate-800">{currencyFormat(Number(p.amount))}</td>
                          <td className="px-8 py-5 text-center">
                             <StatusBadge status={p.status} />
                          </td>
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-2">
                                <Wallet size={12} className="text-slate-300" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Pix</span>
                             </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                {p.status !== "pago" && (
                                   <Button 
                                     size="icon" 
                                     className="w-9 h-9 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:scale-110 active:scale-95 transition-all"
                                     onClick={() => markPaidMutation.mutate({ id: p.id })}
                                   >
                                     <CheckCircle2 size={16} />
                                   </Button>
                                )}
                                <Button size="icon" className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 shadow-sm hover:scale-110 active:scale-95 transition-all" onClick={() => setEditPayment(p)}>
                                   <Pencil size={14} />
                                </Button>
                                <Button size="icon" className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-500 hover:text-white transition-all" onClick={() => deleteMutation.mutate({ id: p.id })}>
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
      </div>

      {/* RIGHT SIDEBAR Area */}
      <div className="w-full lg:w-[360px] bg-white border-l border-slate-100 p-8 space-y-10 overflow-y-auto shrink-0 scrollbar-thin">
         
         {/* Resumo Financeiro Chart */}
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black text-slate-800 tracking-tight">Resumo financeiro</h3>
               <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  Este mês <ChevronDown size={12} />
               </div>
            </div>

            <div className="h-[200px] w-full relative flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={stats.distribution}
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-base font-black text-slate-800 tracking-tighter">{currencyFormat(payments.reduce((acc, p) => acc + Number(p.amount), 0))}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {stats.distribution.map((item, i) => (
                 <div key={i} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-slate-800 truncate">{item.name}</p>
                       <p className="text-[9px] font-bold text-slate-400">{Math.round((item.value / (payments.length || 1)) * 100)}%</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="h-px bg-slate-50" />

         {/* Próximos Vencimentos */}
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black text-slate-800 tracking-tight">Próximos vencimentos</h3>
               <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline transition-all">Ver todos</button>
            </div>

            <div className="space-y-3">
               {upcomingDues.map((due, i) => (
                 <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-500 cursor-pointer" onClick={() => setEditPayment(due)}>
                    <div className="flex items-center gap-3">
                       <Avatar className="w-8 h-8 border border-white">
                          <AvatarFallback className="bg-blue-600 text-white text-[9px] font-black uppercase">{(due.studentName ?? "A")[0]}</AvatarFallback>
                       </Avatar>
                       <div>
                          <p className="text-xs font-black text-slate-800">{due.studentName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(due.dueDate + "T12:00:00"), "dd/MM/yyyy")}</p>
                       </div>
                    </div>
                    <p className="text-xs font-black text-slate-800">{currencyFormat(Number(due.amount))}</p>
                 </div>
               ))}
               {upcomingDues.length === 0 && (
                 <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Tudo em ordem</p>
               )}
            </div>
         </div>

         <div className="h-px bg-slate-50" />

         {/* Inadimplentes */}
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black text-slate-800 tracking-tight">Inadimplentes</h3>
               <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-[10px] font-black">{overdueList.length}</div>
            </div>

            <div className="space-y-3">
               {overdueList.slice(0, 3).map((over, i) => (
                 <div key={i} className="p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50 flex items-center justify-between group hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all duration-500 cursor-pointer" onClick={() => setEditPayment(over)}>
                    <div className="flex items-center gap-3">
                       <Avatar className="w-8 h-8 border border-white">
                          <AvatarFallback className="bg-rose-500 text-white text-[9px] font-black uppercase">{(over.studentName ?? "A")[0]}</AvatarFallback>
                       </Avatar>
                       <div>
                          <p className="text-xs font-black text-slate-800">{over.studentName}</p>
                          <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Atraso de {over.daysOverdue} dias</p>
                       </div>
                    </div>
                    <p className="text-xs font-black text-slate-800">{currencyFormat(Number(over.amount))}</p>
                 </div>
               ))}
               {overdueList.length > 3 && (
                  <button className="w-full h-10 rounded-xl bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-all">Ver todos inadimplentes</button>
               )}
               {overdueList.length === 0 && (
                 <p className="text-center py-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Nenhum atraso!</p>
               )}
            </div>
         </div>
      </div>

      {/* MODALS */}
      {novaOpen && (
        <NovaModal open={novaOpen} onClose={() => setNovaOpen(false)} students={students} />
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
