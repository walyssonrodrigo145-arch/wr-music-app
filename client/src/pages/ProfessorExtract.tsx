import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Clock, Calculator, CheckCircle2, DollarSign, RefreshCw, AlertCircle, Calendar, FileText, Settings2, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfessorExtract() {
  const { user } = useAuth();
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [selectedProfId, setSelectedProfId] = useState<string>("me");

  // Modals state
  const [detailsPaymentId, setDetailsPaymentId] = useState<number | null>(null);
  const [adjustPayment, setAdjustPayment] = useState<any | null>(null);

  // Print state
  const printRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";
  const isProfessor = user?.role === "professor";

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

  const updateAdjustmentsMutation = trpc.professorPayments.updateAdjustments.useMutation({
    onSuccess: () => {
      toast.success("Ajustes salvos com sucesso!");
      setAdjustPayment(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: detailsData, isLoading: detailsLoading } = trpc.professorPayments.getDetails.useQuery(
    { paymentId: detailsPaymentId! },
    { enabled: !!detailsPaymentId }
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
  }));

  const years = [viewYear - 1, viewYear, viewYear + 1];

  const displayPayments = payments?.filter(p => {
    if (!isAdmin) return true;
    if (selectedProfId === "all" || selectedProfId === "me") return true;
    return p.professorId.toString() === selectedProfId;
  }) || [];

  const handlePrint = (payment: any) => {
    // A simple window.print approach
    const printContent = `
      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #000;">
        <div style="text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 24px;">RECIBO DE PAGAMENTO</h1>
          <p style="margin: 5px 0; color: #666;">Folha Mensal de Professores</p>
        </div>
        
        <table style="width: 100%; margin-bottom: 30px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0;"><strong>Professor:</strong> ${payment.professorName}</td>
            <td style="padding: 8px 0; text-align: right;"><strong>Referência:</strong> ${format(new Date(payment.year, payment.month - 1), "MM/yyyy")}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Status:</strong> ${payment.status.toUpperCase()}</td>
            <td style="padding: 8px 0; text-align: right;"><strong>Data de Emissão:</strong> ${format(new Date(), "dd/MM/yyyy")}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Descrição</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Proventos (+)</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Descontos (-)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;">Total de Aulas (${payment.totalClasses} concluídas / ${payment.totalMinutes} min)</td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">R$ ${Number(payment.totalCredits).toFixed(2)}</td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">-</td>
            </tr>
            ${(payment.adjustments ? JSON.parse(payment.adjustments) : []).map((adj: any) => `
              <tr>
                <td style="padding: 12px; border: 1px solid #ddd;">${adj.desc}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${adj.value > 0 ? 'R$ ' + Number(adj.value).toFixed(2) : '-'}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${adj.value < 0 ? 'R$ ' + Math.abs(adj.value).toFixed(2) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;"><strong>TOTAIS</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;"><strong>R$ ${Number(payment.totalCredits).toFixed(2)}</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;"><strong>R$ ${Number(payment.totalDebits).toFixed(2)}</strong></td>
            </tr>
            <tr style="background: #f8f9fa; font-size: 16px;">
              <td colspan="2" style="padding: 15px; border: 1px solid #ddd; text-align: right;"><strong>VALOR LÍQUIDO A RECEBER</strong></td>
              <td style="padding: 15px; border: 1px solid #ddd; text-align: right;"><strong>R$ ${Number(payment.totalAmount).toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 80px; text-align: center;">
          <div style="border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 10px;">
            ${payment.professorName}
          </div>
          <p style="margin-top: 5px; color: #666; font-size: 12px;">Assinatura do Recebedor</p>
        </div>
      </div>
    `;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl shadow-primary/5"
      >
        <div>
          <h1 className="font-outfit text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Folha de Pagamento
          </h1>
          <p className="text-zinc-500 mt-1">Gestão e extratos de pagamento de professores</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {isAdmin && (
            <Button 
              variant="outline" 
              className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300 w-full sm:w-auto"
              onClick={() => calculateMutation.mutate({ month: viewMonth, year: viewYear })}
              disabled={calculateMutation.isPending}
            >
              {calculateMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular Mês
            </Button>
          )}

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={viewMonth.toString()} onValueChange={(v) => setViewMonth(parseInt(v))}>
              <SelectTrigger className="w-full sm:w-[150px] capitalize bg-background/50 backdrop-blur-sm">
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
              <SelectTrigger className="w-[110px] bg-background/50 backdrop-blur-sm">
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
      </motion.div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
        </div>
      ) : displayPayments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/30 backdrop-blur-sm border-dashed border-2 border-primary/20 rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        >
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Calendar className="w-10 h-10" />
          </div>
          <h3 className="font-outfit text-2xl font-semibold mb-2">Nenhum registro encontrado</h3>
          <p className="text-zinc-500 max-w-md text-lg">
            Nenhum pagamento calculado para este mês ainda. 
            {isAdmin && " Clique no botão 'Calcular Mês' acima para gerar os extratos."}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {displayPayments.map((payment, i) => (
            <motion.div
              key={payment.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-primary/5 hover:shadow-primary/10 transition-all duration-300"
            >
              {/* Card Header Premium */}
              <div className="bg-gradient-to-r from-primary/5 via-transparent to-transparent dark:from-primary/10 p-6 border-b border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center font-outfit font-bold text-2xl shadow-lg shadow-primary/30">
                      {payment.professorName?.charAt(0) || "P"}
                    </div>
                    <div>
                      <h3 className="font-outfit text-2xl font-bold text-foreground">{payment.professorName}</h3>
                      <p className="text-sm text-zinc-500 font-medium mt-1">
                        {format(new Date(payment.year, payment.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={payment.status === "pago" ? "default" : payment.status === "aprovado" ? "secondary" : "outline"}
                      className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                        payment.status === "pago" ? "bg-green-500 hover:bg-green-600 text-white border-none shadow-md shadow-green-500/20" : 
                        payment.status === "aprovado" ? "bg-blue-500 hover:bg-blue-600 text-white border-none shadow-md shadow-blue-500/20" : 
                        "bg-background/50 backdrop-blur-md"
                      }`}
                    >
                      {payment.status === "aberto" && "Em Aberto"}
                      {payment.status === "aprovado" && "Aprovado"}
                      {payment.status === "pago" && "Pago"}
                    </Badge>
                    
                    <Button size="sm" variant="outline" className="bg-background/50 hover:bg-background/80 hover:-translate-y-0.5 transition-transform" onClick={() => handlePrint(payment)}>
                      <FileText className="w-4 h-4 mr-2 text-primary" /> Recibo
                    </Button>

                    <Button size="sm" variant="outline" className="bg-background/50 hover:bg-background/80 hover:-translate-y-0.5 transition-transform" onClick={() => setDetailsPaymentId(payment.id)}>
                      Ver Aulas
                    </Button>

                    {isAdmin && payment.status === "aberto" && (
                      <Button size="sm" variant="outline" className="bg-background/50 hover:bg-background/80 hover:-translate-y-0.5 transition-transform" onClick={() => setAdjustPayment({
                        ...payment, 
                        adjs: payment.adjustments ? JSON.parse(payment.adjustments) : []
                      })}>
                        <Settings2 className="w-4 h-4 mr-2" /> Ajustes
                      </Button>
                    )}

                    {isAdmin && payment.status === "aberto" && (
                      <Button size="sm" className="hover:-translate-y-0.5 shadow-lg shadow-primary/20 transition-transform" onClick={() => approveMutation.mutate({ id: payment.id })} disabled={approveMutation.isPending}>
                        Aprovar
                      </Button>
                    )}
                    
                    {isAdmin && payment.status === "aprovado" && (
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 shadow-lg shadow-green-500/20 transition-transform" onClick={() => markPaidMutation.mutate({ id: payment.id })} disabled={markPaidMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Pagar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                  <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/30">
                    <p className="text-sm font-semibold text-zinc-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" /> Aulas Concluídas
                    </p>
                    <p className="font-outfit text-3xl font-bold text-foreground">{payment.totalClasses}</p>
                  </div>
                  
                  <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/30">
                    <p className="text-sm font-semibold text-zinc-500 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" /> Total Minutos
                    </p>
                    <p className="font-outfit text-3xl font-bold text-foreground">{payment.totalMinutes}m</p>
                  </div>
                  
                  <div className="space-y-2 p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <p className="text-sm font-semibold text-red-500/80 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Descontos
                    </p>
                    <p className="font-outfit text-3xl font-bold text-red-500">
                      -R$ {Number(payment.totalDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="space-y-2 bg-primary/10 p-5 rounded-2xl border border-primary/20 shadow-inner">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2 uppercase tracking-wide">
                      <DollarSign className="w-4 h-4" /> Líquido a Receber
                    </p>
                    <p className="font-outfit text-4xl font-black text-primary drop-shadow-sm">
                      R$ {Number(payment.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal: Ver Aulas */}
      <Dialog open={!!detailsPaymentId} onOpenChange={(o) => !o && setDetailsPaymentId(null)}>
        <DialogContent className="w-[95vw] sm:w-[95vw] md:w-full sm:max-w-5xl max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader className="flex flex-row items-center justify-between mt-4">
            <DialogTitle className="font-outfit text-2xl text-primary">Aulas Ministradas</DialogTitle>
            <Button 
              variant="outline" 
              className="hidden sm:flex gap-2 items-center" 
              onClick={() => {
                if (!detailsData) return;
                // Add BOM for Excel UTF-8 support
                let csv = "data:text/csv;charset=utf-8,\uFEFF";
                
                if (detailsData.paymentType === "porcentagem" && detailsData.percentageDetails) {
                  csv += "Relatório Analítico de Comissões\nAluno;Mensalidade Base;Comissão Gerada\n";
                  detailsData.percentageDetails.forEach((i: any) => {
                    csv += `"${i.studentName}";"R$ ${i.monthlyFee}";"R$ ${i.commission}"\n`;
                  });
                  csv += "\n\n";
                }
                
                csv += "Histórico de Aulas Concluídas\nData;Aluno;Título;Duração;Status\n";
                if (detailsData.lessons) {
                  detailsData.lessons.forEach((l: any) => {
                    const date = format(new Date(l.scheduledAt), "dd/MM/yyyy HH:mm");
                    csv += `"${date}";"${l.studentName || '-'}";"${l.title}";"${l.duration}m";"${l.status}"\n`;
                  });
                }
                
                const link = document.createElement("a");
                link.href = encodeURI(csv);
                link.download = "relatorio_aulas.csv";
                document.body.appendChild(link);
                link.click();
                link.remove();
              }}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </DialogHeader>
          <div className="mt-6 space-y-8">
            {detailsLoading ? (
              <div className="py-12 flex justify-center"><RefreshCw className="w-8 h-8 text-primary animate-spin" /></div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                {detailsData?.paymentType === "porcentagem" && detailsData?.percentageDetails && detailsData.percentageDetails.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-outfit font-semibold text-lg flex items-center gap-2 text-foreground">
                      <div className="w-2 h-6 bg-primary rounded-full"></div>
                      Relatório Analítico de Comissões ({detailsData.paymentPercentage}%)
                    </h4>
                    <div className="overflow-hidden w-full border border-border/50 rounded-xl shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-primary/5 text-primary text-xs font-semibold tracking-wider uppercase">
                          <tr>
                            <th className="px-5 py-4">Aluno Taught</th>
                            <th className="px-5 py-4">Mensalidade (Base)</th>
                            <th className="px-5 py-4">Comissão Gerada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 bg-background/50">
                          {detailsData.percentageDetails.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-primary/5 transition-colors">
                              <td className="px-5 py-4 font-medium text-foreground">{item.studentName}</td>
                              <td className="px-5 py-4 text-zinc-500">R$ {item.monthlyFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-5 py-4 font-bold text-green-600">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h4 className="font-outfit font-semibold text-lg flex items-center gap-2 text-foreground">
                    <div className="w-2 h-6 bg-zinc-400 rounded-full"></div>
                    Histórico de Aulas Concluídas
                  </h4>
                  {detailsData?.lessons?.length === 0 ? (
                    <div className="bg-muted/30 rounded-xl p-8 text-center text-zinc-500 border border-dashed border-border">
                      Nenhuma aula encontrada para este período.
                    </div>
                  ) : (
                    <div className="overflow-hidden w-full border border-border/50 rounded-xl shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          <tr>
                            <th className="px-5 py-4">Data</th>
                            <th className="px-5 py-4">Aluno</th>
                            <th className="px-5 py-4">Título</th>
                            <th className="px-5 py-4">Duração</th>
                            <th className="px-5 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 bg-background/50">
                          {detailsData?.lessons.map((lesson: any) => (
                            <tr key={lesson.id} className="hover:bg-muted transition-colors">
                              <td className="px-5 py-4 font-medium text-zinc-600 dark:text-zinc-400">{format(new Date(lesson.scheduledAt), "dd/MM/yyyy HH:mm")}</td>
                              <td className="px-5 py-4 font-semibold text-foreground">{lesson.studentName || "-"}</td>
                              <td className="px-5 py-4 text-zinc-500">{lesson.title}</td>
                              <td className="px-5 py-4 font-medium">{lesson.duration}m</td>
                              <td className="px-5 py-4">
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">{lesson.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Ajustes Manuais */}
      <Dialog open={!!adjustPayment} onOpenChange={(o) => !o && setAdjustPayment(null)}>
        <DialogContent className="w-[95vw] sm:w-full max-w-xl rounded-2xl bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-outfit text-2xl text-foreground">Ajustes Manuais</DialogTitle>
          </DialogHeader>
          {adjustPayment && (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                {adjustPayment.adjs.map((adj: any, idx: number) => (
                  <div key={idx} className="flex gap-3 items-center bg-muted/20 p-2 rounded-xl border border-border/30">
                    <Input 
                      placeholder="Descrição (ex: Bônus, Falta)" 
                      value={adj.desc} 
                      onChange={e => {
                        const newAdjs = [...adjustPayment.adjs];
                        newAdjs[idx].desc = e.target.value;
                        setAdjustPayment({...adjustPayment, adjs: newAdjs});
                      }}
                      className="flex-1 bg-background/50"
                    />
                    <Input 
                      type="number" 
                      placeholder="Valor (R$)" 
                      value={adj.value} 
                      onChange={e => {
                        const newAdjs = [...adjustPayment.adjs];
                        newAdjs[idx].value = parseFloat(e.target.value) || 0;
                        setAdjustPayment({...adjustPayment, adjs: newAdjs});
                      }}
                      className="w-32 bg-background/50 font-outfit"
                    />
                    <Button variant="ghost" size="icon" className="hover:bg-red-500/10 hover:text-red-500 rounded-lg" onClick={() => {
                      const newAdjs = adjustPayment.adjs.filter((_:any, i:number) => i !== idx);
                      setAdjustPayment({...adjustPayment, adjs: newAdjs});
                    }}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full border-dashed border-2 hover:bg-primary/5 hover:text-primary transition-colors py-6 rounded-xl" onClick={() => {
                  setAdjustPayment({...adjustPayment, adjs: [...adjustPayment.adjs, { desc: "", value: 0 }]});
                }}>
                  <Plus className="w-5 h-5 mr-2" /> Adicionar Novo Ajuste
                </Button>
              </div>

              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-3 text-sm">
                <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Créditos Base:</span>
                  <span className="font-outfit text-base">R$ {Number(adjustPayment.totalCredits).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-green-600">
                  <span className="font-medium">Ajustes (+):</span>
                  <span className="font-outfit text-base">+ R$ {adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span className="font-medium">Ajustes (-):</span>
                  <span className="font-outfit text-base">- R$ {Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold border-t border-primary/20 pt-4 mt-2">
                  <span className="text-foreground text-base">Total Líquido:</span>
                  <span className="font-outfit text-2xl text-primary">R$ {(
                    Number(adjustPayment.totalCredits) + 
                    adjustPayment.adjs.reduce((sum:number,a:any)=>sum+a.value,0)
                  ).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => setAdjustPayment(null)}>Cancelar</Button>
                <Button className="rounded-xl shadow-lg shadow-primary/20" disabled={updateAdjustmentsMutation.isPending} onClick={() => {
                  const manualCredits = adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0);
                  const manualDebits = Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0));
                  
                  const totalAmount = Number(adjustPayment.totalCredits) + adjustPayment.adjs.reduce((sum:number,a:any)=>sum+a.value, 0);

                  updateAdjustmentsMutation.mutate({
                    paymentId: adjustPayment.id,
                    adjustments: JSON.stringify(adjustPayment.adjs),
                    totalAmount: totalAmount,
                    totalCredits: Number(adjustPayment.totalCredits) + manualCredits,
                    totalDebits: manualDebits
                  });
                }}>
                  {updateAdjustmentsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
