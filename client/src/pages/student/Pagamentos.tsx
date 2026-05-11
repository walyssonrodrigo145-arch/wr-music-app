import { trpc } from "@/lib/trpc";
import { 
  DollarSign, 
  Download, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function StudentPayments() {
  const { data: payments, isLoading } = trpc.studentPortal.getPayments.useQuery();

  if (isLoading) return <div>Carregando pagamentos...</div>;

  const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { label: string, color: string }> = {
      pago: { label: 'Pago', color: 'bg-green-500/10 text-green-600' },
      pendente: { label: 'Pendente', color: 'bg-orange-500/10 text-orange-600' },
      atrasado: { label: 'Atrasado', color: 'bg-red-500/10 text-red-600' },
    };
    const config = configs[status] || configs.pendente;
    return (
      <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", config.color)}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Pagamentos</h1>
        <p className="text-muted-foreground font-medium">Acompanhe seu histórico financeiro e mensalidades.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black flex items-center gap-2">
            <History size={20} className="text-primary" /> Histórico de Mensalidades
          </h2>
          
          {payments?.map((payment) => (
            <Card key={payment.id} className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm group hover:shadow-xl transition-all overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-muted dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <FileText size={20} />
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-sm font-black text-foreground">Mensalidade - {format(new Date(payment.dueDate), "MMMM yyyy", { locale: ptBR })}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar size={12} /> Vencimento: {format(new Date(payment.dueDate), "dd/MM/yyyy")}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center sm:items-end gap-2">
                    <p className="text-lg font-black text-foreground">R$ {Number(payment.amount).toFixed(2)}</p>
                    <StatusBadge status={payment.status} />
                  </div>

                  {payment.status === 'pago' && (
                    <button className="p-3 rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                      <Download size={18} />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {payments?.length === 0 && (
            <div className="text-center py-20 bg-muted/50 bg-card/20 rounded-3xl border-2 border-dashed border-border border-border">
              <AlertCircle className="mx-auto text-muted-foreground mb-4 opacity-20" size={50} />
              <p className="text-muted-foreground font-bold">Nenhum registro de pagamento encontrado.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-gradient-to-br from-primary to-violet-600 text-white overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <DollarSign size={80} />
             </div>
             <CardContent className="p-8 relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total Investido</p>
                <p className="text-4xl font-black mb-1">R$ 1.250,00</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Desde o início do curso</p>
                
                <div className="mt-8 pt-6 border-t border-white/20">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold opacity-80">Mensalidade Atual</span>
                      <span className="text-sm font-black">R$ 250,00</span>
                   </div>
                   <button 
                     onClick={() => toast.info("Integração com gateway de pagamento em desenvolvimento.")}
                     className="w-full bg-card text-primary font-black text-xs uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all"
                   >
                      Pagar Agora
                   </button>
                </div>
             </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-card/50 bg-muted/50 backdrop-blur-xl">
             <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest">Informações</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                   <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><AlertCircle size={16} /></div>
                   <p className="text-xs font-medium text-muted-foreground">Os comprovantes ficam disponíveis para download após a confirmação do pagamento.</p>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><AlertCircle size={16} /></div>
                   <p className="text-xs font-medium text-muted-foreground">Em caso de dúvidas sobre valores ou vencimentos, entre em contato com o seu professor.</p>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
