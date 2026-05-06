import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Plus, X,
  Loader2, Trash2, ChevronLeft, ChevronRight, Pencil, 
  Filter, Search, Bell, Moon, MoreVertical, CreditCard, Wallet, 
  ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { EditMensalidadeModal } from "@/components/modals/EditMensalidadeModal";
import { VencimentosReportModal } from "@/components/modals/VencimentosReportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const map: Record<string, { label: string; cls: string }> = {
    pago:     { label: "Paga",     cls: "bg-emerald-50 text-emerald-600" },
    pendente: { label: "A vencer", cls: "bg-amber-50 text-amber-600" },
    atrasado: { label: "Em atraso", cls: "bg-rose-50 text-rose-600" },
    agendada: { label: "Agendada", cls: "bg-blue-50 text-blue-600" },
  };
  const c = map[status] ?? map.pendente;
  return (
    <span className={cn("inline-flex items-center justify-center text-[10px] font-bold px-3 py-1.5 rounded-lg", c.cls)}>
      {c.label}
    </span>
  );
}

const Sparkline = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 30" className="w-full h-8 mt-4 overflow-visible">
    <defs>
      <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M0,20 Q10,5 20,20 T40,20 T60,10 T80,25 T100,15"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M0,20 Q10,5 20,20 T40,20 T60,10 T80,25 T100,15 V30 H0 Z"
      fill={`url(#grad-${color})`}
    />
  </svg>
);

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
        className="relative bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                 <DollarSign size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Nova Mensalidade</h3>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto scrollbar-none">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Selecione o Aluno</label>
            <select value={form.studentId} onChange={e => handleStudentChange(e.target.value)}
              className="w-full h-12 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 transition-all cursor-pointer">
              <option value="">Selecionar aluno...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Valor (R$)</label>
               <Input value={form.amount} onChange={e => set("amount", e.target.value)}
                 type="number" className="h-12 text-sm font-bold rounded-xl border-slate-200 bg-slate-50/50" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Dia Vencimento</label>
               <select value={form.dueDay} onChange={e => set("dueDay", e.target.value)}
                 className="w-full h-12 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-700 cursor-pointer">
                 {[5,10,15,20,25].map(d => <option key={d} value={String(d)}>{d}</option>)}
               </select>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Mês inicial</label>
              <select value={form.startMonth} onChange={e => set("startMonth", e.target.value)}
                className="w-full h-12 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Ano</label>
              <select value={form.startYear} onChange={e => set("startYear", e.target.value)}
                className="w-full h-12 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-4">
                {[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-4">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest text-center">Geração em Lote</p>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setMonthsCount(n)}
                  className={cn(
                    "h-10 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm",
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

        <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex gap-4">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 gap-3 bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Gerar
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
    
    const sumAmount = (arr: PaymentRow[]) => arr.reduce((acc, p) => acc + Number(p.amount), 0);
    const totalToReceive = sumAmount(upcoming) + sumAmount(overdue);
    const received = sumAmount(paid);
    const upcomingAmt = sumAmount(upcoming);
    const overdueAmt = sumAmount(overdue);
    const scheduledAmt = sumAmount(scheduled);
    
    const totalAmount = sumAmount(payments);
    const getPercent = (val: number) => totalAmount > 0 ? Math.round((val / totalAmount) * 100) : 0;
    
    return {
      totalToReceive,
      received,
      upcoming: upcomingAmt,
      overdue: overdueAmt,
      totalAmount,
      distribution: [
        { name: 'Recebidas', value: received, color: '#10B981', percent: getPercent(received) },
        { name: 'A vencer', value: upcomingAmt, color: '#F59E0B', percent: getPercent(upcomingAmt) },
        { name: 'Em atraso', value: overdueAmt, color: '#EF4444', percent: getPercent(overdueAmt) },
        { name: 'Agendadas', value: scheduledAmt, color: '#2563EB', percent: getPercent(scheduledAmt) },
      ].filter(d => d.value > 0)
    };
  }, [payments]);

  const upcomingDues = useMemo(() => {
    return payments
      .filter(p => p.status === "pendente")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);
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
    <div className="flex flex-col lg:flex-row h-screen bg-[#F8FAFC] overflow-hidden -m-4 sm:-m-6">
      
      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER AREA */}
        <div className="px-10 py-8 space-y-8 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Olá, WR! Bem-vindo de volta.</h1>
              <p className="text-xs text-slate-400 font-medium mt-1">Controle e histórico de mensalidades</p>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="relative group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" />
                  <Input 
                    placeholder="Procurar aluno..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[240px] h-10 pl-11 rounded-full bg-slate-100/50 border-none focus:ring-0 text-xs font-medium placeholder:text-slate-400" 
                  />
               </div>
            </div>
          </div>

          {/* TOP METRICS CARDS */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: "Total a receber", value: stats.totalToReceive, icon: DollarSign, color: "#2563EB", bg: "bg-blue-600", sub: "Este mês" },
              { label: "Recebidas", value: stats.received, icon: CheckCircle2, color: "#10B981", bg: "bg-emerald-500", sub: "Este mês" },
              { label: "A vencer", value: stats.upcoming, icon: Clock, color: "#F59E0B", bg: "bg-amber-500", sub: "Próximos 7 dias" },
              { label: "Em atraso", value: stats.overdue, icon: AlertCircle, color: "#EF4444", bg: "bg-rose-500", sub: "Atrasadas" }
            ].map((card, i) => (
              <div key={i} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0", card.bg)}>
                    <card.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">{card.label}</p>
                    <h4 className="text-xl font-bold text-slate-900 tracking-tight">{currencyFormat(card.value)}</h4>
                    <p className="text-[10px] font-medium text-slate-300 mt-0.5">{card.sub}</p>
                  </div>
                </div>
                <Sparkline color={card.color} />
              </div>
            ))}
          </div>
        </div>

        {/* CONTENT AREA: FILTERS + TABLE */}
        <div className="flex-1 flex flex-col px-10 pb-10 overflow-hidden">
           
           <div className="flex-1 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
             
             {/* TABLE HEADER & FILTERS */}
             <div className="px-8 py-6 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Mensalidades</h3>

                <div className="flex items-center gap-3">
                   <div className="relative group">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        placeholder="Buscar mensalidade..." 
                        className="w-[200px] h-9 pl-10 rounded-full bg-slate-100/50 border-none text-[11px] font-medium placeholder:text-slate-400" 
                      />
                   </div>
                   
                   <div className="relative">
                      <select className="h-9 px-4 rounded-full bg-slate-100/50 border-none text-[11px] font-bold text-slate-500 appearance-none pr-10 cursor-pointer outline-none">
                        <option>Todos os status</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>

                   <div className="relative">
                      <select className="h-9 px-4 rounded-full bg-slate-100/50 border-none text-[11px] font-bold text-slate-500 appearance-none pr-10 cursor-pointer outline-none">
                        <option>Este mês</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>

                   <button className="w-9 h-9 rounded-full bg-slate-100/50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                     <Filter size={14} />
                   </button>
                </div>
             </div>

             {/* DATA TABLE */}
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-y border-slate-50">
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aluno</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Referência</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vencimento</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forma de Pagamento</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      <tr><td colSpan={7} className="py-10 text-center"><Loader2 size={24} className="animate-spin text-blue-500/20 mx-auto" /></td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="py-10 text-center text-xs font-medium text-slate-300 italic">Nenhuma mensalidade encontrada</td></tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-4">
                             <div className="flex items-center gap-3">
                               <Avatar className="w-8 h-8">
                                 <AvatarFallback className="bg-blue-600 text-white text-[9px] font-bold">
                                   {(p.studentName ?? "?")[0]}
                                 </AvatarFallback>
                               </Avatar>
                               <div className="min-w-0">
                                 <p className="text-xs font-bold text-slate-800 truncate leading-none">{p.studentName || "—"}</p>
                                 <p className="text-[10px] text-slate-400 font-medium truncate mt-1">{p.email || "Sem e-mail"}</p>
                               </div>
                             </div>
                          </td>
                          <td className="px-8 py-4 text-[11px] font-medium text-slate-500">{MONTHS_PT[p.month-1]}/{p.year}</td>
                          <td className="px-8 py-4">
                             <span className={cn("text-[11px] font-bold", p.status === "atrasado" ? "text-rose-500" : "text-slate-500")}>
                               {format(new Date(p.dueDate + "T12:00:00"), "dd/MM/yyyy")}
                             </span>
                          </td>
                          <td className="px-8 py-4 text-xs font-bold text-slate-800">{currencyFormat(Number(p.amount))}</td>
                          <td className="px-8 py-4">
                             <StatusBadge status={p.status} />
                          </td>
                          <td className="px-8 py-4">
                             <p className="text-[11px] font-medium text-slate-500">Pix</p>
                          </td>
                          <td className="px-8 py-4 text-right">
                             <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <MoreVertical size={16} />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>

             {/* PAGINATION FOOTER */}
             <div className="px-8 py-4 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-400">Mostrando 1 a 8 de 23 mensalidades</p>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 border border-slate-100 transition-colors"><ChevronLeft size={16} /></button>
                      <button className="w-8 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold shadow-lg shadow-blue-500/20">1</button>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">2</button>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">3</button>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 border border-slate-100 transition-colors"><ChevronRight size={16} /></button>
                   </div>
                   <div className="relative">
                      <select className="h-8 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 appearance-none cursor-pointer outline-none">
                         <option>10 por página</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR Area */}
      <div className="w-[340px] bg-white border-l border-slate-100 flex flex-col overflow-hidden">
         <div className="p-8 space-y-10 overflow-y-auto scrollbar-none">
            
            {/* Resumo Financeiro Chart */}
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Resumo financeiro</h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                     Este mês <ChevronDown size={12} />
                  </div>
               </div>

               <div className="h-[180px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                         data={stats.distribution}
                         innerRadius={55}
                         outerRadius={75}
                         paddingAngle={4}
                         dataKey="value"
                         stroke="none"
                       >
                         {stats.distribution.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Pie>
                    </PieChart>
                  </ResponsiveContainer>
               </div>

               <div className="space-y-3">
                  {stats.distribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <p className="text-[11px] font-bold text-slate-800">{item.name}</p>
                       </div>
                       <div className="flex items-center gap-4">
                          <p className="text-[11px] font-bold text-slate-400">{currencyFormat(item.value)}</p>
                          <p className="text-[11px] font-bold text-slate-400 w-8 text-right">{item.percent}%</p>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900">Total</p>
                  <p className="text-sm font-bold text-slate-900">{currencyFormat(stats.totalAmount)}</p>
               </div>
            </div>

            {/* Próximos Vencimentos */}
            <div className="space-y-6 pt-2">
               <h3 className="text-sm font-bold text-slate-900 tracking-tight">Próximos vencimentos</h3>
               
               <div className="space-y-4">
                  {upcomingDues.map((due, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                             <AvatarFallback className="bg-blue-600 text-white text-[9px] font-bold">{(due.studentName ?? "A")[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                             <p className="text-[11px] font-bold text-slate-800">{due.studentName}</p>
                             <p className="text-[10px] text-slate-400 font-medium">{format(new Date(due.dueDate + "T12:00:00"), "dd/MM/yyyy")}</p>
                          </div>
                       </div>
                       <p className="text-[11px] font-bold text-slate-800">{currencyFormat(Number(due.amount))}</p>
                    </div>
                  ))}
                  <button className="w-full py-2.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition-colors">
                     Ver todos
                  </button>
               </div>
            </div>

            {/* Inadimplentes */}
            <div className="space-y-6 pt-2">
               <h3 className="text-sm font-bold text-slate-900 tracking-tight">Inadimplentes</h3>
               
               <div className="space-y-4">
                  {overdueList.slice(0, 2).map((over, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                             <AvatarFallback className="bg-rose-500 text-white text-[9px] font-bold">{(over.studentName ?? "A")[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                             <p className="text-[11px] font-bold text-slate-800">{over.studentName}</p>
                             <p className="text-[10px] font-bold text-rose-500">Atraso de {over.daysOverdue} dias</p>
                          </div>
                       </div>
                       <p className="text-[11px] font-bold text-slate-800">{currencyFormat(Number(over.amount))}</p>
                    </div>
                  ))}
                  <button className="w-full text-center text-[11px] font-bold text-blue-600 hover:underline transition-all">
                     Ver todos inadimplentes
                  </button>
               </div>
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
