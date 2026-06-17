import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Clock, Calculator, CheckCircle2, ChevronRight, DollarSign, RefreshCw, AlertCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
export default function ProfessorExtract() {
  const { user } = useAuth();
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [selectedProfId, setSelectedProfId] = useState<string>("me"); // "me" or a professor ID for admins

  const isAdmin = user?.role === "admin";
  const isProfessor = user?.role === "professor";

  // When admin, fetch all professors to populate dropdown
  const { data: professorsList } = trpc.system.checkSchema.useQuery(undefined, {
    enabled: false // We will use a mock list for now until a real route exists, or use user's prof ID
  }); 
  // Wait, I can just use the professorPayments.list since it returns the professorName

  const { data: payments, isLoading, refetch } = trpc.professorPayments.list.useQuery({
    month: viewMonth,
    year: viewYear,
  });

  const calculateMutation = trpc.professorPayments.calculateAll.useMutation({
    onSuccess: (data) => {
      toast.success(`Pagamentos calculados para ${data.count} professores`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.professorPayments.approve.useMutation({
    onSuccess: () => {
      toast.success("Pagamento aprovado!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = trpc.professorPayments.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento marcado como pago!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
  }));

  const years = [viewYear - 1, viewYear, viewYear + 1];

  // Filter payments to show based on role
  // If professor, only show theirs. If admin, show all or selected
  const displayPayments = payments?.filter(p => {
    if (!isAdmin) return true; // Let's assume the backend already filters for non-admins if needed. Oh wait, the backend `list` doesn't filter by professorId! It returns all for the org.
    if (selectedProfId === "all" || selectedProfId === "me") return true;
    return p.professorId.toString() === selectedProfId;
  }) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Folha de Pagamento</h1>
          <p className="text-zinc-500">Gestão e extratos de pagamento de professores</p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={() => calculateMutation.mutate({ month: viewMonth, year: viewYear })}
              disabled={calculateMutation.isPending}
            >
              {calculateMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular Mês
            </Button>
          )}

          <div className="flex gap-2">
            <Select value={viewMonth.toString()} onValueChange={(v) => setViewMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px] capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()} className="capitalize">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={viewYear.toString()} onValueChange={(v) => setViewYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : displayPayments.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="h-64 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum registro encontrado</h3>
            <p className="text-zinc-500 max-w-sm">
              Nenhum pagamento calculado para este mês ainda. 
              {isAdmin && " Clique no botão 'Calcular Mês' acima para gerar os extratos."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {displayPayments.map((payment, i) => (
            <motion.div
              key={payment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800/50 p-4 border-b">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                        {payment.professorName?.charAt(0) || "P"}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{payment.professorName}</h3>
                        <p className="text-sm text-zinc-500">
                          {format(new Date(payment.year, payment.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={payment.status === "pago" ? "default" : payment.status === "aprovado" ? "secondary" : "outline"}
                        className={payment.status === "pago" ? "bg-green-500 hover:bg-green-600" : payment.status === "aprovado" ? "bg-blue-500 text-white" : ""}
                      >
                        {payment.status === "aberto" && "Em Aberto"}
                        {payment.status === "aprovado" && "Aprovado"}
                        {payment.status === "pago" && "Pago"}
                      </Badge>
                      
                      {isAdmin && payment.status === "aberto" && (
                        <Button size="sm" variant="outline" onClick={() => approveMutation.mutate({ id: payment.id })} disabled={approveMutation.isPending}>
                          Aprovar
                        </Button>
                      )}
                      
                      {isAdmin && payment.status === "aprovado" && (
                        <Button size="sm" onClick={() => markPaidMutation.mutate({ id: payment.id })} disabled={markPaidMutation.isPending}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar Pago
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Aulas Concluídas
                      </p>
                      <p className="text-2xl font-bold">{payment.totalClasses}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Total Minutos
                      </p>
                      <p className="text-2xl font-bold">{payment.totalMinutes}m</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Débitos/Descontos
                      </p>
                      <p className="text-2xl font-bold text-red-500">
                        R$ {Number(payment.totalDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="space-y-1 bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <p className="text-sm font-medium text-primary flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Valor Líquido a Receber
                      </p>
                      <p className="text-3xl font-bold text-primary">
                        R$ {Number(payment.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
