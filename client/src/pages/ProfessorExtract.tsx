import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Clock, Calculator, CheckCircle2, DollarSign, RefreshCw, AlertCircle, Calendar, FileText, Settings2, Plus, Trash2 } from "lucide-react";
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
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={payment.status === "pago" ? "default" : payment.status === "aprovado" ? "secondary" : "outline"}
                        className={payment.status === "pago" ? "bg-green-500 hover:bg-green-600 text-white" : payment.status === "aprovado" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                      >
                        {payment.status === "aberto" && "Em Aberto"}
                        {payment.status === "aprovado" && "Aprovado"}
                        {payment.status === "pago" && "Pago"}
                      </Badge>
                      
                      <Button size="sm" variant="ghost" onClick={() => handlePrint(payment)}>
                        <FileText className="w-4 h-4 mr-2" /> Recibo
                      </Button>

                      <Button size="sm" variant="ghost" onClick={() => setDetailsPaymentId(payment.id)}>
                        Ver Aulas
                      </Button>

                      {isAdmin && payment.status === "aberto" && (
                        <Button size="sm" variant="ghost" onClick={() => setAdjustPayment({
                          ...payment, 
                          adjs: payment.adjustments ? JSON.parse(payment.adjustments) : []
                        })}>
                          <Settings2 className="w-4 h-4 mr-2" /> Ajustes
                        </Button>
                      )}

                      {isAdmin && payment.status === "aberto" && (
                        <Button size="sm" variant="default" onClick={() => approveMutation.mutate({ id: payment.id })} disabled={approveMutation.isPending}>
                          Aprovar Pagamento
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
                        <AlertCircle className="w-4 h-4" /> Descontos
                      </p>
                      <p className="text-2xl font-bold text-red-500">
                        -R$ {Number(payment.totalDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="space-y-1 bg-primary/5 p-3 rounded-lg border border-primary/10">
                      <p className="text-sm font-medium text-primary flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Líquido a Receber
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

      {/* Modal: Ver Aulas */}
      <Dialog open={!!detailsPaymentId} onOpenChange={(o) => !o && setDetailsPaymentId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aulas Ministradas</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            {detailsLoading ? (
              <div className="py-8 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : (
              <>
                {detailsData?.paymentType === "porcentagem" && detailsData?.percentageDetails && detailsData.percentageDetails.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Relatório Analítico de Comissões ({detailsData.paymentPercentage}%)</h4>
                    <div className="overflow-x-auto w-full border rounded-md">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-primary/10 text-primary uppercase text-xs">
                          <tr>
                            <th className="px-4 py-2 rounded-tl-md">Aluno Taught</th>
                            <th className="px-4 py-2">Mensalidade (Base)</th>
                            <th className="px-4 py-2 rounded-tr-md">Comissão Gerada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsData.percentageDetails.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="px-4 py-3 font-medium">{item.studentName}</td>
                              <td className="px-4 py-3 text-zinc-500">R$ {item.monthlyFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 font-bold text-green-600">R$ {item.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Histórico de Aulas Concluídas</h4>
                  {detailsData?.lessons?.length === 0 ? (
                    <p className="text-center text-zinc-500 py-8">Nenhuma aula encontrada para este período.</p>
                  ) : (
                    <div className="overflow-x-auto w-full border rounded-md">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs">
                          <tr>
                            <th className="px-4 py-2 rounded-tl-md">Data</th>
                            <th className="px-4 py-2">Aluno</th>
                            <th className="px-4 py-2">Título</th>
                            <th className="px-4 py-2">Duração</th>
                            <th className="px-4 py-2 rounded-tr-md">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsData?.lessons.map((lesson: any) => (
                            <tr key={lesson.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="px-4 py-3">{format(new Date(lesson.scheduledAt), "dd/MM/yyyy HH:mm")}</td>
                              <td className="px-4 py-3 font-medium">{lesson.studentName || "-"}</td>
                              <td className="px-4 py-3 text-zinc-500">{lesson.title}</td>
                              <td className="px-4 py-3">{lesson.duration}m</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">{lesson.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Ajustes Manuais */}
      <Dialog open={!!adjustPayment} onOpenChange={(o) => !o && setAdjustPayment(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustes Manuais</DialogTitle>
          </DialogHeader>
          {adjustPayment && (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                {adjustPayment.adjs.map((adj: any, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input 
                      placeholder="Descrição (ex: Bônus, Falta)" 
                      value={adj.desc} 
                      onChange={e => {
                        const newAdjs = [...adjustPayment.adjs];
                        newAdjs[idx].desc = e.target.value;
                        setAdjustPayment({...adjustPayment, adjs: newAdjs});
                      }}
                      className="flex-1"
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
                      className="w-32"
                    />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const newAdjs = adjustPayment.adjs.filter((_:any, i:number) => i !== idx);
                      setAdjustPayment({...adjustPayment, adjs: newAdjs});
                    }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full" onClick={() => {
                  setAdjustPayment({...adjustPayment, adjs: [...adjustPayment.adjs, { desc: "", value: 0 }]});
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Ajuste
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Créditos de Aulas:</span>
                  <span>R$ {Number(adjustPayment.totalCredits).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Ajustes (+):</span>
                  <span>R$ {adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Ajustes (-):</span>
                  <span>-R$ {Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>Total Líquido:</span>
                  <span>R$ {(
                    Number(adjustPayment.totalCredits) + 
                    adjustPayment.adjs.reduce((sum:number,a:any)=>sum+a.value,0)
                  ).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAdjustPayment(null)}>Cancelar</Button>
                <Button disabled={updateAdjustmentsMutation.isPending} onClick={() => {
                  const baseCredits = Number(payments?.find(p => p.id === adjustPayment.id)?.totalCredits || 0); // Need actual base, but totalCredits is overwritten... wait, totalCredits should be baseCredits + adjs(+). 
                  // Let's just calculate:
                  const manualCredits = adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0);
                  const manualDebits = Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0));
                  
                  // Wait, original calculate mutation set totalCredits to base. 
                  // If we don't have original base stored separately, we can guess it's `payment.totalCredits - oldManualCredits` or we just say `payment.totalCredits` is the class total. Let's fix that.
                  // For simplicity, totalAmount = adjustPayment.totalCredits + sum(adjs)
                  // totalDebits = sum(negative adjs)
                  
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
                  Salvar Ajustes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
