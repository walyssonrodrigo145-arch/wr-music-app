import { trpc } from "@/lib/trpc";
import { 
  DollarSign, 
  Download, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  History,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 }
};

export default function StudentPayments() {
  const { data: payments, isLoading } = trpc.studentPortal.getPayments.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { label: string, color: string }> = {
      pago: { label: 'Pago', color: 'bg-green-100 text-green-600' },
      pendente: { label: 'Pendente', color: 'bg-orange-100 text-orange-600' },
      atrasado: { label: 'Atrasado', color: 'bg-red-100 text-red-600' },
    };
    const config = configs[status] || configs.pendente;
    return (
      <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", config.color)}>
        {config.label}
      </span>
    );
  };

  const totalPaid = payments?.filter(p => p.status === 'pago').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
  const nextPayment = payments?.filter(p => p.status !== 'pago').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const nextValue = nextPayment ? Number(nextPayment.amount) : 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Financeiro</h1>
          <p className="text-muted-foreground font-medium">Gerencie suas mensalidades e histórico de pagamentos.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status da Conta</p>
              <p className="text-sm font-black text-green-500 uppercase tracking-tight">Em Dia ✅</p>
           </div>
           <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
             <ShieldCheck size={20} />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black flex items-center gap-2">
              <History size={20} className="text-primary" /> Histórico de Faturas
            </h2>
            <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Download Todos</button>
          </div>
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {payments?.map((payment) => (
              <motion.div variants={item} key={payment.id}>
                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:shadow-2xl transition-all overflow-hidden relative">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row items-center p-6 gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all",
                        payment.status === 'pago' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                      )}>
                        <FileText size={24} />
                      </div>

                      <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                        <p className="text-lg font-black text-foreground truncate">Mensalidade • {format(new Date(payment.dueDate), "MMMM yyyy", { locale: ptBR })}</p>
                        <div className="flex items-center justify-center sm:justify-start gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <span className="flex items-center gap-1.5"><Calendar size={12} className="text-primary" /> Vencimento: {format(new Date(payment.dueDate), "dd/MM/yyyy")}</span>
                          {payment.paidAt && (
                             <span className="flex items-center gap-1.5 text-green-500"><CheckCircle2 size={12} /> Pago em: {format(new Date(payment.paidAt), "dd/MM/yyyy")}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center sm:items-end gap-2">
                        <p className="text-xl font-black text-foreground">R$ {Number(payment.amount).toFixed(2)}</p>
                        <StatusBadge status={payment.status} />
                      </div>

                      <div className="flex items-center gap-2">
                        {payment.status === 'pago' ? (
                          <button className="w-12 h-12 rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm flex items-center justify-center">
                            <Download size={20} />
                          </button>
                        ) : (
                          <button className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                             Pagar
                             <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {payments?.length === 0 && (
              <div className="text-center py-24 bg-card/30 rounded-[2rem] border-2 border-dashed border-border">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="text-muted-foreground opacity-30" size={40} />
                </div>
                <h3 className="text-xl font-black text-foreground">Sem registros</h3>
                <p className="text-muted-foreground font-medium mt-2">Nenhum histórico financeiro encontrado.</p>
              </div>
            )}
          </motion.div>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-primary to-indigo-600 text-white overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp size={120} />
             </div>
             <CardContent className="p-8 relative z-10">
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <CreditCard size={20} />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Meu Investimento</p>
                </div>
                
                <h3 className="text-4xl font-black mb-1">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Total investido no seu talento</p>
                
                <div className="mt-8 pt-6 border-t border-white/20 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white/80">Próxima Mensalidade</span>
                      <span className="text-sm font-black">R$ {nextValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   </div>
                   <button 
                     onClick={() => toast.info("Gateway de pagamento em integração.")}
                     className="w-full bg-white text-primary font-black text-xs uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:translate-y-[-2px] active:scale-95 transition-all"
                   >
                      Pagar Fatura
                   </button>
                </div>
             </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-xl">
             <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-primary" />
                  <CardTitle className="text-sm font-black uppercase tracking-[0.1em]">Central de Ajuda</CardTitle>
                </div>
             </CardHeader>
             <CardContent className="space-y-5 pt-4">
                <div className="flex items-start gap-4">
                   <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Download size={16} /></div>
                   <div className="space-y-1">
                      <p className="text-xs font-black text-foreground">Recibos e Comprovantes</p>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">Ficam disponíveis para download imediato após a confirmação do pagamento.</p>
                   </div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><MessageSquare size={16} className="lucide-message-square" /></div>
                   <div className="space-y-1">
                      <p className="text-xs font-black text-foreground">Dúvidas sobre Valores</p>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">Qualquer divergência ou dúvida sobre vencimentos, entre em contato com o suporte.</p>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MessageSquare(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
