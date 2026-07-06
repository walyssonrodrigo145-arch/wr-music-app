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
    const adjustments: any[] = payment.adjustments ? JSON.parse(payment.adjustments) : [];
    const totalCredits = Number(payment.totalCredits).toFixed(2);
    const totalDebits = Number(payment.totalDebits).toFixed(2);
    const totalAmount = Number(payment.totalAmount).toFixed(2);
    const refDate = format(new Date(payment.year, payment.month - 1), "MMMM 'de' yyyy", { locale: ptBR });
    const emitDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const adjustRows = adjustments.map((adj: any) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">${adj.desc}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#16a34a;font-weight:700;">${adj.value > 0 ? 'R$ ' + Number(adj.value).toFixed(2) : '—'}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#dc2626;font-weight:700;">${adj.value < 0 ? 'R$ ' + Math.abs(adj.value).toFixed(2) : '—'}</td>
      </tr>
    `).join('');

    const printContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo — ${payment.professorName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{max-width:760px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08);}
    .header{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%);padding:36px 40px;display:flex;justify-content:space-between;align-items:center;}
    .header-title{color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;}
    .header-sub{color:#a5b4fc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-top:4px;}
    .badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 16px;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;}
    .body{padding:36px 40px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;}
    .info-block{background:#f8fafc;border-radius:10px;padding:16px;}
    .info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:4px;}
    .info-value{font-size:14px;font-weight:700;color:#0f172a;}
    table{width:100%;border-collapse:collapse;margin-bottom:24px;}
    thead tr{background:#f1f5f9;}
    th{padding:12px 16px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;}
    th:not(:first-child){text-align:right;}
    td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;}
    .total-row td{background:#f8fafc;font-weight:700;font-size:13px;}
    .net-row td{background:linear-gradient(90deg,#1e1b4b,#312e81);color:#fff;font-weight:900;font-size:15px;padding:16px;}
    .net-row td:last-child{text-align:right;}
    .signature{margin-top:48px;display:flex;justify-content:center;}
    .sig-block{text-align:center;}
    .sig-line{width:280px;border-top:2px solid #1e1b4b;margin-bottom:8px;}
    .sig-name{font-weight:700;font-size:14px;}
    .sig-label{font-size:11px;color:#94a3b8;margin-top:2px;}
    .footer{background:#f8fafc;padding:16px 40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;}
    @media print{body{background:#fff;}.page{box-shadow:none;border-radius:0;margin:0;max-width:100%;}}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-title">🎵 MusicPro</div>
        <div class="header-sub">Recibo de Pagamento — Professores</div>
      </div>
      <div class="badge">${payment.status?.toUpperCase() || 'CALCULADO'}</div>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Professor</div>
          <div class="info-value">${payment.professorName}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Referência</div>
          <div class="info-value">${refDate.charAt(0).toUpperCase() + refDate.slice(1)}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Total de Aulas</div>
          <div class="info-value">${payment.totalClasses} aulas / ${payment.totalMinutes} min</div>
        </div>
        <div class="info-block">
          <div class="info-label">Data de Emissão</div>
          <div class="info-value">${emitDate.charAt(0).toUpperCase() + emitDate.slice(1)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Proventos (+)</th>
            <th>Descontos (−)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valor base das aulas concluídas</td>
            <td style="text-align:right;color:#16a34a;font-weight:700;">R$ ${totalCredits}</td>
            <td style="text-align:right;">—</td>
          </tr>
          ${adjustRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="1"><strong>Totais</strong></td>
            <td style="text-align:right;color:#16a34a;"><strong>R$ ${totalCredits}</strong></td>
            <td style="text-align:right;color:#dc2626;"><strong>R$ ${totalDebits}</strong></td>
          </tr>
          <tr class="net-row">
            <td colspan="2"><strong>💰 VALOR LÍQUIDO A RECEBER</strong></td>
            <td><strong>R$ ${totalAmount}</strong></td>
          </tr>
        </tfoot>
      </table>
      <div class="signature">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">${payment.professorName}</div>
          <div class="sig-label">Assinatura do Recebedor</div>
        </div>
      </div>
    </div>
    <div class="footer">Documento gerado automaticamente pelo MusicPro • ${emitDate}</div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 600);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="font-outfit text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Folha de Pagamento
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Gestão e extratos de pagamento de professores</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto bg-card/50 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-xl shadow-primary/5">
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={viewMonth.toString()} onValueChange={(v) => setViewMonth(parseInt(v))}>
              <SelectTrigger className="w-full sm:w-[150px] capitalize bg-background border-white/5 font-semibold rounded-xl h-11">
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
              <SelectTrigger className="w-[110px] bg-background border-white/5 font-semibold rounded-xl h-11">
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
          
          {isAdmin && (
            <Button 
              className="hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 w-full sm:w-auto rounded-xl font-bold h-11"
              onClick={() => calculateMutation.mutate({ month: viewMonth, year: viewYear })}
              disabled={calculateMutation.isPending}
            >
              {calculateMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular Mês
            </Button>
          )}
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
              {/* Card Header Premium - Holerite */}
              <div className="bg-gradient-to-r from-muted/50 via-transparent to-transparent p-6 md:p-8 border-b border-border/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-outfit font-black text-3xl shadow-xl shadow-indigo-500/30 ring-4 ring-background shrink-0">
                      {payment.professorName?.charAt(0) || "P"}
                    </div>
                    <div>
                      <h3 className="font-outfit text-2xl md:text-3xl font-black text-foreground tracking-tight">{payment.professorName}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">
                          Referência: {format(new Date(payment.year, payment.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Badge variant={payment.status === "pago" ? "default" : payment.status === "aprovado" ? "secondary" : "outline"}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl ${
                      payment.status === "pago" ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" : 
                      payment.status === "aprovado" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : 
                      "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {payment.status === "aberto" && "Status: Em Aberto"}
                    {payment.status === "aprovado" && "Status: Aprovado"}
                    {payment.status === "pago" && "Status: Pago"}
                  </Badge>
                </div>
              </div>
              
              {/* Card Body - 2 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                {/* Atividades */}
                <div className="p-6 md:p-8 space-y-6 bg-card/30">
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Resumo de Atividades
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Aulas Concluídas</p>
                      <p className="font-outfit text-3xl font-bold text-foreground">{payment.totalClasses}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Tempo Total</p>
                      <p className="font-outfit text-3xl font-bold text-foreground">{payment.totalMinutes}<span className="text-lg text-muted-foreground font-medium ml-1">min</span></p>
                    </div>
                  </div>
                </div>

                {/* Financeiro */}
                <div className="p-6 md:p-8 space-y-6 bg-muted/10">
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Resumo Financeiro
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-border/50 pb-4">
                      <p className="text-sm font-semibold text-muted-foreground">Proventos Brutos</p>
                      <p className="font-outfit text-xl font-bold text-foreground">
                        R$ {Number(payment.totalCredits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex justify-between items-end border-b border-border/50 pb-4">
                      <p className="text-sm font-semibold text-red-500/80">Descontos</p>
                      <p className="font-outfit text-xl font-bold text-red-500">
                        - R$ {Number(payment.totalDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-end pt-2">
                      <p className="text-sm font-black text-primary uppercase tracking-wider">Líquido a Receber</p>
                      <p className="font-outfit text-4xl md:text-5xl font-black text-primary drop-shadow-sm">
                        <span className="text-2xl mr-1 text-primary/80">R$</span>{Number(payment.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-muted/30 p-4 md:p-6 border-t border-border/50 flex flex-wrap items-center justify-end gap-3">
                <Button size="sm" variant="outline" className="h-10 rounded-xl font-semibold bg-background hover:bg-muted" onClick={() => handlePrint(payment)}>
                  <FileText className="w-4 h-4 mr-2 text-muted-foreground" /> Recibo
                </Button>

                <Button size="sm" variant="outline" className="h-10 rounded-xl font-semibold bg-background hover:bg-muted" onClick={() => setDetailsPaymentId(payment.id)}>
                  <Clock className="w-4 h-4 mr-2 text-muted-foreground" /> Ver Aulas
                </Button>

                {isAdmin && payment.status === "aberto" && (
                  <Button size="sm" variant="outline" className="h-10 rounded-xl font-semibold bg-background hover:bg-muted" onClick={() => setAdjustPayment({
                    ...payment, 
                    adjs: payment.adjustments ? JSON.parse(payment.adjustments) : []
                  })}>
                    <Settings2 className="w-4 h-4 mr-2 text-muted-foreground" /> Ajustes
                  </Button>
                )}

                {isAdmin && payment.status === "aberto" && (
                  <Button size="sm" className="h-10 rounded-xl font-bold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all" onClick={() => approveMutation.mutate({ id: payment.id })} disabled={approveMutation.isPending}>
                    Aprovar Pagamento
                  </Button>
                )}
                
                {isAdmin && payment.status === "aprovado" && (
                  <Button size="sm" className="h-10 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 hover:-translate-y-0.5 transition-all" onClick={() => markPaidMutation.mutate({ id: payment.id })} disabled={markPaidMutation.isPending}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Pago
                  </Button>
                )}
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
